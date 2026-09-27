/**
 * Arranging 13 cards well: the computer's rows, the rows of whoever runs out of time, and the
 * "Tự xếp" button. Tries every valid 5–5–3 split (about 72 000) and keeps the one most likely to
 * win chi, counting the chi bonuses.
 */
import { type Card, handOf, type Rows } from './cards.js';
import { chiPoints } from './scoring.js';

/**
 * About how often a chi of each category wins (by category, weakest first); a hand's place
 * within its category moves it towards the next one.
 */
const WIN_CHANCE = [
  [0, 0.08, 0.28, 0.5, 0.62, 0.74, 0.86, 0.97, 1, 1],
  [0.03, 0.3, 0.6, 0.78, 0.86, 0.92, 0.97, 1, 1, 1],
  [0.05, 0.4, 0.95, 0.97, 1],
];
const CATEGORY = 13 ** 5;

/** How good `cards` are as chi `chi` (0–2): chance to win it times what it is worth. */
function worth(chi: number, cards: Card[]) {
  const { category, strength } = handOf(cards);
  const chances = WIN_CHANCE[chi] as number[];
  // A 3-card chi: high card, pair, three of a kind = steps 0, 1, 2 of its table.
  const step = chi === 2 ? Math.min(category, 2) : category;
  const low = chances[step] as number;
  const high = chances[step + 1] as number;
  const chance = low + (high - low) * ((strength % CATEGORY) / CATEGORY);
  return chance * chiPoints(chi, cards);
}

const bits = (mask: number) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
};

/** The best valid rows for these 13 cards. */
export function bestRows(hand: readonly Card[]): Rows {
  const cardsOf = (mask: number) => hand.filter((_, i) => mask & (1 << i));
  const all = (1 << hand.length) - 1;
  // Each 5- and 3-card choice, worked out once: its strength and its worth in each chi.
  const strength = new Float64Array(all + 1);
  const worth1 = new Float64Array(all + 1);
  const worth2 = new Float64Array(all + 1);
  const worth3 = new Float64Array(all + 1);
  const fives: number[] = [];
  for (let mask = 0; mask <= all; mask++) {
    const n = bits(mask);
    if (n !== 5 && n !== 3) continue;
    const cards = cardsOf(mask);
    strength[mask] = handOf(cards).strength;
    if (n === 5) {
      fives.push(mask);
      worth1[mask] = worth(0, cards);
      worth2[mask] = worth(1, cards);
    } else worth3[mask] = worth(2, cards);
  }
  let best = { score: -1, masks: [0, 0, 0] };
  for (const one of fives) {
    const rest = all ^ one;
    // Every 5 of the 8 cards left for chi 2 (the submasks of `rest`).
    for (let two = rest; two; two = (two - 1) & rest) {
      if (bits(two) !== 5) continue;
      const three = rest ^ two;
      const s2 = strength[two] ?? 0;
      if (s2 > (strength[one] ?? 0) || (strength[three] ?? 0) > s2) continue;
      const score = (worth1[one] ?? 0) + (worth2[two] ?? 0) + (worth3[three] ?? 0);
      if (score > best.score) best = { score, masks: [one, two, three] };
    }
  }
  const [one, two, three] = best.masks.map(cardsOf) as [Card[], Card[], Card[]];
  return [one, two, three];
}
