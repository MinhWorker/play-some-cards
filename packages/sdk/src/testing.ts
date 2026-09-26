import { Game, type GameEvent, gameRules, type Stored } from './engine.js';
import type { GamePlugin, GameResult, PlayerId } from './game.js';
import { seededRng } from './rng.js';

/**
 * Plays a `Game` the way the server does, one event at a time, so a test reads like a script:
 *
 *   const game = testGame(plugin, ['a', 'b'], { options: { size: 6 } });
 *   game.send('a', 'place', { cell: 4 });                 // throws if the game rejects it
 *   expect(game.error('a', 'place', { cell: 5 })).toBe('Chưa tới lượt bạn');
 *   expect(game.state.board[4]).toBe('X');
 *
 * `options` are the picks (defaults filled by the plugin's `room.options`). Pass the `Game`
 * itself (`testGame(new MyGame(), …)`) to test it before it is in `index.ts`; its options are
 * then used as given.
 */
export function testGame<State, View, Options>(
  game: GamePlugin<Stored<State>, GameEvent, View, Options> | Game<State, Options, View>,
  players: PlayerId[],
  { options, seed = 1 }: { options?: Partial<Options>; seed?: number } = {},
) {
  const rules = game instanceof Game ? gameRules(game) : game.rules;
  const room = game instanceof Game ? undefined : game.room;
  const rng = seededRng(seed);
  const opts = (room ? room.options.parse(options ?? {}) : options) as Options;
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
    /**
     * Throws if any of `secrets` (a card, a hand, a deck order…) appears anywhere in what
     * `viewer` sees. Check every player and `null` (spectators) for anything that must stay hidden.
     */
    assertHidden(viewer: PlayerId | null, ...secrets: unknown[]) {
      const view = JSON.stringify(rules.getView(stored, viewer));
      for (const secret of secrets) {
        if (view.includes(JSON.stringify(secret))) {
          throw new Error(`${viewer ?? 'A spectator'} can see ${JSON.stringify(secret)}`);
        }
      }
      return session;
    },
    /** What the computer would play for `player` now (`null` = nothing). */
    bot(player: PlayerId) {
      return rules.bot?.(stored, player, rng, opts) ?? null;
    },
  };
  return session;
}
