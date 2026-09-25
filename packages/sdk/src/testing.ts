import type { GamePlugin, GameResult, PlayerId } from './game.js';
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
export function playMoves<State, Move, View>(
  plugin: GamePlugin<State, Move, View>,
  players: PlayerId[],
  plays: Play<Move>[],
  seed = 1,
): { state: State; result: GameResult | null } {
  const { rules } = plugin;
  const rng = seededRng(seed);
  let state = rules.setup(players, rng);
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
export function moveError<State, Move, View>(
  plugin: GamePlugin<State, Move, View>,
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
export function assertHidden<State, View>(
  plugin: GamePlugin<State, unknown, View>,
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
