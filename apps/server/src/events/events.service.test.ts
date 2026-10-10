import { COIN, EVENT_POINTS } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { EventClock } from './event-clock.js';
import { EventsService } from './events.service.js';
import { MemoryEventsStore } from './events.store.js';

const OPEN = '2026-09-25T20:00:00+07:00';

function setup(at = OPEN) {
  const ledger = new LedgerService(new MemoryLedgerStore());
  const clock = new EventClock();
  clock.set(at);
  const events = new EventsService(new MemoryEventsStore(), ledger, clock);
  return { ledger, clock, events };
}

/** A finished game of Câu cá Trung Thu where `lan` got `points`. */
const fishing = (matchId: string, points: number, gameId = 'trung-thu'): FinishedGame => ({
  gameId,
  matchId,
  startedAt: 0,
  endedAt: 0,
  seats: [{ id: 'lan', name: 'Lan', bot: false, left: false }],
  result: {
    winners: ['lan'],
    rewards: [{ player: 'lan', resource: EVENT_POINTS, amount: points }],
  },
});

describe('Sự kiện', () => {
  it('adds the points of each game once, while the event is open', async () => {
    const { clock, events } = setup();
    await events.recordMatch(fishing('m1', 8));
    await events.recordMatch(fishing('m1', 8));
    await events.recordMatch(fishing('m2', 4));
    expect(await events.progress('lan', 'trung-thu')).toEqual({
      eventId: 'trung-thu',
      points: 12,
      claimed: [],
    });
    clock.set('2026-10-04T00:00:00+07:00');
    expect(events.closed('trung-thu')).toBe(true);
    await events.recordMatch(fishing('m3', 9));
    expect((await events.progress('lan', 'trung-thu')).points).toBe(12);
  });

  it('refuses points above the rewardCap, and games that are not events', async () => {
    const { events } = setup();
    await events.recordMatch(fishing('m1', 26));
    await events.recordMatch(fishing('m2', 5, 'tic-tac-toe'));
    expect((await events.progress('lan', 'trung-thu')).points).toBe(0);
    expect(events.closed('tic-tac-toe')).toBe(false);
    await expect(events.progress('lan', 'tic-tac-toe')).rejects.toThrow('Không có sự kiện này');
  });

  it('pays each tier once, when its points are reached', async () => {
    const { ledger, events } = setup();
    await events.recordMatch(fishing('m1', 12));
    await expect(events.claim('lan', 'trung-thu', 1)).rejects.toThrow('Chưa đủ điểm');
    await expect(events.claim('lan', 'trung-thu', 5)).rejects.toThrow('Không có mốc này');
    const { progress, balances } = await events.claim('lan', 'trung-thu', 0);
    expect(progress).toMatchObject({ points: 12, claimed: [0] });
    expect(balances).toEqual({ [COIN]: 50 });
    await expect(events.claim('lan', 'trung-thu', 0)).rejects.toThrow('Bạn đã nhận mốc này');
    expect(await ledger.balances('lan')).toEqual({ [COIN]: 50 });
  });

  it('pays once even when two claims race', async () => {
    const { ledger, events } = setup();
    await events.recordMatch(fishing('m1', 12));
    await Promise.allSettled([
      events.claim('lan', 'trung-thu', 0),
      events.claim('lan', 'trung-thu', 0),
    ]);
    expect(await ledger.balances('lan')).toEqual({ [COIN]: 50 });
  });
});
