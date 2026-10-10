import { Inject, Injectable, Logger } from '@nestjs/common';
import { getGame, type RewardNotice } from '@xomdao/shared';
import type { FinishedGame } from '../rooms/rooms.service.js';
import type { LedgerEntry, LedgerStore } from './ledger.store.js';

export const LEDGER_STORE = Symbol('LEDGER_STORE');

/**
 * The ledger: the only module that changes balances (docs/adr/0002-modules.md). Every change is
 * a row with a key that makes it happen once. Other modules pay or charge through `apply`; game
 * rewards come from finished games (`RoomsService.onFinished`, wired by the rooms gateway).
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger('Ledger');

  constructor(@Inject(LEDGER_STORE) private readonly store: LedgerStore) {}

  apply(entry: LedgerEntry) {
    if (!Number.isInteger(entry.amount) || entry.amount === 0) {
      throw new Error(`Ledger amounts are whole numbers other than 0, not ${entry.amount}`);
    }
    return this.store.apply(entry);
  }

  balances(userId: string) {
    return this.store.balances(userId);
  }

  /**
   * Pays a finished game's `result.rewards` to the accounts at the table, once per game (keyed
   * by its match id), refusing whatever goes above the game's `meta.rewardCap`. Returns what
   * each account received, with its new balances.
   */
  async rewardMatch({ gameId, matchId, seats, result }: FinishedGame): Promise<RewardNotice[]> {
    const cap = getGame(gameId)?.rewardCap ?? {};
    const people = new Set(seats.filter((s) => !s.bot).map((s) => s.id));
    const totals = new Map<string, Map<string, number>>();
    for (const { player, resource, amount } of result.rewards ?? []) {
      if (!people.has(player)) continue;
      const mine = totals.get(player) ?? new Map<string, number>();
      mine.set(resource, (mine.get(resource) ?? 0) + amount);
      totals.set(player, mine);
    }
    const notices: RewardNotice[] = [];
    for (const [userId, resources] of totals) {
      const rewards: RewardNotice['rewards'] = [];
      for (const [resource, amount] of resources) {
        const limit = cap[resource] ?? 0;
        if (amount > limit) {
          this.logger.error(`${gameId} gave ${amount} ${resource}, above its rewardCap ${limit}`);
          continue;
        }
        const applied = await this.store.apply({
          userId,
          resource,
          amount,
          reason: `match:${gameId}`,
          key: `match:${matchId}:${userId}:${resource}`,
        });
        if (applied.status === 'applied') rewards.push({ resource, amount });
      }
      if (rewards.length) {
        notices.push({ userId, gameId, rewards, balances: await this.store.balances(userId) });
      }
    }
    return notices;
  }
}
