import type { z } from 'zod';

/** A player's id inside a room. Stable for the lifetime of the room. */
export type PlayerId = string;

/** Returned by `getResult` once the game is over. */
export interface GameResult {
  /** Empty array means a draw. */
  winners: PlayerId[];
}

/**
 * The contract every game implements. Games are PURE: no I/O, no randomness
 * except through `rng`, no mutation of the input state. The server is the only
 * place that calls `applyMove`; clients only render `getView` output.
 */
export interface GameDefinition<State, Move, View = State> {
  /** Unique, kebab-case. Also the folder name in `apps/web/src/games/`. */
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Validates the shape of an incoming move before any game logic runs. */
  moveSchema: z.ZodType<Move>;
  /** Creates the initial state. `rng` returns a float in [0, 1). */
  setup(players: PlayerId[], rng: () => number): State;
  /** Returns an error message if the move is illegal, otherwise `null`. */
  validateMove(state: State, move: Move, player: PlayerId): string | null;
  /** Returns the NEW state. Only called after `validateMove` returned `null`. */
  applyMove(state: State, move: Move, player: PlayerId, rng: () => number): State;
  /**
   * What `player` is allowed to see. Hide other players' cards here.
   * `player` is `null` for spectators: show only what is public to everyone.
   */
  getView(state: State, player: PlayerId | null): View;
  /** `null` while the game is still running. */
  getResult(state: State): GameResult | null;
}

// biome-ignore lint/suspicious/noExplicitAny: registry holds games of different types
export type AnyGameDefinition = GameDefinition<any, any, any>;

/** Helper that keeps full type inference when declaring a game. */
export function defineGame<State, Move, View = State>(
  game: GameDefinition<State, Move, View>,
): GameDefinition<State, Move, View> {
  return game;
}
