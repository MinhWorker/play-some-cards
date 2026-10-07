import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { matches, matchPlayers } from '../db/schema.js';

export interface StoredPlayer {
  /** The account, `null` for a bot. */
  userId: string | null;
  name: string;
  avatar?: string;
  frame?: string;
  bot: boolean;
  won: boolean;
  left: boolean;
}

export interface StoredMatch {
  id: string;
  gameId: string;
  startedAt: number;
  endedAt: number;
  /** In seat order. */
  players: StoredPlayer[];
}

/** Where finished games are kept: Postgres in real use, memory when there is no DATABASE_URL. */
export interface MatchesStore {
  add(match: Omit<StoredMatch, 'id'>): Promise<void>;
  /** The account's `limit` most recent games, newest first. */
  recent(userId: string, limit: number): Promise<StoredMatch[]>;
}

export class PgMatchesStore implements MatchesStore {
  constructor(private readonly db: Db) {}

  async add({ gameId, startedAt, endedAt, players }: Omit<StoredMatch, 'id'>) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(matches)
        .values({ gameId, startedAt: new Date(startedAt), endedAt: new Date(endedAt) })
        .returning({ id: matches.id });
      if (!row) return;
      await tx.insert(matchPlayers).values(
        players.map((p, seat) => ({
          matchId: row.id,
          seat,
          userId: p.userId,
          name: p.name,
          avatar: p.avatar ?? null,
          frame: p.frame ?? null,
          bot: p.bot,
          won: p.won,
          left: p.left,
        })),
      );
    });
  }

  async recent(userId: string, limit: number) {
    const rows = await this.db
      .select({ match: matches })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(eq(matchPlayers.userId, userId))
      .orderBy(desc(matches.endedAt))
      .limit(limit);
    if (!rows.length) return [];
    const seats = await this.db
      .select()
      .from(matchPlayers)
      .where(
        inArray(
          matchPlayers.matchId,
          rows.map((r) => r.match.id),
        ),
      )
      .orderBy(matchPlayers.seat);
    return rows.map(({ match }) => ({
      id: match.id,
      gameId: match.gameId,
      startedAt: match.startedAt.getTime(),
      endedAt: match.endedAt.getTime(),
      players: seats
        .filter((s) => s.matchId === match.id)
        .map((s) => ({
          userId: s.userId,
          name: s.name,
          ...(s.avatar && { avatar: s.avatar }),
          ...(s.frame && { frame: s.frame }),
          bot: s.bot,
          won: s.won,
          left: s.left,
        })),
    }));
  }
}

/** Used by tests and when the server runs without a database (history vanishes on restart). */
export class MemoryMatchesStore implements MatchesStore {
  private readonly matches: StoredMatch[] = [];

  async add(match: Omit<StoredMatch, 'id'>) {
    this.matches.push({ id: crypto.randomUUID(), ...structuredClone(match) });
  }

  async recent(userId: string, limit: number) {
    return this.matches
      .filter((m) => m.players.some((p) => p.userId === userId))
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, limit)
      .map((m) => structuredClone(m));
  }
}
