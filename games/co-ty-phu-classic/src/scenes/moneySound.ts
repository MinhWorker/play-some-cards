import type { MoneyTransfer } from '../game/model.js';

/** The recipient hears income; the rest of the table hears the payer's expense. */
export function moneySound(transfer: MoneyTransfer, viewerSeat: number | undefined) {
  if (transfer.reason.startsWith('Xây ở ')) return 'tycoon-buy';
  return transfer.from === null || transfer.to === viewerSeat ? 'tycoon-coin' : 'tycoon-rent';
}
