/**
 * What Mậu Binh remembers and what a room picks. Read this first; the logic is MauBinhGame.ts.
 *
 * A game in the room is a match of several rounds ("vòng"). Each round deals 13 cards to
 * everyone still at the table; everyone arranges them in secret into chi 1 (5 cards), chi 2
 * (5) and chi 3 (3), then all rows are shown at once and every pair of players settles
 * (scoring.ts). The most points after the last round wins.
 */
import { z } from 'zod';
import type { Card, Rows } from './cards.js';
import type { Duel, SpecialKind } from './scoring.js';

/**
 * The deal on screen (ms): the shuffle, then one card every `stepMs`, each flying `flyMs`, then
 * the hand turns face up in `flipMs`. The Game needs it too: arranging starts after the deal.
 */
export const DEAL = { shuffleMs: 760, stepMs: 28, flyMs: 240, flipMs: 220 };
/** How long dealing `cards` cards takes on screen, start to hands face up. */
export const dealMs = (cards: number) =>
  DEAL.shuffleMs + cards * DEAL.stepMs + DEAL.flyMs + DEAL.flipMs;
/** After the deal: "Vòng 2" in big letters. */
export const INTRO_MS = 1200;

/**
 * The reveal on screen (ms): "Lật bài!", then chi 1, 2, 3 one after another (each is laid down
 * in the middle of the table, turned over, compared and taken back), then everyone's total;
 * tới trắng and sập 3 chi get a cut-in. The Game waits for it before going on.
 */
export const REVEAL = { introMs: 1000, specialMs: 2000, chiMs: 2600, scoopMs: 1800, totalMs: 1500 };
export function revealMs(result: Pick<RoundResult, 'specials' | 'duels'>) {
  const specials = result.specials.some(Boolean) ? REVEAL.specialMs : 0;
  const scoops = result.duels.some((d) => d.scoop !== 0) ? REVEAL.scoopMs : 0;
  return REVEAL.introMs + specials + 3 * REVEAL.chiMs + scoops + REVEAL.totalMs;
}
/** The round's scores stay up this long after the reveal, before the next deal. */
export const ROUND_OVER_MS = 6000;

/** How a round ended: everyone's rows (shown to all once the round is over) and the scores. */
export interface RoundResult {
  /** Rows by seat (`null` for seats not dealt in). */
  rows: (Rows | null)[];
  /** Binh lủng. */
  fouls: boolean[];
  /** Left during the round: lost it like binh lủng. */
  forfeits: boolean[];
  /** Arranged by the computer when time ran out. */
  auto: boolean[];
  specials: (SpecialKind | null)[];
  duels: Duel[];
  /** Points each seat got in this round. */
  points: number[];
}

/**
 * deal: the cards are flying out and the round is announced (no moves yet);
 * arrange: everyone arranges in secret; show: the rows are revealed and scored, until the next
 * deal (or the match ends).
 */
export type Phase = 'deal' | 'arrange' | 'show';

/** Everything about a match in progress (on the server). */
export interface State {
  /** The round being played, from 1. */
  round: number;
  /** Rounds in the match (from the options). */
  rounds: number;
  phase: Phase;
  /** Each seat's 13 cards, sorted (empty for seats not in the round). */
  hands: Card[][];
  /** Seats dealt into this round. */
  inRound: boolean[];
  /** The rows each seat handed in ("Xong"), `null` while still arranging. */
  rows: (Rows | null)[];
  /** Seats that left during this round (they lose it). */
  forfeits: number[];
  /** Seats that left the match, in the order they left. */
  gone: number[];
  /** Match points per seat. */
  points: number[];
  results: RoundResult[];
}

/** What one player sees: their own cards and rows; of the others only who is done. */
export interface View extends Omit<State, 'hands' | 'rows'> {
  /** This player's cards (empty for a spectator). */
  hand: Card[];
  /** The rows this player handed in, `null` if not (yet). */
  mine: Rows | null;
  /** Who has handed in their rows. */
  ready: boolean[];
}

export const ROUNDS = [1, 3, 5] as const;
export const ARRANGE_SECONDS = [60, 90] as const;

/** Picked on the setup screen: computer players, how many rounds, the time to arrange. */
export const optionsSchema = z.object({
  bots: z.number().int().min(0).max(3).default(0),
  rounds: z.number().int().min(1).max(10).default(5),
  arrangeSeconds: z.number().int().min(20).max(180).default(90),
});
export type Options = z.infer<typeof optionsSchema>;
