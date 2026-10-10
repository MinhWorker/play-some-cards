/**
 * Achievements and levels, as data. An achievement is reached once a player's count of a stat
 * gets to a number: the hub's own (below) count over every game, a game's own
 * (`meta.achievements`) count in that game. Stats are `played` and `won` (counted by the server
 * for every finished game) and whatever a game counts with `ctx.stat`.
 *
 * Experience (`xp`) is what levels go by: `XP_PER_GAME` for each game played, plus each
 * achievement's `xp` when it is reached. It is kept as earned, so changing these numbers later
 * does not change what players already have.
 *
 * Append achievements; never reuse or rename an id, since players keep them.
 */
import type { AchievementMeta } from '@xomdao/sdk';
import { CORE_STATS, STAT_NAME } from '@xomdao/sdk';
import { games } from './registry.js';

/** An achievement with its hub id (`core:won-10`, `tien-len:chop`) and its game, if any. */
export interface AchievementDef extends Required<Omit<AchievementMeta, 'reward' | 'xp'>> {
  reward: Record<string, number>;
  xp: number;
  /** The game it counts in; absent for the hub's own, which count over every game. */
  gameId?: string;
}

/** Experience for every finished game (bots excepted). */
export const XP_PER_GAME = 10;

/** The hub's own achievements: they count over every game. */
const CORE: AchievementMeta[] = [
  {
    id: 'played-1',
    name: 'Ván đầu tiên',
    stat: 'played',
    at: 1,
    xp: 20,
    reward: { 'core:coin': 20 },
  },
  {
    id: 'played-10',
    name: 'Mười ván',
    stat: 'played',
    at: 10,
    xp: 50,
    reward: { 'core:coin': 50 },
  },
  {
    id: 'played-50',
    name: 'Khách quen của xóm',
    stat: 'played',
    at: 50,
    xp: 150,
    reward: { 'core:coin': 150 },
  },
  { id: 'won-1', name: 'Trận thắng đầu', stat: 'won', at: 1, xp: 20, reward: { 'core:coin': 20 } },
  {
    id: 'won-10',
    name: 'Mười trận thắng',
    stat: 'won',
    at: 10,
    xp: 100,
    reward: { 'core:coin': 100 },
  },
  {
    id: 'won-50',
    name: 'Cao thủ trong xóm',
    stat: 'won',
    at: 50,
    xp: 300,
    reward: { 'core:coin': 300 },
  },
];

const define = (meta: AchievementMeta, gameId?: string): AchievementDef => ({
  id: `${gameId ?? 'core'}:${meta.id}`,
  name: meta.name,
  stat: meta.stat,
  at: meta.at,
  reward: meta.reward ?? {},
  xp: meta.xp ?? 0,
  ...(gameId ? { gameId } : {}),
});

/** Every achievement: the hub's own first, then each game's in registry order. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...CORE.map((meta) => define(meta)),
  ...Object.values(games).flatMap((game) =>
    (game.achievements ?? []).map((meta) => define(meta, game.id)),
  ),
];

/** Problems with a list of achievements (a game's, or the hub's own); empty when fine. */
export function achievementProblems(list: AchievementMeta[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const a of list) {
    const add = (text: string) => problems.push(`achievement "${a.id}": ${text}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) add('id must be kebab-case');
    if (ids.has(a.id)) add('duplicate id');
    ids.add(a.id);
    if (!a.name.trim() || a.name.length > 40) add('name must be 1–40 characters');
    if (!STAT_NAME.test(a.stat)) add(`"${a.stat}" is not a stat name`);
    if (!Number.isInteger(a.at) || a.at < 1) add('at must be a whole number ≥ 1');
    if (a.xp !== undefined && (!Number.isInteger(a.xp) || a.xp < 0)) add('xp must be ≥ 0');
    for (const [resource, amount] of Object.entries(a.reward ?? {})) {
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(resource) || !Number.isInteger(amount) || amount < 0) {
        add('reward keys are namespaced resources (core:coin) and values whole numbers ≥ 0');
      }
    }
  }
  return problems;
}

/** Problems with the hub's own achievements, which may only count `played` and `won`. */
export function coreAchievementProblems(): string[] {
  return [
    ...achievementProblems(CORE),
    ...CORE.filter((a) => !(CORE_STATS as readonly string[]).includes(a.stat)).map(
      (a) => `achievement "${a.id}": the hub's own count only played or won`,
    ),
  ];
}

/** The experience a level starts at: 0, 100, 300, 600, 1000… (each level 100 more than the last). */
export function levelStart(level: number): number {
  return 50 * level * (level - 1);
}

/** The level `xp` experience is at (1 and up), and where it started and the next one starts. */
export function levelOf(xp: number): { level: number; levelXp: number; nextXp: number } {
  let level = 1;
  while (levelStart(level + 1) <= xp) level++;
  return { level, levelXp: levelStart(level), nextXp: levelStart(level + 1) };
}

/** How many players a ranking shows. */
export const RANKING_LIMIT = 20;
/** The board of everyone, by experience; every other board is a game's id, by wins. */
export const CORE_BOARD = 'core';
