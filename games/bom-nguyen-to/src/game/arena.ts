import {
  type Blast,
  type Bomb,
  cellOf,
  DIRECTIONS,
  distance,
  enemies,
  type Fighter,
  FUSE,
  HEIGHT,
  indexOf,
  inside,
  keyOf,
  type Point,
  type State,
  tileAt,
  WIDTH,
} from './model.js';

/** Rays include the first crate/bomb and stop there; a wall is never included. */
export function blastCells(s: State, b: Bomb): Point[] {
  const result = new Map<string, Point>();
  const add = (p: Point) => result.set(keyOf(p), p);
  const ray = (start: Point, dx: number, dy: number, length: number) => {
    for (let i = 1; i <= length; i++) {
      const p = { x: start.x + dx * i, y: start.y + dy * i };
      const tile = tileAt(s, p);
      if (tile === 'wall') break;
      add(p);
      if (
        tile === 'crate' ||
        s.bombs.some((other) => other.id !== b.id && other.x === p.x && other.y === p.y)
      )
        break;
    }
  };
  add({ x: b.x, y: b.y });
  if (b.enhanced && b.element === 'lightning') {
    ray(b, b.axis === 'x' ? 1 : 0, b.axis === 'y' ? 1 : 0, b.range * 2 + 1);
    ray(b, b.axis === 'x' ? -1 : 0, b.axis === 'y' ? -1 : 0, b.range * 2 + 1);
  } else if (b.enhanced && b.element === 'water') {
    const dx = b.axis === 'x' ? 1 : 0;
    const dy = b.axis === 'y' ? 1 : 0;
    for (const offset of [-1, 0, 1]) {
      const start = { x: b.x + dy * offset, y: b.y + dx * offset };
      if (tileAt(s, start) === 'wall') continue;
      add(start);
      if (
        tileAt(s, start) === 'crate' ||
        s.bombs.some((other) => other.id !== b.id && distance(other, start) === 0)
      )
        continue;
      ray(start, dx, dy, b.range);
      ray(start, -dx, -dy, b.range);
    }
  } else {
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const d = DIRECTIONS[dir];
      ray(b, d.x, d.y, b.range);
    }
  }
  return [...result.values()];
}

export function walkable(s: State, p: Point, fighter?: Fighter, ignoreBomb = false): boolean {
  if (tileAt(s, p) !== 'floor') return false;
  return (
    ignoreBomb ||
    !s.bombs.some((b) => b.x === p.x && b.y === p.y && !b.pass.includes(fighter?.id ?? ''))
  );
}

/** Half the side of a fighter's square footprint, in cells (for walking off a bomb). */
const BODY = 0.26;
const corners = ({ x, y }: Point) => [
  { x: x - BODY, y: y - BODY },
  { x: x + BODY, y: y - BODY },
  { x: x - BODY, y: y + BODY },
  { x: x + BODY, y: y + BODY },
];

/** Whether any part of a fighter at `p` stands on `cell`. */
export const touches = (p: Point, cell: Point) =>
  corners(p).some((corner) => distance(cellOf(corner), cell) === 0);

const EPS = 1e-6;

/**
 * Fighters walk the grid's lanes, one lane wide: walking along a row keeps them centred in it, so
 * they never wobble between the walls of a corridor. A turn first lines them up with the nearer
 * lane whose next cell is open (corner assist), so a corner never catches them. They advance cell
 * by cell and stop at the centre before a wall, crate or bomb, so a dash cannot tunnel.
 */
export function moveFighter(s: State, p: Fighter, dx: number, dy: number) {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const amount = horizontal ? dx : dy;
  if (!amount) return;
  const sign = Math.sign(amount);
  let budget = Math.abs(amount);
  let along = horizontal ? p.x : p.y;
  let cross = horizontal ? p.y : p.x;
  const open = (a: number, c: number) =>
    walkable(s, horizontal ? { x: a, y: c } : { x: c, y: a }, p);
  const near = Math.round(cross);
  if (Math.abs(cross - near) > EPS) {
    const far = cross > near ? near + 1 : near - 1;
    const ahead = Math.round(along) + sign;
    const lane = open(ahead, near) || !open(ahead, far) ? near : far;
    const shift = Math.min(budget, Math.abs(lane - cross));
    cross += Math.sign(lane - cross) * shift;
    budget -= shift;
  }
  if (Math.abs(cross - Math.round(cross)) <= EPS) {
    cross = Math.round(cross);
    while (budget > EPS) {
      const cell = Math.round(along);
      const toCentre = (cell - along) * sign;
      if (toCentre > EPS) {
        const step = Math.min(budget, toCentre);
        along += sign * step;
        budget -= step;
        continue;
      }
      if (!open(cell + sign, cross)) break;
      const step = Math.min(budget, 1 + toCentre);
      along += sign * step;
      budget -= step;
    }
  }
  p.x = horizontal ? along : cross;
  p.y = horizontal ? cross : along;
}

/** How far a player's own screen may be from the server when it reports where they are. */
const FOLLOW_LIMIT = 1.6;

/**
 * Take the position a player's screen shows (sent with their input), when they could have walked
 * there along open lanes: the server and their view stay in step, without pulling them back.
 */
export function follow(s: State, p: Fighter, to: Point) {
  if (p.hp <= 0 || p.frozenUntil > s.time || p.stunUntil > s.time) return;
  if (Math.abs(to.x - p.x) + Math.abs(to.y - p.y) > FOLLOW_LIMIT) return;
  for (const xFirst of [true, false]) {
    const probe = { ...p };
    for (const leg of xFirst ? ['x', 'y'] : ['y', 'x'])
      if (leg === 'x') moveFighter(s, probe, to.x - probe.x, 0);
      else moveFighter(s, probe, 0, to.y - probe.y);
    if (Math.abs(probe.x - to.x) + Math.abs(probe.y - to.y) < 0.01) {
      p.x = to.x;
      p.y = to.y;
      return;
    }
  }
}

export function makeBomb(s: State, p: Fighter): Bomb {
  const enhanced = p.skillUntil > s.time;
  return {
    ...cellOf(p),
    id: s.nextId,
    owner: p.id,
    team: p.team,
    element: p.element,
    enhanced,
    range: p.range + (enhanced && p.element === 'fire' ? 1 : 0),
    damage: 35 + (enhanced && p.element === 'fire' ? 15 : 0),
    axis: p.facing === 'left' || p.facing === 'right' ? 'x' : 'y',
    explodeAt: s.time + FUSE,
    frozenUntil: 0,
    pass: s.fighters
      .filter((other) => other.hp > 0 && touches(other, cellOf(p)))
      .map((other) => other.id),
  };
}
export function placeBomb(s: State, p: Fighter): boolean {
  if (
    p.hp <= 0 ||
    s.phase !== 'playing' ||
    p.frozenUntil > s.time ||
    p.stunUntil > s.time ||
    p.nextBomb > s.time
  )
    return false;
  if (s.bombs.filter((b) => b.owner === p.id).length >= p.capacity) return false;
  const c = cellOf(p);
  if (!walkable(s, c, p) || s.bombs.some((b) => distance(b, c) === 0)) return false;
  s.bombs.push(makeBomb(s, p));
  s.nextId++;
  p.nextBomb = s.time + 300;
  return true;
}

const canHurt = (s: State, b: Pick<Blast, 'owner' | 'team'>, p: Fighter) =>
  p.id === b.owner || s.mode === 'solo' || s.friendlyFire || p.team !== b.team;

function push(s: State, p: Fighter, source: Point, steps = 1) {
  const dx = p.x - source.x;
  const dy = p.y - source.y;
  const dir =
    Math.abs(dx) >= Math.abs(dy)
      ? { x: Math.sign(dx) || 1, y: 0 }
      : { x: 0, y: Math.sign(dy) || 1 };
  moveFighter(s, p, dir.x * steps, dir.y * steps);
  p.target = null;
}

export function activateSkill(s: State, p: Fighter): boolean {
  if (
    p.hp <= 0 ||
    s.phase !== 'playing' ||
    p.skillReady > s.time ||
    p.frozenUntil > s.time ||
    p.stunUntil > s.time
  )
    return false;
  p.skillReady = s.time + 14000;
  p.skillUntil = s.time + 6000;
  if (p.element !== 'wind') return true;
  const dir = DIRECTIONS[p.facing];
  for (const b of [...s.bombs].sort((a, b) => distance(b, p) - distance(a, p))) {
    const rel = { x: b.x - p.x, y: b.y - p.y };
    const forward = rel.x * dir.x + rel.y * dir.y;
    if (
      forward < -0.5 ||
      forward > 3 ||
      Math.abs(rel.x * dir.y - rel.y * dir.x) > 1.2 ||
      b.frozenUntil > s.time
    )
      continue;
    for (let n = 0; n < 2; n++) {
      const dest = { x: b.x + dir.x, y: b.y + dir.y };
      if (
        !walkable(s, dest, undefined) ||
        s.fighters.some((f) => f.hp > 0 && distance(cellOf(f), dest) === 0)
      )
        break;
      b.x = dest.x;
      b.y = dest.y;
      b.pass = [];
    }
  }
  const cells: Point[] = [cellOf(p)];
  const pushed = new Set<string>();
  for (let n = 1; n <= 3; n++) {
    const c = { x: Math.round(p.x) + dir.x * n, y: Math.round(p.y) + dir.y * n };
    if (tileAt(s, c) !== 'floor') break;
    cells.push(c);
    for (const other of s.fighters) {
      if (
        other.hp > 0 &&
        !pushed.has(other.id) &&
        enemies(s, p, other) &&
        distance(cellOf(other), c) === 0
      ) {
        pushed.add(other.id);
        if (other.invulnerableUntil <= s.time) {
          other.hp = Math.max(0, other.hp - 20);
          other.invulnerableUntil = s.time + 700;
        }
        push(s, other, p, 2);
      }
    }
  }
  s.blasts.push({
    id: s.nextId++,
    cells,
    owner: p.id,
    team: p.team,
    element: 'wind',
    enhanced: true,
    damage: 0,
    expires: s.time + 500,
    hit: s.fighters.map((f) => f.id),
  });
  return true;
}

export function activateDash(s: State, p: Fighter): boolean {
  if (
    s.phase !== 'playing' ||
    p.hp <= 0 ||
    p.dashReady > s.time ||
    p.frozenUntil > s.time ||
    p.stunUntil > s.time
  )
    return false;
  p.dashUntil = s.time + 650;
  p.dashReady = s.time + 5000;
  return true;
}

/** Resolve simultaneous bombs in stable order; ice holds a chained bomb until it thaws. */
export function explodeBombs(s: State, rng: () => number) {
  // Newly placed or wind-pushed bombs can enter a still-active explosion.
  for (const blast of s.blasts)
    for (const other of s.bombs) {
      const marker = `bomb:${other.id}`;
      if (
        blast.expires <= s.time ||
        blast.damage === 0 ||
        blast.hit.includes(marker) ||
        !blast.cells.some((c) => distance(c, other) === 0)
      )
        continue;
      blast.hit.push(marker);
      if (blast.enhanced && blast.element === 'ice') {
        const remaining = Math.max(0, other.explodeAt - Math.max(s.time, other.frozenUntil));
        other.frozenUntil = Math.max(other.frozenUntil, s.time + 1500);
        other.explodeAt = other.frozenUntil + remaining;
      } else if (other.frozenUntil <= s.time) other.explodeAt = s.time;
    }
  let safety = s.bombs.length + 1;
  while (safety-- > 0) {
    const b = s.bombs.find((b) => b.explodeAt <= s.time && b.frozenUntil <= s.time);
    if (!b) break;
    const cells = blastCells(s, b);
    const hitCells = new Set(cells.map(keyOf));
    s.bombs = s.bombs.filter((other) => other.id !== b.id);
    for (const other of s.bombs) {
      if (!hitCells.has(keyOf(other))) continue;
      if (b.enhanced && b.element === 'ice') {
        const remaining = Math.max(0, other.explodeAt - Math.max(s.time, other.frozenUntil));
        other.frozenUntil = Math.max(other.frozenUntil, s.time + 1500);
        other.explodeAt = other.frozenUntil + remaining;
      } else if (other.frozenUntil <= s.time) other.explodeAt = s.time;
    }
    for (const c of cells) {
      s.pickups = s.pickups.filter((p) => distance(p, c) !== 0);
      if (tileAt(s, c) !== 'crate') continue;
      s.cells[indexOf(c)] = 'floor';
      const owner = s.fighters.find((p) => p.id === b.owner);
      if (owner) owner.crates++;
      const roll = rng();
      if (roll < 0.55)
        s.pickups.push({
          ...c,
          kind: roll < 0.2 ? 'heal' : roll < 0.33 ? 'range' : roll < 0.44 ? 'capacity' : 'speed',
        });
    }
    s.blasts.push({
      id: s.nextId++,
      cells,
      owner: b.owner,
      team: b.team,
      element: b.element,
      enhanced: b.enhanced,
      damage: b.damage,
      expires: s.time + 650,
      hit: [],
    });
  }
}

export function applyBlasts(s: State) {
  for (const blast of s.blasts) {
    for (const p of s.fighters) {
      if (
        p.hp <= 0 ||
        blast.hit.includes(p.id) ||
        !canHurt(s, blast, p) ||
        !blast.cells.some((c) => distance(c, cellOf(p)) === 0)
      )
        continue;
      blast.hit.push(p.id);
      if (p.invulnerableUntil > s.time) continue;
      const wasAlive = p.hp > 0;
      p.hp = Math.max(0, p.hp - blast.damage);
      p.invulnerableUntil = s.time + 700;
      if (blast.enhanced && blast.element === 'water') p.slowUntil = s.time + 2000;
      if (blast.enhanced && blast.element === 'ice') p.frozenUntil = s.time + 1500;
      if (blast.enhanced && blast.element === 'lightning' && p.id !== blast.owner) {
        const next = s.fighters
          .filter(
            (other) =>
              other.hp > 0 &&
              other.id !== p.id &&
              other.id !== blast.owner &&
              canHurt(s, blast, other) &&
              distance(other, p) <= 2.5,
          )
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (next && next.invulnerableUntil <= s.time) {
          next.hp = Math.max(0, next.hp - 20);
          next.invulnerableUntil = s.time + 700;
          blast.hit.push(next.id);
        } else p.stunUntil = s.time + 900;
      }
      if (blast.enhanced && blast.element === 'wind') push(s, p, blast.cells[0] ?? p);
      if (wasAlive && p.hp === 0) {
        const owner = s.fighters.find((f) => f.id === blast.owner);
        if (owner && owner.id !== p.id) owner.kills++;
      }
    }
  }
}

export function collectPickups(s: State, p: Fighter) {
  if (p.hp <= 0) return;
  s.pickups = s.pickups.filter((item) => {
    if (distance(item, cellOf(p)) !== 0) return true;
    if (item.kind === 'heal') p.hp = Math.min(100, p.hp + 30);
    if (item.kind === 'range') p.range = Math.min(5, p.range + 1);
    if (item.kind === 'capacity') p.capacity = Math.min(4, p.capacity + 1);
    if (item.kind === 'speed') p.speed = Math.min(4.5, p.speed + 0.25);
    return false;
  });
}

/** The arena first shrinks after 2 minutes of play, then one ring every 12 seconds. */
export const SHRINK_START = 120000;
export const SHRINK_EVERY = 12000;
const SMALLEST_RING = 4;

/** Whether `p` lies in ring `ring` or further out (ring 1 = the cells along the fence). */
export const inRing = (p: Point, ring: number) =>
  p.x <= ring || p.y <= ring || p.x >= WIDTH - 1 - ring || p.y >= HEIGHT - 1 - ring;

/** The ring that closes next and when (play time, `s.elapsed`), or null at the smallest arena. */
export function nextRing(s: State): { ring: number; at: number } | null {
  const ring = s.ring + 1;
  return ring > SMALLEST_RING ? null : { ring, at: SHRINK_START + (ring - 1) * SHRINK_EVERY };
}

export function shrinkArena(s: State) {
  const ring =
    s.elapsed < SHRINK_START
      ? 0
      : Math.min(SMALLEST_RING, 1 + Math.floor((s.elapsed - SHRINK_START) / SHRINK_EVERY));
  if (ring === s.ring) return;
  s.ring = ring;
  for (let y = 1; y < HEIGHT - 1; y++)
    for (let x = 1; x < WIDTH - 1; x++) {
      const p = { x, y };
      if (inRing(p, ring)) {
        s.cells[indexOf(p)] = 'wall';
        for (const f of s.fighters) if (distance(cellOf(f), p) === 0) f.hp = 0;
      }
    }
  s.bombs = s.bombs.filter((b) => tileAt(s, b) !== 'wall');
  s.pickups = s.pickups.filter((p) => inside(p) && tileAt(s, p) === 'floor');
}
