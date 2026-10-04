/** Optional commands run with the same pure hooks, timers, results and parser as moves. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { catalog } from './console/definitions.js';
import { type CommandContext, Game, type TimerContext } from './engine.js';
import { testGame } from './testing.js';

class CommandGame extends Game<{ count: number }> {
  events = {};
  override catalogs = { amount: [{ id: 'two', value: 2, label: 'Hai' }] };
  override commands = {
    add: z
      .object({ amount: catalog('amount'), limit: z.int().default(10) })
      .describe('Tăng bộ đếm'),
  };
  onStart() {
    return { count: 0 };
  }
  cmdAdd(ctx: CommandContext<{ count: number }, undefined, { amount: number; limit: number }>) {
    if (ctx.args.amount < 0) ctx.reject('Không được giảm');
    const count = ctx.state.count + ctx.args.amount;
    ctx.setTimer(100, 'done');
    if (count >= ctx.args.limit) ctx.finish([ctx.players[0]!.id]);
    return { count };
  }
  onDone(ctx: TimerContext<{ count: number }>) {
    return { count: ctx.state.count + 1 };
  }
}
describe('game commands', () => {
  it('resolves catalog values, preserves pure inputs and runs timer hooks', () => {
    const game = testGame(new CommandGame(), ['a']);
    const before = game.state;
    game.command('add @amount:two');
    expect(game.state.count).toBe(2);
    expect(before.count).toBe(0);
    expect(game.timer).toEqual({ event: 'done', ms: 100 });
    game.fireTimer();
    expect(game.state.count).toBe(3);
    game.command('add limit=4 amount=1');
    expect(game.result).toEqual({ winners: ['a'] });
    expect(game.timer).toBeNull();
  });
  it('validates arguments and stops at a rejected command', () => {
    const game = testGame(new CommandGame(), ['a']);
    expect(() => game.command('add 1; add -1; add 5')).toThrow('Không được giảm');
    expect(game.state.count).toBe(1);
    expect(() => game.command('add "bad"')).toThrow('add: amount');
    expect(() => game.command('unknown')).toThrow('Không có lệnh');
  });
});
