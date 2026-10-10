import { Injectable } from '@nestjs/common';
import { COIN, getItem, ITEM_SLOTS, ITEMS, type ShopItem } from '@xomdao/shared';
import { InventoryService } from '../inventory/inventory.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

export class ShopError extends Error {}

/**
 * Chợ (docs/adr/0002-modules.md): sells the items of `ITEMS` for coins. It keeps no table of its
 * own: it charges through the ledger and hands the item to Túi đồ. Each item is bought once per
 * account, so the charge is keyed `shop:<user>:<item>`: a second tap, a retry or two devices at
 * once pay once.
 */
@Injectable()
export class ShopService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly inventory: InventoryService,
  ) {}

  /** Every item, by slot and then cheapest first, with whether this account has it. */
  async list(userId: string): Promise<ShopItem[]> {
    const owned = new Set(await this.inventory.owned(userId));
    return [...ITEMS]
      .sort((a, b) => ITEM_SLOTS.indexOf(a.slot) - ITEM_SLOTS.indexOf(b.slot) || a.price - b.price)
      .map((item) => ({ ...item, owned: owned.has(item.id) }));
  }

  async buy(userId: string, itemId: string) {
    const item = getItem(itemId);
    if (!item) throw new ShopError('Không có món này');
    if (await this.inventory.owns(userId, itemId)) throw new ShopError('Bạn đã có món này');
    const paid = await this.ledger.apply({
      userId,
      resource: COIN,
      amount: -item.price,
      reason: `shop:${item.id}`,
      key: `shop:${userId}:${item.id}`,
    });
    if (paid.status === 'insufficient') throw new ShopError('Không đủ xu');
    // `duplicate`: another request already paid for it; make sure it is in the bag.
    await this.inventory.grant(userId, item.id);
    return {
      item: { ...item, owned: true },
      balances: await this.ledger.balances(userId),
    };
  }
}
