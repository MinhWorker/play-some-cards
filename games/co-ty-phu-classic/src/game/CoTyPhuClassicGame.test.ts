import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { AUCTION_TURN_MS, BOARD, SPECIAL_EVENT_TIMEOUT } from './model.js';
import { bankHotels, bankHouses, move, rent } from './rules.js';
import { decisionSeat } from './turnClock.js';

/** The first dice after both decks are shuffled with seed 1. */
const firstRoll = () => {
  const rng = seededRng(1);
  for (let i = 0; i < 24; i++) rng();
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)] as const;
};

const at = (target: number) => {
  const game = testGame(plugin, ['a', 'b'], { seed: 1 });
  const [a, b] = firstRoll();
  game.state.players[0]!.position = (target - a - b + 40) % 40;
  return game;
};

describe('Cờ tỷ phú Classic', () => {
  it('starts with 40 squares, 1000 each and hidden card order', () => {
    const game = testGame(plugin, ['a', 'b']);
    expect(BOARD).toHaveLength(40);
    expect(game.state.properties).toHaveLength(40);
    expect(game.state.players.map((p) => p.cash)).toEqual([1000, 1000]);
    expect(game.error('b', 'roll')).toBe('Chưa tới lượt bạn');
    expect(game.view('a')).not.toHaveProperty('chance');
    expect(game.view(null)).not.toHaveProperty('chest');
  });

  it('reveals tax before charging, rejects other seats and applies it once', () => {
    const game = at(38);
    game.send('a', 'roll');
    expect(game.state.phase).toBe('event');
    expect(game.state.players[0]!.cash).toBe(1000);
    expect(game.state.transfers).toEqual([]);
    expect(game.timer?.event).toBe('prepare-event');
    expect(game.error('b', 'event-ready', { id: game.state.specialEvent!.id })).toBe(
      'Chưa tới lượt bạn',
    );
    game.send('a', 'event-ready', { id: game.state.specialEvent!.id });
    expect(game.timer).toMatchObject({ event: 'auto-confirm-event', ms: SPECIAL_EVENT_TIMEOUT });
    expect(game.error('b', 'confirm-event')).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'end-turn')).toBe('Thao tác chưa hợp lệ');
    game.state.properties[1]!.owner = 0;
    expect(game.error('a', 'mortgage', { square: 1 })).toBe('Hãy xác nhận sự kiện trước');
    expect(
      game.error('a', 'offer-trade', { to: 1, give: -1, take: -1, giveCash: 50, takeCash: 0 }),
    ).toBe('Hãy xác nhận sự kiện trước');
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.state.specialEvent).toBeNull();
    expect(game.timer).toEqual({ event: 'turn-timeout', ms: 30000 });
    expect(game.error('a', 'confirm-event')).toBe('Thao tác chưa hợp lệ');
  });

  it('starts the countdown when the event is displayed and does not restart it', () => {
    const game = at(38);
    game.send('a', 'roll');
    const id = game.state.specialEvent!.id;
    expect(game.state.specialEvent?.ready).toBe(false);
    expect(game.error('a', 'event-ready', { id: id + 1 })).toBe('Sự kiện đã thay đổi');
    game.send('a', 'event-ready', { id });
    expect(game.state.specialEvent?.ready).toBe(true);
    const timer = game.timer;
    game.send('a', 'event-ready', { id });
    expect(game.timer).toEqual(timer);
    expect(game.state.players[0]!.cash).toBe(1000);
    game.fireTimer();
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.error('a', 'event-ready', { id })).toBe('Sự kiện đã thay đổi');
  });

  it('confirms repair charges and three consecutive doubles before applying them', () => {
    const game = at(22);
    game.state.chance = [8];
    game.state.properties[1] = { owner: 0, houses: 2, mortgaged: false };
    game.send('a', 'roll');
    expect(game.state.players[0]!.cash).toBe(1000);
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.cash).toBe(950);
    const doubleSeed = Array.from({ length: 100 }, (_, i) => i + 1).find((seed) => {
      const rng = seededRng(seed);
      for (let i = 0; i < 24; i++) rng();
      const first = Math.floor(rng() * 6);
      const second = Math.floor(rng() * 6);
      return first === second;
    });
    const jailed = testGame(plugin, ['a', 'b'], { seed: doubleSeed });
    jailed.state.doubles = 2;
    jailed.send('a', 'roll');
    expect(jailed.state.phase).toBe('event');
    expect(jailed.state.players[0]!.jailed).toBe(false);
    jailed.send('a', 'confirm-event');
    expect(jailed.state.players[0]!.jailed).toBe(true);
    expect(jailed.state.phase).toBe('end');
  });

  it('enters debt only after confirming an unaffordable special event', () => {
    const game = at(38);
    game.state.players[0]!.cash = 1;
    game.send('a', 'roll');
    expect(game.state.phase).toBe('event');
    expect(game.state.debt).toBeNull();
    game.send('a', 'confirm-event');
    expect(game.state.phase).toBe('debt');
    expect(game.state.players[0]!.cash).toBe(1);
    expect(game.state.debt?.amount).toBe(200);
  });

  it.each([
    [5, 50],
    [7, -15],
  ])('waits before applying chance card %s', (card, amount) => {
    const game = at(22);
    game.state.chance = [card];
    game.send('a', 'roll');
    expect(game.state.phase).toBe('event');
    expect(game.state.players[0]!.cash).toBe(1000);
    expect(game.state.chance).toEqual([card]);
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.cash).toBe(1000 + amount);
    expect(game.state.transfers[0]?.amount).toBe(Math.abs(amount));
  });

  it('waits before card movement, then collects Start and continues the landing', () => {
    const game = at(22);
    game.state.chance = [4];
    game.send('a', 'roll');
    expect(game.state.players[0]!.position).toBe(22);
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.position).toBe(18);
    expect(game.state.players[0]!.cash).toBe(1200);
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(18);
    expect(game.state.specialEvent).toBeNull();
  });

  it('waits before granting a free jail card or moving to jail', () => {
    const game = at(22);
    game.state.chance = [10];
    game.send('a', 'roll');
    expect(game.state.players[0]!.freeCards).toEqual([]);
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.freeCards).toEqual(['chance']);
    expect(game.state.chance).toEqual([]);
    const jailed = at(30);
    jailed.send('a', 'roll');
    expect(jailed.state.players[0]!.position).toBe(30);
    expect(jailed.state.players[0]!.jailed).toBe(false);
    jailed.send('a', 'confirm-event');
    expect(jailed.state.players[0]!.position).toBe(10);
    expect(jailed.state.players[0]!.jailed).toBe(true);
  });

  it('auto-confirms multiplayer events, but has no countdown for a single seat', () => {
    const game = at(38);
    game.send('a', 'roll');
    game.fireTimer();
    expect(game.state.phase).toBe('event');
    game.fireTimer();
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.state.specialEvent).toBeNull();
    expect(game.timer).toEqual({ event: 'turn-timeout', ms: 30000 });
    const solo = testGame(plugin, ['a'], { seed: 1 });
    const [a, b] = firstRoll();
    solo.state.players[0]!.position = 38 - a - b;
    solo.send('a', 'roll');
    expect(solo.state.phase).toBe('event');
    expect(solo.timer).toBeNull();
  });

  it('keeps the countdown when another seat leaves and cancels it when the owner leaves', () => {
    const game = testGame(plugin, ['a', 'b', 'c'], { seed: 1 });
    const [a, b] = firstRoll();
    game.state.players[0]!.position = 38 - a - b;
    game.send('a', 'roll');
    game.leave('c');
    expect(game.state.phase).toBe('event');
    expect(game.timer).not.toBeNull();
    game.fireTimer();
    expect(game.state.phase).toBe('event');
    game.fireTimer();
    expect(game.state.players[0]!.cash).toBe(800);
    const leaving = at(22);
    leaving.state.chance = [10];
    leaving.send('a', 'roll');
    leaving.leave('a');
    expect(leaving.state.chance).toEqual([10]);
    expect(leaving.state.specialEvent).toBeNull();
    expect(leaving.timer).toBeNull();
  });

  it('buys an unowned street after a roll', () => {
    const game = at(3);
    game.send('a', 'roll');
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(3);
    const cash = game.state.players[0]!.cash;
    game.send('a', 'buy');
    expect(game.state.properties[3]?.owner).toBe(0);
    expect(game.state.players[0]!.cash).toBe(cash - BOARD[3]!.price!);
    expect(game.view(null)).toMatchObject({
      transfers: [{ from: 0, to: null, amount: BOARD[3]!.price!, reason: `Mua ${BOARD[3]!.name}` }],
    });
    expect(game.error('b', 'end-turn')).toBe('Chưa tới lượt bạn');
  });

  it('records Start salary and rent separately in their actual order', () => {
    const game = at(1);
    game.state.properties[1]!.owner = 1;
    game.send('a', 'roll');
    expect(game.view(null)).toMatchObject({
      transfers: [
        { from: null, to: 0, amount: 200, reason: 'Qua Xuất phát' },
        { from: 0, to: 1, amount: 20, reason: 'Tiền thuê Phú Quốc' },
      ],
    });
    expect(game.state.players.map((p) => p.cash)).toEqual([1180, 1020]);
    const sequence = game.state.moneySequence;
    game.send('a', 'end-turn');
    expect(game.state.transfers).toEqual([]);
    expect(game.state.moneySequence).toBeGreaterThan(sequence);
  });

  it('does not animate an unpaid debt as money already transferred', () => {
    const game = at(37);
    game.state.properties[37]!.owner = 1;
    game.state.players[0]!.cash = 1;
    game.send('a', 'roll');
    expect(game.state.phase).toBe('debt');
    expect(game.state.transfers).toEqual([]);
  });

  it('auctions an owned street and pays the seller', () => {
    const game = testGame(plugin, ['a', 'b', 'c']);
    game.state.properties[3]!.owner = 0;
    game.send('a', 'auction', { square: 3 });
    expect(game.error('a', 'bid', { amount: 50 })).toBeTruthy();
    game.send('b', 'bid', { amount: 50 });
    expect(game.error('c', 'bid', { amount: 60 })).toBeTruthy();
    game.send('c', 'bid', { amount: 86 });
    game.send('b', 'pass');
    expect(game.state.properties[3]?.owner).toBe(2);
    expect(game.state.players.map((p) => p.cash)).toEqual([1086, 1000, 914]);
    expect(game.state.auction).toBeNull();
    expect(game.state.phase).toBe('roll');
  });

  it('gives each bidder a countdown and passes when it runs out', () => {
    const game = testGame(plugin, ['a', 'b', 'c'], { bots: ['c'] });
    game.state.properties[3]!.owner = 0;
    game.send('a', 'auction', { square: 3 });
    expect(game.state.auction?.bidder).toBe(1);
    expect(game.timer).toMatchObject({ event: 'turn-timeout', ms: AUCTION_TURN_MS });
    game.fireTimer();
    expect(game.state.auction?.passed).toEqual([0, 1]);
    expect(game.state.auction?.bidder).toBe(2);
    expect(game.timer).toBeNull();
  });

  it('charges rent and pauses for liquidation if cash is short', () => {
    const game = at(37);
    game.state.properties[37]!.owner = 1;
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 0;
    game.state.players[0]!.cash = 1;
    game.send('a', 'roll');
    expect(game.state.phase).toBe('debt');
    expect(game.state.debt?.creditor).toBe(1);
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'mortgage', { square: 3 });
    game.send('a', 'pay-debt');
    expect(game.state.debt).toBeNull();
    expect(game.state.players[1]!.cash).toBe(1000 + BOARD[37]!.rent![0]!);
    expect(game.state.properties[1]?.mortgaged).toBe(true);
  });

  it('builds one level on a return visit without requiring a color set', () => {
    const game = at(1);
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    expect(game.error('a', 'build', { square: 1 })).toBe(
      'Chỉ xây một lần khi quay lại ô đất của mình',
    );
    game.send('a', 'roll');
    expect(game.state.buildable).toBe(1);
    game.send('a', 'build', { square: 1 });
    expect(game.state.properties[1]!.houses).toBe(1);
    expect(game.error('a', 'build', { square: 1 })).toBe(
      'Chỉ xây một lần khi quay lại ô đất của mình',
    );
    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.properties[1]!.houses).toBe(1);
    expect(rent(game.state, 1, 7)).toBe(0);
    game.send('a', 'redeem', { square: 1 });
    expect(rent(game.state, 1, 7)).toBe(80);
    game.send('a', 'sell-house', { square: 1 });
    expect(rent(game.state, 1, 7)).toBe(20);
    expect(game.error('a', 'build', { square: 1 })).toBe(
      'Chỉ xây một lần khi quay lại ô đất của mình',
    );
  });

  it('does not grant building on purchase and expires a return visit at the next roll or turn', () => {
    const game = at(3);
    game.send('a', 'roll').send('a', 'buy');
    expect(game.state.buildable).toBeNull();
    expect(game.error('a', 'build', { square: 3 })).toBe(
      'Chỉ xây một lần khi quay lại ô đất của mình',
    );
    move(game.state, 0, 3, false, 7);
    expect(game.state.buildable).toBe(3);
    game.send('a', 'end-turn');
    expect(game.state.buildable).toBeNull();
    expect(game.error('a', 'build', { square: 3 })).toBe('Chưa tới lượt bạn');
    game.state.turn = 0;
    game.state.phase = 'roll';
    move(game.state, 0, 3, false, 7);
    game.state.phase = 'roll';
    game.send('a', 'roll');
    expect(game.state.buildable).toBeNull();
  });

  it('upgrades independently to a hotel across five visits and honors bank supply', () => {
    const game = at(1);
    game.state.properties[1]!.owner = 0;
    game.send('a', 'roll');
    for (let level = 1; level <= 5; level++) {
      if (level > 1) move(game.state, 0, 1, false, 7);
      game.send('a', 'build', { square: 1 });
      expect(game.state.properties[1]!.houses).toBe(level);
    }
    expect(bankHouses(game.state)).toBe(32);
    expect(bankHotels(game.state)).toBe(11);
    game.send('a', 'sell-house', { square: 1 });
    expect(game.state.properties[1]!.houses).toBe(4);
    expect(bankHouses(game.state)).toBe(28);
    expect(bankHotels(game.state)).toBe(12);
    move(game.state, 0, 1, false, 7);
    game.state.properties
      .filter((_, i) => BOARD[i]!.kind === 'street' && i !== 1)
      .slice(0, 12)
      .forEach((p) => {
        p.houses = 5;
      });
    expect(game.error('a', 'build', { square: 1 })).toBe('Ngân hàng đã hết nhà hoặc khách sạn');
  });

  it.each([1, 5])(
    'waives rent on square %s while the owner is jailed, then resumes after release',
    (square) => {
      const game = at(square);
      game.state.properties[square]!.owner = 1;
      game.state.players[1]!.jailed = true;
      game.state.players[0]!.cash = 1;
      game.send('a', 'roll');
      expect(game.state.debt).toBeNull();
      expect(game.state.transfers.filter((t) => t.to === 1)).toEqual([]);
      expect(rent(game.state, square, 7, 2)).toBe(0);
      game.state.players[1]!.jailed = false;
      expect(rent(game.state, square, 7)).toBeGreaterThan(0);
    },
  );

  it('lets a bot build on a return visit before using its double roll', () => {
    const game = testGame(plugin, ['a', 'b'], { bots: ['a'] });
    game.state.properties[1]!.owner = 0;
    game.state.after = 'roll';
    move(game.state, 0, 1, false, 7);
    expect(game.bot('a')).toMatchObject({ event: 'build', payload: { square: 1 } });
    game.send('a', 'build', { square: 1 });
    expect(game.bot('a')?.event).toBe('roll');
  });

  it('preserves the return visit when another player leaves', () => {
    const game = testGame(plugin, ['a', 'b', 'c']);
    game.state.properties[1]!.owner = 0;
    move(game.state, 0, 1, false, 7);
    game.leave('c');
    expect(game.state.buildable).toBe(1);
    game.send('a', 'build', { square: 1 });
    expect(game.state.properties[1]!.houses).toBe(1);
  });

  it('manages an empty street independently of buildings on another street in the same color', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[1] = { owner: 1, houses: 2, mortgaged: false };
    game.state.properties[3]!.owner = 0;
    game.send('a', 'mortgage', { square: 3 });
    game.send('a', 'redeem', { square: 3 });
    game.send('a', 'offer-trade', { to: 1, give: 3, take: -1, giveCash: 0, takeCash: 0 });
    game.send('b', 'accept-trade');
    expect(game.state.properties[3]!.owner).toBe(1);
    expect(game.state.properties[1]!.houses).toBe(2);
  });

  it('keeps a return visit available while the bank has no houses', () => {
    const game = at(1);
    game.state.properties[1]!.owner = 0;
    const occupied = game.state.properties
      .filter((_, i) => BOARD[i]!.kind === 'street' && i !== 1)
      .slice(0, 8);
    occupied.forEach((p) => {
      p.owner = 1;
      p.houses = 4;
    });
    game.send('a', 'roll');
    expect(game.error('a', 'build', { square: 1 })).toBe('Ngân hàng đã hết nhà hoặc khách sạn');
    const available = game.state.properties.findIndex((p) => p.owner === 1 && p.houses === 4);
    game.send('b', 'sell-house', { square: available });
    game.send('a', 'build', { square: 1 });
    expect(game.state.properties[1]!.houses).toBe(1);
  });

  it('exchanges deeds only after the other player accepts', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    game.send('a', 'offer-trade', { to: 1, give: 1, take: 3, giveCash: 50, takeCash: 0 });
    expect(game.state.properties[1]?.owner).toBe(0);
    game.send('b', 'accept-trade');
    expect(game.state.properties[1]?.owner).toBe(1);
    expect(game.state.properties[3]?.owner).toBe(0);
    expect(game.state.players.map((p) => p.cash)).toEqual([950, 1050]);
  });

  it('gives the last remaining player the win when someone leaves', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.leave('b');
    expect(game.result).toEqual({ winners: ['a'] });
  });

  it('keeps an unresolved purchase when the trade recipient leaves', () => {
    const game = testGame(plugin, ['a', 'b', 'c'], { seed: 1 });
    const [a, b] = firstRoll();
    game.state.players[0]!.position = (3 - a - b + 40) % 40;
    game.send('a', 'roll');
    game.send('a', 'offer-trade', { to: 1, give: -1, take: -1, giveCash: 50, takeCash: 0 });
    game.leave('b');
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(3);
    game.send('a', 'buy');
    expect(game.state.properties[3]?.owner).toBe(0);
  });

  it('keeps the current bidder when a different bidder leaves', () => {
    const game = testGame(plugin, ['a', 'b', 'c']);
    game.state.properties[3]!.owner = 0;
    game.send('a', 'auction', { square: 3 });
    game.send('b', 'bid', { amount: 50 });
    expect(game.state.auction?.bidder).toBe(2);
    game.leave('b');
    expect(game.state.auction?.bidder).toBe(2);
    game.send('c', 'bid', { amount: 36 });
    expect(game.state.properties[3]?.owner).toBe(2);
    expect(game.state.players[0]!.cash).toBe(1036);
  });

  it('transfers a held jail card to the creditor after bankruptcy', () => {
    const game = at(37);
    game.state.properties[37]!.owner = 1;
    game.state.players[0]!.cash = 1;
    game.state.players[0]!.freeCards.push('chance');
    game.send('a', 'roll');
    expect(game.state.phase).toBe('debt');
    game.send('a', 'bankrupt');
    expect(game.state.players[1]?.freeCards).toEqual(['chance']);
  });

  it('lets computer players handle a long game without a rejected move', () => {
    const players = ['a', 'b', 'c'];
    const game = testGame(plugin, players, { bots: players, options: { bots: 3 } });
    for (let i = 0; i < 800 && !game.result; i++) {
      const seat = decisionSeat(game.state);
      const id = players[seat]!;
      const move = game.bot(id);
      expect(move).not.toBeNull();
      game.send(id, move!.event, move!.payload as object);
    }
    expect(game.state.properties.some((deed) => deed.owner !== null)).toBe(true);
  });

  it('lets a computer confirm special events without starting a countdown', () => {
    const game = testGame(plugin, ['a', 'b'], { bots: ['a'], seed: 1 });
    const [a, b] = firstRoll();
    game.state.players[0]!.position = (38 - a - b + 40) % 40;
    game.send('a', 'roll');
    expect(game.state.phase).toBe('event');
    expect(game.timer).toBeNull();
    const id = game.state.specialEvent!.id;
    expect(game.error('b', 'event-ready', { id })).toBe('Chưa tới lượt bạn');
    game.send('a', 'event-ready', { id });
    expect(game.timer).toBeNull();
    expect(game.state.players[0]!.cash).toBe(1000);
    expect(game.bot('a')?.event).toBe('confirm-event');
    game.send('a', 'confirm-event');
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.state.specialEvent).toBeNull();
    expect(game.timer).toBeNull();
  });

  it('lets a computer accept a favorable trade', () => {
    const game = testGame(plugin, ['a', 'b'], { bots: ['b'], options: { bots: 1 } });
    game.state.properties[1]!.owner = 0;
    game.send('a', 'offer-trade', { to: 1, give: 1, take: -1, giveCash: 0, takeCash: 0 });
    expect(game.bot('b')?.event).toBe('accept-trade');
    expect(game.bot('a')).toBeNull();
  });
});
