// Database tables (Drizzle ORM). After changing this file run `npm run db:generate -w @xomdao/server`
// to write a migration into `apps/server/drizzle/`; the server applies pending migrations on start.
// Rooms and games still live in memory (see rooms.service.ts); accounts, finished games
// (match history), the ledger, Túi đồ, event progress, stats and achievements are stored here. Each module owns its
// own tables (docs/adr/0002-modules.md).
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Lowercase letters and digits, unique. Never changes. */
  username: text('username').notNull().unique(),
  /** scrypt: `salt:hash`, both hex (see accounts.service.ts). */
  passwordHash: text('password_hash').notNull(),
  /** Display name shown in games; not unique, can change any time. */
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  /** The ring drawn around the avatar (`Frame` in @xomdao/shared). */
  frame: text('frame').notNull().default('gold'),
  /** The back of their cards (`CardBack` in @xomdao/shared), equipped from Túi đồ. */
  cardBack: text('card_back').notNull().default('lattice'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One row per logged-in browser. Only a hash of the token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

/** A finished game with at least one account at the table (see matches.service.ts). */
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
});

/** Who sat at a finished game, as they were then. Bots have no `userId`. */
export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    seat: integer('seat').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    avatar: text('avatar'),
    frame: text('frame'),
    bot: boolean('bot').notNull().default(false),
    won: boolean('won').notNull().default(false),
    left: boolean('left').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.seat] }),
    index('match_players_user_id_idx').on(t.userId),
  ],
);

/**
 * Ledger (apps/server/src/ledger): one row per change to a balance. `key` makes a change happen
 * once (a game's reward is keyed by its match id). Only the ledger writes these two tables.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Namespaced: `core:coin`. */
    resource: text('resource').notNull(),
    /** Above 0 adds, below 0 spends. */
    amount: bigint('amount', { mode: 'number' }).notNull(),
    /** Why, for people reading the table: `match:tic-tac-toe`. */
    reason: text('reason').notNull(),
    key: text('key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ledger_entries_user_id_idx').on(t.userId)],
);

/** Each account's balance per resource: the sum of its ledger rows. */
export const balances = pgTable(
  'balances',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resource] })],
);

/**
 * Túi đồ (apps/server/src/inventory): the items each account bought or won (`ITEMS` in
 * @xomdao/shared). Free items are everyone's and never stored. Only the inventory writes it.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

/**
 * Sự kiện (apps/server/src/events): the points each game of an event gave each account, once
 * per game. Progress is their sum. Only the Events module writes it.
 */
export const eventPoints = pgTable(
  'event_points',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    matchId: text('match_id').notNull(),
    points: integer('points').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId, t.matchId] })],
);

/** The event reward tiers (indexes into `meta.event.tiers`) each account claimed. */
export const eventClaims = pgTable(
  'event_claims',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    tier: integer('tier').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId, t.tier] })],
);

/**
 * Thống kê (apps/server/src/stats): each account's count of each stat in each game (`played`,
 * `won`, a game's own `ctx.stat`), and its experience as game `core`, stat `xp`. Only the Stats
 * module writes it.
 */
export const playerStats = pgTable(
  'player_stats',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: text('game_id').notNull(),
    name: text('name').notNull(),
    value: integer('value').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId, t.name] }),
    index('player_stats_board').on(t.gameId, t.name, t.value),
  ],
);

/** The games already counted in `player_stats`, so a game counts once per account. */
export const statMatches = pgTable(
  'stat_matches',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull(),
    countedAt: timestamp('counted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.matchId] })],
);

/** The achievements (`ACHIEVEMENTS` ids) each account reached. */
export const achievements = pgTable(
  'achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);
