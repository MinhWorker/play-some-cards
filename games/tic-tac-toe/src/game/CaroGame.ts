/**
 * The game's logic, on the server. A player's event runs its hook, which gets the whole room in
 * `ctx` and returns the next state; everyone's screen then gets it (scenes/CaroView.ts).
 */
import { type BotContext, type EventContext, Game, type StartContext } from '@psc/sdk';
import { z } from 'zod';
import { place, winningLine } from './board.js';
import { botMove } from './bot.js';
import { type Mark, type Options, type State, WIN_LENGTH } from './model.js';

export class CaroGame extends Game<State, Options> {
  /** What players can do: mark a cell. */
  events = {
    place: z.object({ cell: z.number().int().min(0).max(80) }),
  };

  /**
   * A new game ("Bắt đầu", "Chơi ván mới") with the room's current options: the board size, and
   * who is X (red, starts): the first seat, or the second after "Đổi màu".
   */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const [x, o] = options.swap ? [second, first] : [first, second];
    const { size } = options;
    return {
      size,
      win: WIN_LENGTH[size],
      board: Array(size * size).fill(null),
      players: [x, o],
      turn: x,
    };
  }

  /** A player marks a cell (event `place`). */
  onPlace(ctx: EventContext<State, { cell: number }, Options>): State {
    const { state, player, payload, reject, finish } = ctx;
    const { cell } = payload;
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
    if (cell >= state.board.length) reject('Ô này không có trên bàn');
    if (state.board[cell] !== null) reject('Ô này đã có người đánh');

    const mark: Mark = player.id === state.players[0] ? 'X' : 'O';
    const board = place(state.board, cell, mark);
    if (winningLine(board, state.win)) finish([player.id]);
    else if (board.every((c) => c !== null)) finish([]);
    const turn = player.id === state.players[0] ? state.players[1] : state.players[0];
    return { ...state, board, turn };
  }

  /** The computer's move, in rooms against the computer (see bot.ts). */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (options.opponent !== 'bot') return null;
    const cell = botMove(state, player.id, rng, options.level);
    return cell === null ? null : { event: 'place', payload: { cell } };
  }
}
