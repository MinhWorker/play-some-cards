import { EVENT_POINTS, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { CASTS, CATCHES, catchFor, MAX_POINTS, pointsOf } from './model.js';

describe('Câu cá Trung Thu', () => {
  it('draws each catch by its weight', () => {
    expect(catchFor(0)).toBe('golden-carp');
    expect(catchFor(0.0999)).toBe('golden-carp');
    expect(catchFor(0.1)).toBe('carp');
    expect(catchFor(0.9)).toBe('sandal');
    expect(catchFor(0.9999)).toBe('sandal');
    expect(CATCHES.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });

  it('ends after the last cast and gives its points to the event', () => {
    const t = testGame(plugin, ['lan']);
    for (let i = 0; i < CASTS; i++) {
      expect(t.result).toBeNull();
      t.send('lan', 'cast');
    }
    expect(t.state.caught).toHaveLength(CASTS);
    const points = pointsOf(t.state.caught);
    expect(t.result?.winners).toEqual(['lan']);
    expect(t.result?.rewards ?? []).toEqual(
      points > 0 ? [{ player: 'lan', resource: EVENT_POINTS, amount: points }] : [],
    );
    expect(t.error('lan', 'cast')).toBe('Ván đã kết thúc');
  });

  it('never gives more than its rewardCap', () => {
    expect(plugin.meta.rewardCap?.[EVENT_POINTS]).toBe(MAX_POINTS);
  });
});
