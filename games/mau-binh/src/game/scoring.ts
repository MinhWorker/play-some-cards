/**
 * Scoring a round: tới trắng (special 13-card hands), binh lủng, and chi against chi. Every pair
 * of players settles on its own ("duel"); a player's round is the sum of their duels.
 * The numbers here are the rules panel's too (scenes/RulesPanel.ts shows them).
 */
import {
  ACE,
  type Card,
  FULL_HOUSE,
  foulOf,
  handOf,
  QUADS,
  type Rows,
  rankOf,
  STRAIGHT_FLUSH,
  TRIPS,
} from './cards.js';

/** Each chi won: +1. */
export const CHI_POINT = 1;
/** Winning all three chi against someone ("sập 3 chi"): this on top. */
export const SCOOP_BONUS = 3;
/** Binh lủng loses this to every opponent whose rows are fine. */
export const FOUL_POINTS = 6;

/** A chi won with a special hand is worth more than 1 (by chi: 0 = chi 1, 1 = chi 2, 2 = chi 3). */
export const CHI_BONUSES: { chi: number; category: number; points: number; name: string }[] = [
  { chi: 2, category: TRIPS, points: 3, name: 'Sám cô chi 3' },
  { chi: 1, category: FULL_HOUSE, points: 2, name: 'Cù lũ chi 2' },
  { chi: 0, category: QUADS, points: 4, name: 'Tứ quý chi 1' },
  { chi: 1, category: QUADS, points: 8, name: 'Tứ quý chi 2' },
  { chi: 0, category: STRAIGHT_FLUSH, points: 5, name: 'Thùng phá sảnh chi 1' },
  { chi: 1, category: STRAIGHT_FLUSH, points: 10, name: 'Thùng phá sảnh chi 2' },
];

/** What winning chi `chi` with `cards` is worth. */
export function chiPoints(chi: number, cards: readonly Card[]) {
  const { category } = handOf(cards);
  return CHI_BONUSES.find((b) => b.chi === chi && b.category === category)?.points ?? CHI_POINT;
}

/** Tới trắng: the whole 13 cards win at once, strongest last. */
export const SPECIALS = [
  { kind: 'three-straights', name: 'Ba sảnh', points: 3 },
  { kind: 'three-flushes', name: 'Ba thùng', points: 3 },
  { kind: 'six-pairs', name: 'Sáu đôi', points: 3 },
  { kind: 'five-pairs-trips', name: 'Năm đôi một sám', points: 6 },
  { kind: 'dragon', name: 'Sảnh rồng', points: 13 },
  { kind: 'dragon-flush', name: 'Sảnh rồng đồng chất', points: 26 },
] as const;
export type SpecialKind = (typeof SPECIALS)[number]['kind'];
export const specialInfo = (kind: SpecialKind | null) => SPECIALS.find((s) => s.kind === kind);
const specialPoints = (kind: SpecialKind | null) => specialInfo(kind)?.points ?? 0;

/** The best tới trắng in 13 cards, or `null`. It counts whatever the player's rows. */
export function specialOf(hand: readonly Card[]): SpecialKind | null {
  const counts = Array<number>(13).fill(0);
  for (const c of hand) counts[rankOf(c)] = (counts[rankOf(c)] ?? 0) + 1;
  const found: SpecialKind[] = [];
  if (counts.every((n) => n === 1)) {
    found.push(hand.every((c) => c % 4 === (hand[0] as Card) % 4) ? 'dragon-flush' : 'dragon');
  }
  const pairs = counts.reduce((sum, n) => sum + Math.floor(n / 2), 0);
  const trips = counts.indexOf(3);
  if (trips >= 0 && counts.reduce((s, n, r) => s + (r === trips ? 0 : Math.floor(n / 2)), 0) >= 5) {
    found.push('five-pairs-trips');
  }
  if (pairs >= 6) found.push('six-pairs');
  if (threeFlushes(hand)) found.push('three-flushes');
  if (threeStraights(counts)) found.push('three-straights');
  return found.sort((a, b) => specialPoints(b) - specialPoints(a))[0] ?? null;
}

/** Whether the suits split into two flushes of 5 and one of 3. */
function threeFlushes(hand: readonly Card[]) {
  const suits = [0, 1, 2, 3].map((s) => hand.filter((c) => c % 4 === s).length);
  const parts = [5, 5, 3];
  // Give each chi a suit (4³ ways); the suits must be filled exactly.
  for (let pick = 0; pick < 64; pick++) {
    const filled = [0, 0, 0, 0];
    parts.forEach((size, i) => {
      const suit = Math.floor(pick / 4 ** i) % 4;
      filled[suit] = (filled[suit] ?? 0) + size;
    });
    if (filled.every((n, s) => n === suits[s])) return true;
  }
  return false;
}

/** Straights of `length` as rank lists, A-2-3… (the ace low) first. */
function runs(length: number): number[][] {
  const low = [ACE, ...Array.from({ length: length - 1 }, (_, i) => i)];
  const rest = Array.from({ length: 14 - length }, (_, start) =>
    Array.from({ length }, (_, i) => start + i),
  );
  return [low, ...rest];
}

/** Whether the ranks split into two straights of 5 and one of 3. */
function threeStraights(counts: number[]) {
  const take = (left: number[], run: number[]) => {
    const next = [...left];
    for (const r of run) {
      next[r] = (next[r] ?? 0) - 1;
      if ((next[r] as number) < 0) return null;
    }
    return next;
  };
  for (const three of runs(3)) {
    const a = take(counts, three);
    if (!a) continue;
    for (const five of runs(5)) {
      const b = take(a, five);
      if (b && runs(5).some((other) => take(b, other))) return true;
    }
  }
  return false;
}

/** How one pair of players settled. Points are for `a`; `b` gets the opposite. */
export interface Duel {
  a: number;
  b: number;
  /** special: tới trắng decided it; foul: binh lủng (or leaving); chi: the three chi. */
  kind: 'special' | 'foul' | 'chi';
  /** Points for `a` from each chi (only `chi` duels). */
  chi: number[];
  /** Someone won all three chi: +1 for `a`, −1 for `b`, 0 for nobody. */
  scoop: number;
  points: number;
}

/** A player as the round's scoring sees them. */
export interface Entry {
  rows: Rows;
  /** Binh lủng, or out of the round (left): loses like binh lủng, no tới trắng. */
  foul: boolean;
  special: SpecialKind | null;
}

export function entryOf(rows: Rows, forfeit: boolean): Entry {
  return {
    rows,
    foul: forfeit || foulOf(rows) !== null,
    special: forfeit ? null : specialOf(rows.flat()),
  };
}

export function duel(a: number, b: number, ea: Entry, eb: Entry): Duel {
  const base = { a, b, chi: [], scoop: 0 };
  const sa = specialPoints(ea.special);
  const sb = specialPoints(eb.special);
  if (sa || sb) {
    return { ...base, kind: 'special', points: sa > sb ? sa : sb > sa ? -sb : 0 };
  }
  if (ea.foul || eb.foul) {
    const points = ea.foul === eb.foul ? 0 : ea.foul ? -FOUL_POINTS : FOUL_POINTS;
    return { ...base, kind: 'foul', points };
  }
  const chi = ea.rows.map((cards, i) => {
    const other = eb.rows[i] as Card[];
    const diff = handOf(cards).strength - handOf(other).strength;
    return diff > 0 ? chiPoints(i, cards) : diff < 0 ? -chiPoints(i, other) : 0;
  });
  const scoop = chi.every((p) => p > 0) ? 1 : chi.every((p) => p < 0) ? -1 : 0;
  const points = chi.reduce((s, p) => s + p, 0) + scoop * SCOOP_BONUS;
  return { ...base, kind: 'chi', chi, scoop, points };
}

/** Every pair of `entries` (seats without an entry sit out), and each seat's total. */
export function scoreRound(entries: (Entry | null)[]) {
  const duels: Duel[] = [];
  const points = entries.map(() => 0);
  entries.forEach((ea, a) => {
    entries.forEach((eb, b) => {
      if (!ea || !eb || b <= a) return;
      const d = duel(a, b, ea, eb);
      duels.push(d);
      points[a] = (points[a] ?? 0) + d.points;
      points[b] = (points[b] ?? 0) - d.points;
    });
  });
  return { duels, points };
}

/** `seat`'s side of a duel: points for them, and for each chi. */
export function sideOf(d: Duel, seat: number) {
  const sign = d.a === seat ? 1 : -1;
  return {
    other: d.a === seat ? d.b : d.a,
    // `|| 0`: no −0 on screen.
    points: d.points * sign || 0,
    chi: d.chi.map((p) => p * sign || 0),
    scoop: d.scoop * sign || 0,
  };
}
