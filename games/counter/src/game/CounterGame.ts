/**
 * The game's logic, on the server. Players send events; each event runs its hook, which gets
 * the whole room in `ctx` and returns the next state. Everyone's screen then gets that state and
 * hears the event (scenes/CounterView.ts).
 */
import { type EventContext, Game, type StartContext } from '@psc/sdk';
import { z } from 'zod';

/** What the game remembers. */
export interface State {
  /** The shared number. */
  count: number;
  /** How many times each seat pressed. */
  presses: number[];
}

export class CounterGame extends Game<State> {
  /** What players can do, and the data each event carries (none here). */
  events = {
    press: z.object({}),
  };

  /** "Bắt đầu" or "Chơi ván mới": the first state. */
  onStart(ctx: StartContext): State {
    return { count: 0, presses: ctx.players.map(() => 0) };
  }

  /** A player pressed their button (event `press`). */
  onPress(ctx: EventContext<State>): State {
    const { state, player } = ctx;
    return {
      count: state.count + 1,
      presses: state.presses.map((n, seat) => (seat === player.seat ? n + 1 : n)),
    };
  }
}
