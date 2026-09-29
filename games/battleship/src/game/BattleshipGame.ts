/**
 * The game's logic, on the server. A player's event runs its hook, which gets the whole room
 * in `ctx` and returns the next state; everyone's screen then gets what `view` lets them see
 * (scenes/BattleshipView.ts).
 *
 *   arrange  while setting up: your fleet where you placed it (secret)
 *   shuffle  while setting up: a new random fleet
 *   ready    while setting up: done; the battle starts once both are
 *   fire     in battle, on your turn: a shot at a cell of the other sea
 *   resign   give up: the other side wins
 *
 * Fleets are secret: `view` shows your own fleet, and of the other only the sunk ships.
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type Seat as PlayerSeat,
  type StartContext,
} from '@psc/sdk';
import { z } from 'zod';
import { botShot } from './bot.js';
import { CELLS, type EndReason, type Options, type Seat, type State, type View } from './model.js';
import { fleetError, isSunk, other, randomFleet, watersOf } from './rules.js';

const cell = z
  .number()
  .int()
  .min(0)
  .max(CELLS - 1);
const arrange = z.object({
  ships: z.array(z.object({ cells: z.array(cell).min(1).max(5) })).max(5),
});
const fire = z.object({ cell });
const none = z.object({});

type Ctx<Payload = Record<string, never>> = EventContext<State, Payload, Options>;

export class BattleshipGame extends Game<State, Options, View> {
  events = { arrange, shuffle: none, ready: none, fire, resign: none };
  override readonly secretEvents = ['arrange'];

  /** A new game: both fleets placed at random, ready to rearrange. */
  onStart({ players, options, rng }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    return {
      players: options.swap ? [second, first] : [first, second],
      phase: 'setup',
      fleets: [randomFleet(rng, options.spacing), randomFleet(rng, options.spacing)],
      ready: [false, false],
      shots: [[], []],
      turn: 0,
      last: null,
      end: null,
    };
  }

  /** A player's own placement of the fleet (event `arrange`). */
  onArrange(ctx: Ctx<z.infer<typeof arrange>>): State {
    const seat = this.arranging(ctx);
    const error = fleetError(ctx.payload.ships, ctx.options.spacing);
    if (error) ctx.reject(error);
    return withFleet(ctx.state, seat, ctx.payload.ships);
  }

  /** A new random fleet. */
  onShuffle(ctx: Ctx): State {
    const seat = this.arranging(ctx);
    return withFleet(ctx.state, seat, randomFleet(ctx.rng, ctx.options.spacing));
  }

  /** Done arranging; once both are, the battle begins. */
  onReady(ctx: Ctx): State {
    const seat = this.arranging(ctx);
    const ready: [boolean, boolean] = [...ctx.state.ready];
    ready[seat] = true;
    return { ...ctx.state, ready, phase: ready[0] && ready[1] ? 'battle' : 'setup' };
  }

  /** A shot at the other sea. A hit earns another shot when the room says so. */
  onFire(ctx: Ctx<z.infer<typeof fire>>): State {
    const { state, reject } = ctx;
    if (state.phase !== 'battle') reject('Chưa vào trận');
    const seat = seatOf(state, ctx.player);
    if (seat !== state.turn) reject('Chưa tới lượt bạn');
    const { cell: at } = ctx.payload;
    if (state.shots[seat].includes(at)) reject('Ô này đã bắn rồi');
    const mine = [...state.shots[seat], at];
    const shots: [number[], number[]] =
      seat === 0 ? [mine, state.shots[1]] : [state.shots[0], mine];
    const fleet = state.fleets[other(seat)];
    const ship = fleet.find((s) => s.cells.includes(at));
    const sunk = ship && isSunk(ship, mine) ? ship.cells : null;
    const next: State = {
      ...state,
      shots,
      turn: ship && ctx.options.bonus ? seat : other(seat),
      last: { by: seat, cell: at, hit: Boolean(ship), sunk },
    };
    if (fleet.every((s) => isSunk(s, mine))) return end(ctx, next, 'sunk', seat);
    return next;
  }

  onResign(ctx: Ctx): State {
    return end(ctx, ctx.state, 'resign', other(seatOf(ctx.state, ctx.player)));
  }

  /** A player left mid-game: the one still at the table wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    return end(ctx, ctx.state, 'left', other(seatOf(ctx.state, ctx.player)));
  }

  /** The computer: ready at once with its random fleet, then its shots on its turn. */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (options.opponent !== 'bot' || state.end) return null;
    const seat = seatOf(state, player);
    if (state.phase === 'setup') return state.ready[seat] ? null : { event: 'ready' };
    if (state.turn !== seat) return null;
    // Only what a player may see: its own shots and the other fleet's sunk ships.
    const waters = watersOf(state.fleets[other(seat)], state.shots[seat], false);
    const at = botShot(
      { shots: waters.shots, sunk: waters.ships, spacing: options.spacing },
      rng,
      options.level,
    );
    return { event: 'fire', payload: { cell: at } };
  }

  /** Your own fleet, the sunk ships of the other, and every shot with its result. */
  view({ state }: GameContext<State, Options>, viewer: PlayerSeat | null): View {
    const { fleets, shots, ...rest } = state;
    const me = viewer ? state.players.indexOf(viewer.id) : -1;
    const over = Boolean(state.end);
    return {
      ...rest,
      waters: [
        watersOf(fleets[0], shots[1], me === 0 || over),
        watersOf(fleets[1], shots[0], me === 1 || over),
      ],
    };
  }

  /** The sender's seat, while setting up and not yet ready. */
  private arranging(ctx: Ctx<unknown>): Seat {
    if (ctx.state.phase !== 'setup') ctx.reject('Trận đã bắt đầu');
    const seat = seatOf(ctx.state, ctx.player);
    if (ctx.state.ready[seat]) ctx.reject('Bạn đã sẵn sàng');
    return seat;
  }
}

/** The seat a player sits in (seat 0 fires first). */
export function seatOf(state: Pick<State, 'players'>, player: { id: string }): Seat {
  return state.players[0] === player.id ? 0 : 1;
}

function withFleet(state: State, seat: Seat, ships: State['fleets'][number]): State {
  const fleets: State['fleets'] = seat === 0 ? [ships, state.fleets[1]] : [state.fleets[0], ships];
  return { ...state, fleets };
}

/** Ends the game: `winner` wins. */
function end(
  ctx: GameContext<State, Options>,
  state: State,
  reason: EndReason,
  winner: Seat,
): State {
  ctx.finish([state.players[winner]]);
  return { ...state, end: { reason, winner } };
}
