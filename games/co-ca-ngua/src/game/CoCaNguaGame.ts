import {
  type BotContext,
  type CommandContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type StartContext,
} from '@psc/sdk';
import { z } from 'zod';
import {
  legalMoves,
  type Options,
  preferredMove,
  ROLL_MS,
  STEP_MS,
  type State,
  TURN_MS,
} from './model.js';

const move = z.object({ horse: z.number().int().min(0).max(3) });
const place = z.object({
  seat: z.number().int().min(0).max(3),
  horse: z.number().int().min(0).max(3),
  position: z.number().int().min(-1).max(57),
});
const diceCommand = z.object({ value: z.number().int().min(1).max(6) });

export class CoCaNguaGame extends Game<State, Options> {
  readonly events = { roll: z.strictObject({}), move };
  override readonly commands = { 'set-horse': place, 'roll-dice': diceCommand };

  cmdSetHorse(ctx: CommandContext<State, Options, z.infer<typeof place>>): State {
    const { seat, horse, position } = ctx.args;
    if (!ctx.state.horses[seat]) ctx.reject('Không có người chơi ở ghế này');
    const horses = ctx.state.horses.map((team) => team.map((h) => ({ ...h })));
    const target = horses[seat]?.[horse];
    if (!target) ctx.reject('Không có ngựa này');
    target.position = position;
    target.finished = false;
    return { ...ctx.state, horses, lastMove: null };
  }

  cmdRollDice(ctx: CommandContext<State, Options, z.infer<typeof diceCommand>>): State {
    if (ctx.state.phase !== 'roll') ctx.reject('Chưa thể tung xúc xắc');
    return this.roll(ctx, ctx.args.value);
  }

  onStart(ctx: StartContext<Options>): State {
    ctx.setTimer(TURN_MS, 'timeout');
    return {
      horses: ctx.players.map(() =>
        Array.from({ length: 4 }, () => ({ position: -1, finished: false })),
      ),
      colors: ctx.players.length === 2 ? [0, 2] : ctx.players.map((_, i) => i),
      turn: 0,
      phase: 'roll',
      dice: null,
      lastRoll: null,
      lastMove: null,
      notice: '',
      moves: 0,
      winner: null,
    };
  }

  onRoll(ctx: EventContext<State, Record<string, never>, Options>): State {
    this.checkTurn(ctx);
    if (ctx.state.phase !== 'roll') ctx.reject('Chưa thể tung xúc xắc');
    return this.roll(ctx);
  }

  onMove(ctx: EventContext<State, z.infer<typeof move>, Options>): State {
    this.checkTurn(ctx);
    if (ctx.state.phase !== 'choose') ctx.reject('Hãy tung xúc xắc trước');
    if (!legalMoves(ctx.state).some((m) => m.horse === ctx.payload.horse)) {
      ctx.reject('Ngựa này không đi được');
    }
    return this.move(ctx, ctx.payload.horse);
  }

  private checkTurn(ctx: EventContext<State, unknown, Options>) {
    if (ctx.player.seat !== ctx.state.turn || ctx.player.left) ctx.reject('Chưa tới lượt bạn');
  }

  private roll(ctx: GameContext<State, Options>, value?: number): State {
    const dice = value ?? 1 + Math.floor(ctx.rng() * 6);
    const state: State = {
      ...ctx.state,
      dice,
      lastRoll: { seat: ctx.state.turn, value: dice },
      lastMove: null,
      phase: 'choose',
      notice: dice === 6 ? 'Ra 6 · Thêm lượt' : '',
    };
    if (legalMoves(state).length) ctx.setTimer(TURN_MS, 'timeout');
    else {
      state.phase = 'pause';
      state.notice = dice === 6 ? 'Không có nước đi · Thêm lượt' : 'Không có nước đi';
      ctx.setTimer(ROLL_MS + 600, 'advance');
    }
    return state;
  }

  private move(ctx: GameContext<State, Options>, horse: number): State {
    const selected = legalMoves(ctx.state).find((m) => m.horse === horse);
    if (!selected) return ctx.state;
    const { state } = ctx;
    const horses = state.horses.map((team) => team.map((h) => ({ ...h })));
    const moving = horses[state.turn]?.[horse];
    if (!moving) return state;
    const from = moving.position;
    moving.position = selected.to;
    moving.finished = selected.finish;
    if (selected.capture) {
      const kicked = horses[selected.capture.seat]?.[selected.capture.horse];
      if (kicked) kicked.position = -1;
    }
    const winner = horses[state.turn]?.every((h) => h.finished) ? state.turn : null;
    if (winner !== null) ctx.finish([ctx.players[winner]?.id ?? '']);
    else ctx.setTimer(selected.path.length * STEP_MS + 450, 'advance');
    return {
      ...state,
      horses,
      phase: 'pause',
      lastMove: { ...selected, seat: state.turn, from },
      notice: selected.finish
        ? 'Về đích!'
        : selected.capture
          ? 'Đá ngựa!'
          : selected.to >= 52
            ? 'Vào chuồng'
            : state.notice,
      moves: state.moves + 1,
      winner,
    };
  }

  onAdvance(ctx: GameContext<State, Options>): State {
    const { state } = ctx;
    let turn = state.turn;
    if (state.dice !== 6 || ctx.players[turn]?.left) {
      do turn = (turn + 1) % ctx.players.length;
      while (ctx.players[turn]?.left);
    }
    ctx.setTimer(TURN_MS, 'timeout');
    return { ...state, turn, phase: 'roll', dice: null };
  }

  onTimeout(ctx: GameContext<State, Options>): State {
    if (ctx.state.phase === 'roll') return this.roll(ctx);
    const selected = preferredMove(ctx.state);
    return selected ? this.move(ctx, selected.horse) : this.onAdvance(ctx);
  }

  onLeave(ctx: LeaveContext<State, Options>): State {
    const active = ctx.players.filter((p) => !p.left);
    const horses = ctx.state.horses.map((team, seat) =>
      seat === ctx.player.seat ? team.map(() => ({ position: -1, finished: false })) : team,
    );
    const state = { ...ctx.state, horses };
    if (active.length <= 1) {
      ctx.finish(active.map((p) => p.id));
      return {
        ...state,
        winner: active[0]?.seat ?? null,
        notice: 'Đối thủ rời bàn',
        lastMove: null,
      };
    }
    return ctx.player.seat === state.turn
      ? this.onAdvance({ ...ctx, state: { ...state, dice: null, lastMove: null } })
      : state;
  }

  bot(ctx: BotContext<State, Options>) {
    if (ctx.player.seat !== ctx.state.turn || ctx.player.left || ctx.state.phase === 'pause')
      return null;
    if (ctx.state.phase === 'roll') return { event: 'roll' };
    const selected = preferredMove(ctx.state);
    return selected ? { event: 'move', payload: { horse: selected.horse } } : null;
  }
}
