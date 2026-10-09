import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import {
  activateDash,
  activateSkill,
  applyBlasts,
  blastCells,
  collectPickups,
  explodeBombs,
  follow,
  makeBomb,
  moveFighter,
  placeBomb,
} from './arena.js';
import { canEscapeBomb, dangerMap, findPath, thinkBot } from './bot.js';
import {
  cloneState,
  distance,
  ELEMENTS,
  HEIGHT,
  indexOf,
  MATCH_TIME,
  optionsSchema,
  type State,
  TICK,
  WIDTH,
} from './model.js';

function arena(mode: 'solo' | 'teams' = 'solo'): State {
  const s = cloneState(testGame(plugin, ['a', 'b', 'c', 'd'], { options: { mode } }).state);
  s.phase = 'playing';
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      s.cells[indexOf({ x, y })] =
        x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? 'wall' : 'floor';
  return s;
}
const actor = (s: State, seat = 0) => {
  const p = s.fighters[seat];
  if (!p) throw new Error('Missing test actor');
  return p;
};

describe('authoritative match lifecycle', () => {
  it('accepts 1–4 characters, fills missing seats and forces four for teams', () => {
    for (let n = 1; n <= 4; n++)
      expect(testGame(plugin, ['a'], { options: { total: n } }).state.fighters).toHaveLength(n);
    expect(
      testGame(plugin, ['a'], { options: { mode: 'teams', total: 1, bots: 0 } }).state.fighters,
    ).toHaveLength(4);
    expect(optionsSchema.parse({}).level).toBe('normal');
  });
  it('each human chooses an element before ready and timers cannot be forged by a client', () => {
    const g = testGame(plugin, ['a', 'b'], { options: { total: 2 } });
    g.send('a', 'choose', { element: 'water' }).send('a', 'ready');
    expect(g.state.phase).toBe('select');
    g.send('b', 'choose', { element: 'ice' }).send('b', 'ready');
    expect(g.state.phase).toBe('playing');
    expect(g.error('a', 'choose', { element: 'fire' })).toBeTruthy();
    expect(g.error('a', 'tick')).toBeTruthy();
    expect(g.error('a', 'input', { direction: 'teleport' })).toBeTruthy();
  });
  it('auto-starts after selection timeout, expires stale movement and does not mutate snapshots', () => {
    const g = testGame(plugin, ['a'], { options: { total: 1 } });
    const before = JSON.stringify(g.state);
    g.send('a', 'choose', { element: 'wind' });
    expect(before).toContain('fire');
    for (let i = 0; i < 200; i++) g.fireTimer();
    expect(g.state.phase).toBe('playing');
    const snapshot = g.state;
    const serialized = JSON.stringify(snapshot);
    g.send('a', 'input', { direction: 'right' });
    expect(JSON.stringify(snapshot)).toBe(serialized);
    for (let i = 0; i < 8; i++) g.fireTimer();
    expect(actor(g.state).dir).toBe('none');
    expect(actor(g.state).x).toBeGreaterThan(1);
  });
  it('a lone player can practice and a solo leaver loses without stopping others', () => {
    const practice = testGame(plugin, ['a'], { options: { total: 1 } });
    practice.send('a', 'ready').fireTimer();
    expect(practice.result).toBeNull();
    const g = testGame(plugin, ['a', 'b'], { options: { total: 2 } });
    g.send('a', 'ready').send('b', 'ready').leave('a');
    expect(g.result?.winners).toEqual(['b']);
    expect(g.timer).toBeNull();
  });
  it('last living team wins with both surviving team members and ends the timer', () => {
    const g = testGame(plugin, ['a', 'b', 'c', 'd'], { options: { mode: 'teams' } });
    for (const id of ['a', 'b', 'c', 'd']) g.send(id, 'ready');
    g.leave('b');
    expect(g.result).toBeNull();
    g.leave('d');
    expect(g.result?.winners).toEqual(['a', 'c']);
    expect(g.timer).toBeNull();
  });
  it('an eliminated teammate shares the winning team result', () => {
    const g = testGame(plugin, ['a', 'b', 'c', 'd'], { options: { mode: 'teams' } });
    for (const id of ['a', 'b', 'c', 'd']) g.send(id, 'ready');
    g.leave('c').leave('b').leave('d');
    expect(g.result?.winners).toEqual(['a', 'c']);
  });
  it('bots move and destroy obstacles across every difficulty, and matches are bounded', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const g = testGame(plugin, ['a', 'b', 'c', 'd'], {
        options: { level },
        bots: ['a', 'b', 'c', 'd'],
        seed: 13,
      });
      for (let i = 0; i < 800 && !g.result; i++) g.fireTimer();
      expect(g.state.fighters.reduce((n, p) => n + p.crates, 0)).toBeGreaterThan(0);
      for (let i = 0; i < MATCH_TIME / TICK && !g.result; i++) g.fireTimer();
      expect(g.result).not.toBeNull();
      expect(g.state.phase).toBe('ended');
    }
  }, 20000);
});

describe('bombs, collision and elemental combat', () => {
  it('snaps bombs to cells, limits capacity and does not permit duplicate placement', () => {
    const s = arena(),
      p = actor(s);
    p.x = 3.1;
    p.y = 3.2;
    expect(placeBomb(s, p)).toBe(true);
    expect(s.bombs[0]).toMatchObject({ x: 3, y: 3, explodeAt: 2500 });
    s.time = 500;
    expect(placeBomb(s, p)).toBe(false);
    p.x = 4;
    expect(placeBomb(s, p)).toBe(true);
    s.time = 1000;
    p.x = 5;
    expect(placeBomb(s, p)).toBe(false);
  });
  it('walls block cross rays and a crate stops a ray without damaging tiles behind it', () => {
    const s = arena(),
      p = actor(s);
    p.x = 5;
    p.y = 5;
    p.range = 4;
    s.cells[indexOf({ x: 5, y: 4 })] = 'wall';
    s.cells[indexOf({ x: 7, y: 5 })] = 'crate';
    const cells = blastCells(s, makeBomb(s, p));
    expect(cells).toContainEqual({ x: 7, y: 5 });
    expect(cells).not.toContainEqual({ x: 8, y: 5 });
    expect(cells).not.toContainEqual({ x: 5, y: 3 });
    placeBomb(s, p);
    s.time = 2500;
    explodeBombs(s, () => 0.1);
    expect(s.cells[indexOf({ x: 7, y: 5 })]).toBe('floor');
    expect(s.pickups).toContainEqual({ x: 7, y: 5, kind: 'heal' });
  });
  it('dash cannot tunnel through walls or another bomb', () => {
    const s = arena(),
      p = actor(s);
    p.x = 3;
    p.y = 3;
    s.cells[indexOf({ x: 4, y: 3 })] = 'wall';
    moveFighter(s, p, 5, 0);
    expect(p.x).toBeLessThan(3.3);
    s.cells[indexOf({ x: 4, y: 3 })] = 'floor';
    const other = actor(s, 1);
    other.x = 4;
    other.y = 3;
    placeBomb(s, other);
    moveFighter(s, p, 5, 0);
    expect(p.x).toBeLessThan(3.3);
    expect(activateDash(s, p)).toBe(true);
    expect(activateDash(s, p)).toBe(false);
  });
  it('walks one lane wide and slides around corners instead of catching on them', () => {
    const s = arena(),
      p = actor(s);
    // A corridor along row 3, walls above and below.
    for (let x = 2; x <= 6; x++) {
      s.cells[indexOf({ x, y: 2 })] = 'wall';
      s.cells[indexOf({ x, y: 4 })] = 'wall';
    }
    p.x = 2;
    p.y = 3;
    moveFighter(s, p, 0, 0.3);
    expect(p.y).toBe(3);
    moveFighter(s, p, 1.5, 0);
    expect(p).toMatchObject({ x: 3.5, y: 3 });
    // Halfway between rows 5 and 6 at column 7, a turn lines up with the open row first.
    p.x = 7;
    p.y = 5.4;
    s.cells[indexOf({ x: 8, y: 5 })] = 'wall';
    moveFighter(s, p, 1, 0);
    expect(p).toMatchObject({ x: 7.4, y: 6 });
  });
  it("follows the player's own view only along open lanes and near the server", () => {
    const s = arena(),
      p = actor(s);
    p.x = 3;
    p.y = 3;
    follow(s, p, { x: 3.8, y: 3 });
    expect(p.x).toBeCloseTo(3.8);
    s.cells[indexOf({ x: 5, y: 3 })] = 'wall';
    follow(s, p, { x: 5, y: 3 });
    expect(p.x).toBeCloseTo(3.8);
    follow(s, p, { x: 3.8, y: 6 });
    expect(p.y).toBe(3);
  });
  it('chain reactions predict the early fuse and resolve completely in one tick', () => {
    const s = arena();
    const a = actor(s),
      b = actor(s, 1);
    a.x = 3;
    a.y = 3;
    b.x = 5;
    b.y = 3;
    placeBomb(s, a);
    s.time = 1000;
    placeBomb(s, b);
    const danger = dangerMap(s);
    expect(danger.get('6,3')?.[0]?.start).toBe(2380);
    s.time = 2500;
    explodeBombs(s, () => 1);
    expect(s.bombs).toHaveLength(0);
    expect(s.blasts).toHaveLength(2);
  });
  it('a newly placed bomb in an active blast explodes immediately', () => {
    const s = arena(),
      p = actor(s);
    p.x = 3;
    p.y = 3;
    placeBomb(s, p);
    s.time = 2500;
    explodeBombs(s, () => 1);
    s.time = 2600;
    p.nextBomb = 0;
    placeBomb(s, p);
    explodeBombs(s, () => 1);
    expect(s.bombs).toHaveLength(0);
    expect(s.blasts).toHaveLength(2);
  });
  it('damage applies once per explosion, grants hit protection and honors friendly fire', () => {
    const s = arena('teams'),
      a = actor(s),
      ally = actor(s, 2),
      enemy = actor(s, 1);
    a.x = 5;
    a.y = 5;
    ally.x = 6;
    ally.y = 5;
    enemy.x = 4;
    enemy.y = 5;
    placeBomb(s, a);
    s.time = 2500;
    explodeBombs(s, () => 1);
    applyBlasts(s);
    applyBlasts(s);
    expect(a.hp).toBe(65);
    expect(enemy.hp).toBe(65);
    expect(ally.hp).toBe(100);
    s.friendlyFire = true;
    s.blasts[0]?.hit.splice(0);
    s.time += 800;
    applyBlasts(s);
    expect(ally.hp).toBe(65);
  });
  it('all five skill cooldowns work and enhanced fire increases damage and range', () => {
    for (const element of ELEMENTS) {
      const s = arena(),
        p = actor(s);
      p.element = element;
      expect(activateSkill(s, p)).toBe(true);
      expect(activateSkill(s, p)).toBe(false);
    }
    const s = arena(),
      p = actor(s);
    activateSkill(s, p);
    expect(makeBomb(s, p)).toMatchObject({ range: 3, damage: 50, enhanced: true });
    s.time = 7000;
    expect(makeBomb(s, p)).toMatchObject({ range: 2, damage: 35, enhanced: false });
  });
  it('water has a rectangle and slows; lightning has a long line and jumps once', () => {
    const s = arena(),
      p = actor(s);
    p.x = 5;
    p.y = 5;
    p.element = 'water';
    activateSkill(s, p);
    expect(blastCells(s, makeBomb(s, p))).toHaveLength(15);
    const enemy = actor(s, 1);
    enemy.x = 6;
    enemy.y = 6;
    placeBomb(s, p);
    s.time = 2500;
    explodeBombs(s, () => 1);
    applyBlasts(s);
    expect(enemy.slowUntil).toBe(4500);
    const l = arena(),
      lp = actor(l);
    lp.x = 5;
    lp.y = 5;
    lp.element = 'lightning';
    activateSkill(l, lp);
    const cells = blastCells(l, makeBomb(l, lp));
    expect(cells.every((c) => c.y === 5)).toBe(true);
    expect(cells.length).toBeGreaterThan(7);
    const e = actor(l, 1),
      next = actor(l, 3);
    e.x = 6;
    e.y = 5;
    next.x = 6;
    next.y = 6;
    placeBomb(l, lp);
    l.time = 2500;
    explodeBombs(l, () => 1);
    applyBlasts(l);
    expect(e.hp).toBe(65);
    expect(next.hp).toBe(80);
  });
  it('ice freezes actors and pauses a neighboring bomb rather than chaining it', () => {
    const s = arena(),
      p = actor(s),
      other = actor(s, 1);
    p.x = 3;
    p.y = 3;
    p.element = 'ice';
    activateSkill(s, p);
    placeBomb(s, p);
    s.time = 1000;
    other.x = 5;
    other.y = 3;
    placeBomb(s, other);
    s.time = 2500;
    explodeBombs(s, () => 1);
    applyBlasts(s);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]).toMatchObject({ frozenUntil: 4000, explodeAt: 5000 });
    expect(other.frozenUntil).toBe(4000);
    expect(placeBomb(s, other)).toBe(false);
    expect(activateDash(s, other)).toBe(false);
    s.time = 4000;
    explodeBombs(s, () => 1);
    expect(s.bombs).toHaveLength(1);
    s.time = 5000;
    explodeBombs(s, () => 1);
    expect(s.bombs).toHaveLength(0);
  });
  it('wind pushes bombs on the grid, hits an opponent and leaves allies unharmed', () => {
    const s = arena('teams'),
      p = actor(s),
      enemy = actor(s, 1);
    p.x = 3;
    p.y = 3;
    p.element = 'wind';
    p.facing = 'right';
    enemy.x = 5;
    enemy.y = 3;
    placeBomb(s, enemy);
    enemy.y = 4;
    activateSkill(s, p);
    expect(s.bombs[0]?.x).toBe(7);
    const next = arena('teams'),
      a = actor(next),
      b = actor(next, 1),
      ally = actor(next, 2);
    a.x = 3;
    a.y = 3;
    a.element = 'wind';
    a.facing = 'right';
    b.x = 4;
    b.y = 3;
    ally.x = 5;
    ally.y = 3;
    activateSkill(next, a);
    expect(b.hp).toBe(80);
    expect(b.x).toBeGreaterThan(4);
    expect(ally.hp).toBe(100);
  });
  it('pickups heal and cap upgrades rather than growing forever', () => {
    const s = arena(),
      p = actor(s);
    p.hp = 90;
    p.range = 5;
    p.capacity = 4;
    p.speed = 4.5;
    for (const kind of ['heal', 'range', 'capacity', 'speed'] as const)
      s.pickups.push({ x: 1, y: 1, kind });
    collectPickups(s, p);
    expect(p).toMatchObject({ hp: 100, range: 5, capacity: 4, speed: 4.5 });
    expect(s.pickups).toHaveLength(0);
  });
});

describe('tactical bots', () => {
  it('finds a route around walls and refuses a bomb in a sealed corridor', () => {
    const s = arena(),
      p = actor(s);
    s.cells[indexOf({ x: 2, y: 1 })] = 'wall';
    const path = findPath(s, p, (c) => distance(c, { x: 3, y: 1 }) === 0);
    expect(path?.[0]).toEqual({ x: 1, y: 2 });
    s.cells[indexOf({ x: 1, y: 2 })] = 'wall';
    expect(canEscapeBomb(s, p)).toBeNull();
    thinkBot(s, p, optionsSchema.parse({ level: 'hard' }), () => 0);
    expect(s.bombs).toHaveLength(0);
  });
  it('checks temporal hazards while planning an escape and pursues low HP healing', () => {
    const s = arena(),
      p = actor(s);
    p.x = 3;
    p.y = 3;
    expect(canEscapeBomb(s, p)?.length).toBeGreaterThan(0);
    p.hp = 20;
    s.pickups.push({ x: 3, y: 4, kind: 'heal' });
    thinkBot(s, p, optionsSchema.parse({ level: 'hard' }), () => 0);
    expect(p.target).toEqual({ x: 3, y: 4 });
  });
  it('leaves the ring that closes next before the arena shrinks', () => {
    const s = arena(),
      p = actor(s);
    s.elapsed = 118000;
    thinkBot(s, p, optionsSchema.parse({ level: 'normal' }), () => 0);
    expect(p.target).not.toBeNull();
    expect(p.target && (p.target.x > 1 || p.target.y > 1)).toBe(true);
  });
});

describe('walking off a bomb', () => {
  it('a player keeps going until no part of them touches their own bomb', () => {
    const g = testGame(plugin, ['a'], { options: { total: 1 } });
    g.send('a', 'ready').send('a', 'bomb');
    for (let i = 0; i < 6; i++) g.send('a', 'input', { direction: 'right' }).fireTimer();
    expect(g.state.fighters[0]?.x).toBeGreaterThan(2.5);
  });
});
