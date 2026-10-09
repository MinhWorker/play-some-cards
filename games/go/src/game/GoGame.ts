/**
 * The game's logic, on the server (Chinese rules: area scoring, komi 7.5, no suicide, no
 * position may come back). A player's event runs its hook, which gets the whole room in `ctx`
 * and returns the next state; everyone's screen then gets it (scenes/GoView.ts).
 *
 *   place    put a stone on an empty point
 *   pass     skip a turn; two passes in a row stop play and start the count
 *   mark     while counting: mark a chain dead, or alive again
 *   accept   while counting: agree with the marking; once both agree, the count decides
 *   resume   while counting: go back to playing instead
 *   resign   give up: the other side wins
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
  BOARD_SIZE,
  type EndReason,
  KOMI,
  type Options,
  type Score,
  type Side,
  type State,
  type View,
} from './model.js';
import { chainsOf, emptyBoard, guessDead, hashOf, koAfter, other, place, score } from './rules.js';

const at = z.object({
  point: z
    .number()
    .int()
    .min(0)
    .max(19 * 19 - 1),
});
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class GoGame extends Game<State, Options, View> {
  events = { place: at, pass: none, mark: at, accept: none, resume: none, resign: none };

  /** A new game: Black is the first seat, or the second when the room swapped colors. */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const board = emptyBoard(BOARD_SIZE);
    return {
      size: BOARD_SIZE,
      board,
      players: options.swap ? [second, first] : [first, second],
      turn: 'b',
      last: null,
      ko: null,
      prisoners: { b: 0, w: 0 },
      passes: 0,
      plies: 0,
      phase: 'play',
      dead: [],
      guess: [],
      accepted: [],
      history: [hashOf(board)],
      end: null,
    };
  }

  /** A player puts a stone down (event `place`). */
  onPlace(ctx: Ctx<z.infer<typeof at>>): State {
    const { state, reject } = ctx;
    const { point } = ctx.payload;
    const side = this.myTurn(ctx);
    if (point >= state.size * state.size) reject('Nước đi không hợp lệ');
    if (state.board[point] !== '.') reject('Chỗ này đã có quân');
    if (point === state.ko) reject('Chưa được ăn lại ngay: đánh chỗ khác trước (cướp)');
    const played = place(state.board, state.size, point, side);
    if (!played) return reject('Không được đặt quân vào chỗ không còn khí');
    const hash = hashOf(played.board);
    if (state.history.includes(hash)) reject('Không được lặp lại thế cờ cũ');
    return {
      ...state,
      board: played.board,
      turn: other(side),
      last: { side, point, captured: played.captured },
      ko: koAfter(played.board, state.size, point, played.captured),
      prisoners: { ...state.prisoners, [side]: state.prisoners[side] + played.captured.length },
      passes: 0,
      plies: state.plies + 1,
      history: [...state.history, hash],
    };
  }

  /** Skip a turn; the second pass in a row starts the count, dead stones guessed. */
  onPass(ctx: Ctx): State {
    const { state } = ctx;
    const side = this.myTurn(ctx);
    const next: State = {
      ...state,
      turn: other(side),
      last: { side, point: null, captured: [] },
      ko: null,
      passes: state.passes + 1,
      plies: state.plies + 1,
    };
    if (next.passes < 2) return next;
    const guess = guessDead(state.board, state.size, next.turn, ctx.rng);
    return { ...next, phase: 'scoring', dead: guess, guess, accepted: [] };
  }

  /** While counting: the chain at `point` is dead (or alive again); agreements start over. */
  onMark(ctx: Ctx<z.infer<typeof at>>): State {
    const { state, reject } = ctx;
    this.counting(ctx);
    const { point } = ctx.payload;
    if (point >= state.size * state.size || state.board[point] === '.') reject('Hãy chạm vào quân');
    const chain = chainsOf(state.board, state.size, [point]);
    const isDead = state.dead.includes(point);
    const dead = isDead
      ? state.dead.filter((p) => !chain.includes(p))
      : [...state.dead, ...chain].sort((a, b) => a - b);
    return { ...state, dead, accepted: [] };
  }

  /** While counting: agree with the marking. Once both agree, the count ends the game. */
  onAccept(ctx: Ctx): State {
    const { state, reject } = ctx;
    const side = this.counting(ctx);
    if (state.accepted.includes(side)) reject('Bạn đã đồng ý, chờ đối thủ');
    const accepted = [...state.accepted, side];
    if (accepted.length < 2) return { ...state, accepted };
    const { b, w } = score(state.board, state.size, state.dead, KOMI);
    return end(ctx, { ...state, accepted }, 'score', b > w ? 'b' : 'w', { b, w });
  }

  /** While counting: back to playing, from where the passes left off. */
  onResume(ctx: Ctx): State {
    this.counting(ctx);
    return { ...ctx.state, phase: 'play', passes: 0, dead: [], guess: [], accepted: [] };
  }

  onResign(ctx: Ctx): State {
    const side = sideOfPlayer(ctx.state, ctx.player);
    return end(ctx, ctx.state, 'resign', other(side), null);
  }

  /** A player left mid-game: the one still at the table wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const side = sideOfPlayer(ctx.state, ctx.player);
    return end(ctx, ctx.state, 'left', other(side), null);
  }

  /**
   * The computer: in play, its point or a pass on its turn; while counting, it marks the stones
   * as the first guess had them (one chain at a time), then accepts.
   */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (options.opponent !== 'bot' || state.end) return null;
    const side = sideOfPlayer(state, player);
    if (state.phase === 'scoring') {
      const wrong =
        state.dead.find((p) => !state.guess.includes(p)) ??
        state.guess.find((p) => !state.dead.includes(p));
      if (wrong !== undefined) return { event: 'mark', payload: { point: wrong } };
      return state.accepted.includes(side) ? null : { event: 'accept' };
    }
    if (side !== state.turn) return null;
    const point = botMove(
      { ...state, passed: state.last?.point === null, history: state.history },
      rng,
      options.level,
    );
    return point === null ? { event: 'pass' } : { event: 'place', payload: { point } };
  }

  /** Nothing is secret; screens just don't need the position history. */
  view({ state }: GameContext<State, Options>, _viewer: Seat | null): View {
    const { history: _, ...view } = state;
    return view;
  }

  /** The sender's side, if it is their turn to play. */
  private myTurn(ctx: Ctx<unknown>): Side {
    const { state, reject } = ctx;
    if (state.phase !== 'play') reject('Đang đếm điểm');
    const side = sideOfPlayer(state, ctx.player);
    if (side !== state.turn) reject('Chưa tới lượt bạn');
    return side;
  }

  /** The sender's side, while counting. */
  private counting(ctx: Ctx<unknown>): Side {
    if (ctx.state.phase !== 'scoring') ctx.reject('Chưa tới lúc đếm điểm');
    return sideOfPlayer(ctx.state, ctx.player);
  }
}

/** The side a seated player plays. */
function sideOfPlayer(state: State, player: Seat): Side {
  return state.players[0] === player.id ? 'b' : 'w';
}

/** Ends the game: `winner` wins (a count always has one: komi has a half point). */
function end(
  ctx: GameContext<State, Options>,
  state: State,
  reason: EndReason,
  winner: Side,
  count: Score | null,
): State {
  ctx.finish([state.players[winner === 'b' ? 0 : 1]]);
  return { ...state, end: { reason, winner, score: count } };
}
