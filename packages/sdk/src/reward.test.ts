/** ctx.reward collects rewards over a game and hands them out with its result. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type EventContext, Game } from './engine.js';
import { testGame } from './testing.js';

type Ctx = EventContext<{ score: number }, { player?: string; resource?: string; amount: number }>;

class RewardGame extends Game<{ score: number }> {
  events = {
    point: z.object({
      player: z.string().optional(),
      resource: z.string().optional(),
      amount: z.number(),
    }),
    win: z.object({}),
  };
  onStart() {
    return { score: 0 };
  }
  onPoint(ctx: Ctx) {
    const { player, resource, amount } = ctx.payload;
    ctx.reward(player ?? ctx.player.id, resource ?? 'core:coin', amount);
    return { score: ctx.state.score + 1 };
  }
  onWin(ctx: EventContext<{ score: number }>) {
    ctx.finish([ctx.player.id]);
    ctx.reward(ctx.player.id, 'core:gem', 1);
    return ctx.state;
  }
}

describe('ctx.reward', () => {
  it('adds every reward of the game to its result', () => {
    const game = testGame(new RewardGame(), ['a', 'b']);
    game.send('a', 'point', { amount: 5 });
    game.send('b', 'point', { amount: 3 });
    expect(game.result).toBeNull();
    game.send('a', 'win', {});
    expect(game.result).toEqual({
      winners: ['a'],
      rewards: [
        { player: 'a', resource: 'core:coin', amount: 5 },
        { player: 'b', resource: 'core:coin', amount: 3 },
        { player: 'a', resource: 'core:gem', amount: 1 },
      ],
    });
  });

  it('leaves rewards out of a result without any', () => {
    class Plain extends RewardGame {
      override onWin(ctx: EventContext<{ score: number }>) {
        ctx.finish([]);
        return ctx.state;
      }
    }
    const game = testGame(new Plain(), ['a', 'b']);
    game.send('a', 'win', {});
    expect(game.result).toEqual({ winners: [] });
  });

  it('refuses rewards for strangers, bad resources and bad amounts', () => {
    const game = testGame(new RewardGame(), ['a', 'b']);
    expect(() => game.send('a', 'point', { player: 'z', amount: 1 })).toThrow('not seated');
    expect(() => game.send('a', 'point', { resource: 'coin', amount: 1 })).toThrow('namespaced');
    expect(() => game.send('a', 'point', { amount: 0 })).toThrow('above 0');
    expect(() => game.send('a', 'point', { amount: 1.5 })).toThrow('above 0');
  });
});
