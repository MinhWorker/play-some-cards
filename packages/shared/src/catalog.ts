import type { EventMeta, GameMeta } from '@xomdao/sdk';

export { EVENT_POINTS } from '@xomdao/sdk';

import type { GameCard, Genre } from './protocol.js';

/**
 * Every genre. Adding one is adding a row here and its island art; the hub puts it on the island
 * ring, main genres first. The "Sắp có" island is not a genre: the client adds it to the ring
 * while there are no secondary genres.
 */
export const genres: Genre[] = [
  { id: 'co', name: 'Cờ', order: 1, island: 'co', main: true },
  { id: 'bai', name: 'Bài', order: 2, island: 'bai', main: true },
  { id: 'su-kien', name: 'Sự kiện', order: 3, island: 'su-kien', main: false },
];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESOURCE = /^[a-z0-9-]+:[a-z0-9-]+$/;

/** Problems with the genre list; empty when it is fine. */
export function genreProblems(list: Genre[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const genre of list) {
    if (!KEBAB.test(genre.id)) problems.push(`genre "${genre.id}": id must be kebab-case`);
    if (ids.has(genre.id)) problems.push(`genre "${genre.id}": duplicate id`);
    ids.add(genre.id);
    if (!genre.name.trim()) problems.push(`genre "${genre.id}": needs a name`);
    if (!genre.island.trim()) problems.push(`genre "${genre.id}": needs island art`);
  }
  if (new Set(list.map((g) => g.order)).size !== list.length) {
    problems.push('genres: two genres share an order');
  }
  return problems;
}

const isAmounts = (value: Record<string, number>) =>
  Object.entries(value).every(
    ([key, amount]) => RESOURCE.test(key) && Number.isInteger(amount) && amount >= 0,
  );

/**
 * Problems with a game's hub declaration (`meta.kind`, `genre`, `tagline`, `duration`,
 * `rewardCap`, `event`); empty when it is fine. The registry test runs it on every game.
 */
export function metaProblems(meta: GameMeta, list: Genre[] = genres): string[] {
  const problems: string[] = [];
  const add = (text: string) => problems.push(`${meta.id}: ${text}`);
  const kind = meta.kind ?? 'table';
  if (kind !== 'table' && kind !== 'event') add(`unknown kind "${kind}"`);
  if (meta.genre !== undefined && !list.some((g) => g.id === meta.genre)) {
    add(`unknown genre "${meta.genre}" (see genres in packages/shared/src/catalog.ts)`);
  }
  const tagline = meta.tagline?.trim() ?? '';
  if (!tagline || tagline.length > 80) add('tagline must be one sentence, 1–80 characters');
  const { min, max } = meta.duration ?? { min: 0, max: 0 };
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    add('duration must be whole minutes with 1 ≤ min ≤ max');
  }
  if (meta.rewardCap && !isAmounts(meta.rewardCap)) {
    add('rewardCap keys are namespaced resources (core:coin) and values whole numbers ≥ 0');
  }
  if (kind === 'event') {
    const event = meta.event;
    if (!event) add('an event needs meta.event (opensAt, closesAt, tiers)');
    else {
      const opens = Date.parse(event.opensAt);
      const closes = Date.parse(event.closesAt);
      if (Number.isNaN(opens) || Number.isNaN(closes) || opens >= closes) {
        add('event.opensAt and event.closesAt must be ISO dates, opensAt first');
      }
      if (!event.tiers.length) add('event.tiers needs at least one tier');
      if (event.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(event.color)) {
        add('event.color must be #RRGGBB');
      }
      if (meta.genre !== undefined && meta.genre !== EVENT_GENRE) {
        add(`an event goes in the "${EVENT_GENRE}" genre`);
      }
      event.tiers.forEach((tier, i) => {
        if (i > 0 && tier.points <= (event.tiers[i - 1]?.points ?? 0)) {
          add('event.tiers must go up in points');
        }
        if (!isAmounts(tier.reward)) add(`event.tiers[${i}].reward has a bad resource or amount`);
      });
    }
  } else if (meta.event) add('only kind "event" has meta.event');
  return problems;
}

/** The genre every event belongs to (its island lights up while one is open). */
export const EVENT_GENRE = 'su-kien';

/** Whether an event is open at `now` (ms): from `opensAt` until just before `closesAt`. */
export function eventOpen(event: Pick<EventMeta, 'opensAt' | 'closesAt'>, now: number): boolean {
  return Date.parse(event.opensAt) <= now && now < Date.parse(event.closesAt);
}

/** A game's card without its live counts, or `null` when it has no genre (not in the hub). */
export function gameCard(meta: GameMeta): Omit<GameCard, 'playing' | 'openRooms'> | null {
  if (!meta.genre) return null;
  return {
    id: meta.id,
    name: meta.name,
    kind: meta.kind ?? 'table',
    genre: meta.genre,
    tagline: meta.tagline,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    duration: meta.duration,
    card: meta.card ?? meta.portal.image,
    status: meta.status,
    rewardCap: meta.rewardCap ?? {},
    ...(meta.event ? { event: meta.event } : {}),
  };
}
