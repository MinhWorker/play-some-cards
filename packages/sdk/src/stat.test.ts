/** ctx.stat counts what players did over a game and hands the counts out with its result. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type EventContext, Game } from './engine.js';
import { testGame } from './testing.js';

type Ctx = EventContext<{ n: number }, { player?: string; name?: string; amount?: number }>;

class StatGame extends Game<{ n: number }> {
  events = {
    bomb: z.object({
      player: z.string().optional(),
      name: z.string().optional(),
      amount: z.number().optional(),
    }),
    win: z.object({}),
  };
  onStart() {
    return { n: 0 };
  }
  onBomb(ctx: Ctx) {
    const { player, name, amount } = ctx.payload;
    ctx.stat(player ?? ctx.player.id, name ?? 'bomb', amount);
    return { n: ctx.state.n + 1 };
  }
  onWin(ctx: EventContext<{ n: number }>) {
    ctx.finish([ctx.player.id]);
    return ctx.state;
  }
}

describe('ctx.stat', () => {
  it('adds every count of the game to its result', () => {
    const game = testGame(new StatGame(), ['a', 'b']);
    game.send('a', 'bomb', {});
    game.send('b', 'bomb', { name: 'chop', amount: 2 });
    game.send('a', 'win', {});
    expect(game.result).toEqual({
      winners: ['a'],
      stats: [
        { player: 'a', name: 'bomb', amount: 1 },
        { player: 'b', name: 'chop', amount: 2 },
      ],
    });
  });

  it('refuses strangers, core and bad names, and bad amounts', () => {
    const game = testGame(new StatGame(), ['a', 'b']);
    expect(() => game.send('a', 'bomb', { player: 'z' })).toThrow('not seated');
    expect(() => game.send('a', 'bomb', { name: 'won' })).toThrow('stat name');
    expect(() => game.send('a', 'bomb', { name: 'Bomb' })).toThrow('stat name');
    expect(() => game.send('a', 'bomb', { amount: 0 })).toThrow('above 0');
  });
});
