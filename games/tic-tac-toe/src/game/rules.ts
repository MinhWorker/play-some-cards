/**
 * The rules, in the order the server calls them during a game:
 *
 *   setup ─► (validateMove ─► applyMove ─► getView ─► getResult) on every move ─► result
 *
 * Pure functions: no Phaser, no DOM, no Math.random (use `rng`), never mutate the state.
 * They run on the server, and in the browser only in the sandbox.
 */
import { defineGame, type GameResult, type PlayerId } from '@psc/sdk';
import { place, winningLine } from './board.js';
import { type Move, moveSchema, type Options, type State, WIN_LENGTH } from './model.js';

const markOf = (state: State, player: PlayerId) => (player === state.players[0] ? 'X' : 'O');

function getResult(state: State): GameResult | null {
  const line = winningLine(state.board, state.win);
  if (line)
    return { winners: [state.board[line[0]] === 'X' ? state.players[0] : state.players[1]] };
  if (state.board.every((c) => c !== null)) return { winners: [] };
  return null;
}

export const rules = defineGame<State, Move, State, Options>({
  moveSchema,

  /**
   * A new game (also after "Chơi ván mới"), with the room's current options: the board size,
   * and who is X (red, starts): the first seat, or the second after "Đổi màu".
   */
  setup(players, _rng, options) {
    const [first, second] = players as [PlayerId, PlayerId];
    const [x, o] = options.swap ? [second, first] : [first, second];
    const { size } = options;
    return {
      size,
      win: WIN_LENGTH[size],
      board: Array(size * size).fill(null),
      players: [x, o],
      turn: x,
    };
  },

  /** `null` if the move is legal, otherwise the message shown to the player (Vietnamese). */
  validateMove(state, move, player) {
    if (getResult(state)) return 'Ván đã kết thúc';
    if (state.turn !== player) return 'Chưa tới lượt bạn';
    if (move.cell >= state.board.length) return 'Ô này không có trên bàn';
    if (state.board[move.cell] !== null) return 'Ô này đã có người đánh';
    return null;
  },

  /** The state after a legal move. */
  applyMove(state, move, player) {
    const board = place(state.board, move.cell, markOf(state, player));
    const turn = player === state.players[0] ? state.players[1] : state.players[0];
    return { ...state, board, turn };
  },

  /** What `player` sees. Nothing is hidden in tic-tac-toe; card games hide hands here. */
  getView(state) {
    return state;
  },

  /** `null` while playing, then the winners (`[]` = draw). */
  getResult,
});
