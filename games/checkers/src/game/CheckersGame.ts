/**
 * The game's logic, on the server (simplified 8 × 8 draughts). A
 * player's event runs its hook, which gets the whole room in `ctx` and returns the next state;
 * everyone's screen then gets it (scenes/CheckersView.ts).
 *
 *   move          a piece along a path of squares (legal moves: rules.ts)
 *   offer-draw    offer a draw, or accept the other side's offer
 *   decline-draw  turn the other side's offer down (moving does too)
 *   resign        give up: the other side wins
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type Seat,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { botMove } from './bot.js';
import { type EndReason, type Options, RULES, type Side, type State, type View } from './model.js';
import { isKing, legalMoves, other, play, positionKey, sameMove, startBoard } from './rules.js';

const move = z.object({
  path: z.array(z.number().int().min(0).max(63)).min(2).max(13),
});
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class CheckersGame extends Game<State, Options, View> {
  events = { move, 'offer-draw': none, 'decline-draw': none, resign: none };

  /** A new game: the first seat moves first, or the second when the room swapped. */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const rules = RULES;
    const board = startBoard(rules);
    return {
      board,
      players: options.swap ? [second, first] : [first, second],
      turn: rules.first,
      last: null,
      taken: { w: 0, b: 0 },
      plies: 0,
      quiet: 0,
      history: [positionKey(board, rules.first)],
      drawOffer: null,
      end: null,
    };
  }

  /** A player moves a piece (event `move`). */
  onMove(ctx: Ctx<z.infer<typeof move>>): State {
    const { state, payload, reject } = ctx;
    const rules = RULES;
    const side = sideOfPlayer(state, ctx.player);
    if (side !== state.turn) reject('Chưa tới lượt bạn');
    const moves = legalMoves(state.board, side, rules);
    const chosen = moves.find((m) => sameMove(m, payload));
    if (!chosen) return reject('Nước đi không đúng luật');
    const from = state.board[chosen.path[0] ?? 0] ?? '.';
    const { board, taken, crowned } = play(state.board, chosen, rules);
    const turn = other(side);
    // A capture or a man moving can never be undone: earlier positions can't come back.
    const reset = taken.length > 0 || !isKing(from);
    const key = positionKey(board, turn);
    const next: State = {
      ...state,
      board,
      turn,
      last: { ...chosen, taken, crowned },
      taken: { ...state.taken, [side]: state.taken[side] + taken.length },
      plies: state.plies + 1,
      quiet: reset ? 0 : state.quiet + 1,
      history: reset ? [key] : [...state.history, key],
      // Moving answers the other side's offer with a no; your own offer still stands.
      drawOffer: state.drawOffer === side ? side : null,
    };
    if (!legalMoves(board, turn, rules).length) return end(ctx, next, 'blocked', side);
    if (next.history.filter((k) => k === key).length >= 3)
      return end(ctx, next, 'repetition', null);
    if (next.quiet >= rules.quietLimit) return end(ctx, next, 'move-limit', null);
    return next;
  }

  /** Offer a draw; if the other side already offered one, this accepts it. */
  onOfferDraw(ctx: Ctx): State {
    const { state, reject } = ctx;
    const side = sideOfPlayer(state, ctx.player);
    if (state.drawOffer === side) reject('Bạn đã xin hoà, chờ đối thủ trả lời');
    if (state.drawOffer === other(side)) return end(ctx, state, 'agreement', null);
    return { ...state, drawOffer: side };
  }

  /** Turn down the other side's draw offer. */
  onDeclineDraw(ctx: Ctx): State {
    const { state, reject } = ctx;
    const side = sideOfPlayer(state, ctx.player);
    if (state.drawOffer !== other(side)) reject('Không có lời xin hoà nào');
    return { ...state, drawOffer: null };
  }

  onResign(ctx: Ctx): State {
    const side = sideOfPlayer(ctx.state, ctx.player);
    return end(ctx, ctx.state, 'resign', other(side));
  }

  /** A player left mid-game: the one still at the table wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const side = sideOfPlayer(ctx.state, ctx.player);
    return end(ctx, ctx.state, 'left', other(side));
  }

  /** The computer's move, in rooms against it. */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (options.opponent !== 'bot' || state.end) return null;
    const side = sideOfPlayer(state, player);
    if (side !== state.turn) return null;
    const best = botMove(state.board, side, RULES, rng, options.level);
    return best && { event: 'move', payload: { path: best.path } };
  }

  /** Nothing is secret; screens just don't need the repetition bookkeeping. */
  view({ state }: GameContext<State, Options>, _viewer: Seat | null): View {
    const { history: _, ...view } = state;
    return view;
  }
}

/** The side a seated player plays: the first seat moves first. */
export function sideOfPlayer(state: Pick<State, 'players'>, player: { id: string }): Side {
  const first = RULES.first;
  return state.players[0] === player.id ? first : other(first);
}

/** Ends the game: `winner` wins (`null` = a draw). */
function end(
  ctx: GameContext<State, Options>,
  state: State,
  reason: EndReason,
  winner: Side | null,
): State {
  const first = RULES.first;
  ctx.finish(winner ? [state.players[winner === first ? 0 : 1]] : []);
  return { ...state, drawOffer: null, end: { reason, winner } };
}
