/**
 * The computer's brain: which cards to play (or `null` to pass).
 *   easy    any legal play, and sometimes passes when it could play
 *   normal  the weakest play that works; leading, sheds its lowest card in the longest set
 *   hard    like normal, but keeps its 2s and bombs until they matter
 */
import { pick, type Rng } from '@xomdao/sdk';
import { beats, type Card, type Combo, comboOf, rankOf, TWO } from './cards.js';
import type { BotLevel, State } from './model.js';

/** Every combination this hand can make (for the bot; enough variety, not every subset). */
export function combosOf(hand: readonly Card[]): Card[][] {
  const byRank = new Map<number, Card[]>();
  for (const card of [...hand].sort((a, b) => a - b)) {
    byRank.set(rankOf(card), [...(byRank.get(rankOf(card)) ?? []), card]);
  }
  const out: Card[][] = hand.map((c) => [c]);
  // Pairs, triples, quads: every choice of suits (at most 6 pairs of one rank).
  for (const cards of byRank.values()) {
    for (const size of [2, 3, 4]) out.push(...choose(cards, size));
  }
  // Straights and runs of pairs: lowest suits below, every suit choice for the top.
  for (let start = 0; start < TWO; start++) {
    for (const width of [1, 2]) {
      const run: Card[] = [];
      for (let rank = start; rank < TWO; rank++) {
        const cards = byRank.get(rank) ?? [];
        if (cards.length < width) break;
        const length = rank - start + 1;
        if (length >= 3) {
          for (const top of choose(cards, width)) out.push([...run, ...top]);
        }
        run.push(...cards.slice(0, width));
      }
    }
  }
  return out;
}

function choose(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  return cards.flatMap((card, i) =>
    choose(cards.slice(i + 1), size - 1).map((rest) => [card, ...rest]),
  );
}

const isBomb = (c: Combo) => c.kind === 'quad' || c.kind === 'pairs';
const strength = (cards: Card[]) => Math.max(...cards);

export function botPlay(state: State, seat: number, level: BotLevel, rng: Rng): Card[] | null {
  const hand = state.hands[seat] ?? [];
  const table = state.table && comboOf(state.table.cards);
  const legal = combosOf(hand).filter((cards) => {
    const combo = comboOf(cards);
    if (!combo || !beats(combo, table)) return false;
    return state.mustPlay === null || cards.includes(state.mustPlay);
  });
  if (legal.length === 0) return null;
  if (level === 'easy') return table && rng() < 0.25 ? null : pick(rng, legal);

  // Leading: get rid of the lowest card, in the longest set that holds it.
  if (!table) {
    const lowest = Math.min(...hand);
    const withLowest = legal.filter((cards) => cards.includes(lowest));
    const pool = withLowest.length ? withLowest : legal;
    return pool.reduce((best, cards) =>
      cards.length > best.length ||
      (cards.length === best.length && strength(cards) < strength(best))
        ? cards
        : best,
    );
  }
  // Following: the weakest play of the same shape, bombs only when nothing else works.
  const same = legal.filter((cards) => comboOf(cards)?.kind === table.kind);
  const pool = same.length ? same : legal;
  const choice = pool.reduce((best, cards) => (strength(cards) < strength(best) ? cards : best));
  if (level === 'hard') {
    const combo = comboOf(choice) as Combo;
    const spendsTwo = choice.some((c) => rankOf(c) === TWO);
    const onTwo = rankOf(table.top) === TWO;
    const danger = state.hands.some((h, s) => s !== seat && h.length > 0 && h.length <= 3);
    if ((spendsTwo || isBomb(combo)) && !onTwo && !danger && hand.length > choice.length) {
      return null;
    }
  }
  return choice;
}
