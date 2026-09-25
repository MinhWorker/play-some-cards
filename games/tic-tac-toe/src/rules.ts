import { defineGame, type PlayerId } from '@psc/sdk';
import { z } from 'zod';

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

/** The three cells of the winning line, or `null` if nobody has three in a row. */
export function winningLine(board: Cell[]): [number, number, number] | null {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return [a, b, c];
  }
  return null;
}

function winnerMark(board: Cell[]): Cell {
  const line = winningLine(board);
  return line ? (board[line[0]] ?? null) : null;
}

function getResult(state: TicTacToeState) {
  const mark = winnerMark(state.board);
  if (mark) return { winners: [mark === 'X' ? state.players[0] : state.players[1]] };
  if (state.board.every((c) => c !== null)) return { winners: [] };
  return null;
}

export const rules = defineGame<TicTacToeState, TicTacToeMove>({
  moveSchema,

  setup(players) {
    const [x, o] = players as [PlayerId, PlayerId];
    return { board: Array(9).fill(null), players: [x, o], turn: x };
  },

  validateMove(state, move, player) {
    if (getResult(state)) return 'Ván đã kết thúc';
    if (state.turn !== player) return 'Chưa tới lượt bạn';
    if (state.board[move.cell] !== null) return 'Ô này đã có người đánh';
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
