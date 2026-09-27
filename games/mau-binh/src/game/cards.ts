/**
 * Cards and hands ("bộ") of Mậu Binh. A card is a number 0–51: `rank * 4 + suit`.
 *   rank 0–12 = 2 3 4 5 6 7 8 9 10 J Q K A      suit 0–3 = ♠ ♣ ♦ ♥ (suits never break ties)
 *
 * A hand's strength is one number (`strength`), so comparing two hands, even a 3-card chi with
 * a 5-card one, is comparing two numbers.
 */

export type Card = number;

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['spade', 'club', 'diamond', 'heart'] as const;
export type Suit = (typeof SUITS)[number];

/** The rank of A (the highest; also the lowest card of A-2-3-4-5). */
export const ACE = 12;

export const rankOf = (card: Card) => Math.floor(card / 4);
export const suitOf = (card: Card): Suit => SUITS[card % 4] as Suit;
export const isRed = (card: Card) => card % 4 >= 2;
export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

/**
 * Hand categories, weakest first. A 3-card chi is only ever high card, pair or three of a kind.
 * mậu thầu, đôi, thú (two pairs), sám cô, sảnh, thùng, cù lũ, tứ quý, thùng phá sảnh.
 */
export const HIGH = 0;
export const PAIR = 1;
export const TWO_PAIRS = 2;
export const TRIPS = 3;
export const STRAIGHT = 4;
export const FLUSH = 5;
export const FULL_HOUSE = 6;
export const QUADS = 7;
export const STRAIGHT_FLUSH = 8;

export const HAND_NAMES = [
  'Mậu thầu',
  'Đôi',
  'Thú',
  'Sám cô',
  'Sảnh',
  'Thùng',
  'Cù lũ',
  'Tứ quý',
  'Thùng phá sảnh',
] as const;

export interface Hand {
  category: number;
  /** Compare two hands by this: higher is stronger, equal is a tie. */
  strength: number;
}

const DIGIT = 13;
const CATEGORY = DIGIT ** 5;

/**
 * What 3 or 5 cards make. The tie-break ranks come after the category: the ranks that make the
 * hand first, then the others high to low. A 3-card chi's missing ranks count as below any card,
 * so it is never equal to a 5-card chi.
 */
export function handOf(cards: readonly Card[]): Hand {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Ranks ordered by how many there are, then high to low: [trips, pair] or [pair, pair, kicker].
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map(([, n]) => n).join('');
  const byGroup = groups.map(([r]) => r);
  const five = cards.length === 5;
  const flush = five && cards.every((c) => c % 4 === (cards[0] as Card) % 4);
  const wheel = five && shape === '11111' && ranks.join() === [ACE, 3, 2, 1, 0].join();
  const run =
    five && shape === '11111' && ((ranks[0] as number) - (ranks[4] as number) === 4 || wheel);
  // A-2-3-4-5 is the lowest straight: its top card is the 5.
  const top = wheel ? 3 : (ranks[0] as number);
  if (run && flush) return make(STRAIGHT_FLUSH, [top]);
  if (shape === '41') return make(QUADS, byGroup);
  if (shape === '32') return make(FULL_HOUSE, byGroup);
  if (flush) return make(FLUSH, ranks);
  if (run) return make(STRAIGHT, [top]);
  if (shape.startsWith('3')) return make(TRIPS, byGroup);
  if (shape.startsWith('22')) return make(TWO_PAIRS, byGroup);
  if (shape.startsWith('2')) return make(PAIR, byGroup);
  return make(HIGH, ranks);
}

function make(category: number, ranks: number[]): Hand {
  let strength = category * CATEGORY;
  ranks.forEach((r, i) => {
    strength += r * DIGIT ** (4 - i);
  });
  return { category, strength };
}

/** "Thùng", "Đôi"… */
export const handName = (cards: readonly Card[]) => HAND_NAMES[handOf(cards).category] ?? '';

/** The three chi, as dealt out by a player: chi 1 (5 cards), chi 2 (5 cards), chi 3 (3 cards). */
export type Rows = [Card[], Card[], Card[]];
export const ROW_SIZES = [5, 5, 3] as const;

/**
 * Why these rows are "binh lủng" (a weaker chi below a stronger one), or `null` when they are
 * fine. Equal chi are fine.
 */
export function foulOf(rows: Rows): string | null {
  const [one, two, three] = rows.map((r) => handOf(r).strength) as [number, number, number];
  if (two > one) return 'Chi 2 mạnh hơn chi 1';
  if (three > two) return 'Chi 3 mạnh hơn chi 2';
  return null;
}

/** Whether `rows` are exactly the 13 cards of `hand`, 5–5–3. */
export function isArrangementOf(rows: Rows, hand: readonly Card[]) {
  const cards = rows.flat();
  return (
    rows.every((r, i) => r.length === ROW_SIZES[i]) &&
    cards.length === hand.length &&
    new Set(cards).size === cards.length &&
    cards.every((c) => hand.includes(c))
  );
}
