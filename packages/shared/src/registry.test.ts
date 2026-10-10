import { existsSync } from 'node:fs';
import { Game, gameRules, validateConsoleDefinitions } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ACHIEVEMENTS,
  achievementProblems,
  coreAchievementProblems,
  levelOf,
} from './achievements.js';
import {
  EVENT_GENRE,
  eventOpen,
  gameCard,
  genreProblems,
  genres,
  metaProblems,
} from './catalog.js';
import type { Genre } from './protocol.js';
import { games } from './registry.js';

const gameDir = (id: string) => new URL(`../../../games/${id}/`, import.meta.url);

describe('game registry', () => {
  it('has at least one ready game', () => {
    expect(Object.values(games).some((g) => g.status === 'ready')).toBe(true);
  });

  for (const game of Object.values(games)) {
    describe(game.id, () => {
      it('has valid optional console declarations', () => {
        validateConsoleDefinitions(game.commands ?? {}, game.catalogs ?? {}, game.events);
        if (Object.keys(game.commands ?? {}).length) expect(game.runCommand).toBeTypeOf('function');
      });

      it('lives in games/<id>', () => {
        expect(existsSync(gameDir(game.id))).toBe(true);
      });

      it('has sane player counts', () => {
        expect(game.minPlayers).toBeGreaterThanOrEqual(1);
        expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
      });

      it('declares a valid hub card', () => {
        expect(metaProblems(game)).toEqual([]);
      });

      it('has its card art in assets/', () => {
        const image = game.card ?? game.portal.image;
        const found = ['webp', 'png'].some((ext) =>
          existsSync(new URL(`assets/${image}.${ext}`, gameDir(game.id))),
        );
        expect(found).toBe(true);
      });

      it('has its portal image in assets/', () => {
        const found = ['webp', 'png'].some((ext) =>
          existsSync(new URL(`assets/${game.portal.image}.${ext}`, gameDir(game.id))),
        );
        expect(found).toBe(true);
      });
    });
  }
});

describe('genres and the hub catalog', () => {
  it('has a valid genre list with Cờ and Bài as the main genres', () => {
    expect(genreProblems(genres)).toEqual([]);
    expect(genres.filter((g) => g.main).map((g) => g.id)).toEqual(['co', 'bai']);
  });

  it('puts every game in Cờ or Bài, every event in Sự kiện, and Bom Nguyên Tố in Hành động', () => {
    for (const game of Object.values(games)) {
      const genre = game.kind === 'event' ? EVENT_GENRE : expect.stringMatching(/^(co|bai)$/);
      expect([game.id, gameCard(game)?.genre]).toEqual([
        game.id,
        game.id === 'bom-nguyen-to' ? 'hanh-dong' : genre,
      ]);
    }
  });

  it('catches bad genres', () => {
    const co: Genre = { id: 'co', name: 'Cờ', order: 1, island: 'co', main: true };
    expect(genreProblems([co, { ...co, order: 2 }])).toEqual(['genre "co": duplicate id']);
    expect(genreProblems([co, { ...co, id: 'Bai', order: 1 }])).toEqual([
      'genre "Bai": id must be kebab-case',
      'genres: two genres share an order',
    ]);
  });

  const meta = {
    id: 'demo',
    name: 'Demo',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready' as const,
    portal: { image: 'island' },
    genre: 'co',
    tagline: 'Một câu giới thiệu.',
    duration: { min: 5, max: 10 },
  };
  const event = {
    opensAt: '2026-09-20T00:00:00+07:00',
    closesAt: '2026-10-05T00:00:00+07:00',
    tiers: [
      { points: 10, reward: { 'core:coin': 50 } },
      { points: 30, reward: { 'core:coin': 200 } },
    ],
  };

  const party = { ...meta, kind: 'event' as const, genre: EVENT_GENRE };

  it('accepts a valid table game and event', () => {
    expect(metaProblems(meta)).toEqual([]);
    expect(metaProblems({ ...party, event: { ...event, color: '#B3261E' } })).toEqual([]);
  });

  it('knows when an event is open', () => {
    const at = (iso: string) => Date.parse(iso);
    expect(eventOpen(event, at('2026-09-19T23:59:59+07:00'))).toBe(false);
    expect(eventOpen(event, at('2026-09-20T00:00:00+07:00'))).toBe(true);
    expect(eventOpen(event, at('2026-10-04T23:59:59+07:00'))).toBe(true);
    expect(eventOpen(event, at('2026-10-05T00:00:00+07:00'))).toBe(false);
  });

  it('catches bad hub declarations', () => {
    expect(metaProblems({ ...meta, genre: 'dua-xe' })).toEqual([
      expect.stringContaining('unknown genre "dua-xe"'),
    ]);
    expect(metaProblems({ ...meta, tagline: ' ' })).toEqual([expect.stringContaining('tagline')]);
    expect(metaProblems({ ...meta, duration: { min: 10, max: 5 } })).toEqual([
      expect.stringContaining('duration'),
    ]);
    expect(metaProblems({ ...meta, rewardCap: { coin: 10 } })).toEqual([
      expect.stringContaining('rewardCap'),
    ]);
    expect(metaProblems({ ...meta, rewardCap: { 'core:coin': -1 } })).toEqual([
      expect.stringContaining('rewardCap'),
    ]);
    expect(metaProblems({ ...party })).toEqual([expect.stringContaining('needs meta.event')]);
    expect(metaProblems({ ...party, genre: 'co', event: { ...event, color: 'red' } })).toEqual([
      expect.stringContaining('#RRGGBB'),
      expect.stringContaining('"su-kien" genre'),
    ]);
    expect(metaProblems({ ...meta, event })).toEqual([
      expect.stringContaining('only kind "event"'),
    ]);
    expect(
      metaProblems({
        ...party,
        event: { ...event, closesAt: event.opensAt, tiers: [...event.tiers].reverse() },
      }),
    ).toEqual([
      expect.stringContaining('opensAt first'),
      expect.stringContaining('go up in points'),
    ]);
  });

  it('catches bad achievements', () => {
    const good = { id: 'five-wins', name: 'Năm ván thắng', stat: 'won', at: 5 };
    expect(metaProblems({ ...meta, achievements: [good] })).toEqual([]);
    expect(
      achievementProblems([
        good,
        { ...good, stat: 'Bomb', at: 0 },
        { ...good, id: 'x', reward: { coin: 5 } },
      ]),
    ).toEqual([
      expect.stringContaining('duplicate id'),
      expect.stringContaining('not a stat name'),
      expect.stringContaining('whole number ≥ 1'),
      expect.stringContaining('reward keys'),
    ]);
  });

  it('leaves games without a genre out of the catalog and defaults the card', () => {
    expect(gameCard({ ...meta, genre: undefined })).toBeNull();
    expect(gameCard(meta)).toMatchObject({ kind: 'table', card: 'island', rewardCap: {} });
  });
});

describe('achievements and levels', () => {
  it('declares the hub achievements well, with unique ids', () => {
    expect(coreAchievementProblems()).toEqual([]);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('goes up a level every 100 more experience than the last', () => {
    expect(levelOf(0)).toEqual({ level: 1, levelXp: 0, nextXp: 100 });
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100)).toEqual({ level: 2, levelXp: 100, nextXp: 300 });
    expect(levelOf(600)).toEqual({ level: 4, levelXp: 600, nextXp: 1000 });
  });
});

describe('invalid game console declarations', () => {
  class MissingHook extends Game<number> {
    events = {};
    override commands = { dice: z.object({ a: z.int() }) };
    onStart() {
      return 0;
    }
  }
  it('catches missing cmd<Name> hooks', () => {
    expect(() => gameRules(new MissingHook())).toThrow('cmdDice');
  });
  it('catches malformed and duplicate catalog ids and absent references', () => {
    expect(() =>
      validateConsoleDefinitions({}, { square: [{ id: 'San Bay', value: 20, label: 'Sân bay' }] }),
    ).toThrow('kebab-case');
    expect(() =>
      validateConsoleDefinitions(
        {},
        {
          square: [
            { id: 'x', value: 1, label: 'X' },
            { id: 'x', value: 2, label: 'Y' },
          ],
        },
      ),
    ).toThrow('duplicate');
    expect(() => validateConsoleDefinitions({ state: z.object({}) }, {})).toThrow('reserved');
    expect(() =>
      validateConsoleDefinitions(
        { dice: z.object({ a: z.int().meta({ catalog: 'missing' }) }) },
        {},
      ),
    ).toThrow('Unknown catalog');
  });
  it('checks event catalog references even when a command has the same name', () => {
    expect(() =>
      validateConsoleDefinitions(
        { warp: z.object({ square: z.int() }) },
        {},
        { warp: z.object({ square: z.int().meta({ catalog: 'missing' }) }) },
      ),
    ).toThrow('Unknown catalog');
  });
});
