import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { BOARD } from './model.js';
import { rent } from './rules.js';

/** The first dice after both decks are shuffled with seed 1. */
const firstRoll = () => {
  const rng = seededRng(1);
  for (let i = 0; i < 22; i++) rng();
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)] as const;
};

const at = (target: number) => {
  const game = testGame(plugin, ['a', 'b'], { seed: 1 });
  const [a, b] = firstRoll();
  game.state.players[0]!.position = (target - a - b + 40) % 40;
  return game;
};

describe('Cờ tỷ phú Classic', () => {
  it('starts with 40 squares, 1500 each and hidden card order', () => {
    const game = testGame(plugin, ['a', 'b']);
    expect(BOARD).toHaveLength(40);
    expect(game.state.properties).toHaveLength(40);
    expect(game.state.players.map((p) => p.cash)).toEqual([1500, 1500]);
    expect(game.error('b', 'roll')).toBe('Chưa tới lượt bạn');
    expect(game.view('a')).not.toHaveProperty('chance');
    expect(game.view(null)).not.toHaveProperty('chest');
  });

  it('buys an unowned street after a roll', () => {
    const game = at(3);
    game.send('a', 'roll');
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(3);
    const cash = game.state.players[0]!.cash;
    game.send('a', 'buy');
    expect(game.state.properties[3]?.owner).toBe(0);
    expect(game.state.players[0]!.cash).toBe(cash - 60);
    expect(game.view(null)).toMatchObject({
      transfers: [{ from: 0, to: null, amount: 60, reason: 'Mua Hàng Đào' }],
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
        { from: 0, to: 1, amount: 2, reason: 'Tiền thuê Phố Cổ' },
      ],
    });
    expect(game.state.players.map((p) => p.cash)).toEqual([1698, 1502]);
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

  it('auctions a declined street to the highest bidder', () => {
    const game = at(3);
    game.send('a', 'roll').send('a', 'auction');
    game.send('a', 'bid', { amount: 50 });
    expect(game.error('b', 'bid', { amount: 50 })).toBe(
      'Giá đấu phải cao hơn và trong số tiền bạn có',
    );
    game.send('b', 'bid', { amount: 60 });
    game.send('a', 'pass');
    expect(game.state.properties[3]?.owner).toBe(1);
    expect(game.state.players[1]?.cash).toBe(1440);
    expect(game.state.auction).toBeNull();
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
    expect(game.state.players[1]!.cash).toBe(1535);
    expect(game.state.properties[1]?.mortgaged).toBe(true);
  });

  it('requires even building and stops rent on mortgaged land', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 0;
    game.send('a', 'build', { square: 1 });
    expect(game.error('a', 'build', { square: 1 })).toBe('Phải xây đều trên cả bộ màu');
    game.send('a', 'build', { square: 3 });
    expect(game.error('a', 'mortgage', { square: 1 })).toBe('Phải bán hết nhà trong bộ màu trước');
    game.send('a', 'sell-house', { square: 1 });
    game.send('a', 'sell-house', { square: 3 });
    game.send('a', 'mortgage', { square: 1 });
    expect(rent(game.state, 1, 7)).toBe(0);
    game.send('a', 'redeem', { square: 1 });
    expect(rent(game.state, 1, 7)).toBe(4);
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
    expect(game.state.players.map((p) => p.cash)).toEqual([1450, 1550]);
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
    const game = testGame(plugin, ['a', 'b', 'c'], { seed: 1 });
    const [a, b] = firstRoll();
    game.state.players[0]!.position = (3 - a - b + 40) % 40;
    game.send('a', 'roll').send('a', 'auction').send('a', 'pass');
    game.send('b', 'bid', { amount: 50 });
    expect(game.state.auction?.bidder).toBe(2);
    game.leave('b');
    expect(game.state.auction?.bidder).toBe(2);
    game.send('c', 'bid', { amount: 1 });
    expect(game.state.properties[3]?.owner).toBe(2);
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
      const seat = game.state.phase === 'auction' ? game.state.auction!.bidder : game.state.turn;
      const id = players[seat]!;
      const move = game.bot(id);
      expect(move).not.toBeNull();
      game.send(id, move!.event, move!.payload as object);
    }
    expect(game.state.properties.some((deed) => deed.owner !== null)).toBe(true);
  });

  it('lets a computer accept a favorable trade', () => {
    const game = testGame(plugin, ['a', 'b'], { bots: ['b'], options: { bots: 1 } });
    game.state.properties[1]!.owner = 0;
    game.send('a', 'offer-trade', { to: 1, give: 1, take: -1, giveCash: 0, takeCash: 0 });
    expect(game.bot('b')?.event).toBe('accept-trade');
    expect(game.bot('a')).toBeNull();
  });
});
