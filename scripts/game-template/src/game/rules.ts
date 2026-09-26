/**
 * The rules, in the order the server calls them during a game:
 *
 *   setup ─► (validateMove ─► applyMove ─► getView ─► getResult) on every move ─► result
 *
 * Pure functions: no Phaser, no DOM, no Math.random (use `rng`), never mutate the state.
 */
import { defineGame, type PlayerId } from '@psc/sdk';
import { type Move, moveSchema, type State, TARGET } from './model.js';

export const rules = defineGame<State, Move>({
  moveSchema,

  /** A new game (also after "Chơi ván mới"). */
  setup(players) {
    return { players, total: 0, turn: players[0] as PlayerId, winner: null };
  },

  /** `null` if the move is legal, otherwise the message shown to the player (Vietnamese). */
  validateMove(state, move, player) {
    if (state.winner) return 'Ván đã kết thúc';
    if (state.turn !== player) return 'Chưa tới lượt bạn';
    if (state.total + move.add > TARGET) return `Không được vượt quá ${TARGET}`;
    return null;
  },

  /** The state after a legal move. */
  applyMove(state, move, player) {
    const total = state.total + move.add;
    const next = state.players[(state.players.indexOf(player) + 1) % state.players.length];
    return {
      ...state,
      total,
      turn: next as PlayerId,
      winner: total === TARGET ? player : null,
    };
  },

  /** What `player` sees (`null` = spectator). Nothing is hidden here; hide other players' cards in yours. */
  getView(state) {
    return state;
  },

  /** `null` while playing, then the winners (`[]` = draw). */
  getResult(state) {
    return state.winner ? { winners: [state.winner] } : null;
  },
});
