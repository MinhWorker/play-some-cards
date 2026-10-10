/**
 * The event's logic, on the server. An event (`kind: 'event'` in src/index.ts) is a game with
 * dates and reward tiers: points go to the event with `ctx.reward(player, EVENT_POINTS, n)`,
 * and the server pays each tier once the player's points reach it.
 *
 * Starter event ("hái lộc"): one player picks PICKS lucky buds; each is worth 1–3 points drawn
 * with `ctx.rng`. When the picks run out, the points go to the event and the game ends.
 * Replace it with your event.
 */
import { EVENT_POINTS, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';

export const PICKS = 5;
/** The most one game gives, also the event's `meta.rewardCap`. */
export const MAX_POINTS = PICKS * 3;

/** What the game remembers: each bud's points so far. */
export interface State {
  picked: number[];
}

const pick = z.object({});

export class __Name__Game extends Game<State> {
  events = { pick };

  onStart(_ctx: StartContext): State {
    return { picked: [] };
  }

  /** The player picked a bud (event `pick`). */
  onPick(ctx: EventContext<State, z.infer<typeof pick>>): State {
    if (ctx.state.picked.length >= PICKS) ctx.reject('Hết lượt hái');
    const picked = [...ctx.state.picked, 1 + Math.floor(ctx.rng() * 3)];
    if (picked.length === PICKS) {
      ctx.reward(
        ctx.player.id,
        EVENT_POINTS,
        picked.reduce((sum, points) => sum + points, 0),
      );
      ctx.finish([ctx.player.id]);
    }
    return { picked };
  }
}
