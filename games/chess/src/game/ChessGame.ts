/**
 * The game's logic, on the server (FIDE rules for two players). A player's event runs its hook,
 * which gets the whole room in `ctx` and returns the next state; everyone's screen then gets it
 * (godot/main.gd).
 *
 *   move          a piece from one square to another (legal moves: rules.ts), with the piece a
 *                 pawn becomes on the last rank
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
import {
  canMove,
  captureOf,
  enPassantOf,
  inCheck,
  insufficientMaterial,
  isCastle,
  isPromotion,
  kindOf,
  legalMoves,
  legalMovesFrom,
  other,
  play,
  positionKey,
  START,
  sideOf,
} from './rules.js';

const square = z
  .number()
  .int()
  .min(0)
  .max(SQUARES - 1);
const move = z.object({
  from: square,
  to: square,
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class ChessGame extends Game<State, Options, View> {
  events = { move, 'offer-draw': none, 'decline-draw': none, resign: none };

  /** A new game: White is the first seat, or the second when the room swapped colors. */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    return {
      ...START,
      players: options.swap ? [second, first] : [first, second],
      last: null,
      check: false,
      captured: [],
      plies: 0,
      quiet: 0,
      history: [positionKey(START)],
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
    if (isPromotion(state, payload) && !payload.promotion) reject('Hãy chọn quân để phong cấp');
    const legal = legalMovesFrom(state, payload.from).some(
      (m) => m.to === payload.to && m.promotion === payload.promotion,
    );
    if (!legal) reject('Nước đi không đúng luật');

    const pos = play(state, payload);
    const captured = captureOf(state, payload);
    const check = inCheck(pos.board, pos.turn);
    // A capture or a pawn move can never be undone: earlier positions can't come back.
    const reset = Boolean(captured) || kindOf(piece ?? '') === 'p';
    const key = positionKey(pos);
    const next: State = {
      ...state,
      ...pos,
      last: {
        ...payload,
        captured,
        castle: isCastle(state, payload),
        enPassant: enPassantOf(state, payload) !== null,
      },
      check,
      captured: captured ? [...state.captured, captured] : state.captured,
      plies: state.plies + 1,
      quiet: reset ? 0 : state.quiet + 1,
      history: reset ? [key] : [...state.history, key],
      // Moving answers the other side's offer with a no; your own offer still stands.
      drawOffer: state.drawOffer === side ? side : null,
    };

    if (!canMove(pos)) {
      return check ? end(ctx, next, 'checkmate', side) : end(ctx, next, 'stalemate', null);
    }
    if (insufficientMaterial(pos.board)) return end(ctx, next, 'material', null);
    const seen = next.history.filter((k) => k === key).length;
    if (seen >= 3) return end(ctx, next, 'repetition', null);
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
    if (sideOfPlayer(state, player) !== state.turn) return null;
    const best = botMove(state, rng, options.level);
    return best && { event: 'move', payload: best };
  }

  /** Nothing is secret; screens get the moves they may play instead of the repetition
   * bookkeeping. */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    const { history: _, ...view } = state;
    const side = viewer && state.players.includes(viewer.id) ? sideOfPlayer(state, viewer) : null;
    const moves = side && side === state.turn && !state.end ? legalMoves(state) : [];
    return { ...view, moves };
  }
}

/** The side a seated player plays. */
function sideOfPlayer(state: State, player: Seat): Side {
  return state.players[0] === player.id ? 'w' : 'b';
}

/** Ends the game: `winner` wins (`null` = a draw). */
function end(
  ctx: GameContext<State, Options>,
  state: State,
  reason: EndReason,
  winner: Side | null,
): State {
  ctx.finish(winner ? [state.players[winner === 'w' ? 0 : 1]] : []);
  return { ...state, drawOffer: null, end: { reason, winner } };
}
