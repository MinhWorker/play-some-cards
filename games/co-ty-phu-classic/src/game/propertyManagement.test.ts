import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import { BOARD } from './model.js';
import { bankHotels, bankHouses, copy, mortgageStatus, move } from './rules.js';

const ids = ['a', 'b', 'c', 'd'];
const fixture = () => testGame(plugin, ids);
const end = (game: ReturnType<typeof fixture>) => {
  game.state.phase = 'end';
  game.send(ids[game.state.turn]!, 'end-turn');
};
const returnToBorrower = (game: ReturnType<typeof fixture>) => {
  end(game);
  while (game.state.turn !== 0) end(game);
};

describe('declining an unowned street', () => {
  it.each([0, 1000])('lets a buyer with %s cash end the turn without an auction', (cash) => {
    const game = fixture();
    game.state.players[0]!.cash = cash;
    move(game.state, 0, 3, false, 3);
    expect(game.error('b', 'end-turn')).toBeTruthy();
    expect(game.error('a', 'auction', { square: 3 })).toBe('Bạn không sở hữu ô này');
    game.send('a', 'end-turn');
    expect(game.state.turn).toBe(1);
    expect(game.state.pending).toBeNull();
    expect(game.state.auction).toBeNull();
    expect(game.state.properties[3]!.owner).toBeNull();
    expect(game.state.players[0]!.cash).toBe(cash);
    expect(game.state.phase).toBe('roll');
  });

  it('ends the whole turn even if the declined landing followed doubles', () => {
    const game = fixture();
    game.state.after = 'roll';
    game.state.doubles = 1;
    move(game.state, 0, 3, false, 2);
    game.send('a', 'end-turn');
    expect(game.state.turn).toBe(1);
    expect(game.state.doubles).toBe(0);
  });

  it('lets a cash-poor bot end the purchase decision', () => {
    const game = fixture();
    game.state.players[0]!.cash = 10;
    move(game.state, 0, 3, false, 3);
    expect(botMove(game.state, 0)?.event).toBe('end-turn');
  });
});

describe('selling owned real estate at auction', () => {
  it.each([1, 5])('sells square %s remotely with a 20%% increment and pays its owner', (square) => {
    const game = fixture();
    game.state.properties[square]!.owner = 0;
    const raise = BOARD[square]!.price! / 5;
    expect(game.error('b', 'auction', { square })).toBeTruthy();
    game.send('a', 'auction', { square });
    expect(game.state.auction).toMatchObject({ seller: 0, bidder: 1, passed: [0] });
    expect(game.error('a', 'bid', { amount: raise })).toBeTruthy();
    expect(game.error('b', 'bid', { amount: raise - 1 })).toBeTruthy();
    game.send('b', 'bid', { amount: raise });
    expect(game.error('c', 'bid', { amount: raise * 2 - 1 })).toBeTruthy();
    game.send('c', 'bid', { amount: raise * 2 });
    game.send('d', 'pass').send('b', 'pass');
    expect(game.state.properties[square]!.owner).toBe(2);
    expect(game.state.transfers).toEqual([
      { from: 2, to: 0, amount: raise * 2, reason: `Đấu giá ${BOARD[square]!.name}` },
    ]);
    expect(game.state.players[0]!.cash).toBe(1000 + raise * 2);
    expect(game.state.players[2]!.cash).toBe(1000 - raise * 2);
    expect(game.state.stationAuctions).toEqual({});
    expect(game.state.phase).toBe('roll');
  });

  it('keeps the original deed and pending landing if nobody buys', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[1]!.houses = 2;
    move(game.state, 0, 3, false, 3);
    game.send('a', 'auction', { square: 1 });
    game.send('b', 'pass').send('c', 'pass').send('d', 'pass');
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(3);
    expect(game.state.properties[1]).toMatchObject({ owner: 0, houses: 2 });
    expect(game.state.transfers).toEqual([]);
    game.send('a', 'buy');
    expect(game.state.properties[3]!.owner).toBe(0);
  });

  it('retains buildings and resumes debt after paying the seller', () => {
    const game = fixture();
    Object.assign(game.state, {
      phase: 'debt',
      debt: { amount: 100, creditor: null, reason: 'Thuế', after: 'end' },
    });
    game.state.players[0]!.cash = 0;
    Object.assign(game.state.properties[1]!, { owner: 0, houses: 2 });
    game.send('a', 'auction', { square: 1 });
    game.send('b', 'bid', { amount: 100 }).send('c', 'pass').send('d', 'pass');
    expect(game.state.properties[1]).toMatchObject({ owner: 1, houses: 2 });
    expect(game.state.phase).toBe('debt');
    game.send('a', 'pay-debt');
    expect(game.state.phase).toBe('end');
    expect(game.state.players[0]!.cash).toBe(0);
  });

  it('rejects unaffordable bids and cancels cleanly when the seller leaves', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.players[1]!.cash = 39;
    game.send('a', 'auction', { square: 1 });
    expect(game.error('b', 'bid', { amount: 40 })).toBeTruthy();
    game.leave('a');
    expect(game.state.auction).toBeNull();
    expect(game.state.phase).toBe('roll');
    expect(game.state.properties[1]!.owner).toBeNull();
  });

  it('changes an auction seller’s creditor to the bank if the creditor leaves', () => {
    const game = fixture();
    Object.assign(game.state, {
      phase: 'debt',
      debt: { amount: 100, creditor: 1, reason: 'Thuê', after: 'end' },
    });
    game.state.players[0]!.cash = 0;
    game.state.properties[1]!.owner = 0;
    game.send('a', 'auction', { square: 1 });
    game.leave('b');
    game.send('c', 'bid', { amount: 100 }).send('d', 'pass');
    expect(game.state.debt?.creditor).toBeNull();
    game.send('a', 'pay-debt');
    expect(game.state.transfers[0]).toMatchObject({ from: 0, to: null, amount: 100 });
  });

  it('carries an existing mortgage through a resale without extending its deadline', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'auction', { square: 1 });
    game.send('b', 'bid', { amount: 40 }).send('c', 'pass').send('d', 'pass');
    expect(game.state.properties[1]).toMatchObject({
      owner: 1,
      mortgaged: true,
      mortgage: { borrower: 0, deadline: 4 },
    });
  });

  it('resumes the visitor when an off-turn indebted seller leaves', () => {
    const game = fixture();
    Object.assign(game.state, {
      turn: 2,
      phase: 'debt',
      debt: { payer: 0, amount: 200, creditor: null, reason: 'Mua bến', after: 'end' },
    });
    game.state.properties[1]!.owner = 0;
    game.send('a', 'auction', { square: 1 });
    game.leave('a');
    expect(game.state.turn).toBe(2);
    expect(game.state.phase).toBe('end');
    expect(game.state.debt).toBeNull();
    expect(game.state.auction).toBeNull();
  });
});

describe('three personal turns to redeem a mortgage', () => {
  it('permits remote management in the owner’s turn and rejects other seats', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    expect(game.error('b', 'mortgage', { square: 3 })).toBe('Chưa tới lượt bạn');
    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.properties[1]!.mortgage).toEqual({
      borrower: 0,
      deadline: 4,
      principal: 100,
    });
    const previous = game.state;
    expect(copy(previous).properties[1]!.mortgage).not.toBe(previous.properties[1]!.mortgage);
    end(game);
    expect(game.error('a', 'redeem', { square: 1 })).toBe('Chưa tới lượt bạn');
    expect(previous.playerTurns).toEqual([1, 0, 0, 0]);
  });

  it('forecloses only at the end of the third subsequent turn, including jailed turns', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.leave('c');
    for (let turn = 1; turn <= 3; turn++) {
      returnToBorrower(game);
      expect(game.state.properties[1]!.owner).toBe(0);
      expect(game.state.playerTurns[0]).toBe(turn + 1);
      expect(mortgageStatus(game.state, game.state.properties[1]!)).toBe(
        turn === 3 ? 'Chuộc: hết lượt này' : `Chuộc: còn ${4 - turn} lượt`,
      );
      game.state.players[0]!.jailed = true;
    }
    end(game);
    expect(game.state.properties[1]).toMatchObject({ owner: null, houses: 0, mortgaged: false });
    expect(game.state.properties[1]!.mortgage).toBeUndefined();
    expect(game.state.notice).toContain('Thu hồi Phú Quốc');
    expect(game.error('a', 'redeem', { square: 1 })).toBeTruthy();
    move(game.state, 1, 1, false, 3);
    game.send('b', 'buy');
    expect(game.state.properties[1]!.owner).toBe(1);
  });

  it('allows redemption during the third turn and starts a fresh deadline on a new loan', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    for (let i = 0; i < 3; i++) returnToBorrower(game);
    game.send('a', 'redeem', { square: 1 });
    expect(game.state.properties[1]!.mortgage).toBeUndefined();
    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.properties[1]!.mortgage?.deadline).toBe(7);
    end(game);
    expect(game.state.properties[1]!.owner).toBe(0);
  });

  it('does not count additional rolls, property actions or other seats’ turns', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'mortgage', { square: 3 }).send('a', 'redeem', { square: 3 });
    for (let i = 0; i < 3; i++) {
      game.state.after = 'roll';
      move(game.state, 0, 10, false, 2);
      game.send('a', 'roll');
      if (game.state.phase === 'event') game.send('a', 'confirm-event');
      game.state.phase = 'roll';
    }
    expect(game.state.playerTurns[0]).toBe(1);
    end(game);
    end(game);
    expect(game.state.playerTurns[0]).toBe(1);
    expect(game.state.properties[1]!.owner).toBe(0);
  });

  it('keeps the original borrower’s deadline after a transfer', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'offer-trade', { to: 1, give: 1, take: -1, giveCash: 0, takeCash: 0 });
    game.send('b', 'accept-trade');
    for (let i = 0; i < 3; i++) returnToBorrower(game);
    expect(game.state.properties[1]!.owner).toBe(1);
    end(game);
    expect(game.state.properties[1]!.owner).toBeNull();
  });

  it('clears loans on borrower bankruptcy instead of leaving an unreachable deadline', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.state.players[0]!.cash = 0;
    Object.assign(game.state, {
      phase: 'debt',
      debt: { amount: 1, creditor: 1, reason: 'Thuê', after: 'end' },
    });
    game.send('a', 'bankrupt');
    expect(game.state.properties[1]).toMatchObject({ owner: null, mortgaged: false });
    expect(game.state.playerTurns[1]).toBe(1);
  });
});

describe('mortgaging several deeds with their buildings', () => {
  it('pledges houses and a hotel together for half their combined purchase/construction cost', () => {
    const game = fixture();
    Object.assign(game.state.properties[1]!, { owner: 0, houses: 2 });
    Object.assign(game.state.properties[3]!, { owner: 0, houses: 5 });
    game.send('a', 'mortgage', { squares: [1, 3] });
    expect(game.state.players[0]!.cash).toBe(1515);
    expect(game.state.transfers.map((transfer) => transfer.amount)).toEqual([200, 315]);
    expect(game.state.properties[1]).toMatchObject({
      houses: 2,
      mortgaged: true,
      mortgage: { principal: 200, deadline: 4 },
    });
    expect(game.state.properties[3]).toMatchObject({
      houses: 5,
      mortgaged: true,
      mortgage: { principal: 315, deadline: 4 },
    });
    expect(game.error('a', 'sell-house', { square: 1 })).toBeTruthy();
    expect(game.error('a', 'sell-house', { square: 3 })).toBeTruthy();
    game.send('a', 'redeem', { square: 1 });
    expect(game.state.players[0]!.cash).toBe(1295);
    expect(game.state.properties[1]).toMatchObject({ houses: 2, mortgaged: false });
    game.send('a', 'redeem', { square: 3 });
    expect(game.state.players[0]!.cash).toBe(948);
    expect(game.state.properties[3]).toMatchObject({ houses: 5, mortgaged: false });
  });

  it('returns mortgaged buildings to the bank only when the loan expires', () => {
    const game = fixture();
    Object.assign(game.state.properties[1]!, { owner: 0, houses: 2 });
    Object.assign(game.state.properties[3]!, { owner: 0, houses: 5 });
    game.send('a', 'mortgage', { squares: [1, 3] });
    expect(bankHouses(game.state)).toBe(30);
    expect(bankHotels(game.state)).toBe(11);
    for (let i = 0; i < 3; i++) returnToBorrower(game);
    expect(game.state.properties[1]!.houses).toBe(2);
    expect(game.state.properties[3]!.houses).toBe(5);
    end(game);
    expect(bankHouses(game.state)).toBe(32);
    expect(bankHotels(game.state)).toBe(12);
    for (const square of [1, 3]) {
      expect(game.state.properties[square]).toMatchObject({
        owner: null,
        houses: 0,
        mortgaged: false,
      });
      expect(game.state.properties[square]!.mortgage).toBeUndefined();
    }
  });

  it('rejects a whole batch without paying or pledging any deed if one choice is invalid', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    for (const squares of [[], [1, 1], [1, 3], [1, 12]]) {
      expect(game.error('a', 'mortgage', { squares })).toBeTruthy();
      expect(game.state.properties[1]!.mortgaged).toBe(false);
      expect(game.state.players[0]!.cash).toBe(1000);
      expect(game.state.transfers).toEqual([]);
    }
    game.send('a', 'mortgage', { squares: [1] });
    expect(game.error('a', 'mortgage', { squares: [1] })).toBeTruthy();
    expect(game.state.players[0]!.cash).toBe(1100);
  });

  it('rounds the whole redemption up without adding a floating point extra unit', () => {
    const game = fixture();
    Object.assign(game.state.properties[2]!, { owner: 0, houses: 1 });
    game.send('a', 'mortgage', { squares: [2] });
    expect(game.state.properties[2]!.mortgage?.principal).toBe(112.5);
    game.send('a', 'redeem', { square: 2 });
    expect(game.state.transfers[0]?.amount).toBe(124);
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 }).send('a', 'redeem', { square: 1 });
    expect(game.state.transfers[0]?.amount).toBe(110);
  });
});
