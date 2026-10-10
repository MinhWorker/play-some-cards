import type { z } from 'zod';
import type { Catalogs } from './console/parser.js';
import { type Game, type GameEvent, gameRules, type Seat, type Stored } from './engine.js';

/** A player's id inside a room (their account id). */
export type PlayerId = string;

/** Returned by `getResult` once the game is over. */
export interface GameResult {
  /** Empty array means a draw. */
  winners: PlayerId[];
  /**
   * What the game gave out with `ctx.reward` (absent when nothing). The server pays it into the
   * players' balances once, within the game's `meta.rewardCap`.
   */
  rewards?: Reward[];
}

/** One `ctx.reward(player, resource, amount)`. */
export interface Reward {
  player: PlayerId;
  /** A namespaced resource: `core:coin`. */
  resource: string;
  /** A whole number above 0. */
  amount: number;
}

/**
 * The room around a game, passed as the last argument of every rule:
 * who sits where, the host, the score and the options. `undefined` in tests that don't set it.
 */
export interface RoomContext<Options = unknown> {
  /** Seated players in seat order (seat = index). */
  players: { id: PlayerId; name: string; bot: boolean; avatar?: string; frame?: string }[];
  hostId: PlayerId | null;
  /** Wins per seat and draws over every game in the room. */
  score: { wins: number[]; draws: number };
  options: Options;
  /** How the previous game in this room ended; `null` for the first one or a new table. */
  lastResult?: GameResult | null;
}

/**
 * What the server and the sandbox run: a `Game` turned into plain functions by `gameRules`
 * (`definePlugin` does it). Games don't write these; they write a `Game`.
 */
export interface GameRules<State, Move, View = State, Options = undefined> {
  /** Validates the shape of an incoming move before any game logic runs. */
  moveSchema: z.ZodType<Move>;
  /** Event parameter schemas, for the dev console. */
  events: Record<string, z.ZodType>;
  /** Optional dev-only game commands and catalog metadata. */
  commands?: Record<string, z.ZodObject>;
  catalogs?: Catalogs;
  /** Runs cmd<Name> through the same hook/timer/result bookkeeping as moves. */
  runCommand?(
    stored: State,
    name: string,
    args: unknown,
    rng: () => number,
    room?: RoomContext<Options>,
  ): State;
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
  /** Everyone seated when the game began, in seat order (`left` = gone since). */
  seats(state: State, room?: RoomContext<Options>): Seat[];
  /** The timer the game set (see `GameContext.setTimer`); `id` changes with each new one. */
  timer(state: State): { id: number; ms: number; event: string } | null;
  /** The timer went off: runs its hook. */
  fireTimer(state: State, rng: () => number, room?: RoomContext<Options>): State;
  /**
   * A player left mid-game and the game goes on without them. Missing when the game has no
   * `onLeave` hook: then leaving stops the game for everyone.
   */
  leave?(state: State, player: PlayerId, rng: () => number, room?: RoomContext<Options>): State;
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
  /**
   * The options of a quick-match room (CHƠI in the hub) once the computer takes `count` empty
   * seats, which `bots` must then report. Without it, quick-match rooms wait for people.
   */
  withBots?(options: Options, count: number): Options;
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
  /**
   * `table` (the default): a game played in rooms whenever you like. `event`: open only between
   * `event.opensAt` and `event.closesAt`.
   */
  kind?: GameKind;
  /**
   * Its genre island in the hub: an id from the core genre list (`genres` in @xomdao/shared:
   * `co`, `bai`…). A game without one stays out of the hub's catalog.
   */
  genre?: string;
  /** One short Vietnamese sentence for its game card ("Xếp năm quân liền hàng trước đối thủ."). */
  tagline: string;
  /** How many minutes one game usually takes, shown on the card as "min–max phút". */
  duration: { min: number; max: number };
  /** Its game card art: a file name in `assets/` (no extension). Defaults to `portal.image`. */
  card?: string;
  /**
   * The most one player can win from one game, per resource (`{ 'core:coin': 50 }`). The server
   * refuses rewards above it; a game without it gives none.
   */
  rewardCap?: Record<string, number>;
  /** Required when `kind` is `event`: when it is open and its reward tiers. */
  event?: EventMeta;
}

/** `meta.kind`: see `GameMeta`. */
export type GameKind = 'table' | 'event';

/**
 * A time-limited event (`kind: 'event'`). Players earn its points with
 * `ctx.reward(player, EVENT_POINTS, amount)` (`'event:point'`, within `meta.rewardCap`); the
 * server adds them to each player's progress in this event while it is open, and pays a tier's
 * `reward` once when the player claims it.
 */
export interface EventMeta {
  /** ISO 8601 date-times, `opensAt` before `closesAt`. Outside them the event is hidden. */
  opensAt: string;
  closesAt: string;
  /** Rewards by milestone, in increasing `points`. */
  tiers: { points: number; reward: Record<string, number> }[];
  /** Its detail board's colour (`#RRGGBB`), e.g. lacquer red for Trung Thu. */
  color?: string;
}

/** The resource an event's game gives points in (`ctx.reward(player, EVENT_POINTS, 3)`). */
export const EVENT_POINTS = 'event:point';

/** What `games/<id>/src/index.ts` exports by default. Safe to load on the server. */
export interface GamePlugin<State = unknown, Move = unknown, View = State, Options = undefined> {
  meta: GameMeta;
  rules: GameRules<State, Move, View, Options>;
  /** Optional room options, picked on the game's own setup screen. */
  room?: RoomSetup<Options>;
}

// biome-ignore lint/suspicious/noExplicitAny: a list of plugins holds games of different types
export type AnyGamePlugin = GamePlugin<any, any, any, any>;

/**
 * Declares a game: `export default definePlugin({ meta, game: new MyGame(), room? })`. The server
 * runs the `Game` through `gameRules`.
 */
export function definePlugin<State, Options, View>({
  meta,
  game,
  room,
}: {
  meta: GameMeta;
  game: Game<State, Options, View>;
  /** Optional room options, picked on the game's own setup screen. */
  room?: RoomSetup<Options>;
}): GamePlugin<Stored<State>, GameEvent, View, Options> {
  return { meta, rules: gameRules(game), room };
}

/** A room's options when nothing was picked (`undefined` for a game without `room`). */
export function defaultOptions<Options>(plugin: { room?: RoomSetup<Options> }): Options {
  return plugin.room?.options.parse({}) as Options;
}
