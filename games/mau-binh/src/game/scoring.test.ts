import { describe, expect, it } from 'vitest';
import type { Rows } from './cards.js';
import { duel, entryOf, scoreRound, specialOf } from './scoring.js';
import { cards } from './testCards.js';

const rows = (a: string, b: string, c: string) => [cards(a), cards(b), cards(c)] as Rows;
const entry = (a: string, b: string, c: string, forfeit = false) => entryOf(rows(a, b, c), forfeit);

// Plain hands: no chi bonus, no tới trắng.
const strong = entry('9♠ 9♥ 9♦ K♣ 2♠', '8♠ 8♥ 4♦ 5♣ 3♠', 'Q♠ 6♥ 5♦');
const weak = entry('7♠ 7♥ 6♦ 6♣ 2♣', '10♠ 10♥ J♣ 3♦ 2♦', 'J♠ 4♥ 8♥');
const foul = entry('2♥ 5♥ 7♣ J♥ K♦', '9♣ 9♦ 3♣ K♥ K♠', '4♠ 8♥ 6♠');

describe('scoring', () => {
  it('gives +1 a chi, and +3 more for winning all three', () => {
    expect(duel(0, 1, strong, weak)).toMatchObject({ kind: 'chi', chi: [1, -1, 1], points: 1 });
    const scoop = entry('A♠ A♥ A♦ K♣ 2♥', 'Q♠ Q♣ J♦ J♣ 3♣', 'K♠ K♥ 5♠');
    expect(duel(0, 1, scoop, weak)).toMatchObject({ chi: [1, 1, 1], scoop: 1, points: 6 });
    expect(duel(1, 0, weak, scoop)).toMatchObject({ scoop: -1, points: -6 });
  });

  it('pays the chi bonuses to the winner', () => {
    const quads = entry('9♠ 9♥ 9♦ 9♣ 2♠', '8♠ 8♥ 8♦ 4♣ 4♠', 'Q♠ Q♥ Q♦');
    // Tứ quý chi 1 (+4), cù lũ chi 2 (+2), sám cô chi 3 (+3), sập 3 chi (+3).
    expect(duel(0, 1, quads, weak)).toMatchObject({ chi: [4, 2, 3], points: 12 });
  });

  it('makes binh lủng lose 6 to everyone else, and two of them draw', () => {
    expect(duel(0, 1, foul, weak)).toMatchObject({ kind: 'foul', points: -6 });
    expect(duel(0, 1, foul, foul)).toMatchObject({ kind: 'foul', points: 0 });
    const left = entry('9♠ 9♥ 9♦ K♣ 2♠', '8♠ 8♥ 4♦ 4♣ 3♠', 'Q♠ Q♥ 5♦', true);
    expect(duel(0, 1, weak, left)).toMatchObject({ kind: 'foul', points: 6 });
  });

  it('adds up every pair into a round that sums to zero', () => {
    const { duels, points } = scoreRound([strong, null, weak, foul]);
    expect(duels).toHaveLength(3);
    expect(points).toEqual([1 + 6, 0, -1 + 6, -12]);
  });
});

describe('tới trắng', () => {
  const special = (names: string) => specialOf(cards(names));

  it('finds each special hand, the best one when several fit', () => {
    expect(special('2♠ 3♥ 4♦ 5♣ 6♠ 7♥ 8♦ 9♣ 10♠ J♥ Q♦ K♣ A♠')).toBe('dragon');
    expect(special('2♠ 3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ A♠')).toBe('dragon-flush');
    expect(special('2♠ 2♥ 4♦ 4♣ 6♠ 6♥ 8♦ 8♣ 10♠ 10♥ Q♦ Q♣ A♠')).toBe('six-pairs');
    expect(special('2♠ 2♥ 4♦ 4♣ 6♠ 6♥ 8♦ 8♣ 10♠ 10♥ Q♦ Q♣ Q♠')).toBe('five-pairs-trips');
    expect(special('2♥ 5♥ 7♥ 9♥ J♥ 2♣ 4♣ 6♣ 8♣ 10♣ 3♦ K♦ A♦')).toBe('three-flushes');
    expect(special('A♠ 2♥ 3♦ 4♣ 5♠ 9♥ 10♦ J♣ Q♠ K♥ 6♦ 7♣ 8♠')).not.toBeNull();
    expect(special('A♠ 2♥ 3♦ 4♣ 5♠ 9♥ 10♦ J♣ Q♠ K♥ 5♦ 6♣ 7♠')).toBe('three-straights');
    expect(special('2♠ 5♥ 9♦ J♣ K♠ 3♥ 3♦ 8♣ 8♠ 7♥ A♦ A♣ Q♠')).toBeNull();
  });

  it('wins its points against everyone, even binh lủng, and the stronger one wins', () => {
    const six = entry('2♠ 2♥ 4♦ 4♣ 6♠', '6♥ 8♦ 8♣ 10♠ 10♥', 'Q♦ Q♣ A♠');
    expect(six.special).toBe('six-pairs');
    expect(duel(0, 1, six, strong)).toMatchObject({ kind: 'special', points: 3 });
    expect(duel(0, 1, foul, six)).toMatchObject({ kind: 'special', points: -3 });
    const dragon = entry('2♠ 3♥ 4♦ 5♣ 6♠', '7♥ 8♦ 9♣ 10♠ J♥', 'Q♦ K♣ A♠');
    expect(duel(0, 1, six, dragon)).toMatchObject({ points: -13 });
    expect(duel(0, 1, six, six)).toMatchObject({ points: 0 });
  });
});
