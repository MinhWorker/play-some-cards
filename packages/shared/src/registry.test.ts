import { existsSync } from 'node:fs';
import { Game, gameRules, validateConsoleDefinitions } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
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

      it('has its portal image in assets/', () => {
        const found = ['webp', 'png'].some((ext) =>
          existsSync(new URL(`assets/${game.portal.image}.${ext}`, gameDir(game.id))),
        );
        expect(found).toBe(true);
      });
    });
  }
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
