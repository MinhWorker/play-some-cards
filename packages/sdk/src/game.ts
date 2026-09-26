import type { z } from 'zod';

/** A player's id inside a room (their account id). */
export type PlayerId = string;

/** Returned by `getResult` once the game is over. */
export interface GameResult {
  /** Empty array means a draw. */
  winners: PlayerId[];
}

/**
 * The room around a game, passed as the last argument of every rule (older games ignore it):
 * who sits where, the host, the score and the options. `undefined` in tests that don't set it.
 */
export interface RoomContext<Options = unknown> {
  /** Seated players in seat order (seat = index). */
  players: { id: PlayerId; name: string; bot: boolean }[];
  hostId: PlayerId | null;
  /** Wins per seat and draws over every game in the room. */
  score: { wins: number[]; draws: number };
  options: Options;
}

/**
 * A game's rules. They are PURE: no I/O, no randomness except through `rng`, no mutation of
 * the input state. Only the server calls `applyMove`; clients only draw `getView` output.
 */
export interface GameRules<State, Move, View = State, Options = undefined> {
  /** Validates the shape of an incoming move before any game logic runs. */
  moveSchema: z.ZodType<Move>;
  /**
   * Creates the initial state. `rng` returns a float in [0, 1). `options` are the room's
   * options (see `RoomSetup`), `undefined` for a game without them. Copy into the state what
   * the other rules need.
   */
  setup(
    players: PlayerId[],
    rng: () => number,
    options: Options,
    room?: RoomContext<Options>,
  ): State;
  /** Returns an error message (Vietnamese, shown to the player) if illegal, otherwise `null`. */
  validateMove(
    state: State,
    move: Move,
    player: PlayerId,
    room?: RoomContext<Options>,
  ): string | null;
  /** Returns the NEW state. Only called after `validateMove` returned `null`. */
  applyMove(
    state: State,
    move: Move,
    player: PlayerId,
    rng: () => number,
    room?: RoomContext<Options>,
  ): State;
  /**
   * What `player` is allowed to see. Hide other players' cards here.
   * `player` is `null` for spectators: show only what is public to everyone.
   */
  getView(state: State, player: PlayerId | null, room?: RoomContext<Options>): View;
  /** `null` while the game is still running. */
  getResult(state: State, room?: RoomContext<Options>): GameResult | null;
  /**
   * What `viewer` may see of a move `player` just made (boards animate it). Defaults to the whole
   * move; return `null` to hide it (e.g. a card passed face down).
   */
  moveView?(move: Move, player: PlayerId, viewer: PlayerId | null): unknown;
  /**
   * The computer's move for `player` (a seat the computer took, see `RoomSetup.bots`), or
   * `null` when it has nothing to do right now (not its turn). The server plays it after a short
   * pause and checks it like any other move.
   */
  bot?(
    state: State,
    player: PlayerId,
    rng: () => number,
    options: Options,
    room?: RoomContext<Options>,
  ): Move | null;
}

/**
 * A game's room options: the object its setup scene (`RoomSetupScene`, client side) passes to
 * `submit`. The server checks it here, then keeps it for the room's whole life: `setup` and
 * `bot` receive it, the board reads it as `props.options`. A game without `room` has no options.
 */
export interface RoomSetup<Options> {
  /**
   * Checks what the client sent and fills defaults. `parse({})` must work: it gives the options
   * of a room created without the setup scene (e.g. the sandbox).
   */
  options: z.ZodType<Options>;
  /** How many seats the computer takes in a new room (needs `rules.bot`). */
  bots?(options: Options): number;
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
export interface GamePlugin<State = unknown, Move = unknown, View = State, Options = undefined> {
  meta: GameMeta;
  rules: GameRules<State, Move, View, Options>;
  /** Optional room options, picked on the game's own setup screen. */
  room?: RoomSetup<Options>;
}

// biome-ignore lint/suspicious/noExplicitAny: a list of plugins holds games of different types
export type AnyGamePlugin = GamePlugin<any, any, any, any>;

/** Declares a game's rules with full type inference. */
export function defineGame<State, Move, View = State, Options = undefined>(
  rules: GameRules<State, Move, View, Options>,
): GameRules<State, Move, View, Options> {
  return rules;
}

/** Declares a game plugin: `export default definePlugin({ meta, rules, room? })`. */
export function definePlugin<State, Move, View, Options>(
  plugin: GamePlugin<State, Move, View, Options>,
): GamePlugin<State, Move, View, Options> {
  return plugin;
}

/** A room's options when nothing was picked (`undefined` for a game without `room`). */
export function defaultOptions<Options>(plugin: { room?: RoomSetup<Options> }): Options {
  return plugin.room?.options.parse({}) as Options;
}
