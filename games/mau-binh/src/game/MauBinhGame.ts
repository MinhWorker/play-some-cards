/**
 * Mậu Binh, on the server: a match of several rounds. Everyone arranges their 13 cards at the
 * same time and sends `submit` (their rows, kept secret from the others) or `cancel` to arrange
 * again. When everyone is done, or time runs out, all rows are shown and scored (scoring.ts).
 *
 * Timers drive the pace: `begin` after the deal and the round's announcement, `arrange-over`
 * when time to arrange is up, then `next-round` (or `finish` after the last round) once the
 * reveal and the scores have been on screen.
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
} from '@psc/sdk';
import { z } from 'zod';
import { bestRows } from './arrange.js';
import { fullDeck, isArrangementOf, type Rows } from './cards.js';
import { winners } from './match.js';
import {
  dealMs,
  INTRO_MS,
  type Options,
  ROUND_OVER_MS,
  type RoundResult,
  revealMs,
  type State,
  type View,
} from './model.js';
import { entryOf, scoreRound } from './scoring.js';

const card = z.number().int().min(0).max(51);
const submit = z.object({
  rows: z.tuple([z.array(card).length(5), z.array(card).length(5), z.array(card).length(3)]),
});

type Ctx = GameContext<State, Options>;

export class MauBinhGame extends Game<State, Options, View> {
  events = { submit, cancel: z.object({}) };
  /** The rows someone hands in stay hidden until everyone's are shown. */
  override secretEvents = ['submit'];

  /** The match begins: the first deal. */
  onStart(ctx: StartContext<Options>): State {
    const n = ctx.players.length;
    const empty: State = {
      round: 0,
      rounds: ctx.options.rounds,
      phase: 'deal',
      hands: [],
      inRound: [],
      rows: [],
      forfeits: [],
      gone: [],
      points: Array(n).fill(0),
      results: [],
    };
    return deal({ ...ctx, state: empty } as Ctx, empty);
  }

  /** The deal and the announcement are over: arrange, against the clock. */
  onBegin(ctx: Ctx): State {
    ctx.setTimer(ctx.options.arrangeSeconds * 1000, 'arrange-over');
    return revealIfDone(ctx, { ...ctx.state, phase: 'arrange' });
  }

  /** "Xong": these rows are final, unless cancelled before everyone is done. */
  onSubmit(ctx: EventContext<State, z.infer<typeof submit>, Options>): State {
    const { state, player, payload, reject } = ctx;
    if (state.phase !== 'arrange') reject('Chưa tới lúc xếp bài');
    if (!isArranging(state, player.seat)) reject('Bạn không có bài trong vòng này');
    const rows = payload.rows as Rows;
    if (!isArrangementOf(rows, state.hands[player.seat] ?? [])) reject('Bài xếp không đúng');
    const next = { ...state, rows: state.rows.map((r, s) => (s === player.seat ? rows : r)) };
    return revealIfDone(ctx, next);
  }

  /** "Xếp lại": back to arranging (only while someone is still arranging). */
  onCancel(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'arrange') reject('Đã lật bài');
    if (!state.rows[player.seat]) reject('Bạn chưa xếp xong');
    return { ...state, rows: state.rows.map((r, s) => (s === player.seat ? null : r)) };
  }

  /** Time's up: whoever is still arranging gets the computer's rows. */
  onArrangeOver(ctx: Ctx): State {
    return ctx.state.phase === 'arrange' ? reveal(ctx, ctx.state) : ctx.state;
  }

  /** The scores were shown: deal the next round. */
  onNextRound(ctx: Ctx): State {
    if (stayed(ctx, ctx.state) < 2) return finish(ctx, ctx.state);
    return deal(ctx, ctx.state);
  }

  /** The last round's scores were shown: the match is over. */
  onFinish(ctx: Ctx): State {
    return finish(ctx, ctx.state);
  }

  /**
   * Someone left: they lose the round being arranged (like binh lủng) and sit out the rest of
   * the match. The others play on; alone at the table, the round is shown and the match ends.
   */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const seat = ctx.player.seat;
    let state: State = { ...ctx.state, gone: [...ctx.state.gone, seat] };
    if (state.phase === 'show') return state;
    if (state.inRound[seat]) state = { ...state, forfeits: [...state.forfeits, seat] };
    if (stayed(ctx, state) < 2) return reveal(ctx, state);
    return state.phase === 'arrange' ? revealIfDone(ctx, state) : state;
  }

  /** The computer arranges its cards as well as it can and is done at once. */
  bot({ state, player }: BotContext<State, Options>) {
    if (state.phase !== 'arrange' || !isArranging(state, player.seat)) return null;
    if (state.rows[player.seat]) return null;
    return { event: 'submit', payload: { rows: bestRows(state.hands[player.seat] ?? []) } };
  }

  /** Your own cards and rows; of the others only who is done (the results show all rows). */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    const { hands, rows, ...rest } = state;
    return {
      ...rest,
      hand: viewer ? (hands[viewer.seat] ?? []) : [],
      mine: viewer ? (rows[viewer.seat] ?? null) : null,
      ready: rows.map(Boolean),
    };
  }
}

/** Dealt into this round and still at the table. */
const isArranging = (state: State, seat: number) =>
  Boolean(state.inRound[seat]) && !state.forfeits.includes(seat);

/** How many are still at the table. */
const stayed = (ctx: Ctx, state: State) => ctx.players.length - state.gone.length;

/** Deals 13 cards to everyone still at the table. */
function deal(ctx: Ctx, state: State): State {
  const inRound = ctx.players.map((p) => !p.left && !state.gone.includes(p.seat));
  const deck = shuffle(ctx.rng, fullDeck());
  let next = 0;
  const hands = inRound.map((dealt) =>
    dealt ? deck.slice(13 * next, 13 * ++next).sort((a, b) => a - b) : [],
  );
  ctx.setTimer(dealMs(13 * next) + INTRO_MS, 'begin');
  return {
    ...state,
    round: state.round + 1,
    phase: 'deal',
    hands,
    inRound,
    rows: hands.map(() => null),
    forfeits: [],
  };
}

/** Everyone still arranging is done: show the rows. */
function revealIfDone(ctx: Ctx, state: State): State {
  const done = state.inRound.every((_, seat) => !isArranging(state, seat) || state.rows[seat]);
  return done ? reveal(ctx, state) : state;
}

/**
 * Shows every row and scores the round. Who hasn't handed rows in gets the computer's; who
 * left loses to everyone. The next round (or the end) waits for the reveal on screen.
 */
function reveal(ctx: Ctx, state: State): State {
  const auto = state.inRound.map((dealt, seat) => dealt && !state.rows[seat]);
  const rows = state.hands.map((hand, seat) =>
    state.inRound[seat] ? (state.rows[seat] ?? bestRows(hand)) : null,
  );
  const forfeits = state.inRound.map((_, seat) => state.forfeits.includes(seat));
  const entries = rows.map((r, seat) => (r ? entryOf(r, Boolean(forfeits[seat])) : null));
  const { duels, points } = scoreRound(entries);
  const result: RoundResult = {
    rows,
    fouls: entries.map((e, seat) => Boolean(e?.foul) && !forfeits[seat]),
    forfeits,
    auto: auto.map((a, seat) => a && !forfeits[seat]),
    specials: entries.map((e) => e?.special ?? null),
    duels,
    points,
  };
  const next: State = {
    ...state,
    phase: 'show',
    rows,
    points: state.points.map((p, s) => p + (points[s] ?? 0)),
    results: [...state.results, result],
  };
  const last = next.round >= next.rounds || stayed(ctx, next) < 2;
  if (last) ctx.setTimer(revealMs(result), 'finish');
  else ctx.setTimer(revealMs(result) + ROUND_OVER_MS, 'next-round');
  return next;
}

function finish(ctx: Ctx, state: State): State {
  ctx.finish(winners(state).map((seat) => ctx.players[seat]?.id ?? ''));
  return state;
}
