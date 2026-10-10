import { and, eq, sum } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { eventClaims, eventPoints } from '../db/schema.js';

/** Where event progress lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface EventsStore {
  /** Adds the points one game gave; a game already counted changes nothing. */
  addPoints(userId: string, eventId: string, matchId: string, points: number): Promise<boolean>;
  points(userId: string, eventId: string): Promise<number>;
  /** The tiers (indexes) claimed, lowest first. */
  claimed(userId: string, eventId: string): Promise<number[]>;
  /** Marks a tier claimed; returns whether it was new. */
  claim(userId: string, eventId: string, tier: number): Promise<boolean>;
}

export class PgEventsStore implements EventsStore {
  constructor(private readonly db: Db) {}

  async addPoints(userId: string, eventId: string, matchId: string, points: number) {
    const rows = await this.db
      .insert(eventPoints)
      .values({ userId, eventId, matchId, points })
      .onConflictDoNothing()
      .returning({ matchId: eventPoints.matchId });
    return rows.length > 0;
  }

  async points(userId: string, eventId: string) {
    const [row] = await this.db
      .select({ total: sum(eventPoints.points) })
      .from(eventPoints)
      .where(and(eq(eventPoints.userId, userId), eq(eventPoints.eventId, eventId)));
    return Number(row?.total ?? 0);
  }

  async claimed(userId: string, eventId: string) {
    const rows = await this.db
      .select({ tier: eventClaims.tier })
      .from(eventClaims)
      .where(and(eq(eventClaims.userId, userId), eq(eventClaims.eventId, eventId)));
    return rows.map((r) => r.tier).sort((a, b) => a - b);
  }

  async claim(userId: string, eventId: string, tier: number) {
    const rows = await this.db
      .insert(eventClaims)
      .values({ userId, eventId, tier })
      .onConflictDoNothing()
      .returning({ tier: eventClaims.tier });
    return rows.length > 0;
  }
}

/** Used by tests and when the server runs without a database (progress vanishes on restart). */
export class MemoryEventsStore implements EventsStore {
  /** Points by `user event match`. */
  private readonly earned = new Map<string, { key: string; points: number }>();
  private readonly claims = new Set<string>();

  async addPoints(userId: string, eventId: string, matchId: string, points: number) {
    const id = `${userId} ${eventId} ${matchId}`;
    if (this.earned.has(id)) return false;
    this.earned.set(id, { key: `${userId} ${eventId}`, points });
    return true;
  }

  async points(userId: string, eventId: string) {
    let total = 0;
    for (const row of this.earned.values()) {
      if (row.key === `${userId} ${eventId}`) total += row.points;
    }
    return total;
  }

  async claimed(userId: string, eventId: string) {
    const prefix = `${userId} ${eventId} `;
    return [...this.claims]
      .filter((c) => c.startsWith(prefix))
      .map((c) => Number(c.slice(prefix.length)))
      .sort((a, b) => a - b);
  }

  async claim(userId: string, eventId: string, tier: number) {
    const id = `${userId} ${eventId} ${tier}`;
    if (this.claims.has(id)) return false;
    this.claims.add(id);
    return true;
  }
}
