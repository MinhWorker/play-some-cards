/**
 * What Tiến Lên remembers and what a room picks. Read this first; the logic is TienLenGame.ts.
 *
 * A game in the room is a match of several rounds ("vòng"). Each round deals 13 cards to
 * everyone still at the table and ends when all of them are ranked; ranks give points, and the
 * most points after the last round wins. A round is played in tricks: a trick ends when everyone
 * else passes on the last play.
 */
import { z } from 'zod';
import type { Card, Kind } from './cards.js';

/**
 * The deal on screen (ms): the shuffle, then one card every `stepMs`, each flying `flyMs`, then
 * the hand turns face up in `flipMs`. The Game needs it too: play starts after the deal.
 */
export const DEAL = { shuffleMs: 760, stepMs: 28, flyMs: 240, flipMs: 220 };
/** How long dealing `cards` cards takes on screen, start to hands face up. */
export const dealMs = (cards: number) =>
  DEAL.shuffleMs + cards * DEAL.stepMs + DEAL.flyMs + DEAL.flipMs;
/** After the deal: "Vòng 2" in big letters, then "Lan đi trước". */
export const INTRO = { roundMs: 1200, leadMs: 1200 };
/** The round's ranking stays up this long before the next deal. */
export const ROUND_OVER_MS = 5000;

/** Cards someone put on the table. */
export interface Play {
  seat: number;
  cards: Card[];
  kind: Kind;
  /** The trick it was played in (older tricks lie under the current one). */
  trick: number;
}

/** How a round ended. */
export interface RoundResult {
  /** Seats best first (who left mid-round are at the bottom). */
  order: number[];
  /** Points each seat got in this round (0 for seats not in it). */
  points: number[];
  /**
   * Who was still holding cards when the round ended (`null` when everyone else left), and
   * those cards: last with 2s in hand is "thối heo".
   */
  holder: number | null;
  leftover: Card[];
}

/**
 * deal: the cards are flying out and the round is announced (no moves yet);
 * play: the round is on; over: its ranking is shown until the next deal (or the match ends).
 */
export type Phase = 'deal' | 'play' | 'over';

/** Everything about a match in progress (on the server). */
export interface State {
  /** The round being played, from 1. */
  round: number;
  /** Rounds in the match (from the options). */
  rounds: number;
  phase: Phase;
  /** Each seat's cards, sorted weakest first (empty for seats not in the round). */
  hands: Card[][];
  /** Seats dealt into this round. */
  inRound: boolean[];
  /** Who leads this round. */
  lead: number;
  /** What must be beaten now; `null` when the turn player starts a new trick. */
  table: Play | null;
  /** Every play of this round in order: the messy pile in the middle. */
  played: Play[];
  /** Tricks so far in this round. */
  trick: number;
  /** Whose turn it is (a seat). */
  turn: number;
  /** Who passed in this trick (they sit out until the next trick). */
  passed: boolean[];
  /** The match's first play must include this card (the lowest one dealt). */
  mustPlay: Card | null;
  /** Seats that emptied their hand this round, best first. */
  out: number[];
  /** Seats that left during this round, placed from the bottom (the first to leave is last). */
  sunk: number[];
  /** Seats that left the match, in the order they left. */
  gone: number[];
  /** Match points per seat. */
  points: number[];
  /** Rounds won per seat (breaks ties on points). */
  firsts: number[];
  results: RoundResult[];
}

/** What one player sees: their own hand, only the size of the others'. */
export interface View extends Omit<State, 'hands'> {
  /** This player's cards (empty for a spectator). */
  hand: Card[];
  /** How many cards each seat holds. */
  counts: number[];
}

export type BotLevel = 'easy' | 'normal' | 'hard';

export const ROUNDS = [1, 3, 5, 10] as const;
export const TURN_SECONDS = [15, 20, 30] as const;

/** Picked on the setup screen: computer players, how strong, how many rounds, the turn clock. */
export const optionsSchema = z.object({
  bots: z.number().int().min(0).max(3).default(0),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  rounds: z.number().int().min(1).max(10).default(5),
  /** Seconds per turn when two or more people play (a table with the computer has no clock). */
  turnSeconds: z.number().int().min(5).max(60).default(20),
});
export type Options = z.infer<typeof optionsSchema>;
