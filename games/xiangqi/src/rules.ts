import { defineGame, type PlayerId } from '@psc/sdk';
import { z } from 'zod';

// Starter rules ("race to 21"): players take turns adding 1, 2 or 3 to a shared total; whoever
// reaches exactly 21 wins. Replace them with your game.

export const TARGET = 21;

export interface State {
  players: PlayerId[];
  total: number;
  turn: PlayerId;
  winner: PlayerId | null;
}

const moveSchema = z.object({ add: z.number().int().min(1).max(3) });
export type Move = z.infer<typeof moveSchema>;

export const rules = defineGame<State, Move>({
  moveSchema,

  setup(players) {
    return { players, total: 0, turn: players[0] as PlayerId, winner: null };
  },

  validateMove(state, move, player) {
    if (state.winner) return 'Ván đã kết thúc';
    if (state.turn !== player) return 'Chưa tới lượt bạn';
    if (state.total + move.add > TARGET) return `Không được vượt quá ${TARGET}`;
    return null;
  },

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

  // Nothing is hidden in this game. Hide other players' cards here in yours.
  getView(state) {
    return state;
  },

  getResult(state) {
    return state.winner ? { winners: [state.winner] } : null;
  },
});
