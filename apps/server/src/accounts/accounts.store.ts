import { AVATARS, type Avatar, type User } from '@psc/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

export interface NewUser {
  username: string;
  passwordHash: string;
  name: string;
  avatar: Avatar;
}

/** Where accounts are kept: Postgres in real use, memory when there is no DATABASE_URL. */
export interface AccountsStore {
  /** `null` when the username is taken. */
  createUser(user: NewUser): Promise<User | null>;
  findLogin(username: string): Promise<{ user: User; passwordHash: string } | null>;
  createSession(tokenHash: string, userId: string): Promise<void>;
  userBySession(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
  updateProfile(userId: string, profile: { name: string; avatar: Avatar }): Promise<User | null>;
}

type UserRow = typeof users.$inferSelect;

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  name: row.name,
  avatar: (AVATARS as readonly string[]).includes(row.avatar) ? (row.avatar as Avatar) : 'boy',
});

export class PgAccountsStore implements AccountsStore {
  constructor(private readonly db: Db) {}

  async createUser(user: NewUser) {
    const [row] = await this.db
      .insert(users)
      .values(user)
      .onConflictDoNothing({ target: users.username })
      .returning();
    return row ? toUser(row) : null;
  }

  async findLogin(username: string) {
    const [row] = await this.db.select().from(users).where(eq(users.username, username));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async createSession(tokenHash: string, userId: string) {
    await this.db.insert(sessions).values({ tokenHash, userId });
  }

  async userBySession(tokenHash: string) {
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, tokenHash));
    return row ? toUser(row.user) : null;
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async updateProfile(userId: string, profile: { name: string; avatar: Avatar }) {
    const [row] = await this.db.update(users).set(profile).where(eq(users.id, userId)).returning();
    return row ? toUser(row) : null;
  }
}

/** Used by tests and when the server runs without a database (accounts vanish on restart). */
export class MemoryAccountsStore implements AccountsStore {
  private readonly users = new Map<string, { user: User; passwordHash: string }>();
  private readonly sessions = new Map<string, string>();

  async createUser({ passwordHash, ...rest }: NewUser) {
    if ([...this.users.values()].some((u) => u.user.username === rest.username)) return null;
    const user: User = { id: crypto.randomUUID(), ...rest };
    this.users.set(user.id, { user, passwordHash });
    return { ...user };
  }

  async findLogin(username: string) {
    const found = [...this.users.values()].find((u) => u.user.username === username);
    return found ? { user: { ...found.user }, passwordHash: found.passwordHash } : null;
  }

  async createSession(tokenHash: string, userId: string) {
    this.sessions.set(tokenHash, userId);
  }

  async userBySession(tokenHash: string) {
    const userId = this.sessions.get(tokenHash);
    const found = userId ? this.users.get(userId) : undefined;
    return found ? { ...found.user } : null;
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async updateProfile(userId: string, profile: { name: string; avatar: Avatar }) {
    const found = this.users.get(userId);
    if (!found) return null;
    Object.assign(found.user, profile);
    return { ...found.user };
  }
}
