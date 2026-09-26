import { describe, expect, it } from 'vitest';
import { beats, type Card, comboOf } from './cards.js';

/** "3s", "10h", "2d": rank then suit letter (s c d h). */
const c = (name: string): Card => {
  const rank = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].indexOf(
    name.slice(0, -1),
  );
  return rank * 4 + 'scdh'.indexOf(name.slice(-1));
};
const combo = (...names: string[]) => comboOf(names.map(c));
const beat = (play: string[], table: string[]) =>
  beats(comboOf(play.map(c)) ?? fail(play), comboOf(table.map(c)));
const fail = (cards: string[]): never => {
  throw new Error(`${cards} is no combination`);
};

describe('combinations', () => {
  it('knows every kind', () => {
    expect(combo('3s')?.kind).toBe('single');
    expect(combo('7s', '7h')?.kind).toBe('pair');
    expect(combo('9c', '9d', '9h')?.kind).toBe('triple');
    expect(combo('Ks', 'Kc', 'Kd', 'Kh')?.kind).toBe('quad');
    expect(combo('3s', '4d', '5h')?.kind).toBe('straight');
    expect(combo('10s', 'Jd', 'Qh', 'Kc', 'As')?.size).toBe(5);
    expect(combo('3s', '3h', '4c', '4d', '5s', '5h')?.kind).toBe('pairs');
  });

  it('refuses what is no combination', () => {
    expect(combo('3s', '4s')).toBeNull();
    expect(combo('3s', '5d', '6h')).toBeNull();
    expect(combo('Ks', 'As', '2s')).toBeNull(); // no 2 in a straight
    expect(combo('Qs', 'Qh', 'Kc', 'Kd', 'As', 'Ah', '2s', '2h')).toBeNull();
    expect(combo('3s', '3h', '4c', '4d')).toBeNull(); // two pairs are no run
  });
});

describe('beating', () => {
  it('needs the same kind and size, with a stronger top card', () => {
    expect(beat(['4s'], ['3h'])).toBe(true);
    expect(beat(['3h'], ['3s'])).toBe(true); // hearts beat spades
    expect(beat(['3s'], ['3h'])).toBe(false);
    expect(beat(['8s', '8h'], ['8c', '8d'])).toBe(true);
    expect(beat(['4s', '5s', '6s'], ['3h', '4h', '5h'])).toBe(true);
    expect(beat(['4s', '5s', '6s', '7s'], ['3h', '4h', '5h'])).toBe(false);
    expect(beat(['9s', '9h'], ['2h'])).toBe(false);
  });

  it('lets bombs chop the 2s and smaller bombs', () => {
    const threePairs = ['3s', '3h', '4c', '4d', '5s', '5h'];
    const fourPairs = ['6s', '6h', '7c', '7d', '8s', '8h', '9c', '9d'];
    const quad = ['Ks', 'Kc', 'Kd', 'Kh'];
    expect(beat(threePairs, ['2h'])).toBe(true);
    expect(beat(threePairs, ['2s', '2h'])).toBe(false);
    expect(beat(quad, ['2h'])).toBe(true);
    expect(beat(quad, ['2s', '2h'])).toBe(true);
    expect(beat(quad, threePairs)).toBe(true);
    expect(beat(threePairs, quad)).toBe(false);
    expect(beat(fourPairs, ['2s', '2h'])).toBe(true);
    expect(beat(fourPairs, quad)).toBe(true);
    expect(beat(fourPairs, threePairs)).toBe(true);
    expect(beat(quad, fourPairs)).toBe(false);
    expect(beat(quad, ['As'])).toBe(false); // bombs only chop 2s
  });
});
