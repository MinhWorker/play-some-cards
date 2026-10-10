import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { LedgerService } from './ledger.service.js';
import { MemoryLedgerStore } from './ledger.store.js';

const seat = (id: string, bot = false) => ({ id, name: id, bot, left: false });

/** A finished Caro game (rewardCap 20 coins) won by `lan`, paying `rewards`. */
const caroGame = (matchId: string, rewards: FinishedGame['result']['rewards']): FinishedGame => ({
  gameId: 'tic-tac-toe',
  matchId,
  startedAt: 0,
  endedAt: 1,
  seats: [seat('lan'), seat('minh')],
  result: { winners: ['lan'], rewards },
});

const coins = (player: string, amount: number) => ({ player, resource: 'core:coin', amount });

function setup() {
  const store = new MemoryLedgerStore();
  return { store, ledger: new LedgerService(store) };
}

describe('LedgerService', () => {
  it('pays a game once, however often it is announced', async () => {
    const { store, ledger } = setup();
    const game = caroGame('m1', [coins('lan', 20)]);
    expect(await ledger.rewardMatch(game)).toEqual([
      {
        userId: 'lan',
        gameId: 'tic-tac-toe',
        rewards: [{ resource: 'core:coin', amount: 20 }],
        balances: { 'core:coin': 20 },
      },
    ]);
    expect(await ledger.rewardMatch(game)).toEqual([]);
    expect(store.entries).toHaveLength(1);
    expect(await ledger.balances('lan')).toEqual({ 'core:coin': 20 });
  });

  it('refuses rewards above the game’s rewardCap and pays bots nothing', async () => {
    const { store, ledger } = setup();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const over = caroGame('m1', [coins('lan', 15), coins('lan', 10), coins('minh', 5)]);
    over.seats.push(seat('bot:1', true));
    over.result.rewards?.push(coins('bot:1', 5), {
      player: 'minh',
      resource: 'core:gem',
      amount: 1,
    });
    const notices = await ledger.rewardMatch(over);
    expect(notices.map((n) => [n.userId, n.rewards])).toEqual([
      ['minh', [{ resource: 'core:coin', amount: 5 }]],
    ]);
    expect(store.entries.map((e) => [e.userId, e.resource, e.amount])).toEqual([
      ['minh', 'core:coin', 5],
    ]);
    vi.restoreAllMocks();
  });

  it('leaves event points to the Events module', async () => {
    const { store, ledger } = setup();
    const game: FinishedGame = {
      ...caroGame('m1', [{ player: 'lan', resource: 'event:point', amount: 7 }]),
      gameId: 'trung-thu',
      seats: [seat('lan')],
    };
    expect(await ledger.rewardMatch(game)).toEqual([]);
    expect(store.entries).toEqual([]);
  });

  it('keeps the right balance over many games', async () => {
    const { ledger } = setup();
    for (let i = 0; i < 5; i++) await ledger.rewardMatch(caroGame(`m${i}`, [coins('lan', 20)]));
    await ledger.rewardMatch(caroGame('m9', [coins('minh', 20)]));
    await ledger.rewardMatch(caroGame('m10', undefined));
    expect(await ledger.balances('lan')).toEqual({ 'core:coin': 100 });
    expect(await ledger.balances('minh')).toEqual({ 'core:coin': 20 });
    expect(await ledger.balances('hoa')).toEqual({});
  });

  it('applies other modules’ changes once and never below zero', async () => {
    const { ledger } = setup();
    const entry = { userId: 'lan', resource: 'core:coin', reason: 'test', key: 'k1', amount: 50 };
    expect(await ledger.apply(entry)).toEqual({ status: 'applied', balance: 50 });
    expect(await ledger.apply(entry)).toEqual({ status: 'duplicate' });
    expect(await ledger.apply({ ...entry, key: 'k2', amount: -80 })).toEqual({
      status: 'insufficient',
      balance: 50,
    });
    expect(await ledger.apply({ ...entry, key: 'k3', amount: -30 })).toEqual({
      status: 'applied',
      balance: 20,
    });
    expect(() => ledger.apply({ ...entry, key: 'k4', amount: 1.5 })).toThrow('whole numbers');
  });

  it('pays a Caro win played through the rooms', async () => {
    const { ledger } = setup();
    const rooms = new RoomsService();
    const paid: Promise<unknown>[] = [];
    rooms.onFinished((game) => paid.push(ledger.rewardMatch(game)));
    const { room } = rooms.create('tic-tac-toe', { id: 'lan', name: 'Lan' });
    rooms.join(room.code, { id: 'minh', name: 'Minh' }, 'player');
    for (let game = 0; game < 2; game++) {
      rooms.start(room.code, 'lan');
      const view = rooms.snapshotFor(room, 'lan').view as { players: [string, string] };
      const [first, second] = view.players;
      for (let i = 0; i < 4; i++) {
        rooms.move(room.code, first, { event: 'place', payload: { x: 2 + i, y: 4 } });
        rooms.move(room.code, second, { event: 'place', payload: { x: 2 + i, y: 6 } });
      }
      rooms.move(room.code, first, { event: 'place', payload: { x: 6, y: 4 } });
      expect(room.result?.winners).toEqual([first]);
    }
    await Promise.all(paid);
    const total = (await ledger.balances('lan'))['core:coin'] ?? 0;
    const other = (await ledger.balances('minh'))['core:coin'] ?? 0;
    expect(total + other).toBe(40);
  });
});
