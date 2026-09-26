import { Game, type GameEvent, gameRules, type Stored } from './engine.js';
import type { GamePlugin, GameResult, PlayerId, RoomContext } from './game.js';
import { seededRng } from './rng.js';

/**
 * Plays a `Game` the way the server does, one event at a time, so a test reads like a script:
 *
 *   const game = testGame(plugin, ['a', 'b'], { options: { size: 6 } });
 *   game.send('a', 'place', { cell: 4 });                 // throws if the game rejects it
 *   expect(game.error('a', 'place', { cell: 5 })).toBe('Chưa tới lượt bạn');
 *   expect(game.state.board[4]).toBe('X');
 *   game.fireTimer();                                      // a ctx.setTimer went off
 *   game.leave('b');                                       // b leaves mid-game (onLeave)
 *
 * `options` are the picks (defaults filled by the plugin's `room.options`); `bots` lists the
 * players the computer plays (`ctx.players[i].bot`). Pass the `Game`
 * itself (`testGame(new MyGame(), …)`) to test it before it is in `index.ts`; its options are
 * then used as given.
 */
export function testGame<State, View, Options>(
  game: GamePlugin<Stored<State>, GameEvent, View, Options> | Game<State, Options, View>,
  players: PlayerId[],
  {
    options,
    seed = 1,
    bots = [],
  }: { options?: Partial<Options>; seed?: number; bots?: PlayerId[] } = {},
) {
  const rules = game instanceof Game ? gameRules(game) : game.rules;
  const setup = game instanceof Game ? undefined : game.room;
  const rng = seededRng(seed);
  const opts = (setup ? setup.options.parse(options ?? {}) : options) as Options;
  // The room around the game, like the server's: players named by their id, the first hosts.
  const room: RoomContext<Options> = {
    players: players.map((id) => ({ id, name: id, bot: bots.includes(id) })),
    hostId: players[0] ?? null,
    score: { wins: players.map(() => 0), draws: 0 },
    options: opts,
    lastResult: null,
  };
  let stored = rules.setup(players, rng, opts, room);
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
      return rules.getView(stored, player, room);
    },
    /** Plays an event; throws with the game's message if it is rejected. */
    send(player: PlayerId, event: string, payload?: object) {
      const error = rules.validateMove(stored, move(event, payload), player, room);
      if (error) throw new Error(`${player} ${event} was rejected: ${error}`);
      stored = rules.applyMove(stored, move(event, payload), player, rng, room);
      return session;
    },
    /** "Chơi ván mới": the next game in the same room (`ctx.lastResult` = this one's result). */
    newGame() {
      room.lastResult = rules.getResult(stored, room);
      stored = rules.setup(
        room.players.map((p) => p.id),
        rng,
        opts,
        room,
      );
      return session;
    },
    /** The pending timer (`ctx.setTimer`): its event and length, or `null`. */
    get timer() {
      const t = rules.timer(stored);
      return t && { event: t.event, ms: t.ms };
    },
    /** Lets the pending timer go off now (throws if there is none). */
    fireTimer() {
      if (!rules.timer(stored)) throw new Error('No timer is set');
      stored = rules.fireTimer(stored, rng, room);
      return session;
    },
    /** `player` leaves the room mid-game (the game's `onLeave`; throws if it has none). */
    leave(player: PlayerId) {
      if (!rules.leave) throw new Error('This game has no onLeave hook');
      stored = rules.leave(stored, player, rng, room);
      room.players = room.players.filter((p) => p.id !== player);
      return session;
    },
    /** The message the game would reject this event with, or `null` if it is fine. */
    error(player: PlayerId, event: string, payload?: object) {
      return rules.validateMove(stored, move(event, payload), player, room);
    },
    /**
     * Throws if any of `secrets` (a card, a hand, a deck order…) appears anywhere in what
     * `viewer` sees. Check every player and `null` (spectators) for anything that must stay hidden.
     */
    assertHidden(viewer: PlayerId | null, ...secrets: unknown[]) {
      const view = JSON.stringify(rules.getView(stored, viewer, room));
      for (const secret of secrets) {
        if (view.includes(JSON.stringify(secret))) {
          throw new Error(`${viewer ?? 'A spectator'} can see ${JSON.stringify(secret)}`);
        }
      }
      return session;
    },
    /** What the computer would play for `player` now (`null` = nothing). */
    bot(player: PlayerId) {
      return rules.bot?.(stored, player, rng, opts, room) ?? null;
    },
  };
  return session;
}
