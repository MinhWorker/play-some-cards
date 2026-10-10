import { COIN } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MemoryInventoryStore } from '../inventory/inventory.store.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import { ShopService } from './shop.service.js';

async function setup(coins: number) {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const ledger = new LedgerService(new MemoryLedgerStore());
  const inventory = new InventoryService(new MemoryInventoryStore(), accounts);
  const shop = new ShopService(ledger, inventory);
  const { user } = await accounts.guest('Minh');
  if (coins)
    await ledger.apply({
      userId: user.id,
      resource: COIN,
      amount: coins,
      reason: 'test',
      key: 'seed',
    });
  return { accounts, ledger, inventory, shop, user };
}

describe('Chợ and Túi đồ', () => {
  it('sells a frame for coins, and it can be worn', async () => {
    const { ledger, inventory, shop, user } = await setup(500);
    expect((await shop.list(user.id)).find((i) => i.id === 'core:frame-jade')).toMatchObject({
      price: 200,
      owned: false,
    });
    const { item, balances } = await shop.buy(user.id, 'core:frame-jade');
    expect(item.owned).toBe(true);
    expect(balances[COIN]).toBe(300);
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 300 });
    const worn = await inventory.equip(user.id, 'core:frame-jade');
    expect(worn.frame).toBe('jade');
    expect((await inventory.profile(user.id)).owned).toContain('core:frame-jade');
  });

  it('refuses without enough coins and charges nothing', async () => {
    const { ledger, inventory, shop, user } = await setup(100);
    await expect(shop.buy(user.id, 'core:frame-jade')).rejects.toThrow('Không đủ xu');
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 100 });
    expect(await inventory.owns(user.id, 'core:frame-jade')).toBe(false);
  });

  it('charges once for two buys at the same time', async () => {
    const { ledger, inventory, shop, user } = await setup(1000);
    const results = await Promise.allSettled([
      shop.buy(user.id, 'core:card-back-lotus'),
      shop.buy(user.id, 'core:card-back-lotus'),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 700 });
    expect(await inventory.owns(user.id, 'core:card-back-lotus')).toBe(true);
    await expect(shop.buy(user.id, 'core:card-back-lotus')).rejects.toThrow('Bạn đã có món này');
  });

  it("only wears what you own; free items are everyone's", async () => {
    const { inventory, user } = await setup(0);
    await expect(inventory.equip(user.id, 'core:frame-rose')).rejects.toThrow(
      'Bạn chưa có món này',
    );
    expect((await inventory.equip(user.id, 'core:frame-silver')).frame).toBe('silver');
    await expect(inventory.equip(user.id, 'core:nothing')).rejects.toThrow('Không có món này');
    expect(await inventory.ownsLook(user.id, 'frame', 'bronze')).toBe(true);
    expect(await inventory.ownsLook(user.id, 'frame', 'ruby')).toBe(false);
  });
});
