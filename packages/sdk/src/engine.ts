/**
 * Write a game as a class with lifecycle hooks, like a Unity script.
 *
 *   class CounterGame extends Game<State> {
 *     events = { press: z.object({}) };                  // what players can do
 *     onStart(ctx) { return { count: 0 }; }              // a new game: the first state
 *     onPress(ctx) { return { count: ctx.state.count + 1 }; }   // event "press" → onPress
 *   }
 *   export default definePlugin({ meta, rules: gameRules(new CounterGame()) });
 *
 * The server runs it: a player's event is checked against `events`, its hook returns the next
 * state, and every screen gets the new state and hears the event (see `GameView`). Hooks get one
 * `ctx` with everything about the room. They must not change `ctx.state`: return a new one.
 */
import { z } from 'zod';
import type { GameResult, GameRules, PlayerId, RoomContext } from './game.js';
import { type Rng, seededRng } from './rng.js';

/** Someone at the table. `seat` is their place (0, 1, …). */
export interface Seat {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
}

/** What every hook gets: the whole room, ready to use. */
export interface GameContext<State, Options = undefined> {
  /** The game's state right now. Read it; return a new one from the hook. */
  state: State;
  /** Seated players in seat order. */
  players: Seat[];
  hostId: PlayerId | null;
  /** Wins per seat and draws over every game in the room. */
  score: { wins: number[]; draws: number };
  /** The room's options (from the game's setup screen). */
  options: Options;
  /** Randomness: a float in [0, 1). Never use Math.random. */
  rng: Rng;
  /** Ends the game with these winners (`[]` = a draw). The screens show the result. */
  finish(winners: PlayerId[]): void;
}

/** What an event hook (`onPress`, …) gets on top: who did it, with what data. */
export interface EventContext<State, Payload = Record<string, never>, Options = undefined>
  extends GameContext<State, Options> {
  /** Who sent the event. */
  player: Seat;
  /** The event's data, already checked against its schema in `events`. */
  payload: Payload;
  /** Refuses the event: the player sees `message` (Vietnamese) and nothing changes. */
  reject(message: string): never;
}

/** What `bot` gets: the room, and which computer seat is asked. */
export interface BotContext<State, Options = undefined> extends GameContext<State, Options> {
  player: Seat;
}

/** The first state has no `state` yet. */
export type StartContext<Options = undefined> = Omit<GameContext<never, Options>, 'state'>;

/**
 * Base class for a game's logic (runs on the server). Declare `events`, implement `onStart` and
 * one `on<Event>` hook per event (`press` → `onPress`, `play-card` → `onPlayCard`).
 */
export abstract class Game<State, Options = undefined, View = State> {
  /** Events players can send, each with the schema of its data (`z.object({})` for none). */
  abstract readonly events: Record<string, z.ZodType>;
  /** Events whose data other players must not see (e.g. a card passed face down). */
  readonly secretEvents: string[] = [];

  /** A new game begins ("Bắt đầu", "Chơi ván mới"): return the first state. */
  abstract onStart(ctx: StartContext<Options>): State;

  // Optional hooks: write them in your class and the engine calls them (they aren't declared
  // here, so no `override` is needed):
  //
  //   on<Event>(ctx: EventContext)   one per event in `events`: return the next state
  //   onEnd(ctx: GameContext)        after ctx.finish(): a last chance to change the state
  //   bot(ctx: BotContext)           the computer's event for its seat ctx.player, or null
  //                                  (not its turn); played after a short pause
  //   view(ctx: GameContext, viewer: Seat | null)   what a player (null = spectator) sees;
  //                                  hide secrets here. Default: the whole state.
}

/** The optional hooks, as the engine looks them up. */
interface OptionalHooks<State, Options, View> {
  onEnd?(ctx: GameContext<State, Options>): State;
  bot?(ctx: BotContext<State, Options>): GameEvent | null;
  view?(ctx: GameContext<State, Options>, viewer: Seat | null): View;
}

/** `press` → `onPress`, `play-card` → `onPlayCard`. */
export const hookName = (event: string) =>
  `on${event.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`;

/** A move as it travels: the event's name and its data. */
export interface GameEvent {
  event: string;
  payload?: unknown;
}

/** What the server keeps: the game's state plus bookkeeping the game doesn't see. */
export interface Stored<State> {
  state: State;
  result: GameResult | null;
  /** Player ids from `setup`, for when the room context is missing (tests). */
  players: PlayerId[];
}

class Rejected extends Error {}

/**
 * Turns a `Game` into the rules the server runs (`definePlugin({ rules: gameRules(game) })`).
 */
export function gameRules<State, Options, View>(
  game: Game<State, Options, View>,
): GameRules<Stored<State>, GameEvent, View, Options> {
  const hooks = game as Game<State, Options, View> & OptionalHooks<State, Options, View>;
  const names = Object.keys(game.events);
  for (const name of names) {
    if (typeof (game as unknown as Record<string, unknown>)[hookName(name)] !== 'function') {
      throw new Error(`Event "${name}" needs a ${hookName(name)}(ctx) method`);
    }
  }

  const seats = (ids: PlayerId[], room?: RoomContext<Options>): Seat[] =>
    room
      ? room.players.map((p, seat) => ({ ...p, seat }))
      : ids.map((id, seat) => ({ id, name: id, seat, bot: false }));

  const context = (
    stored: { state: State; players: PlayerId[] },
    rng: Rng,
    options: Options,
    room: RoomContext<Options> | undefined,
    onFinish: (winners: PlayerId[]) => void,
  ): GameContext<State, Options> => ({
    state: stored.state,
    players: seats(stored.players, room),
    hostId: room?.hostId ?? null,
    score: room?.score ?? { wins: [], draws: 0 },
    options: room ? room.options : options,
    rng,
    finish: onFinish,
  });

  /** Runs the event's hook; returns the new stored state, or throws `Rejected`. */
  const run = (
    stored: Stored<State>,
    move: GameEvent,
    player: PlayerId,
    rng: Rng,
    room: RoomContext<Options> | undefined,
  ): Stored<State> => {
    const reject = (message: string): never => {
      throw new Rejected(message);
    };
    if (stored.result) reject('Ván đã kết thúc');
    const schema = game.events[move.event];
    const payload = schema?.safeParse(move.payload ?? {});
    if (!payload?.success) reject('Nước đi không hợp lệ');
    let result: GameResult | null = null;
    const ctx = context(stored, rng, room?.options as Options, room, (winners) => {
      result = { winners };
    });
    const seat = ctx.players.find((p) => p.id === player);
    if (!seat) reject('Bạn không ngồi ở bàn này');
    const hook = (game as unknown as Record<string, (ctx: unknown) => State>)[hookName(move.event)];
    let state = hook?.call(game, { ...ctx, player: seat, payload: payload?.data, reject }) as State;
    if (result && hooks.onEnd) state = hooks.onEnd({ ...ctx, state });
    return { ...stored, state, result };
  };

  return {
    moveSchema: z.object({ event: z.string(), payload: z.unknown().optional() }),

    setup(players, rng, options, room) {
      let result: GameResult | null = null;
      const ctx = context({ state: undefined as never, players }, rng, options, room, (winners) => {
        result = { winners };
      });
      const { state: _, ...start } = ctx;
      return { state: game.onStart(start), result, players };
    },

    // Runs the hook on the side (hooks never change their input) to find out if it rejects.
    validateMove(stored, move, player, room) {
      try {
        run(stored, move, player, seededRng(1), room);
        return null;
      } catch (err) {
        if (err instanceof Rejected) return err.message;
        throw err;
      }
    },

    applyMove(stored, move, player, rng, room) {
      return run(stored, move, player, rng, room);
    },

    getView(stored, player, room) {
      const ctx = context(stored, seededRng(1), room?.options as Options, room, () => {});
      const viewer = ctx.players.find((p) => p.id === player) ?? null;
      return hooks.view ? hooks.view(ctx, viewer) : (stored.state as unknown as View);
    },

    getResult(stored) {
      return stored.result;
    },

    bot(stored, player, rng, options, room) {
      if (!hooks.bot || stored.result) return null;
      const ctx = context(stored, rng, options, room, () => {});
      const seat = ctx.players.find((p) => p.id === player);
      return seat ? hooks.bot({ ...ctx, player: seat }) : null;
    },

    moveView(move, player, viewer) {
      if (player === viewer || !game.secretEvents.includes(move.event)) return move;
      return { event: move.event };
    },
  };
}
