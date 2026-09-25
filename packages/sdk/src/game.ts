import type { z } from 'zod';

/** A player's id inside a room (their account id). */
export type PlayerId = string;

/** Returned by `getResult` once the game is over. */
export interface GameResult {
  /** Empty array means a draw. */
  winners: PlayerId[];
}

/**
 * A game's rules. They are PURE: no I/O, no randomness except through `rng`, no mutation of
 * the input state. Only the server calls `applyMove`; clients only draw `getView` output.
 */
export interface GameRules<State, Move, View = State> {
  /** Validates the shape of an incoming move before any game logic runs. */
  moveSchema: z.ZodType<Move>;
  /** Creates the initial state. `rng` returns a float in [0, 1). */
  setup(players: PlayerId[], rng: () => number): State;
  /** Returns an error message (Vietnamese, shown to the player) if illegal, otherwise `null`. */
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

/** How a game appears in the app. */
export interface GameMeta {
  /** Same as the game's folder name: `games/<id>/`. Kebab-case. */
  id: string;
  /** Vietnamese name shown to players. */
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * `wip` games can be played in local dev and PR previews, and are locked ("sắp có") in
   * production. Flip to `ready` when the game is done.
   */
  status: 'ready' | 'wip';
  /** Its entry on the home map: `image` is a file name in the game's `assets/` (no extension). */
  portal: { image: string };
}

/** What `games/<id>/src/index.ts` exports by default. Safe to load on the server. */
export interface GamePlugin<State = unknown, Move = unknown, View = State> {
  meta: GameMeta;
  rules: GameRules<State, Move, View>;
}

// biome-ignore lint/suspicious/noExplicitAny: a list of plugins holds games of different types
export type AnyGamePlugin = GamePlugin<any, any, any>;

/** Declares a game's rules with full type inference. */
export function defineGame<State, Move, View = State>(
  rules: GameRules<State, Move, View>,
): GameRules<State, Move, View> {
  return rules;
}

/** Declares a game plugin: `export default definePlugin({ meta, rules })`. */
export function definePlugin<State, Move, View>(
  plugin: GamePlugin<State, Move, View>,
): GamePlugin<State, Move, View> {
  return plugin;
}
