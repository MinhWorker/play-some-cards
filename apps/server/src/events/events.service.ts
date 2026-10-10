import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_POINTS, type EventProgress, eventOpen, getGame } from '@xomdao/shared';
import { LedgerService } from '../ledger/ledger.service.js';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { EventClock } from './event-clock.js';
import type { EventsStore } from './events.store.js';

export const EVENTS_STORE = Symbol('EVENTS_STORE');

export class EventError extends Error {}

/**
 * Sự kiện (docs/adr/0002-modules.md): each player's points in each event (a game with
 * `kind: 'event'`) and the reward tiers they claimed. It owns `event_points` and
 * `event_claims`; tier rewards are paid through the ledger, keyed
 * `event:<event>:<user>:<tier>:<resource>` so each tier pays once.
 *
 * Points come from finished games (`RoomsService.onFinished`, wired by the rooms gateway): an
 * event's game gives them with `ctx.reward(player, EVENT_POINTS, n)`. They count only while the
 * event is open (by `EventClock`), within the game's `meta.rewardCap`, and once per game.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('Events');

  constructor(
    @Inject(EVENTS_STORE) private readonly store: EventsStore,
    private readonly ledger: LedgerService,
    /** The time events go by (moved by `dev:clock`). */
    readonly clock: EventClock,
  ) {}

  /** Whether `gameId` is an event that is closed now (rooms refuse to start it). */
  closed(gameId: string): boolean {
    const event = getGame(gameId)?.event;
    return getGame(gameId)?.kind === 'event' && (!event || !eventOpen(event, this.clock.now()));
  }

  /** Adds a finished event game's points to the progress of the people who played it. */
  async recordMatch({ gameId, matchId, seats, result }: FinishedGame): Promise<void> {
    const game = getGame(gameId);
    if (game?.kind !== 'event' || this.closed(gameId)) return;
    const cap = game.rewardCap?.[EVENT_POINTS] ?? 0;
    const people = new Set(seats.filter((s) => !s.bot).map((s) => s.id));
    const totals = new Map<string, number>();
    for (const { player, resource, amount } of result.rewards ?? []) {
      if (resource !== EVENT_POINTS || !people.has(player)) continue;
      totals.set(player, (totals.get(player) ?? 0) + amount);
    }
    for (const [userId, points] of totals) {
      if (points > cap) {
        this.logger.error(`${gameId} gave ${points} points, above its rewardCap ${cap}`);
        continue;
      }
      await this.store.addPoints(userId, gameId, matchId, points);
    }
  }

  async progress(userId: string, eventId: string): Promise<EventProgress> {
    this.eventOf(eventId);
    return {
      eventId,
      points: await this.store.points(userId, eventId),
      claimed: await this.store.claimed(userId, eventId),
    };
  }

  /** Pays tier `tier` of the event, once, when the player has its points. */
  async claim(userId: string, eventId: string, tier: number) {
    const event = this.eventOf(eventId);
    const step = Number.isInteger(tier) ? event.tiers[tier] : undefined;
    if (!step) throw new EventError('Không có mốc này');
    const before = await this.progress(userId, eventId);
    if (before.claimed.includes(tier)) throw new EventError('Bạn đã nhận mốc này');
    if (before.points < step.points) throw new EventError('Chưa đủ điểm');
    for (const [resource, amount] of Object.entries(step.reward)) {
      if (amount <= 0) continue;
      await this.ledger.apply({
        userId,
        resource,
        amount,
        reason: `event:${eventId}`,
        key: `event:${eventId}:${userId}:${tier}:${resource}`,
      });
    }
    await this.store.claim(userId, eventId, tier);
    return {
      progress: await this.progress(userId, eventId),
      balances: await this.ledger.balances(userId),
    };
  }

  private eventOf(eventId: string) {
    const game = getGame(eventId);
    if (game?.kind !== 'event' || !game.event) throw new EventError('Không có sự kiện này');
    return game.event;
  }
}
