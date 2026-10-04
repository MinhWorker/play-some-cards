/** Browser presentation uses SceneRuntime (@psc/sdk/client); server hooks and timers remain authoritative. */
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

/** Someone at the table. `seat` is their place (0, 1, …) and never changes during a game. */
export interface Seat {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
  /** The account's picture (`boy`, `girl`, …); missing for bots and in tests. */
  avatar?: string;
  /** They left the room during this game (only games with an `onLeave` hook go on without them). */
  left: boolean;
}

/** What every hook gets: the whole room, ready to use. */
export interface GameContext<State, Options = undefined> {
  /** The game's state right now. Read it; return a new one from the hook. */
  state: State;
  /** Everyone seated when the game began, in seat order (with `left` set for who has gone). */
  players: Seat[];
  hostId: PlayerId | null;
  /** Wins per seat and draws over every game in the room. */
  score: { wins: number[]; draws: number };
  /** The room's options (from the game's setup screen). */
  options: Options;
  /**
   * How the previous game in this room ended (e.g. its winner leads the next one); `null` for
   * the first game, or when the players at the table changed.
   */
  lastResult: GameResult | null;
  /** Randomness: a float in [0, 1). Never use Math.random. */
  rng: Rng;
  /** Ends the game with these winners (`[]` = a draw). The screens show the result. */
  finish(winners: PlayerId[]): void;
  /**
   * In `ms`, the server runs the hook of `event` (`'turn-over'` → `onTurnOver(ctx)`, which gets
   * `payload`), e.g. a turn clock or a pause between rounds. There is one timer: setting it again
   * replaces it; it stops when it fires, with `clearTimer()` or when the game ends. Screens see it
   * as `ctx.timer` (to draw a countdown). Timer events are not in `events`: players can't send them.
   */
  setTimer(ms: number, event: string, payload?: unknown): void;
  clearTimer(): void;
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

/** What a timer's hook gets (see `setTimer`). */
export interface TimerContext<State, Payload = undefined, Options = undefined>
  extends GameContext<State, Options> {
  payload: Payload;
}

/** What `onLeave` gets: who left (already marked `left` in `players`). */
export interface LeaveContext<State, Options = undefined> extends GameContext<State, Options> {
  player: Seat;
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
  //   on<Timer>(ctx: TimerContext)   a timer set with ctx.setTimer(ms, '<timer>') went off
  //   onLeave(ctx: LeaveContext)     a player left mid-game: the game goes on without them
  //                                  (without this hook, leaving stops the game for everyone)
  //   onEnd(ctx: GameContext)        after ctx.finish(): a last chance to change the state
  //   bot(ctx: BotContext)           the computer's event for its seat ctx.player, or null
  //                                  (not its turn); played after a short pause
  //   view(ctx: GameContext, viewer: Seat | null)   what a player (null = spectator) sees;
  //                                  hide secrets here. Default: the whole state.
}

/** The optional hooks, as the engine looks them up. */
interface OptionalHooks<State, Options, View> {
  onLeave?(ctx: LeaveContext<State, Options>): State;
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

/** The pending timer: `id` changes every time one is set. */
export interface PendingTimer {
  id: number;
  ms: number;
  event: string;
  payload?: unknown;
}

/** Who sat down when the game began (names and pictures are kept for players who leave). */
export interface SeatInfo {
  id: PlayerId;
  name: string;
  bot: boolean;
  avatar?: string;
}

/** What the server keeps: the game's state plus bookkeeping the game doesn't see. */
export interface Stored<State> {
  state: State;
  result: GameResult | null;
  players: SeatInfo[];
  /** Players who left during the game. */
  left: PlayerId[];
  timer: PendingTimer | null;
  /** Timers set so far (the next timer's id). */
  timers: number;
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
  const hookOf = (event: string) =>
    (game as unknown as Record<string, ((ctx: unknown) => State) | undefined>)[hookName(event)];

  /** Seats from the game's start; live names and pictures from the room while they're in it. */
  const seats = (stored: Pick<Stored<State>, 'players' | 'left'>, room?: RoomContext<Options>) =>
    stored.players.map((info, seat): Seat => {
      const live = room?.players.find((p) => p.id === info.id);
      return { ...info, ...live, seat, left: stored.left.includes(info.id) };
    });

  /** A hook's context, and what the hook did through it (the result, the timer it set). */
  const context = (
    stored: Omit<Stored<State>, 'result'>,
    rng: Rng,
    options: Options,
    room: RoomContext<Options> | undefined,
  ) => {
    const out = {
      result: null as GameResult | null,
      timer: stored.timer,
      timers: stored.timers,
    };
    const ctx: GameContext<State, Options> = {
      state: stored.state,
      players: seats(stored, room),
      hostId: room?.hostId ?? null,
      score: room?.score ?? { wins: [], draws: 0 },
      options: room ? room.options : options,
      lastResult: room?.lastResult ?? null,
      rng,
      finish: (winners) => {
        out.result = { winners };
      },
      setTimer: (ms, event, payload) => {
        if (!hookOf(event)) {
          throw new Error(`Timer "${event}" needs a ${hookName(event)}(ctx) method`);
        }
        out.timer = { id: ++out.timers, ms, event, payload };
      },
      clearTimer: () => {
        out.timer = null;
      },
    };
    return { ctx, out };
  };

  /** Runs a hook through `call`; returns the new stored state. */
  const runHook = (
    stored: Stored<State>,
    rng: Rng,
    room: RoomContext<Options> | undefined,
    call: (ctx: GameContext<State, Options>) => State,
  ): Stored<State> => {
    const { ctx, out } = context(stored, rng, room?.options as Options, room);
    let state = call(ctx);
    if (out.result && hooks.onEnd) state = hooks.onEnd({ ...ctx, state });
    const result = out.result ?? stored.result;
    return { ...stored, state, result, timer: result ? null : out.timer, timers: out.timers };
  };

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
    const seat = seats(stored, room).find((p) => p.id === player && !p.left);
    if (!seat) reject('Bạn không ngồi ở bàn này');
    const hook = hookOf(move.event);
    return runHook(
      stored,
      rng,
      room,
      (ctx) => hook?.call(game, { ...ctx, player: seat, payload: payload?.data, reject }) as State,
    );
  };

  return {
    events: game.events,
    moveSchema: z.object({ event: z.string(), payload: z.unknown().optional() }),

    setup(players, rng, options, room) {
      const info: SeatInfo[] = players.map((id) => {
        const p = room?.players.find((m) => m.id === id);
        return { id, name: p?.name ?? id, bot: p?.bot ?? false, avatar: p?.avatar };
      });
      const empty = { state: undefined as never, players: info, left: [], timer: null, timers: 0 };
      const { ctx, out } = context(empty, rng, options, room);
      const { state: _, ...start } = ctx;
      const state = game.onStart(start);
      const timer = out.result ? null : out.timer;
      return { ...empty, state, result: out.result, timer, timers: out.timers };
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

    timer(stored) {
      return stored.result ? null : stored.timer;
    },

    fireTimer(stored, rng, room) {
      const timer = stored.timer;
      if (!timer || stored.result) return stored;
      const hook = hookOf(timer.event);
      return runHook(
        { ...stored, timer: null },
        rng,
        room,
        (ctx) => hook?.call(game, { ...ctx, payload: timer.payload }) as State,
      );
    },

    ...(hooks.onLeave && {
      leave(stored: Stored<State>, player: PlayerId, rng: Rng, room?: RoomContext<Options>) {
        if (stored.result || stored.left.includes(player)) return stored;
        const gone = { ...stored, left: [...stored.left, player] };
        const seat = seats(gone, room).find((p) => p.id === player);
        if (!seat) return stored;
        return runHook(
          gone,
          rng,
          room,
          (ctx) => hooks.onLeave?.call(game, { ...ctx, player: seat }) as State,
        );
      },
    }),

    seats(stored, room) {
      return seats(stored, room);
    },

    getView(stored, player, room) {
      const { ctx } = context(stored, seededRng(1), room?.options as Options, room);
      const viewer = ctx.players.find((p) => p.id === player) ?? null;
      return hooks.view ? hooks.view(ctx, viewer) : (stored.state as unknown as View);
    },

    getResult(stored) {
      return stored.result;
    },

    bot(stored, player, rng, options, room) {
      if (!hooks.bot || stored.result) return null;
      const { ctx } = context(stored, rng, options, room);
      const seat = ctx.players.find((p) => p.id === player && !p.left);
      return seat ? hooks.bot({ ...ctx, player: seat }) : null;
    },

    moveView(move, player, viewer) {
      if (player === viewer || !game.secretEvents.includes(move.event)) return move;
      return { event: move.event };
    },
  };
}
