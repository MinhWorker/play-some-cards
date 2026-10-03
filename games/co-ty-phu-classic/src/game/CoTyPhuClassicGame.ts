import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type StartContext,
  type TimerContext,
} from '@psc/sdk';
import { z } from 'zod';
import { botMove } from './bot.js';
import { CHANCE, CHEST, shuffle } from './cards.js';
import {
  AUCTION_BID_MS,
  AUCTION_OPEN_MS,
  AUCTION_STEP,
  BOARD,
  isDeed,
  type Options,
  SPECIAL_EVENT_TIMEOUT,
  type State,
  type View,
} from './model.js';
import {
  awaitSpecialEvent,
  bankHotels,
  bankHouses,
  bankrupt,
  charge,
  copy,
  move,
  next,
  openAuction,
  resolveSpecialEvent,
  transferMoney,
} from './rules.js';

import { decisionKey, decisionSeat, hasPvpClock } from './turnClock.js';

type Action<T = Record<string, never>> = EventContext<State, T, Options>;
const squareSchema = z.object({ square: z.number().int().min(0).max(39) });

function requireTurn<T>(ctx: Action<T>, phase?: State['phase']) {
  if (ctx.state.turn !== ctx.player.seat) ctx.reject('Chưa tới lượt bạn');
  if (phase && ctx.state.phase !== phase) ctx.reject('Thao tác chưa hợp lệ');
}

function requireOwner(ctx: Action<{ square: number }>) {
  if (ctx.state.phase === 'event') ctx.reject('Hãy xác nhận sự kiện trước');
  if (ctx.state.phase === 'trade' || ctx.state.phase === 'auction')
    ctx.reject('Hãy hoàn tất trao đổi hoặc đấu giá trước');
  const square = ctx.payload.square;
  if (!isDeed(BOARD[square]!) || ctx.state.properties[square]?.owner !== ctx.player.seat)
    ctx.reject('Bạn không sở hữu ô này');
  return square;
}

export class CoTyPhuClassicGame extends Game<State, Options, View> {
  events = {
    roll: z.object({}),
    'confirm-event': z.object({}),
    'event-ready': z.object({ id: z.number().int().nonnegative() }),
    buy: z.object({}),
    auction: z.object({}),
    bid: z.object({ amount: z.number().int().min(1).max(100000) }),
    pass: z.object({}),
    'end-turn': z.object({}),
    build: squareSchema,
    'sell-house': squareSchema,
    mortgage: squareSchema,
    redeem: squareSchema,
    'pay-debt': z.object({}),
    bankrupt: z.object({}),
    'pay-bail': z.object({}),
    'use-card': z.object({}),
    'offer-trade': z.object({
      to: z.number().int().min(0).max(3),
      give: z.number().int().min(-1).max(39),
      take: z.number().int().min(-1).max(39),
      giveCash: z.number().int().min(0).max(100000),
      takeCash: z.number().int().min(0).max(100000),
    }),
    'accept-trade': z.object({}),
    'decline-trade': z.object({}),
  };

  onStart(ctx: StartContext<Options>): State {
    const { players, rng } = ctx;
    const s: State = {
      lastAutoAction: null,
      specialEvent: null,
      moneySequence: 0,
      transfers: [],
      players: players.map(() => ({
        cash: 1500,
        position: 0,
        jailed: false,
        jailRolls: 0,
        freeCards: [],
        bankrupt: false,
      })),
      properties: BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false })),
      turn: 0,
      round: 0,
      shortages: [],
      phase: 'roll',
      after: 'end',
      doubles: 0,
      dice: null,
      pending: null,
      buildable: null,
      auction: null,
      debt: null,
      trade: null,
      chance: shuffle(CHANCE.length, rng),
      chest: shuffle(CHEST.length, rng),
      notice: 'Bắt đầu ván mới.',
      lastCard: null,
      winner: null,
    };
    this.scheduleDecision(s, ctx);
    return s;
  }

  view({ state }: GameContext<State, Options>): View {
    const { chance: _chance, chest: _chest, ...visible } = state;
    return visible;
  }

  bot({ state, player }: BotContext<State, Options>) {
    return player.bot ? botMove(state, player.seat) : null;
  }

  onRoll(ctx: Action): State {
    requireTurn(ctx, 'roll');
    const s = copy(ctx.state);
    const seat = s.turn;
    const p = s.players[seat]!;
    s.buildable = null;
    const a = 1 + Math.floor(ctx.rng() * 6);
    const b = 1 + Math.floor(ctx.rng() * 6);
    s.dice = [a, b];
    s.lastCard = null;
    if (p.jailed) {
      if (a !== b) {
        p.jailRolls++;
        if (p.jailRolls < 3) {
          s.phase = 'end';
          s.notice = `Chưa ra tù: ${a} + ${b}.`;
          return this.complete(s, ctx, true);
        }
        if (p.cash < 50) {
          s.after = 'end';
          charge(s, seat, 50, null, 'Tiền bảo lãnh ra tù');
          s.debt!.moveAfter = (p.position + a + b) % BOARD.length;
          p.jailed = false;
          p.jailRolls = 0;
          return this.complete(s, ctx, true);
        }
        transferMoney(s, s.turn, null, 50, 'Tiền bảo lãnh ra tù');
      }
      p.jailed = false;
      p.jailRolls = 0;
      s.doubles = 0;
      s.after = 'end';
    } else if (a === b) {
      s.doubles++;
      if (s.doubles === 3) {
        awaitSpecialEvent(s, { kind: 'jail', reason: 'Ba lần xúc xắc đôi: vào tù!' });
        return this.complete(s, ctx, true);
      }
      s.after = 'roll';
    } else {
      s.after = 'end';
    }
    move(s, seat, (p.position + a + b) % BOARD.length, true, a + b);
    return this.complete(s, ctx, true);
  }

  private scheduleDecision(s: State, ctx: StartContext<Options>) {
    ctx.clearTimer();
    if (s.winner !== null) return;
    if (s.specialEvent) {
      if (!ctx.players[s.turn]?.bot && s.players.filter((p) => !p.bankrupt).length >= 2)
        ctx.setTimer(30000, 'prepare-event', s.specialEvent.id);
      return;
    }
    // An auction is open to everyone: its own clock, bots included, restarts on every bid.
    if (s.phase === 'auction' && s.auction) {
      ctx.setTimer(
        s.auction.round ? AUCTION_BID_MS : AUCTION_OPEN_MS,
        'auction-end',
        s.auction.round,
      );
      return;
    }
    const seat = decisionSeat(s);
    if (hasPvpClock(s, ctx.players) && !ctx.players[seat]?.bot)
      ctx.setTimer(ctx.options.turnSeconds * 1000, 'turn-timeout', decisionKey(s));
  }

  private complete(s: State, ctx: GameContext<State, Options>, force = false) {
    if (
      force ||
      decisionKey(s) !== decisionKey(ctx.state) ||
      hasPvpClock(s, ctx.players) !== hasPvpClock(ctx.state, ctx.players) ||
      s.winner !== null
    )
      this.scheduleDecision(s, ctx);
    return s;
  }

  onEventReady(ctx: Action<{ id: number }>): State {
    if (ctx.player.seat !== ctx.state.turn) ctx.reject('Chưa tới lượt bạn');
    if (ctx.state.phase !== 'event' || ctx.state.specialEvent?.id !== ctx.payload.id)
      ctx.reject('Sự kiện đã thay đổi');
    if (ctx.players[ctx.state.turn]?.bot || ctx.state.specialEvent.ready) return ctx.state;
    return this.startEventCountdown(ctx);
  }

  private startEventCountdown(ctx: GameContext<State, Options>): State {
    const s = copy(ctx.state);
    if (!s.specialEvent || ctx.players[s.turn]?.bot) return this.complete(s, ctx);
    s.specialEvent = { ...s.specialEvent, ready: true };
    ctx.clearTimer();
    if (s.players.filter((player) => !player.bankrupt).length >= 2)
      ctx.setTimer(SPECIAL_EVENT_TIMEOUT, 'auto-confirm-event', s.specialEvent.id);
    return this.complete(s, ctx);
  }

  onPrepareEvent(ctx: TimerContext<State, number, Options>): State {
    if (ctx.state.phase !== 'event' || ctx.state.specialEvent?.id !== ctx.payload) return ctx.state;
    return this.startEventCountdown(ctx);
  }

  onConfirmEvent(ctx: Action): State {
    requireTurn(ctx, 'event');
    const s = copy(ctx.state);
    resolveSpecialEvent(s, ctx.rng);
    return this.complete(s, ctx);
  }

  onAutoConfirmEvent(ctx: TimerContext<State, number, Options>): State {
    if (ctx.state.phase !== 'event' || ctx.state.specialEvent?.id !== ctx.payload) return ctx.state;
    const s = copy(ctx.state);
    resolveSpecialEvent(s, ctx.rng);
    return this.complete(s, ctx);
  }

  onTurnTimeout(ctx: TimerContext<State, string, Options>): State {
    const seat = decisionSeat(ctx.state);
    if (
      ctx.payload !== decisionKey(ctx.state) ||
      !hasPvpClock(ctx.state, ctx.players) ||
      ctx.players[seat]?.bot ||
      ctx.state.winner !== null
    )
      return ctx.state;
    const action = <T>(state: State, payload: T): Action<T> => ({
      ...ctx,
      state,
      player: ctx.players[seat]!,
      payload,
      reject: (message) => {
        throw new Error(message);
      },
    });
    let s = ctx.state;
    let event: string;
    switch (s.phase) {
      case 'roll':
        event = 'roll';
        s = this.onRoll(action(s, {}));
        break;
      case 'end':
        event = 'end-turn';
        s = this.onEndTurn(action(s, {}));
        break;
      case 'buy':
        event = s.players[seat]!.cash >= BOARD[s.pending!]!.price! ? 'buy' : 'auction';
        s = event === 'buy' ? this.onBuy(action(s, {})) : this.onAuction(action(s, {}));
        break;
      case 'auction':
        // An auction runs on its own clock (onAuctionEnd), never on a turn's.
        return ctx.state;
      case 'trade':
        event = 'decline-trade';
        s = this.onDeclineTrade(action(s, {}));
        break;
      case 'debt': {
        const transfers = [] as State['transfers'];
        event = 'pay-debt';
        // Each step sells a building, mortgages a plot, pays, or declares insolvency.
        for (let i = 0; i <= BOARD.length * 6 && s.phase === 'debt' && s.winner === null; i++) {
          const move = botMove(s, seat);
          if (!move) throw new Error('Không thể tự xử lý khoản nợ');
          event = move.event;
          switch (event) {
            case 'sell-house':
              s = this.onSellHouse(action(s, squareSchema.parse(move.payload)));
              break;
            case 'mortgage':
              s = this.onMortgage(action(s, squareSchema.parse(move.payload)));
              break;
            case 'pay-debt':
              s = this.onPayDebt(action(s, {}));
              break;
            case 'bankrupt':
              s = this.onBankrupt(action(s, {}));
              break;
            default:
              throw new Error('Thao tác tự xử lý khoản nợ không hợp lệ');
          }
          transfers.push(...s.transfers);
        }
        s = { ...s, transfers };
        break;
      }
      case 'event':
        return ctx.state;
    }
    s = { ...s, lastAutoAction: { id: (ctx.state.lastAutoAction?.id ?? 0) + 1, seat, event } };
    return this.complete(s, ctx, true);
  }

  onBuy(ctx: Action): State {
    requireTurn(ctx, 'buy');
    const s = copy(ctx.state);
    const square = s.pending!;
    if (BOARD[square]!.kind === 'station') ctx.reject('Bến xe phải được đấu giá');
    const price = BOARD[square]!.price!;
    if (s.players[s.turn]!.cash < price) ctx.reject('Không đủ tiền mua đất');
    transferMoney(s, s.turn, null, price, `Mua ${BOARD[square]!.name}`);
    s.properties[square]!.owner = s.turn;
    s.pending = null;
    s.phase = s.after;
    s.notice = `Đã mua ${BOARD[square]!.name} với ${price}.`;
    return this.complete(s, ctx);
  }

  onAuction(ctx: Action): State {
    requireTurn(ctx, 'buy');
    const s = copy(ctx.state);
    openAuction(s, s.pending!);
    s.notice = `Đấu giá ${BOARD[s.pending!]!.name}.`;
    return this.complete(s, ctx);
  }

  /** Who may still bid: at the table, not bankrupt, not out of this auction. */
  private bidders(s: State) {
    const auction = s.auction!;
    return s.players.flatMap((p, i) => (p.bankrupt || auction.passed.includes(i) ? [] : [i]));
  }

  /**
   * The auction is decided once nobody but the leader (or nobody at all) can still bid. A station
   * must be sold: the last one left in it buys, bid or not.
   */
  private decided(s: State) {
    const remaining = this.bidders(s);
    const { leader, square } = s.auction!;
    if (remaining.length === 0) return true;
    return remaining.length === 1 && (remaining[0] === leader || BOARD[square]!.kind === 'station');
  }

  /**
   * Ends the auction: the leader buys at the highest bid. A station refunds every deposit
   * first, and its winner pays the listed price.
   */
  private settleAuction(s: State) {
    const auction = s.auction!;
    const cell = BOARD[auction.square]!;
    let price = auction.highest;
    let winner = auction.leader;
    if (cell.kind === 'station') {
      auction.bids.forEach((amount, seat) => {
        transferMoney(s, null, seat, amount, 'Hoàn tiền đấu giá');
      });
      price = cell.price!;
      const remaining = this.bidders(s);
      if (winner === null && remaining.length === 1) winner = remaining[0]!;
    }
    if (winner !== null && !s.players[winner]!.bankrupt && s.players[winner]!.cash >= price) {
      transferMoney(s, winner, null, price, `Đấu giá ${cell.name}`);
      s.properties[auction.square]!.owner = winner;
      s.notice = `${cell.name} bán giá ${price}.`;
    } else s.notice = 'Không ai mua đất trong phiên đấu giá.';
    s.auction = null;
    s.pending = null;
    s.phase = s.after;
  }

  /** The auction's clock ran out: the leader buys. */
  onAuctionEnd(ctx: TimerContext<State, number, Options>): State {
    if (ctx.state.phase !== 'auction' || ctx.state.auction?.round !== ctx.payload) return ctx.state;
    const s = copy(ctx.state);
    this.settleAuction(s);
    return this.complete(s, ctx, true);
  }

  /** Anyone still in the auction raises the highest bid; the clock starts again. */
  onBid(ctx: Action<{ amount: number }>): State {
    const auction = ctx.state.auction;
    const seat = ctx.player.seat;
    if (ctx.state.phase !== 'auction' || !auction) return ctx.reject('Không có phiên đấu giá');
    if (ctx.state.players[seat]!.bankrupt || auction.passed.includes(seat))
      ctx.reject('Bạn đã rời phiên đấu giá');
    if (auction.leader === seat) ctx.reject('Giá bạn đã trả vẫn đang cao nhất');
    const station = BOARD[auction.square]!.kind === 'station';
    const amount = ctx.payload.amount;
    const available = ctx.state.players[seat]!.cash + auction.bids[seat]!;
    if (station ? amount !== auction.highest + AUCTION_STEP : amount <= auction.highest)
      ctx.reject('Giá đã thay đổi, hãy trả lại');
    if (amount > available || (station && available < BOARD[auction.square]!.price!))
      ctx.reject('Không đủ tiền cho giá này');
    const s = copy(ctx.state);
    const a = s.auction!;
    if (station) {
      transferMoney(s, seat, null, amount - a.bids[seat]!, 'Đặt tiền đấu giá');
      a.bids[seat] = amount;
    }
    a.highest = amount;
    a.leader = seat;
    a.round++;
    s.notice = `${ctx.player.name} trả ${amount}.`;
    if (this.decided(s)) this.settleAuction(s);
    return this.complete(s, ctx, true);
  }

  /** Leave the auction (a station's deposit comes back). The leader of a street may not. */
  onPass(ctx: Action): State {
    const auction = ctx.state.auction;
    const seat = ctx.player.seat;
    if (ctx.state.phase !== 'auction' || !auction) return ctx.reject('Không có phiên đấu giá');
    if (auction.passed.includes(seat)) ctx.reject('Bạn đã rời phiên đấu giá');
    const station = BOARD[auction.square]!.kind === 'station';
    if (auction.leader === seat && !station) ctx.reject('Giá bạn đã trả vẫn đang cao nhất');
    const s = copy(ctx.state);
    this.leaveAuction(s, seat);
    s.notice = `${ctx.player.name} bỏ đấu giá.`;
    if (this.decided(s)) {
      this.settleAuction(s);
      return this.complete(s, ctx, true);
    }
    // The clock keeps running: leaving doesn't give the others more time.
    return s;
  }

  /** `seat` is out of the auction: its deposit comes back; a station's lead goes to the next deposit. */
  private leaveAuction(s: State, seat: number) {
    const a = s.auction!;
    if (a.bids[seat]) transferMoney(s, null, seat, a.bids[seat]!, 'Rút tiền đấu giá');
    a.bids[seat] = 0;
    a.passed.push(seat);
    if (a.leader !== seat) return;
    const best = Math.max(0, ...a.bids);
    a.leader = best > 0 ? a.bids.indexOf(best) : null;
    // A station keeps its price ladder; a street starts over from nothing.
    if (BOARD[a.square]!.kind !== 'station') a.highest = 0;
  }

  onEndTurn(ctx: Action): State {
    requireTurn(ctx, 'end');
    const s = copy(ctx.state);
    const previous = s.turn;
    s.turn = next(s, s.turn);
    if (s.turn <= previous) {
      s.round++;
      s.shortages = s.shortages.filter((event) => event.round >= s.round);
    }
    s.phase = 'roll';
    s.after = 'end';
    s.doubles = 0;
    s.dice = null;
    s.lastCard = null;
    s.buildable = null;
    s.notice = `Tới lượt ${ctx.players[s.turn]!.name}.`;
    return this.complete(s, ctx);
  }

  onBuild(ctx: Action<{ square: number }>): State {
    requireTurn(ctx);
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    const cell = BOARD[square]!;
    const deed = s.properties[square]!;
    if (cell.kind !== 'street') ctx.reject('Chỉ xây trên đất phố');
    if (s.buildable !== square || s.players[s.turn]!.position !== square)
      ctx.reject('Chỉ xây một lần khi quay lại ô đất của mình');
    if (deed.mortgaged) ctx.reject('Đất này đang thế chấp');
    if (deed.houses >= 5) ctx.reject('Đã có khách sạn');
    if (deed.houses === 4 ? bankHotels(s) < 1 : bankHouses(s) < 1)
      ctx.reject('Ngân hàng đã hết nhà hoặc khách sạn');
    const price = cell.houseCost!;
    if (s.players[ctx.player.seat]!.cash < price) ctx.reject('Không đủ tiền xây');
    transferMoney(s, ctx.player.seat, null, price, `Xây ở ${cell.name}`);
    deed.houses++;
    s.buildable = null;
    s.notice = `Xây ở ${cell.name}: ${deed.houses === 5 ? 'khách sạn' : `${deed.houses} nhà`}.`;
    return this.complete(s, ctx);
  }

  onSellHouse(ctx: Action<{ square: number }>): State {
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    const deed = s.properties[square]!;
    const cell = BOARD[square]!;
    if (!deed.houses) ctx.reject('Ô này không có nhà');
    if (deed.houses === 5 && bankHouses(s) < 4)
      ctx.reject('Ngân hàng thiếu 4 nhà để đổi khách sạn');
    deed.houses--;
    transferMoney(s, null, ctx.player.seat, cell.houseCost! / 2, `Bán nhà ở ${cell.name}`);
    s.notice = `Bán nhà ở ${cell.name}, nhận ${cell.houseCost! / 2}.`;
    return this.complete(s, ctx);
  }

  onMortgage(ctx: Action<{ square: number }>): State {
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    if (s.properties[square]!.mortgaged) ctx.reject('Đất này đã thế chấp');
    if (s.properties[square]!.houses) ctx.reject('Phải bán hết nhà trên ô đất này trước');
    s.properties[square]!.mortgaged = true;
    const amount = BOARD[square]!.price! / 2;
    transferMoney(s, null, ctx.player.seat, amount, `Thế chấp ${BOARD[square]!.name}`);
    s.notice = `Thế chấp ${BOARD[square]!.name}, nhận ${amount}.`;
    return this.complete(s, ctx);
  }

  onRedeem(ctx: Action<{ square: number }>): State {
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    if (!s.properties[square]!.mortgaged) ctx.reject('Đất này chưa thế chấp');
    const amount = Math.ceil((BOARD[square]!.price! / 2) * 1.1);
    if (s.players[ctx.player.seat]!.cash < amount) ctx.reject('Không đủ tiền chuộc đất');
    transferMoney(s, ctx.player.seat, null, amount, `Chuộc ${BOARD[square]!.name}`);
    s.properties[square]!.mortgaged = false;
    s.notice = `Chuộc ${BOARD[square]!.name} với ${amount}.`;
    return this.complete(s, ctx);
  }

  onPayDebt(ctx: Action): State {
    requireTurn(ctx, 'debt');
    const s = copy(ctx.state);
    const debt = s.debt!;
    if (s.players[s.turn]!.cash < debt.amount) ctx.reject('Bạn chưa đủ tiền trả nợ');
    transferMoney(s, s.turn, debt.creditor, debt.amount, debt.reason);
    s.debt = null;
    s.phase = debt.after;
    s.notice = `Đã trả ${debt.amount}: ${debt.reason}.`;
    if (debt.moveAfter !== undefined) {
      move(s, s.turn, debt.moveAfter, true, (s.dice?.[0] ?? 0) + (s.dice?.[1] ?? 0));
    }
    return this.complete(s, ctx);
  }

  onBankrupt(ctx: Action): State {
    requireTurn(ctx, 'debt');
    if (ctx.state.players[ctx.state.turn]!.cash >= ctx.state.debt!.amount)
      ctx.reject('Bạn đã đủ tiền trả nợ');
    const s = copy(ctx.state);
    bankrupt(s, s.turn, s.debt!.creditor, ctx);
    return this.complete(s, ctx);
  }

  onPayBail(ctx: Action): State {
    requireTurn(ctx, 'roll');
    const s = copy(ctx.state);
    const p = s.players[s.turn]!;
    if (!p.jailed) ctx.reject('Bạn không ở trong tù');
    if (p.cash < 50) ctx.reject('Không đủ tiền bảo lãnh');
    transferMoney(s, s.turn, null, 50, 'Tiền bảo lãnh ra tù');
    p.jailed = false;
    p.jailRolls = 0;
    s.notice = 'Đã trả 50 để ra tù.';
    return this.complete(s, ctx);
  }

  onUseCard(ctx: Action): State {
    requireTurn(ctx, 'roll');
    const s = copy(ctx.state);
    const p = s.players[s.turn]!;
    if (!p.jailed || !p.freeCards.length) ctx.reject('Không có thẻ ra tù để dùng');
    const deck = p.freeCards.shift()!;
    s[deck].push((deck === 'chance' ? CHANCE : CHEST).findIndex((card) => card.kind === 'free'));
    p.jailed = false;
    p.jailRolls = 0;
    s.notice = 'Đã dùng thẻ ra tù miễn phí.';
    return this.complete(s, ctx);
  }

  onOfferTrade(
    ctx: Action<{ to: number; give: number; take: number; giveCash: number; takeCash: number }>,
  ): State {
    requireTurn(ctx);
    if (ctx.state.phase === 'event') ctx.reject('Hãy xác nhận sự kiện trước');
    if (ctx.state.phase === 'auction' || ctx.state.phase === 'debt' || ctx.state.phase === 'trade')
      ctx.reject('Không thể trao đổi lúc này');
    const { to, give, take, giveCash, takeCash } = ctx.payload;
    if (to === ctx.player.seat || ctx.state.players[to]?.bankrupt || !ctx.state.players[to])
      ctx.reject('Người nhận trao đổi không hợp lệ');
    if (give === -1 && take === -1 && giveCash === 0 && takeCash === 0)
      ctx.reject('Đề nghị trao đổi đang trống');
    if (give !== -1 && ctx.state.properties[give]?.owner !== ctx.player.seat)
      ctx.reject('Bạn không sở hữu đất đưa ra');
    if (take !== -1 && ctx.state.properties[take]?.owner !== to)
      ctx.reject('Người kia không sở hữu đất yêu cầu');
    if (
      (give !== -1 && ctx.state.properties[give]!.houses > 0) ||
      (take !== -1 && ctx.state.properties[take]!.houses > 0)
    )
      ctx.reject('Phải bán hết nhà trên ô đất trước khi đổi');
    if (
      ctx.state.players[ctx.player.seat]!.cash < giveCash ||
      ctx.state.players[to]!.cash < takeCash
    )
      ctx.reject('Một bên không đủ tiền trao đổi');
    const s = copy(ctx.state);
    s.trade = {
      from: ctx.player.seat,
      to,
      give: give === -1 ? null : give,
      take: take === -1 ? null : take,
      giveCash,
      takeCash,
      resume: s.phase,
    };
    s.phase = 'trade';
    s.notice = `${ctx.player.name} đề nghị trao đổi với ${ctx.players[to]!.name}.`;
    return this.complete(s, ctx);
  }

  onAcceptTrade(ctx: Action): State {
    const trade = ctx.state.trade;
    if (ctx.state.phase !== 'trade' || !trade || trade.to !== ctx.player.seat)
      ctx.reject('Bạn không có đề nghị cần trả lời');
    const s = copy(ctx.state);
    const t = s.trade!;
    if (
      (t.give !== null && s.properties[t.give]!.owner !== t.from) ||
      (t.take !== null && s.properties[t.take]!.owner !== t.to) ||
      s.players[t.from]!.cash < t.giveCash ||
      s.players[t.to]!.cash < t.takeCash
    )
      ctx.reject('Tài sản trao đổi đã thay đổi');
    if (t.give !== null) s.properties[t.give]!.owner = t.to;
    if (t.take !== null) s.properties[t.take]!.owner = t.from;
    transferMoney(s, t.from, t.to, t.giveCash, 'Trao đổi tài sản');
    transferMoney(s, t.to, t.from, t.takeCash, 'Trao đổi tài sản');
    s.trade = null;
    s.phase = t.resume;
    s.notice = 'Hai bên đã trao đổi tài sản.';
    return this.complete(s, ctx);
  }

  onDeclineTrade(ctx: Action): State {
    const trade = ctx.state.trade;
    if (ctx.state.phase !== 'trade' || !trade || ![trade.from, trade.to].includes(ctx.player.seat))
      ctx.reject('Bạn không có đề nghị cần trả lời');
    const s = copy(ctx.state);
    s.phase = trade.resume;
    s.trade = null;
    s.notice = 'Đề nghị trao đổi đã bị huỷ.';
    return this.complete(s, ctx);
  }

  onLeave(ctx: LeaveContext<State, Options>): State {
    const s = copy(ctx.state);
    if (s.players[ctx.player.seat]!.bankrupt) return this.complete(s, ctx);
    const wasTurn = s.turn === ctx.player.seat;
    bankrupt(s, ctx.player.seat, null, ctx);
    if (s.winner === null && !wasTurn) {
      if (ctx.state.trade && [ctx.state.trade.from, ctx.state.trade.to].includes(ctx.player.seat)) {
        s.phase = ctx.state.trade.resume;
        s.pending = ctx.state.pending;
      } else if (ctx.state.auction) {
        // bankrupt() refunded the leaver's deposit; the others' deposits stay with the bank.
        s.auction = {
          ...ctx.state.auction,
          passed: [...ctx.state.auction.passed],
          bids: [...ctx.state.auction.bids],
        };
        s.auction.bids[ctx.player.seat] = 0;
        s.auction.passed.push(ctx.player.seat);
        if (s.auction.leader === ctx.player.seat) {
          const best = Math.max(0, ...s.auction.bids);
          s.auction.leader = best > 0 ? s.auction.bids.indexOf(best) : null;
          if (BOARD[s.auction.square]!.kind !== 'station') s.auction.highest = 0;
        }
        s.phase = 'auction';
        s.pending = ctx.state.pending;
        if (this.decided(s)) this.settleAuction(s);
      } else {
        s.phase = ctx.state.phase;
        if (s.specialEvent) s.notice = ctx.state.notice;
        s.pending = ctx.state.pending;
        s.debt = ctx.state.debt && {
          ...ctx.state.debt,
          creditor: ctx.state.debt.creditor === ctx.player.seat ? null : ctx.state.debt.creditor,
        };
      }
    }
    return this.complete(s, ctx, !s.specialEvent && !hasPvpClock(s, ctx.players));
  }
}
