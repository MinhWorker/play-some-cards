import { Inject, Injectable } from '@nestjs/common';
import { HISTORY_LIMIT, type MatchRecord } from '@xomdao/shared';
import type { FinishedGame } from '../rooms/rooms.service.js';
import type { MatchesStore } from './matches.store.js';

export const MATCHES_STORE = Symbol('MATCHES_STORE');

/**
 * Match history: keeps every finished game that had an account at the table, and gives a
 * player their most recent ones. The rooms gateway feeds it from `RoomsService.onFinished`.
 */
@Injectable()
export class MatchesService {
  constructor(@Inject(MATCHES_STORE) private readonly store: MatchesStore) {}

  async record({ gameId, startedAt, endedAt, seats, result }: FinishedGame) {
    if (seats.every((s) => s.bot)) return;
    await this.store.add({
      gameId,
      startedAt,
      endedAt,
      players: seats.map((s) => ({
        userId: s.bot ? null : s.id,
        name: s.name,
        ...(s.avatar && { avatar: s.avatar }),
        ...(s.frame && { frame: s.frame }),
        bot: s.bot,
        won: result.winners.includes(s.id),
        left: s.left,
      })),
    });
  }

  /** The player's most recent games, newest first, as they see them. */
  async recent(userId: string): Promise<MatchRecord[]> {
    const matches = await this.store.recent(userId, HISTORY_LIMIT);
    return matches.map(({ id, gameId, startedAt, endedAt, players }) => {
      const me = players.find((p) => p.userId === userId);
      const draw = players.every((p) => !p.won);
      return {
        id,
        gameId,
        outcome: me?.won ? 'win' : draw ? 'draw' : 'loss',
        startedAt,
        endedAt,
        players: players.map(({ userId: id, ...p }) => ({ ...p, me: id === userId })),
      };
    });
  }
}
