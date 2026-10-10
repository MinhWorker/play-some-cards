/**
 * The game's logic, on the server (WXF 2018 rules for two players). A player's event runs its
 * hook, which gets the whole room in `ctx` and returns the next state; everyone's screen then
 * gets it (scenes/XiangqiView.ts).
 *
 *   move          a piece from one point to another (legal moves: rules.ts)
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
import {
  type EndReason,
  type Options,
  QUIET_LIMIT,
  type Side,
  SQUARES,
  type State,
  type View,
} from './model.js';
import { judgeRepetition, startsChase } from './referee.js';
import {
  canMove,
  inCheck,
  legalMoves,
  legalTargets,
  noAttackers,
  other,
  play,
  positionKey,
  START,
  sideOf,
} from './rules.js';

const point = z
  .number()
  .int()
  .min(0)
  .max(SQUARES - 1);
const move = z.object({ from: point, to: point });
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class XiangqiGame extends Game<State, Options, View> {
  events = { move, 'offer-draw': none, 'decline-draw': none, resign: none };

  /** A new game: Red is the first seat, or the second when the room swapped colors. */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    return {
      board: START,
      players: options.swap ? [second, first] : [first, second],
      turn: 'r',
      last: null,
      check: false,
      captured: [],
      plies: 0,
      quiet: 0,
      history: [{ key: positionKey(START, 'r'), check: false, chase: false }],
      drawOffer: null,
      end: null,
    };
  }

  /** A player moves a piece (event `move`). */
  onMove(ctx: Ctx<z.infer<typeof move>>): State {
    const { state, payload, reject } = ctx;
    const side = sideOfPlayer(state, ctx.player);
    if (side !== state.turn) reject('Chưa tới lượt bạn');
    const piece = state.board[payload.from];
    if (!piece || sideOf(piece) !== side) reject('Hãy chọn quân của bạn');
    if (!legalTargets(state.board, payload.from).includes(payload.to)) {
      reject('Nước đi không đúng luật');
    }

    const board = play(state.board, payload);
    const captured = state.board[payload.to] ?? null;
    const turn = other(side);
    const check = inCheck(board, turn);
    const key = positionKey(board, turn);
    // A capture can never be repeated: the positions before it don't matter any more.
    const chase = startsChase(state.board, board, side);
    const history = captured
      ? [{ key, check, chase: false }]
      : [...state.history, { key, check, chase }];
    const next: State = {
      ...state,
      board,
      turn,
      last: { ...payload, captured },
      check,
      captured: captured ? [...state.captured, captured] : state.captured,
      plies: state.plies + 1,
      quiet: captured ? 0 : state.quiet + 1,
      history,
      // Moving answers the other side's offer with a no; your own offer still stands.
      drawOffer: state.drawOffer === side ? side : null,
    };

    if (!canMove(board, turn)) return end(ctx, next, check ? 'checkmate' : 'stalemate', side);
    const repeated = judgeRepetition(history);
    if (repeated) {
      const winner = repeated.loser ? other(repeated.loser) : null;
      return end(ctx, next, repeated.reason, winner);
    }
    if (noAttackers(board)) return end(ctx, next, 'material', null);
    if (next.quiet >= QUIET_LIMIT) return end(ctx, next, 'move-limit', null);
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
    const best = botMove(state.board, side, rng, options.level);
    return best && { event: 'move', payload: best };
  }

  /** Nothing is secret; screens get the moves they may play instead of the repetition
   * bookkeeping. */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    const { history: _, ...view } = state;
    const side = viewer && state.players.includes(viewer.id) ? sideOfPlayer(state, viewer) : null;
    const moves = side && side === state.turn && !state.end ? legalMoves(state.board, side) : [];
    return { ...view, moves };
  }
}

/** The side a seated player plays. */
function sideOfPlayer(state: State, player: Seat): Side {
  return state.players[0] === player.id ? 'r' : 'b';
}

/** Ends the game: `winner` wins (`null` = a draw). */
function end(
  ctx: GameContext<State, Options>,
  state: State,
  reason: EndReason,
  winner: Side | null,
): State {
  ctx.finish(winner ? [state.players[winner === 'r' ? 0 : 1]] : []);
  return { ...state, drawOffer: null, end: { reason, winner } };
}
