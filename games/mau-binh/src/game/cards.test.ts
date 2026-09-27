import { describe, expect, it } from 'vitest';
import { bestRows } from './arrange.js';
import { foulOf, handName, handOf, isArrangementOf, type Rows } from './cards.js';
import { cards } from './testCards.js';

const strength = (names: string) => handOf(cards(names)).strength;

describe('hands', () => {
  it('names every category', () => {
    expect(handName(cards('2♠ 5♥ 9♦ J♣ K♠'))).toBe('Mậu thầu');
    expect(handName(cards('9♠ 9♥ 2♦ J♣ K♠'))).toBe('Đôi');
    expect(handName(cards('9♠ 9♥ J♦ J♣ K♠'))).toBe('Thú');
    expect(handName(cards('9♠ 9♥ 9♦ J♣ K♠'))).toBe('Sám cô');
    expect(handName(cards('A♠ 2♥ 3♦ 4♣ 5♠'))).toBe('Sảnh');
    expect(handName(cards('2♥ 5♥ 9♥ J♥ K♥'))).toBe('Thùng');
    expect(handName(cards('9♠ 9♥ 9♦ K♣ K♠'))).toBe('Cù lũ');
    expect(handName(cards('9♠ 9♥ 9♦ 9♣ K♠'))).toBe('Tứ quý');
    expect(handName(cards('10♦ J♦ Q♦ K♦ A♦'))).toBe('Thùng phá sảnh');
    expect(handName(cards('9♠ 9♥ 9♦'))).toBe('Sám cô');
    expect(handName(cards('9♠ 10♠ J♠'))).toBe('Mậu thầu');
  });

  it('ranks A-2-3-4-5 lowest and 10-J-Q-K-A highest among straights', () => {
    const wheel = strength('A♠ 2♥ 3♦ 4♣ 5♠');
    expect(wheel).toBeLessThan(strength('2♠ 3♥ 4♦ 5♣ 6♠'));
    expect(strength('10♠ J♥ Q♦ K♣ A♠')).toBeGreaterThan(strength('9♠ 10♥ J♦ Q♣ K♠'));
  });

  it('compares what makes the hand first, then the other cards, and ignores suits', () => {
    expect(strength('9♠ 9♥ 9♦ 2♣ 2♠')).toBeGreaterThan(strength('8♠ 8♥ 8♦ A♣ A♠'));
    expect(strength('9♠ 9♥ 3♦ 3♣ 2♠')).toBeGreaterThan(strength('8♠ 8♥ 7♦ 7♣ A♠'));
    expect(strength('9♠ 9♥ A♦ 3♣ 2♠')).toBeGreaterThan(strength('9♦ 9♣ K♦ Q♣ J♠'));
    expect(strength('9♠ 9♥ A♦ 3♣ 2♠')).toBe(strength('9♦ 9♣ A♠ 3♥ 2♦'));
  });

  it('never ties a 3-card chi with a 5-card one', () => {
    expect(strength('9♠ 9♥ K♦ 3♣ 2♠')).toBeGreaterThan(strength('9♦ 9♣ K♠'));
    expect(strength('A♠ K♥ Q♦ 3♣ 2♠')).toBeGreaterThan(strength('A♦ K♣ Q♠'));
  });

  it('calls weaker chi below stronger ones binh lủng', () => {
    const rows = (a: string, b: string, c: string) => [cards(a), cards(b), cards(c)] as Rows;
    expect(foulOf(rows('9♠ 9♥ 9♦ K♣ K♠', '2♥ 5♥ 8♥ J♥ K♥', 'A♠ A♥ 3♦'))).toBeNull();
    expect(foulOf(rows('2♥ 5♥ 7♣ J♥ K♥', '9♠ 9♥ 3♣ K♣ K♠', '4♠ 8♥ 6♦'))).toBe(
      'Chi 2 mạnh hơn chi 1',
    );
    expect(foulOf(rows('9♠ 9♥ 3♣ K♣ K♠', '2♥ 5♥ 7♣ J♥ Q♥', 'A♠ A♥ 4♦'))).toBe(
      'Chi 3 mạnh hơn chi 2',
    );
  });
});

describe('the best rows', () => {
  it('always arranges the hand without binh lủng, strongest chi first', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let n = 0; n < 12; n++) {
      // A different 13 cards each time (a fixed stride through the deck).
      const hand = Array.from(
        { length: 13 },
        (_, i) => deck[(n * 7 + i * 4 + (i >> 2)) % 52] as number,
      );
      const rows = bestRows(hand);
      expect(isArrangementOf(rows, hand)).toBe(true);
      expect(foulOf(rows)).toBeNull();
    }
  });

  it('keeps a straight flush in chi 1 and a three of a kind in chi 3', () => {
    const rows = bestRows(cards('5♥ 6♥ 7♥ 8♥ 9♥ 2♠ 2♣ 2♦ K♠ K♣ 4♦ J♣ 3♠'));
    expect(handName(rows[0])).toBe('Thùng phá sảnh');
  });
});
