/**
 * __Name__Game: the game's logic, on the server. Players send events (listed in `events`); each
 * event runs its hook (`play` → `onPlay`), which gets the whole room in `ctx` and returns the
 * next state. Use it in src/index.ts: `game: new __Name__Game()`.
 */
import { type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';

/** What the game remembers. Hooks never change it: they return a new one. */
export interface State {
  plays: number;
}

export class __Name__Game extends Game<State> {
  /** What players can do, and the data each event carries (checked before the hook runs). */
  events = {
    play: z.object({}),
  };

  /** A new game begins ("Bắt đầu", "Chơi ván mới"): return the first state. */
  onStart(_ctx: StartContext): State {
    return { plays: 0 };
  }

  /**
   * A player sent `play` (ctx.player, ctx.payload). Refuse it with ctx.reject('…'), end the game
   * with ctx.finish([winner ids]) ([] = a draw).
   */
  onPlay(ctx: EventContext<State>): State {
    return { plays: ctx.state.plays + 1 };
  }

  // Optional hooks: write them and the engine calls them.
  //   onEnd(ctx: GameContext<State>): State               after ctx.finish()
  //   bot(ctx: BotContext<State>): GameEvent | null       the computer's event for ctx.player
  //   view(ctx: GameContext<State>, viewer: Seat | null)  what a player sees: hide secrets here
}
