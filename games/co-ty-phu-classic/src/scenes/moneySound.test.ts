import { describe, expect, it } from 'vitest';
import type { MoneyTransfer } from '../game/model.js';
import { moneySound } from './moneySound.js';

describe('money sounds around the table', () => {
  it('plays expense to the payer, other players and spectators, but income to the recipient', () => {
    const transfer: MoneyTransfer = { from: 1, to: 0, amount: 50, reason: 'Tiền thuê đất' };
    expect([0, 1, 2, undefined].map((seat) => moneySound(transfer, seat))).toEqual([
      'tycoon-coin',
      'tycoon-rent',
      'tycoon-rent',
      'tycoon-rent',
    ]);
  });

  it.each(['Mua đất', 'Chuộc đất', 'Đấu giá đất', 'Thuế', 'Trao đổi'])(
    'plays bank expenses to everyone for %s',
    (reason) => {
      const transfer: MoneyTransfer = { from: 1, to: null, amount: 50, reason };
      for (const seat of [0, 1, 2, undefined])
        expect(moneySound(transfer, seat)).toBe('tycoon-rent');
    },
  );

  it('plays the purchase sound to everyone when building a house or hotel', () => {
    const transfer: MoneyTransfer = { from: 1, to: null, amount: 50, reason: 'Xây ở Phố Cổ' };
    for (const seat of [0, 1, 2, undefined]) expect(moneySound(transfer, seat)).toBe('tycoon-buy');
  });

  it('plays bank income to everyone', () => {
    const transfer: MoneyTransfer = { from: null, to: 1, amount: 200, reason: 'Qua Xuất phát' };
    for (const seat of [0, 1, 2, undefined]) expect(moneySound(transfer, seat)).toBe('tycoon-coin');
  });
});
