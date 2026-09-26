/**
 * Cards and the combinations of Tiến Lên (southern rules). A card is a number 0–51:
 * `rank * 4 + suit`, so a bigger number is always a stronger card.
 *   rank 0–12 = 3 4 5 6 7 8 9 10 J Q K A 2      suit 0–3 = ♠ ♣ ♦ ♥
 */

export type Card = number;

export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
export const SUITS = ['spade', 'club', 'diamond', 'heart'] as const;
export type Suit = (typeof SUITS)[number];

/** The rank of 2 (the strongest, "heo"). */
export const TWO = 12;

export const rankOf = (card: Card) => Math.floor(card / 4);
export const suitOf = (card: Card): Suit => SUITS[card % 4] as Suit;
export const isRed = (card: Card) => card % 4 >= 2;
/** "3♠", "10♥": for messages. */
export const cardName = (card: Card) => `${RANKS[rankOf(card)]}${['♠', '♣', '♦', '♥'][card % 4]}`;

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

/**
 * single, pair, triple, quad (tứ quý), straight (sảnh: 3+ ranks in a row, no 2) and pairs
 * (đôi thông: 3+ pairs in a row, no 2).
 */
export type Kind = 'single' | 'pair' | 'triple' | 'quad' | 'straight' | 'pairs';

export interface Combo {
  kind: Kind;
  /** How many cards. */
  size: number;
  /** The strongest card: two combos of the same kind and size compare by it. */
  top: Card;
}

/** What these cards make, or `null` if they are no combination. */
export function comboOf(cards: readonly Card[]): Combo | null {
  const sorted = [...cards].sort((a, b) => a - b);
  const size = sorted.length;
  const top = sorted[size - 1];
  if (top === undefined || new Set(sorted).size !== size) return null;
  const ranks = sorted.map(rankOf);
  const sameRank = ranks.every((r) => r === ranks[0]);
  if (size === 1) return { kind: 'single', size, top };
  if (sameRank && size <= 4) {
    return { kind: (['pair', 'triple', 'quad'] as const)[size - 2] as Kind, size, top };
  }
  if (ranks.includes(TWO)) return null;
  const inRow = (step: number) =>
    ranks.every((r, i) => r === (ranks[0] as number) + Math.floor(i / step));
  if (size >= 3 && inRow(1)) return { kind: 'straight', size, top };
  if (size >= 6 && size % 2 === 0 && inRow(2)) return { kind: 'pairs', size, top };
  return null;
}

/** Whether `play` may be put on `table` (a new round: `table` is null, anything goes). */
export function beats(play: Combo, table: Combo | null): boolean {
  if (!table) return true;
  if (play.kind === table.kind && play.size === table.size) return play.top > table.top;
  // Chặt: bombs beat the 2s and smaller bombs.
  const twos = rankOf(table.top) === TWO && (table.kind === 'single' || table.kind === 'pair');
  const pairsOf = (c: Combo) => (c.kind === 'pairs' ? c.size / 2 : 0);
  if (pairsOf(play) === 3) return twos && table.kind === 'single';
  if (play.kind === 'quad') return twos || pairsOf(table) === 3;
  if (pairsOf(play) >= 4) {
    const longer = pairsOf(play) > pairsOf(table);
    return twos || table.kind === 'quad' || (pairsOf(table) >= 3 && longer);
  }
  return false;
}

/** A bomb is played on a 2 or on another bomb: the special "chặt" sound. */
export function isChop(play: Combo, table: Combo | null) {
  return Boolean(table) && (play.kind !== table?.kind || play.size !== table?.size);
}
