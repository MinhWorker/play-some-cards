/**
 * The game's logic, on the server. A player's event (or a timer) runs its hook, which gets the
 * whole room in `ctx` and returns the next state; everyone's screen then gets what `view` lets
 * them see (scenes/BaiCaoView.ts).
 *
 *   bet          before the deal: how much you bet against the dealer this round
 *   reveal       after the deal: turn your three cards over for everyone
 *   bet-over     (timer) betting time is up: whoever didn't bet bets the least
 *   reveal-over  (timer) time is up: every hand is turned over
 *   next-round   (timer) after the count: the next dealer, or the end of the game
 *
 * Counting: each player's hand against the dealer's (cards.ts); the stronger wins the bet, twice
 * the bet with Ba Tây.
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type Seat,
  type StartContext,
  shuffle,
} from '@xomdao/sdk';
import { z } from 'zod';
import { compareHands, fullDeck, handOf } from './cards.js';
import {
  BETS,
  DEFAULT_BET,
  type Options,
  type Result,
  type State,
  TIMES,
  type View,
} from './model.js';

const bet = z.object({ amount: z.number().int() });
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class BaiCaoGame extends Game<State, Options, View> {
  events = { bet, reveal: none };

  /** A new game: the first seat deals first; everyone at 0 points. */
  onStart(ctx: StartContext<Options>): State {
    const seats = ctx.players.length;
    const state: State = {
      round: 1,
      rounds: ctx.options.rounds,
      phase: 'bet',
      dealer: 0,
      points: Array(seats).fill(0),
      bets: Array(seats).fill(null),
      hands: Array.from({ length: seats }, () => []),
      revealed: Array(seats).fill(false),
      gone: [],
      results: null,
    };
    ctx.setTimer(TIMES.bet, 'bet-over');
    return state;
  }

  /** A player bets against the dealer; once everyone has, the cards are dealt. */
  onBet(ctx: Ctx<z.infer<typeof bet>>): State {
    const { state, reject } = ctx;
    const seat = ctx.player.seat;
    if (state.phase !== 'bet') reject('Đã hết lúc đặt cược');
    if (seat === state.dealer) reject('Nhà cái không đặt cược');
    if (state.bets[seat] !== null) reject('Bạn đã đặt cược');
    if (!(BETS as readonly number[]).includes(ctx.payload.amount)) reject('Mức cược không hợp lệ');
    const next = {
      ...state,
      bets: state.bets.map((b, s) => (s === seat ? ctx.payload.amount : b)),
    };
    return punters(next).every((s) => next.bets[s] !== null) ? deal(ctx, next) : next;
  }

  /** Betting time is up: whoever didn't bet bets the least, and the cards are dealt. */
  onBetOver(ctx: GameContext<State, Options>): State {
    const { state } = ctx;
    if (state.phase !== 'bet') return state;
    return deal(ctx, {
      ...state,
      bets: state.bets.map((b, s) => (isPunter(state, s) ? (b ?? DEFAULT_BET) : null)),
    });
  }

  /** A player turns their cards over; once everyone has, the round is counted. */
  onReveal(ctx: Ctx): State {
    const { state, reject } = ctx;
    const seat = ctx.player.seat;
    if (state.phase !== 'reveal') reject('Chưa chia bài');
    if (state.revealed[seat]) reject('Bạn đã lật bài');
    const next = { ...state, revealed: state.revealed.map((r, s) => r || s === seat) };
    return active(next).every((s) => next.revealed[s]) ? showdown(ctx, next) : next;
  }

  /** Time is up: every hand is turned over and counted. */
  onRevealOver(ctx: GameContext<State, Options>): State {
    return ctx.state.phase === 'reveal' ? showdown(ctx, ctx.state) : ctx.state;
  }

  /** After the count: the next round with the next dealer, or the end of the game. */
  onNextRound(ctx: GameContext<State, Options>): State {
    const { state } = ctx;
    if (state.round >= state.rounds) return finish(ctx, state);
    const seats = state.points.length;
    let dealer = (state.dealer + 1) % seats;
    while (state.gone.includes(dealer)) dealer = (dealer + 1) % seats;
    ctx.setTimer(TIMES.bet, 'bet-over');
    return {
      ...state,
      round: state.round + 1,
      phase: 'bet',
      dealer,
      bets: state.bets.map(() => null),
      hands: state.hands.map(() => []),
      revealed: state.revealed.map(() => false),
      results: null,
    };
  }

  /**
   * Someone left: they sit out from now on (their bet this round is called off). Fewer than two
   * left ends the game; the dealer leaving calls the round off.
   */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const seat = ctx.player.seat;
    const state: State = {
      ...ctx.state,
      gone: [...ctx.state.gone, seat],
      bets: ctx.state.bets.map((b, s) => (s === seat ? null : b)),
      hands: ctx.state.hands.map((h, s) => (s === seat ? [] : h)),
    };
    if (active(state).length < 2) return finish(ctx, state);
    if (state.phase === 'showdown') return state;
    if (seat === state.dealer) {
      ctx.setTimer(TIMES.showdown, 'next-round');
      return { ...state, phase: 'showdown', results: null };
    }
    if (state.phase === 'bet' && punters(state).every((s) => state.bets[s] !== null)) {
      return deal(ctx, state);
    }
    if (state.phase === 'reveal' && active(state).every((s) => state.revealed[s])) {
      return showdown(ctx, state);
    }
    return state;
  }

  /** The computer bets 5, 10 or 20 (mostly 10) and turns its cards over as soon as it can. */
  bot({ state, player, rng }: BotContext<State, Options>) {
    const seat = player.seat;
    if (state.gone.includes(seat)) return null;
    if (state.phase === 'bet' && isPunter(state, seat) && state.bets[seat] === null) {
      const roll = rng();
      return { event: 'bet', payload: { amount: roll < 0.25 ? 5 : roll < 0.8 ? 10 : 20 } };
    }
    if (state.phase === 'reveal' && !state.revealed[seat]) return { event: 'reveal' };
    return null;
  }

  /** Your own cards, and the others' once turned over (all of them at the count). */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    return {
      ...state,
      hands: state.hands.map((hand, s) =>
        s === viewer?.seat || state.revealed[s] || state.phase === 'showdown'
          ? hand
          : hand.length
            ? null
            : [],
      ),
    };
  }
}

/** Seats still at the table. */
function active(state: State): number[] {
  return state.points.map((_, s) => s).filter((s) => !state.gone.includes(s));
}

const isPunter = (state: State, seat: number) =>
  seat !== state.dealer && !state.gone.includes(seat);
/** The players betting against the dealer this round. */
const punters = (state: State) => active(state).filter((s) => s !== state.dealer);

/** Three cards to everyone at the table, from a shuffled deck. */
function deal(ctx: GameContext<State, Options>, state: State): State {
  const deck = shuffle(ctx.rng, fullDeck());
  const hands = state.hands.map((_, s) => (state.gone.includes(s) ? [] : deck.splice(0, 3)));
  ctx.setTimer(TIMES.reveal, 'reveal-over');
  return { ...state, phase: 'reveal', hands, revealed: state.revealed.map(() => false) };
}

/** Every hand against the dealer's: the stronger wins the bet (twice with Ba Tây). */
function showdown(ctx: GameContext<State, Options>, state: State): State {
  const dealer = handOf(state.hands[state.dealer] ?? []);
  const results: Result[] = [];
  let dealerDelta = 0;
  for (const seat of punters(state)) {
    const hand = handOf(state.hands[seat] ?? []);
    const stake = state.bets[seat] ?? DEFAULT_BET;
    const won = compareHands(hand, dealer) > 0;
    const delta = (won ? 1 : -1) * stake * ((won ? hand : dealer).tay ? 2 : 1);
    results.push({ seat, delta });
    dealerDelta -= delta;
  }
  results.push({ seat: state.dealer, delta: dealerDelta });
  const points = state.points.map((p, s) => p + (results.find((r) => r.seat === s)?.delta ?? 0));
  ctx.setTimer(TIMES.showdown, 'next-round');
  return {
    ...state,
    phase: 'showdown',
    points,
    results,
    revealed: state.revealed.map((r, s) => r || !state.gone.includes(s)),
  };
}

/** The game is over: the most points win (everyone level is a draw). */
function finish(ctx: GameContext<State, Options>, state: State): State {
  const seats = active(state);
  const best = Math.max(...seats.map((s) => state.points[s] ?? 0));
  const top = seats.filter((s) => state.points[s] === best);
  const winners = top.length === seats.length && seats.length > 1 ? [] : top;
  ctx.finish(winners.map((s) => ctx.players[s]?.id ?? ''));
  return state;
}
