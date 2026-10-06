/**
 * Cards and hands of Bài Cào. A card is a number 0–51: `rank * 4 + suit`, so a bigger number is
 * always a stronger card (for breaking ties).
 *   rank 0–12 = A 2 3 4 5 6 7 8 9 10 J Q K      suit 0–3 = ♣ ♠ ♥ ♦ (tép, bích, cơ, rô)
 */

export type Card = number;

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['club', 'spade', 'heart', 'diamond'] as const;
export type Suit = (typeof SUITS)[number];

export const rankOf = (card: Card) => Math.floor(card / 4);
export const suitOf = (card: Card): Suit => SUITS[card % 4] as Suit;
export const isRed = (card: Card) => card % 4 >= 2;
/** "A♣", "10♦": for messages. */
export const cardName = (card: Card) => `${RANKS[rankOf(card)]}${['♣', '♠', '♥', '♦'][card % 4]}`;

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

/** A card's points: A is 1, 2–9 their number, 10 J Q K nothing. */
export const pointsOf = (card: Card) => (rankOf(card) >= 9 ? 0 : rankOf(card) + 1);

/** A face card: J, Q or K. */
export const isFace = (card: Card) => rankOf(card) >= 10;

export interface Hand {
  /** Ba Tây: three face cards, the best hand there is. */
  tay: boolean;
  /** The points' last digit (0 = "bù"). */
  points: number;
  /** The strongest card, which breaks ties. */
  top: Card;
}

export function handOf(cards: readonly Card[]): Hand {
  return {
    tay: cards.length === 3 && cards.every(isFace),
    points: cards.reduce((sum, c) => sum + pointsOf(c), 0) % 10,
    top: Math.max(...cards),
  };
}

/** > 0 when `a` beats `b` (never 0 for two different hands of real cards). */
export function compareHands(a: Hand, b: Hand): number {
  if (a.tay !== b.tay) return a.tay ? 1 : -1;
  if (a.points !== b.points) return a.points - b.points;
  return a.top - b.top;
}

/** What a hand is called: "Ba Tây", "9 nút", "Bù". */
export function handName(hand: Hand): string {
  if (hand.tay) return 'Ba Tây';
  return hand.points ? `${hand.points} nút` : 'Bù';
}
