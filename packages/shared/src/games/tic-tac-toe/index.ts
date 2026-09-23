import { z } from 'zod';
import { defineGame, type PlayerId } from '../../game.js';

export type Cell = 'X' | 'O' | null;

export interface TicTacToeState {
  board: Cell[];
  /** players[0] is X, players[1] is O. */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
}

const moveSchema = z.object({ cell: z.number().int().min(0).max(8) });
export type TicTacToeMove = z.infer<typeof moveSchema>;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function winnerMark(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return mark;
  }
  return null;
}

function getResult(state: TicTacToeState) {
  const mark = winnerMark(state.board);
  if (mark) return { winners: [mark === 'X' ? state.players[0] : state.players[1]] };
  if (state.board.every((c) => c !== null)) return { winners: [] };
  return null;
}

export const ticTacToe = defineGame<TicTacToeState, TicTacToeMove>({
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  minPlayers: 2,
  maxPlayers: 2,
  moveSchema,

  setup(players) {
    const [x, o] = players as [PlayerId, PlayerId];
    return { board: Array(9).fill(null), players: [x, o], turn: x };
  },

  validateMove(state, move, player) {
    if (getResult(state)) return 'Game is over';
    if (state.turn !== player) return 'Not your turn';
    if (state.board[move.cell] !== null) return 'Cell is taken';
    return null;
  },

  applyMove(state, move, player) {
    const mark = player === state.players[0] ? 'X' : 'O';
    const board = state.board.slice();
    board[move.cell] = mark;
    const turn = player === state.players[0] ? state.players[1] : state.players[0];
    return { ...state, board, turn };
  },

  // No hidden information in tic-tac-toe, so everyone sees the full state.
  getView(state) {
    return state;
  },

  getResult,
});
