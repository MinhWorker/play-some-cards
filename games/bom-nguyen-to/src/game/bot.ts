import {
  activateDash,
  activateSkill,
  blastCells,
  inRing,
  makeBomb,
  nextRing,
  placeBomb,
  walkable,
} from './arena.js';
import {
  cellOf,
  DIRECTIONS,
  type Direction,
  distance,
  enemies,
  type Fighter,
  FUSE,
  HEIGHT,
  keyOf,
  type Options,
  type Point,
  type State,
  tileAt,
  WIDTH,
} from './model.js';

export interface DangerWindow {
  start: number;
  end: number;
}
/** Fixed-point propagation predicts chain reactions before the original fuse. */
export function dangerMap(s: State, fighter?: Fighter): Map<string, DangerWindow[]> {
  const map = new Map<string, DangerWindow[]>();
  const add = (c: Point, window: DangerWindow) => {
    const key = keyOf(c);
    const windows = map.get(key) ?? [];
    windows.push(window);
    map.set(key, windows);
  };
  const times = new Map(s.bombs.map((b) => [b.id, Math.max(b.explodeAt, b.frozenUntil)]));
  const footprints = new Map(s.bombs.map((b) => [b.id, blastCells(s, b)]));
  for (let pass = 0; pass < s.bombs.length; pass++) {
    for (const b of s.bombs)
      for (const other of s.bombs) {
        if (b.id === other.id || (b.enhanced && b.element === 'ice')) continue;
        const time = times.get(b.id) ?? b.explodeAt;
        if (other.frozenUntil > time) continue;
        if (footprints.get(b.id)?.some((c) => distance(c, other) === 0))
          times.set(other.id, Math.min(times.get(other.id) ?? other.explodeAt, time));
      }
  }
  const hurts = (owner: string, team: number) =>
    !fighter ||
    owner === fighter.id ||
    s.mode === 'solo' ||
    s.friendlyFire ||
    team !== fighter.team;
  for (const b of s.bombs) {
    if (!hurts(b.owner, b.team)) continue;
    const start = times.get(b.id) ?? b.explodeAt;
    for (const c of footprints.get(b.id) ?? []) add(c, { start: start - 120, end: start + 850 });
  }
  for (const b of s.blasts)
    if (b.damage && hurts(b.owner, b.team))
      for (const c of b.cells) add(c, { start: s.time - 100, end: b.expires + 150 });
  // A fighter also keeps clear of the ring that the arena closes next, for good.
  const next = fighter && s.phase === 'playing' ? nextRing(s) : null;
  if (next) {
    const closes = s.time + next.at - s.elapsed;
    for (let y = 1; y < HEIGHT - 1; y++)
      for (let x = 1; x < WIDTH - 1; x++)
        if (inRing({ x, y }, next.ring) && !inRing({ x, y }, next.ring - 1))
          add({ x, y }, { start: closes - 400, end: Number.POSITIVE_INFINITY });
  }
  return map;
}
export const safeDuring = (
  danger: Map<string, DangerWindow[]>,
  p: Point,
  start: number,
  end: number,
) => !(danger.get(keyOf(p)) ?? []).some((w) => w.start <= end && w.end >= start);

/** Space-time BFS can wait and checks both ends of a traversal against blast intervals. */
export function findPath(
  s: State,
  p: Fighter,
  goal: (c: Point, at: number) => boolean,
  danger = dangerMap(s, p),
  maxSteps = 18,
): Point[] | null {
  const start = cellOf(p);
  const stepMs = Math.ceil(1000 / p.speed) + 80;
  const queue = [{ c: start, depth: 0, path: [] as Point[] }];
  const seen = new Set<string>([`${keyOf(start)}:0`]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (!node) continue;
    const at = s.time + node.depth * stepMs;
    if (node.depth > 0 && goal(node.c, at)) return node.path;
    if (node.depth >= maxSteps) continue;
    for (const dir of ['up', 'right', 'down', 'left', 'none'] as const) {
      const d = DIRECTIONS[dir];
      const c = { x: node.c.x + d.x, y: node.c.y + d.y };
      const stamp = `${keyOf(c)}:${node.depth + 1}`;
      if (seen.has(stamp) || tileAt(s, c) !== 'floor') continue;
      if (
        s.bombs.some(
          (b) =>
            distance(b, c) === 0 &&
            !(b.pass.includes(p.id) && node.path.every((n) => distance(n, start) === 0)),
        )
      )
        continue;
      if (
        !safeDuring(danger, node.c, at, at + stepMs * 0.5) ||
        !safeDuring(danger, c, at + stepMs * 0.5, at + stepMs + 120)
      )
        continue;
      seen.add(stamp);
      queue.push({ c, depth: node.depth + 1, path: [...node.path, c] });
    }
  }
  return null;
}
export function escapePath(s: State, p: Fighter): Point[] | null {
  const danger = dangerMap(s, p);
  return findPath(
    s,
    p,
    (c, at) => safeDuring(danger, c, at, Math.max(at + 800, s.time + FUSE + 1000)),
    danger,
  );
}
export function canEscapeBomb(s: State, p: Fighter): Point[] | null {
  return escapePath({ ...s, bombs: [...s.bombs, makeBomb(s, p)] }, p);
}
/**
 * The way to the next cell: first line up on the smaller offset, so a turn never clips the
 * corner of a wall or crate beside the corridor.
 */
function aim(p: Fighter, c: Point): Direction {
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const horizontal = Math.abs(dx) > 0.03 && (Math.abs(dy) <= 0.03 || Math.abs(dx) < Math.abs(dy));
  if (horizontal) return dx > 0 ? 'right' : 'left';
  if (Math.abs(dy) > 0.03) return dy > 0 ? 'down' : 'up';
  return 'none';
}
export function thinkBot(s: State, p: Fighter, options: Options, rng: () => number) {
  const interval = options.level === 'easy' ? 450 : options.level === 'normal' ? 220 : 100;
  const danger = dangerMap(s, p);
  const c = cellOf(p);
  // Any blast still to come over this cell (a bomb's whole fuse plus its flames) is a threat:
  // leaving at the last moment fails once the way out is long or another bomb lands.
  const horizon = s.time + FUSE + 1000;
  const threatened = !safeDuring(danger, c, s.time, horizon);
  if (p.target && distance(p.target, p) > 0.03 && !(threatened && p.nextThink <= s.time)) {
    p.dir = aim(p, p.target);
    return;
  }
  if (p.target && distance(p.target, p) <= 0.03) {
    p.x = p.target.x;
    p.y = p.target.y;
    p.target = null;
    // Keep running out of a blast without waiting for the next think.
    if (threatened) p.nextThink = s.time;
  }
  if (p.nextThink > s.time) {
    p.dir = 'none';
    return;
  }
  p.nextThink = s.time + interval;
  if (threatened) {
    const route = escapePath(s, p);
    const dest = route?.[0];
    p.target = dest ?? null;
    p.dir = dest ? aim(p, dest) : 'none';
    if (options.level !== 'easy' && route && route.length > 1) activateDash(s, p);
    return;
  }
  const opponents = s.fighters.filter((other) => other.hp > 0 && enemies(s, p, other));
  const target = opponents.sort(
    (a, b) =>
      (s.mode === 'teams' && options.level === 'hard' ? a.hp - b.hp : 0) ||
      distance(a, p) - distance(b, p),
  )[0];
  if (target && distance(target, p) < 5 && options.level !== 'easy') {
    const facing = aim(p, cellOf(target));
    if (facing !== 'none') p.facing = facing;
    activateSkill(s, p);
  }
  const proposed = makeBomb(s, p);
  const footprint = blastCells(s, proposed);
  const hits = opponents.some((other) =>
    footprint.some((tile) => distance(tile, cellOf(other)) === 0),
  );
  const crates = footprint.filter((tile) => tileAt(s, tile) === 'crate').length;
  const hypothetical = { ...s, bombs: [...s.bombs, proposed] };
  const alliesSafe =
    s.mode !== 'teams' ||
    s.fighters
      .filter((other) => other.hp > 0 && !enemies(s, p, other) && other.id !== p.id)
      .every(
        (other) =>
          safeDuring(dangerMap(hypothetical, other), cellOf(other), s.time, s.time + FUSE + 1000) ||
          escapePath(hypothetical, other),
      );
  if (
    (hits || crates > 0) &&
    alliesSafe &&
    p.nextBomb <= s.time &&
    s.bombs.filter((b) => b.owner === p.id).length < p.capacity &&
    !s.bombs.some((b) => distance(b, c) === 0)
  ) {
    const route = canEscapeBomb(s, p);
    const chance = options.level === 'easy' ? 0.4 : options.level === 'normal' ? 0.75 : 1;
    if (route?.length && rng() < chance && placeBomb(s, p)) {
      p.target = route[0] ?? null;
      p.dir = p.target ? aim(p, p.target) : 'none';
      p.nextThink = s.time;
      return;
    }
  }
  const pickup = s.pickups
    .filter((item) => item.kind !== 'heal' || p.hp <= 75)
    .sort(
      (a, b) =>
        (p.hp <= 50 ? Number(b.kind === 'heal') - Number(a.kind === 'heal') : 0) ||
        distance(a, p) - distance(b, p),
    )[0];
  // Never walk somewhere to stand in a blast that is still to come.
  const safe = (tile: Point, at: number) => safeDuring(danger, tile, at, horizon);
  let path = pickup
    ? findPath(s, p, (tile, at) => distance(tile, pickup) === 0 && safe(tile, at), danger, 14)
    : null;
  if (!path && target)
    path = findPath(
      s,
      p,
      (tile, at) => distance(tile, cellOf(target)) <= 1 && safe(tile, at),
      danger,
      16,
    );
  if (!path)
    path = findPath(
      s,
      p,
      (tile, at) =>
        safe(tile, at) &&
        ['up', 'down', 'left', 'right'].some((dir) => {
          const d = DIRECTIONS[dir as Direction];
          return tileAt(s, { x: tile.x + d.x, y: tile.y + d.y }) === 'crate';
        }),
      danger,
      12,
    );
  const dest = path?.[0];
  p.target = dest && walkable(s, dest, p) ? dest : null;
  p.dir = p.target ? aim(p, p.target) : 'none';
}
