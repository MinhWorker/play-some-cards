import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import {
  activateDash,
  activateSkill,
  applyBlasts,
  collectPickups,
  explodeBombs,
  follow,
  moveFighter,
  placeBomb,
  shrinkArena,
  touches,
} from './arena.js';
import { thinkBot } from './bot.js';
import {
  cloneState,
  DIRECTIONS,
  distance,
  ELEMENTS,
  type Fighter,
  HEIGHT,
  MATCH_TIME,
  type Options,
  SELECT_TIME,
  type State,
  TICK,
  WIDTH,
} from './model.js';

/** Where the player's own screen has them (see `follow`). */
const pointSchema = z.object({
  x: z.number().finite().min(0).max(WIDTH),
  y: z.number().finite().min(0).max(HEIGHT),
});
const inputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right', 'none']),
  at: pointSchema.optional(),
});
const bombSchema = z.object({ at: pointSchema.optional() });
const chooseSchema = z.object({ element: z.enum(ELEMENTS) });
type Ctx = GameContext<State, Options>;
export class BomNguyenToGame extends Game<State, Options> {
  events = {
    input: inputSchema,
    bomb: bombSchema,
    skill: z.object({}),
    dash: z.object({}),
    choose: chooseSchema,
    ready: z.object({}),
  };
  onStart(ctx: StartContext<Options>): State {
    const count = Math.max(
      ctx.players.length,
      ctx.options.mode === 'teams' ? 4 : ctx.options.total,
    );
    const spawn = [
      { x: 1, y: 1 },
      { x: WIDTH - 2, y: HEIGHT - 2 },
      { x: WIDTH - 2, y: 1 },
      { x: 1, y: HEIGHT - 2 },
    ];
    const cells: State['cells'] = [];
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const wall =
          x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 || (x % 2 === 0 && y % 2 === 0);
        const safe = spawn.some((p) => distance(p, { x, y }) <= 2);
        cells.push(wall ? 'wall' : !safe && ctx.rng() < 0.62 ? 'crate' : 'floor');
      }
    const fighters: Fighter[] = Array.from({ length: Math.min(4, count) }, (_, seat) => {
      const player = ctx.players[seat];
      const bot = player?.bot ?? true;
      return {
        ...(spawn[seat] ?? { x: 1, y: 1 }),
        id: player?.id ?? `arena:${seat}`,
        name: player?.name ?? `Máy ${seat + 1}`,
        seat,
        bot,
        team: seat % 2,
        element: bot ? (ELEMENTS[(seat + 1) % ELEMENTS.length] ?? 'fire') : ctx.options.element,
        hp: 100,
        ready: bot,
        dir: 'none',
        facing: seat % 2 ? 'left' : 'right',
        inputUntil: 0,
        target: null,
        nextBomb: 0,
        nextThink: 0,
        capacity: 2,
        range: 2,
        speed: 3.2,
        skillUntil: 0,
        skillReady: 0,
        dashUntil: 0,
        dashReady: 0,
        frozenUntil: 0,
        slowUntil: 0,
        stunUntil: 0,
        invulnerableUntil: 0,
        kills: 0,
        crates: 0,
      };
    });
    ctx.setTimer(TICK, 'tick');
    return {
      phase: 'select',
      time: 0,
      elapsed: 0,
      cells,
      fighters,
      bombs: [],
      blasts: [],
      pickups: [],
      nextId: 1,
      ring: 0,
      winners: [],
      reason: '',
      mode: ctx.options.mode,
      friendlyFire: ctx.options.friendlyFire,
    };
  }
  onChoose(ctx: EventContext<State, z.infer<typeof chooseSchema>, Options>): State {
    if (ctx.state.phase !== 'select') ctx.reject('Chỉ chọn nguyên tố trước trận đấu');
    const s = cloneState(ctx.state);
    const p = s.fighters.find((p) => p.id === ctx.player.id);
    if (p) {
      p.element = ctx.payload.element;
      p.ready = false;
    }
    return s;
  }
  onReady(ctx: EventContext<State, Record<string, never>, Options>): State {
    if (ctx.state.phase !== 'select') return ctx.state;
    const s = cloneState(ctx.state);
    const p = s.fighters.find((p) => p.id === ctx.player.id);
    if (p) p.ready = true;
    if (s.fighters.every((p) => p.ready)) s.phase = 'playing';
    return s;
  }
  onInput(ctx: EventContext<State, z.infer<typeof inputSchema>, Options>): State {
    const s = cloneState(ctx.state);
    const p = s.fighters.find((p) => p.id === ctx.player.id);
    if (p && p.hp > 0 && s.phase === 'playing') {
      if (ctx.payload.at) follow(s, p, ctx.payload.at);
      p.dir = ctx.payload.direction;
      p.inputUntil = s.time + 650;
      if (p.dir !== 'none') p.facing = p.dir;
    }
    return s;
  }
  onBomb(ctx: EventContext<State, z.infer<typeof bombSchema>, Options>): State {
    // The bomb lands on the cell the player sees themselves on.
    const at = ctx.payload.at;
    return this.action(ctx, (s, p) => {
      if (at && s.phase === 'playing') follow(s, p, at);
      return placeBomb(s, p);
    });
  }
  onSkill(ctx: EventContext<State, Record<string, never>, Options>): State {
    return this.action(ctx, activateSkill);
  }
  onDash(ctx: EventContext<State, Record<string, never>, Options>): State {
    return this.action(ctx, activateDash);
  }
  private action(
    ctx: EventContext<State, object, Options>,
    fn: (s: State, p: Fighter) => boolean,
  ): State {
    const s = cloneState(ctx.state);
    const p = s.fighters.find((p) => p.id === ctx.player.id);
    if (p) fn(s, p);
    this.finishIfOver({ ...ctx, state: s });
    return s;
  }
  /** Bots share the simulation tick instead of the gateway's turn-based scheduler. */
  bot(_ctx: BotContext<State, Options>) {
    return null;
  }
  onTick(ctx: Ctx): State {
    const s = cloneState(ctx.state);
    s.time += TICK;
    if (s.phase === 'select') {
      if (s.time >= SELECT_TIME) {
        s.phase = 'playing';
        for (const p of s.fighters) p.ready = true;
      }
      ctx.setTimer(TICK, 'tick');
      return s;
    }
    if (s.phase === 'ended') return s;
    s.elapsed += TICK;
    s.blasts = s.blasts.filter((b) => b.expires > s.time);
    explodeBombs(s, ctx.rng);
    applyBlasts(s);
    for (const p of s.fighters) {
      if (p.hp <= 0) {
        p.dir = 'none';
        continue;
      }
      if (p.frozenUntil > s.time || p.stunUntil > s.time) continue;
      if (p.bot) thinkBot(s, p, ctx.options, ctx.rng);
      else if (p.inputUntil < s.time) p.dir = 'none';
      if (p.dir !== 'none') p.facing = p.dir;
      const d = DIRECTIONS[p.dir];
      let step =
        ((p.speed * TICK) / 1000) *
        (p.dashUntil > s.time ? 1.85 : 1) *
        (p.slowUntil > s.time ? 0.5 : 1);
      // Stop on the next cell's line rather than overshoot it and turn back.
      if (p.bot && p.target)
        step = Math.min(step, Math.abs(d.x ? p.target.x - p.x : p.target.y - p.y));
      const from = { x: p.x, y: p.y };
      moveFighter(s, p, d.x * step, d.y * step);
      // Blocked on the way (a bomb dropped in front, a wall corner): think again.
      if (p.bot && p.target && d !== DIRECTIONS.none && distance(from, p) === 0) p.target = null;
      collectPickups(s, p);
    }
    // A fighter keeps walking off a bomb placed under them until no part of them touches it.
    for (const b of s.bombs)
      b.pass = b.pass.filter((id) => {
        const p = s.fighters.find((p) => p.id === id);
        return p && p.hp > 0 && touches(p, b);
      });
    applyBlasts(s);
    shrinkArena(s);
    if (!this.finishIfOver({ ...ctx, state: s })) ctx.setTimer(TICK, 'tick');
    return s;
  }
  onLeave(ctx: LeaveContext<State, Options>): State {
    const s = cloneState(ctx.state);
    const p = s.fighters.find((p) => p.id === ctx.player.id);
    if (p) {
      p.hp = 0;
      p.ready = true;
      p.dir = 'none';
    }
    this.finishIfOver({ ...ctx, state: s });
    return s;
  }
  private finishIfOver(ctx: Ctx): boolean {
    const s = ctx.state;
    if (s.phase !== 'playing') return false;
    const alive = s.fighters.filter((p) => p.hp > 0);
    const sides = new Set(alive.map((p) => (s.mode === 'teams' ? p.team : p.id)));
    const practice = s.fighters.length === 1;
    if (
      (!practice && sides.size <= 1) ||
      (practice && alive.length === 0) ||
      s.elapsed >= MATCH_TIME
    ) {
      let winners = alive;
      s.reason =
        alive.length === 0
          ? 'Không còn người sống sót'
          : s.elapsed >= MATCH_TIME
            ? 'Hết thời gian'
            : s.mode === 'teams'
              ? 'Đội sống sót cuối cùng'
              : 'Người sống sót cuối cùng';
      if (s.elapsed >= MATCH_TIME && sides.size > 1) {
        const scores = new Map<string | number, number>();
        for (const p of alive) {
          const key = s.mode === 'teams' ? p.team : p.id;
          scores.set(key, (scores.get(key) ?? 0) + p.hp);
        }
        const best = Math.max(...scores.values());
        const top = [...scores.entries()].filter(([, hp]) => hp === best);
        winners =
          top.length === 1
            ? alive.filter((p) => (s.mode === 'teams' ? p.team : p.id) === top[0]?.[0])
            : [];
      }
      // A team victory belongs to eliminated teammates too, including match-history outcomes.
      if (s.mode === 'teams' && winners.length) {
        const team = winners[0]?.team;
        winners = s.fighters.filter((p) => p.team === team);
      }
      s.winners = winners.map((p) => p.id);
      s.phase = 'ended';
      for (const p of s.fighters) p.dir = 'none';
      ctx.finish(s.winners);
      return true;
    }
    return false;
  }
}
