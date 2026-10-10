/**
 * The game's logic, on the server. Players send events (listed in `events`); each event runs its
 * hook (`add` → `onAdd`), which gets the whole room in `ctx` and returns the next state. Every
 * screen then gets the new state and hears the event (godot/main.gd in the Godot client,
 * scenes/__Name__View.ts in the web app).
 *
 * Starter game ("race to 21"): players take turns adding 1, 2 or 3 to a shared total; whoever
 * reaches exactly 21 wins. Replace it with your game.
 */
import { type BotContext, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';

export const TARGET = 21;
/** Coins for the winner (people only), also the game's `meta.rewardCap`. */
export const WIN_COINS = 10;

/** What the game remembers. Hooks never change it: they return a new one. */
export interface State {
  total: number;
  /** Whose turn it is: a seat (0, 1, …). */
  turn: number;
}

/**
 * Room options, picked on the Tạo phòng board (`room_setup()` in godot/main.gd):
 * how many seats the computer takes. `optionsSchema.parse({})` gives the defaults.
 */
export const optionsSchema = z.object({ bots: z.number().int().min(0).max(3).default(0) });
export type Options = z.infer<typeof optionsSchema>;

const add = z.object({ amount: z.number().int().min(1).max(3) });

export class __Name__Game extends Game<State, Options> {
  /** What players can do, and the data each event carries (checked before the hook runs). */
  events = { add };

  /** "Bắt đầu" or "Chơi ván mới": the first state. */
  onStart(_ctx: StartContext<Options>): State {
    return { total: 0, turn: 0 };
  }

  /** A player added to the total (event `add`). */
  onAdd(ctx: EventContext<State, z.infer<typeof add>, Options>): State {
    const { state, player, payload } = ctx;
    if (player.seat !== state.turn) ctx.reject('Chưa tới lượt bạn');
    const total = state.total + payload.amount;
    if (total > TARGET) ctx.reject(`Không được vượt quá ${TARGET}`);
    if (total === TARGET) {
      ctx.reward(player.id, 'core:coin', WIN_COINS);
      ctx.finish([player.id]);
    }
    return { total, turn: (state.turn + 1) % ctx.players.length };
  }

  /** The computer's move on its turn: 21 when it can reach it, else 1–3 at random. */
  bot({ state, player, rng }: BotContext<State, Options>) {
    if (state.turn !== player.seat) return null;
    const left = TARGET - state.total;
    const amount = left <= 3 ? left : 1 + Math.floor(rng() * 3);
    return { event: 'add', payload: { amount } };
  }
}
