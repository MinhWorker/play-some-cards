import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { balances, ledgerEntries } from '../db/schema.js';

/** One change to a balance. */
export interface LedgerEntry {
  userId: string;
  /** Namespaced: `core:coin`. */
  resource: string;
  /** Above 0 adds, below 0 spends. */
  amount: number;
  /** Why, for people reading the ledger: `match:tic-tac-toe`. */
  reason: string;
  /** The same key is applied once; later tries change nothing. */
  key: string;
}

/** What applying an entry did. */
export type Applied =
  | { status: 'applied'; balance: number }
  | { status: 'duplicate' }
  | { status: 'insufficient'; balance: number };

/** Where the ledger lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface LedgerStore {
  /** Writes the entry and moves the balance, unless its key was used or it would go below 0. */
  apply(entry: LedgerEntry): Promise<Applied>;
  /** The account's balance per resource (resources never touched are missing). */
  balances(userId: string): Promise<Record<string, number>>;
}

class Insufficient extends Error {}

export class PgLedgerStore implements LedgerStore {
  constructor(private readonly db: Db) {}

  async apply(entry: LedgerEntry): Promise<Applied> {
    try {
      return await this.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(ledgerEntries)
          .values(entry)
          .onConflictDoNothing({ target: ledgerEntries.key })
          .returning({ id: ledgerEntries.id });
        if (!inserted) return { status: 'duplicate' } as const;
        const [row] = await tx
          .insert(balances)
          .values({ userId: entry.userId, resource: entry.resource, amount: entry.amount })
          .onConflictDoUpdate({
            target: [balances.userId, balances.resource],
            set: { amount: sql`${balances.amount} + ${entry.amount}` },
          })
          .returning({ amount: balances.amount });
        const balance = row?.amount ?? 0;
        // Throwing rolls back the entry and the balance change.
        if (balance < 0) throw new Insufficient();
        return { status: 'applied', balance } as const;
      });
    } catch (err) {
      if (!(err instanceof Insufficient)) throw err;
      const current = await this.balances(entry.userId);
      return { status: 'insufficient', balance: current[entry.resource] ?? 0 };
    }
  }

  async balances(userId: string) {
    const rows = await this.db
      .select({ resource: balances.resource, amount: balances.amount })
      .from(balances)
      .where(eq(balances.userId, userId));
    return Object.fromEntries(rows.map((r) => [r.resource, r.amount]));
  }
}

/** Used by tests and when the server runs without a database (balances vanish on restart). */
export class MemoryLedgerStore implements LedgerStore {
  readonly entries: LedgerEntry[] = [];
  private readonly keys = new Set<string>();
  private readonly totals = new Map<string, Record<string, number>>();

  async apply(entry: LedgerEntry): Promise<Applied> {
    if (this.keys.has(entry.key)) return { status: 'duplicate' };
    const totals = this.totals.get(entry.userId) ?? {};
    const balance = (totals[entry.resource] ?? 0) + entry.amount;
    if (balance < 0) return { status: 'insufficient', balance: totals[entry.resource] ?? 0 };
    this.keys.add(entry.key);
    this.entries.push({ ...entry });
    this.totals.set(entry.userId, { ...totals, [entry.resource]: balance });
    return { status: 'applied', balance };
  }

  async balances(userId: string) {
    return { ...this.totals.get(userId) };
  }
}
