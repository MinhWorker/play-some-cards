import { eq } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { inventoryItems } from '../db/schema.js';

/** Where Túi đồ lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface InventoryStore {
  /** The stored item ids of an account (free items are not stored). */
  items(userId: string): Promise<string[]>;
  /** Adds an item; adding one already there changes nothing. Returns whether it was new. */
  grant(userId: string, itemId: string): Promise<boolean>;
}

export class PgInventoryStore implements InventoryStore {
  constructor(private readonly db: Db) {}

  async items(userId: string) {
    const rows = await this.db
      .select({ itemId: inventoryItems.itemId })
      .from(inventoryItems)
      .where(eq(inventoryItems.userId, userId));
    return rows.map((r) => r.itemId);
  }

  async grant(userId: string, itemId: string) {
    const rows = await this.db
      .insert(inventoryItems)
      .values({ userId, itemId })
      .onConflictDoNothing()
      .returning({ itemId: inventoryItems.itemId });
    return rows.length > 0;
  }
}

/** Used by tests and when the server runs without a database (items vanish on restart). */
export class MemoryInventoryStore implements InventoryStore {
  private readonly owned = new Map<string, Set<string>>();

  async items(userId: string) {
    return [...(this.owned.get(userId) ?? [])];
  }

  async grant(userId: string, itemId: string) {
    const mine = this.owned.get(userId) ?? new Set<string>();
    this.owned.set(userId, mine);
    if (mine.has(itemId)) return false;
    mine.add(itemId);
    return true;
  }
}
