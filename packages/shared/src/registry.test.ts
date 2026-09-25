import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { games } from './registry.js';

const gameDir = (id: string) => new URL(`../../../games/${id}/`, import.meta.url);

describe('game registry', () => {
  it('has at least one ready game', () => {
    expect(Object.values(games).some((g) => g.status === 'ready')).toBe(true);
  });

  for (const game of Object.values(games)) {
    describe(game.id, () => {
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
