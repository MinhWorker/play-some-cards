import { describe, expect, it } from 'vitest';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { MatchesService } from './matches.service.js';
import { MemoryMatchesStore } from './matches.store.js';

const seat = (id: string, extra: Partial<FinishedGame['seats'][number]> = {}) => ({
  id,
  name: id.toUpperCase(),
  bot: false,
  left: false,
  ...extra,
});

const game = (endedAt: number, winners: string[], seats = [seat('a'), seat('b')]) => ({
  gameId: 'tic-tac-toe',
  startedAt: endedAt - 60_000,
  endedAt,
  seats,
  result: { winners },
});

describe('MatchesService', () => {
  it('gives each player their own outcome, newest first', async () => {
    const matches = new MatchesService(new MemoryMatchesStore());
    await matches.record(game(1_000, ['a']));
    await matches.record(game(2_000, []));
    const forA = await matches.recent('a');
    expect(forA.map((m) => m.outcome)).toEqual(['draw', 'win']);
    expect((await matches.recent('b')).map((m) => m.outcome)).toEqual(['draw', 'loss']);
    expect(forA[1]?.players).toEqual([
      { name: 'A', bot: false, won: true, left: false, me: true },
      { name: 'B', bot: false, won: false, left: false, me: false },
    ]);
  });

  it('keeps bots without an account and skips games with no account', async () => {
    const matches = new MatchesService(new MemoryMatchesStore());
    await matches.record(
      game(
        1_000,
        ['bot:1'],
        [seat('a', { avatar: 'fox', frame: 'jade' }), seat('bot:1', { bot: true })],
      ),
    );
    await matches.record(
      game(2_000, [], [seat('bot:1', { bot: true }), seat('bot:2', { bot: true })]),
    );
    const [only, ...rest] = await matches.recent('a');
    expect(rest).toEqual([]);
    expect(only?.outcome).toBe('loss');
    expect(only?.players[0]).toMatchObject({ avatar: 'fox', frame: 'jade', me: true });
    expect(only?.players[1]).toMatchObject({ bot: true, won: true, me: false });
    expect(await matches.recent('bot:1')).toEqual([]);
  });

  it('returns at most the 20 most recent games', async () => {
    const matches = new MatchesService(new MemoryMatchesStore());
    for (let i = 1; i <= 25; i++) await matches.record(game(i * 1_000, ['a']));
    const recent = await matches.recent('a');
    expect(recent).toHaveLength(20);
    expect(recent[0]?.endedAt).toBe(25_000);
  });
});
