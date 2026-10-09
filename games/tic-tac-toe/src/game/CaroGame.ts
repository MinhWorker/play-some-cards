/**
 * The game's logic, on the server. A player's event runs its hook, which gets the whole room in
 * `ctx` and returns the next state; everyone's screen then gets it (scenes/CaroView.ts).
 */
import { type BotContext, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';
import { at, grow, inside, isDraw, newBoard, place, winsAt } from './board.js';
import { botMove } from './bot.js';
import { MAX_SIDE, type Mark, type Options, type Point, type State } from './model.js';

/** A cell coordinate, loosely bounded (onPlace checks it is on the board). */
const coord = z
  .number()
  .int()
  .min(-MAX_SIDE)
  .max(MAX_SIDE * 2);

export class CaroGame extends Game<State, Options> {
  /** What players can do: mark a cell. */
  events = {
    place: z.object({ x: coord, y: coord }),
  };

  /**
   * A new game ("Bắt đầu", "Chơi ván mới") on a fresh 9×9 board with the room's current options:
   * who is X (red, starts): the first seat, or the second after "Đổi màu".
   */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const [x, o] = options.swap ? [second, first] : [first, second];
    return { board: newBoard(), players: [x, o], turn: x };
  }

  /**
   * A player marks a cell (event `place`): five in a row wins; otherwise a mark on an edge grows
   * the board there, and once it can't grow and nobody can make five any more it is a draw.
   */
  onPlace(ctx: EventContext<State, Point, Options>): State {
    const { state, player, payload, reject, finish } = ctx;
    const p = { x: payload.x, y: payload.y };
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
    if (!inside(state.board, p)) reject('Ô này không có trên bàn');
    if (at(state.board, p) !== null) reject('Ô này đã có người đánh');

    const mark: Mark = player.id === state.players[0] ? 'X' : 'O';
    let board = place(state.board, p, mark);
    if (winsAt(state.board, p, mark)) finish([player.id]);
    else {
      board = grow(board, p);
      if (isDraw(board)) finish([]);
    }
    const turn = player.id === state.players[0] ? state.players[1] : state.players[0];
    return { ...state, board, turn };
  }

  /** The computer's move, in rooms against the computer (see bot.ts). */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (options.opponent !== 'bot') return null;
    const cell = botMove(state, player.id, rng, options.level);
    return cell === null ? null : { event: 'place', payload: cell };
  }
}
