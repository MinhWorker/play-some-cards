/**
 * Câu cá Trung Thu, the sample event (`kind: 'event'`): one player casts CASTS times; each cast
 * brings up a catch drawn with `ctx.rng`. When the casts run out, the catches' points go to the
 * event (`ctx.reward(player, EVENT_POINTS, points)`), golden carps are counted
 * (`ctx.stat`, for the "Cá chép vàng" achievement) and the game ends.
 */
import { EVENT_POINTS, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';
import { CASTS, catchFor, pointsOf, type State } from './model.js';

export type { State } from './model.js';

const cast = z.object({});

export class FishingGame extends Game<State> {
  events = { cast };

  onStart(_ctx: StartContext): State {
    return { caught: [] };
  }

  /** The player cast the line (event `cast`). */
  onCast(ctx: EventContext<State, z.infer<typeof cast>>): State {
    const caught = [...ctx.state.caught, catchFor(ctx.rng())];
    if (caught.length >= CASTS) {
      const points = pointsOf(caught);
      if (points > 0) ctx.reward(ctx.player.id, EVENT_POINTS, points);
      const golden = caught.filter((c) => c === 'golden-carp').length;
      if (golden > 0) ctx.stat(ctx.player.id, 'golden-carp', golden);
      ctx.finish([ctx.player.id]);
    }
    return { caught };
  }
}
