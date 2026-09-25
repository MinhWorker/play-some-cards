import { describe, expect, it } from 'vitest';
import { int, pick, seededRng, shuffle } from './rng.js';

describe('rng helpers', () => {
  it('repeats with the same seed', () => {
    const a = seededRng(7);
    const b = seededRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('int stays in range, both ends included', () => {
    const rng = seededRng(1);
    const seen = new Set(Array.from({ length: 200 }, () => int(rng, 1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('shuffle keeps every item and does not touch the input', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(seededRng(3), items);
    expect(out.slice().sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pick returns an item', () => {
    expect(['a', 'b']).toContain(pick(seededRng(2), ['a', 'b']));
  });
});
