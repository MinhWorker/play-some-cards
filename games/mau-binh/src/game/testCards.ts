/** Cards by name for tests: `cards('A♠ K♠ 10♥')`. */
import { type Card, RANKS } from './cards.js';

const SUIT_SIGNS = ['♠', '♣', '♦', '♥'];

export function cards(names: string): Card[] {
  return names
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => {
      const rank = RANKS.indexOf(name.slice(0, -1) as (typeof RANKS)[number]);
      const suit = SUIT_SIGNS.indexOf(name.slice(-1));
      if (rank < 0 || suit < 0) throw new Error(`Not a card: ${name}`);
      return rank * 4 + suit;
    });
}
