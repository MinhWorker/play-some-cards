/**
 * The game's logic, on the server. Players send events (listed in `events`); each event runs its
 * hook (`add` → `onAdd`), which gets the whole room in `ctx` and returns the next state. Every
 * screen then gets the new state and hears the event (scenes/XiangqiView.ts).
 *
 * Starter game ("race to 21"): players take turns adding 1, 2 or 3 to a shared total; whoever
 * reaches exactly 21 wins. Replace it with your game.
 */
import { type EventContext, Game, type StartContext } from '@psc/sdk';
import { z } from 'zod';

export const TARGET = 21;

/** What the game remembers. Hooks never change it: they return a new one. */
export interface State {
  total: number;
  /** Whose turn it is: a seat (0, 1, …). */
  turn: number;
}

const add = z.object({ amount: z.number().int().min(1).max(3) });

export class XiangqiGame extends Game<State> {
  /** What players can do, and the data each event carries (checked before the hook runs). */
  events = { add };

  /** "Bắt đầu" or "Chơi ván mới": the first state. */
  onStart(_ctx: StartContext): State {
    return { total: 0, turn: 0 };
  }

  /** A player added to the total (event `add`). */
  onAdd(ctx: EventContext<State, z.infer<typeof add>>): State {
    const { state, player, payload } = ctx;
    if (player.seat !== state.turn) ctx.reject('Chưa tới lượt bạn');
    const total = state.total + payload.amount;
    if (total > TARGET) ctx.reject(`Không được vượt quá ${TARGET}`);
    if (total === TARGET) ctx.finish([player.id]);
    return { total, turn: (state.turn + 1) % ctx.players.length };
  }
}
