// Database tables (Drizzle ORM). After changing this file run `npm run db:generate -w @psc/server`
// to write a migration into `apps/server/drizzle/`; the server applies pending migrations on start.
// Rooms and games still live in memory (see rooms.service.ts); only accounts are stored here.
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Lowercase letters and digits, unique. Never changes. */
  username: text('username').notNull().unique(),
  /** scrypt: `salt:hash`, both hex (see accounts.service.ts). */
  passwordHash: text('password_hash').notNull(),
  /** Display name shown in games; not unique, can change any time. */
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
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
