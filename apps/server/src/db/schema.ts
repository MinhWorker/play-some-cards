// Database tables (Drizzle ORM). After changing this file run `npm run db:generate -w @xomdao/server`
// to write a migration into `apps/server/drizzle/`; the server applies pending migrations on start.
// Rooms and games still live in memory (see rooms.service.ts); accounts, finished games
// (match history) and the ledger are stored here. Each module owns its own tables
// (docs/adr/0002-modules.md).
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
