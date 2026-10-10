import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { achievements, playerStats, statMatches } from '../db/schema.js';

/** An amount to add to one stat of one game (`core` `xp` is experience). */
export interface StatCount {
  gameId: string;
  name: string;
  amount: number;
}

/** One stored count. */
export interface StatRow {
  gameId: string;
  name: string;
  value: number;
}

/** Where stats live: Postgres in real use, memory when there is no DATABASE_URL. */
export interface StatsStore {
  /** Adds one game's counts for an account; a game already counted changes nothing. */
  addMatch(userId: string, matchId: string, counts: StatCount[]): Promise<boolean>;
  counts(userId: string): Promise<StatRow[]>;
  /** The achievement ids the account reached. */
  unlocked(userId: string): Promise<string[]>;
  /** Marks an achievement reached and adds its experience; returns whether it was new. */
  unlock(userId: string, achievementId: string, xp: number): Promise<boolean>;
  /** The highest counts of a stat of a game, most first (ties by account id); above 0 only. */
  top(gameId: string, name: string, limit: number): Promise<{ userId: string; value: number }[]>;
  /** How many accounts have more of a stat of a game than `value`. */
  above(gameId: string, name: string, value: number): Promise<number>;
}

export class PgStatsStore implements StatsStore {
  constructor(private readonly db: Db) {}

  addMatch(userId: string, matchId: string, counts: StatCount[]) {
    return this.db.transaction(async (tx) => {
      const [counted] = await tx
        .insert(statMatches)
        .values({ userId, matchId })
        .onConflictDoNothing()
        .returning({ matchId: statMatches.matchId });
      if (!counted) return false;
      for (const { gameId, name, amount } of counts) {
        await tx
          .insert(playerStats)
          .values({ userId, gameId, name, value: amount })
          .onConflictDoUpdate({
            target: [playerStats.userId, playerStats.gameId, playerStats.name],
            set: { value: sql`${playerStats.value} + ${amount}` },
          });
      }
      return true;
    });
  }

  counts(userId: string) {
    return this.db
      .select({ gameId: playerStats.gameId, name: playerStats.name, value: playerStats.value })
      .from(playerStats)
      .where(eq(playerStats.userId, userId));
  }

  async unlocked(userId: string) {
    const rows = await this.db
      .select({ id: achievements.achievementId })
      .from(achievements)
      .where(eq(achievements.userId, userId));
    return rows.map((r) => r.id);
  }

  unlock(userId: string, achievementId: string, xp: number) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(achievements)
        .values({ userId, achievementId })
        .onConflictDoNothing()
        .returning({ id: achievements.achievementId });
      if (!row) return false;
      if (xp > 0) {
        await tx
          .insert(playerStats)
          .values({ userId, gameId: 'core', name: 'xp', value: xp })
          .onConflictDoUpdate({
            target: [playerStats.userId, playerStats.gameId, playerStats.name],
            set: { value: sql`${playerStats.value} + ${xp}` },
          });
      }
      return true;
    });
  }

  top(gameId: string, name: string, limit: number) {
    return this.db
      .select({ userId: playerStats.userId, value: playerStats.value })
      .from(playerStats)
      .where(
        and(eq(playerStats.gameId, gameId), eq(playerStats.name, name), gt(playerStats.value, 0)),
      )
      .orderBy(desc(playerStats.value), playerStats.userId)
      .limit(limit);
  }

  async above(gameId: string, name: string, value: number) {
    const [row] = await this.db
      .select({ n: count() })
      .from(playerStats)
      .where(
        and(
          eq(playerStats.gameId, gameId),
          eq(playerStats.name, name),
          gt(playerStats.value, value),
        ),
      );
    return Number(row?.n ?? 0);
  }
}

/** Used by tests and when the server runs without a database (stats vanish on restart). */
export class MemoryStatsStore implements StatsStore {
  /** Values by `user game name`. */
  private readonly values = new Map<string, { userId: string } & StatRow>();
  private readonly matches = new Set<string>();
  private readonly reached = new Set<string>();

  async addMatch(userId: string, matchId: string, counts: StatCount[]) {
    if (this.matches.has(`${userId} ${matchId}`)) return false;
    this.matches.add(`${userId} ${matchId}`);
    for (const count of counts) this.add(userId, count);
    return true;
  }

  async counts(userId: string) {
    return [...this.values.values()]
      .filter((row) => row.userId === userId)
      .map(({ gameId, name, value }) => ({ gameId, name, value }));
  }

  async unlocked(userId: string) {
    const prefix = `${userId} `;
    return [...this.reached].filter((r) => r.startsWith(prefix)).map((r) => r.slice(prefix.length));
  }

  async unlock(userId: string, achievementId: string, xp: number) {
    const key = `${userId} ${achievementId}`;
    if (this.reached.has(key)) return false;
    this.reached.add(key);
    if (xp > 0) this.add(userId, { gameId: 'core', name: 'xp', amount: xp });
    return true;
  }

  async top(gameId: string, name: string, limit: number) {
    return this.board(gameId, name)
      .sort((a, b) => b.value - a.value || (a.userId < b.userId ? -1 : 1))
      .slice(0, limit)
      .map(({ userId, value }) => ({ userId, value }));
  }

  async above(gameId: string, name: string, value: number) {
    return this.board(gameId, name).filter((row) => row.value > value).length;
  }

  private board(gameId: string, name: string) {
    return [...this.values.values()].filter(
      (row) => row.gameId === gameId && row.name === name && row.value > 0,
    );
  }

  private add(userId: string, { gameId, name, amount }: StatCount) {
    const key = `${userId} ${gameId} ${name}`;
    const row = this.values.get(key) ?? { userId, gameId, name, value: 0 };
    this.values.set(key, { ...row, value: row.value + amount });
  }
}
