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
  CELEBRATION_MS,
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
      rankings: [],
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
    const completed = horses[state.turn]?.every((h) => h.finished) ?? false;
    const rankings = completed ? [...state.rankings, state.turn] : state.rankings;
    const remaining = ctx.players.filter((p) => !p.left && !rankings.includes(p.seat));
    const over = completed && (ctx.options.mode === 'normal' || remaining.length <= 1);
    if (over && ctx.options.mode === 'ranked') rankings.push(...remaining.map((p) => p.seat));
    const winner = over ? (rankings[0] ?? null) : null;
    if (winner !== null) ctx.finish([ctx.players[winner]?.id ?? '']);
    else
      ctx.setTimer(
        selected.path.length * STEP_MS + 450 + (completed ? CELEBRATION_MS : 0),
        'advance',
      );
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
      rankings,
    };
  }

  onAdvance(ctx: GameContext<State, Options>): State {
    const { state } = ctx;
    let turn = state.turn;
    const active = ctx.players.filter((p) => !p.left && !state.rankings.includes(p.seat));
    if (!active.length || state.winner !== null) return state;
    if (state.dice !== 6 || ctx.players[turn]?.left || state.rankings.includes(turn)) {
      do turn = (turn + 1) % ctx.players.length;
      while (ctx.players[turn]?.left || state.rankings.includes(turn));
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
    const { state } = ctx;
    const ranked = ctx.options.mode === 'ranked';
    const rankings = [...state.rankings];
    const completed = rankings.includes(ctx.player.seat);
    const horses = state.horses.map((team, seat) =>
      seat === ctx.player.seat && !completed
        ? team.map(() => ({ position: -1, finished: false }))
        : team,
    );
    const active = ctx.players.filter((p) => !p.left && (!ranked || !rankings.includes(p.seat)));
    if (active.length <= 1) {
      if (ranked) rankings.push(...active.map((p) => p.seat));
      const winner = ranked ? (rankings[0] ?? null) : (active[0]?.seat ?? null);
      ctx.finish(winner === null ? [] : [ctx.players[winner]?.id ?? '']);
      return { ...state, horses, rankings, winner, notice: 'Đối thủ rời bàn', lastMove: null };
    }
    const next = { ...state, horses };
    return ctx.player.seat === state.turn
      ? this.onAdvance({ ...ctx, state: { ...next, dice: null, lastMove: null } })
      : next;
  }

  bot(ctx: BotContext<State, Options>) {
    if (
      ctx.player.seat !== ctx.state.turn ||
      ctx.player.left ||
      ctx.state.rankings.includes(ctx.player.seat) ||
      ctx.state.phase === 'pause'
    )
      return null;
    if (ctx.state.phase === 'roll') return { event: 'roll' };
    const selected = preferredMove(ctx.state);
    return selected ? { event: 'move', payload: { horse: selected.horse } } : null;
  }
}
