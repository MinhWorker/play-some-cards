import type { GameEvent, Stored } from './engine.js';
import { defaultOptions, type GamePlugin, type GameResult, type PlayerId } from './game.js';
import { seededRng } from './rng.js';

export interface Play<Move> {
  player: PlayerId;
  move: Move;
}

/**
 * Plays a game the way the server does (schema check, validateMove, applyMove) and returns the
 * final state. Throws with the game's own message as soon as a move is rejected, so a test reads
 * like a script of the game:
 *
 *   const { state, result } = playMoves(plugin, ['a', 'b'], [{ player: 'a', move: { cell: 4 } }]);
 */
export function playMoves<State, Move, View, Options>(
  plugin: GamePlugin<State, Move, View, Options>,
  players: PlayerId[],
  plays: Play<Move>[],
  seed = 1,
  options: Options = defaultOptions(plugin),
): { state: State; result: GameResult | null } {
  const { rules } = plugin;
  const rng = seededRng(seed);
  let state = rules.setup(players, rng, options);
  plays.forEach(({ player, move }, i) => {
    const parsed = rules.moveSchema.safeParse(move);
    if (!parsed.success) throw new Error(`Move ${i + 1} has the wrong shape: ${parsed.error}`);
    const error = rules.validateMove(state, parsed.data, player);
    if (error) throw new Error(`Move ${i + 1} (${player}) was rejected: ${error}`);
    state = rules.applyMove(state, parsed.data, player, rng);
  });
  return { state, result: rules.getResult(state) };
}

/** The error message for a move, or `null` if it is legal (schema check included). */
export function moveError<State, Move, View, Options>(
  plugin: GamePlugin<State, Move, View, Options>,
  state: State,
  player: PlayerId,
  move: unknown,
): string | null {
  const parsed = plugin.rules.moveSchema.safeParse(move);
  if (!parsed.success) return 'wrong shape';
  return plugin.rules.validateMove(state, parsed.data, player);
}

/**
 * Throws if any of `secrets` (a card, a hand, a deck order…) appears anywhere in what `viewer`
 * sees. Check every player and `null` (spectators) for anything that must stay hidden.
 */
export function assertHidden<State, View, Options>(
  plugin: GamePlugin<State, unknown, View, Options>,
  state: State,
  viewer: PlayerId | null,
  ...secrets: unknown[]
): void {
  const view = JSON.stringify(plugin.rules.getView(state, viewer));
  for (const secret of secrets) {
    if (view.includes(JSON.stringify(secret))) {
      throw new Error(`${viewer ?? 'A spectator'} can see ${JSON.stringify(secret)}`);
    }
  }
}

/**
 * Plays a `Game` the way the server does, one event at a time, so a test reads like a script:
 *
 *   const game = testGame(plugin, ['a', 'b'], { options: { size: 6 } });
 *   game.send('a', 'place', { cell: 4 });                 // throws if the game rejects it
 *   expect(game.error('a', 'place', { cell: 5 })).toBe('Chưa tới lượt bạn');
 *   expect(game.state.board[4]).toBe('X');
 *
 * `options` are the picks (defaults filled by the plugin's `room.options`).
 */
export function testGame<State, View, Options>(
  plugin: GamePlugin<Stored<State>, GameEvent, View, Options>,
  players: PlayerId[],
  { options, seed = 1 }: { options?: Partial<Options>; seed?: number } = {},
) {
  const { rules } = plugin;
  const rng = seededRng(seed);
  const opts = (plugin.room ? plugin.room.options.parse(options ?? {}) : options) as Options;
  let stored = rules.setup(players, rng, opts);
  const move = (event: string, payload?: object): GameEvent => ({ event, payload });
  const session = {
    /** The game's state now. */
    get state(): State {
      return stored.state;
    },
    /** `null` while playing, then the winners. */
    get result(): GameResult | null {
      return rules.getResult(stored);
    },
    /** What `player` sees (`null` = a spectator). */
    view(player: PlayerId | null): View {
      return rules.getView(stored, player);
    },
    /** Plays an event; throws with the game's message if it is rejected. */
    send(player: PlayerId, event: string, payload?: object) {
      const error = rules.validateMove(stored, move(event, payload), player);
      if (error) throw new Error(`${player} ${event} was rejected: ${error}`);
      stored = rules.applyMove(stored, move(event, payload), player, rng);
      return session;
    },
    /** The message the game would reject this event with, or `null` if it is fine. */
    error(player: PlayerId, event: string, payload?: object) {
      return rules.validateMove(stored, move(event, payload), player);
    },
    /** What the computer would play for `player` now (`null` = nothing). */
    bot(player: PlayerId) {
      return rules.bot?.(stored, player, rng, opts) ?? null;
    },
  };
  return session;
}
