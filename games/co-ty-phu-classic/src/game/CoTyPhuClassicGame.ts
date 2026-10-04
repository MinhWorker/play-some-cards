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
  AUCTION_TURN_MS,
  auctionRaise,
  BOARD,
  isDeed,
  type Options,
  SPECIAL_EVENT_TIMEOUT,
  STARTING_CASH,
  STATION_CONTRIBUTION_STEP,
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
  expireMortgages,
  mortgageAmount,
  move,
  next,
  redeemAmount,
  resolveSpecialEvent,
  settleStations,
  startTurn,
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

/** Also allow the off-turn station winner to raise funds for their outstanding debt. */
function requireManagement<T>(ctx: Action<T>) {
  if ((ctx.state.phase === 'debt' ? decisionSeat(ctx.state) : ctx.state.turn) !== ctx.player.seat)
    ctx.reject('Chưa tới lượt bạn');
  if (ctx.state.winner !== null || ctx.state.players[ctx.player.seat]!.bankrupt)
    ctx.reject('Bạn không còn chơi trong ván');
}

export class CoTyPhuClassicGame extends Game<State, Options, View> {
  events = {
    roll: z.object({}),
    'confirm-event': z.object({}),
    'event-ready': z.object({ id: z.number().int().nonnegative() }),
    buy: z.object({}),
    auction: squareSchema,
    bid: z.object({ amount: z.number().int().min(1).max(100000) }),
    pass: z.object({}),
    'end-turn': z.object({}),
    build: squareSchema,
    'sell-house': squareSchema,
    mortgage: z.union([
      squareSchema,
      z.object({ squares: z.array(squareSchema.shape.square).min(1).max(28) }),
    ]),
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
        cash: STARTING_CASH,
        position: 0,
        jailed: false,
        jailRolls: 0,
        freeCards: [],
        bankrupt: false,
      })),
      properties: BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false })),
      turn: 0,
      playerTurns: players.map((_, seat) => (seat === 0 ? 1 : 0)),
      round: 0,
      shortages: [],
      phase: 'roll',
      after: 'end',
      doubles: 0,
      dice: null,
      pending: null,
      buildable: null,
      auction: null,
      stationAuctions: {},
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
    const seat = decisionSeat(s);
    if (ctx.players[seat]?.bot) return;
    // Each bid in an auction has its own countdown, even in a game against the computer.
    if (s.phase === 'auction') ctx.setTimer(AUCTION_TURN_MS, 'turn-timeout', decisionKey(s));
    else if (hasPvpClock(s, ctx.players))
      ctx.setTimer(ctx.options.turnSeconds * 1000, 'turn-timeout', decisionKey(s));
  }

  private complete(s: State, ctx: GameContext<State, Options>, force = false) {
    settleStations(s);
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
      (ctx.state.phase !== 'auction' && !hasPvpClock(ctx.state, ctx.players)) ||
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
        event = s.players[seat]!.cash >= BOARD[s.pending!]!.price! ? 'buy' : 'end-turn';
        s = event === 'buy' ? this.onBuy(action(s, {})) : this.onEndTurn(action(s, {}));
        break;
      case 'auction':
        event = 'pass';
        if (s.auction!.leader === seat && s.auction!.seller !== undefined) {
          s = copy(s);
          this.auctionStep(s);
        } else s = this.onPass(action(s, {}));
        break;
      case 'trade':
        event = 'decline-trade';
        s = this.onDeclineTrade(action(s, {}));
        break;
      case 'debt': {
        const transfers = [] as State['transfers'];
        event = 'pay-debt';
        // Each step sells a building, mortgages a plot, pays, or declares insolvency.
        for (
          let i = 0;
          i <= BOARD.length * 6 &&
          s.phase === 'debt' &&
          decisionSeat(s) === seat &&
          s.winner === null;
          i++
        ) {
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

  onAuction(ctx: Action<{ square: number }>): State {
    requireManagement(ctx);
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    const seller = ctx.player.seat;
    s.auction = {
      square,
      seller,
      resume: s.phase,
      bidder: next(s, seller),
      highest: 0,
      leader: null,
      passed: [seller],
      bids: s.players.map(() => 0),
    };
    s.phase = 'auction';
    s.notice = `${ctx.player.name} mở đấu giá ${BOARD[square]!.name}.`;
    this.auctionStep(s, false);
    return this.complete(s, ctx);
  }

  private auctionStep(s: State, advance = true) {
    const auction = s.auction!;
    if (s.properties[auction.square]!.owner !== auction.seller) {
      s.auction = null;
      s.phase = auction.resume!;
      s.notice = 'Đấu giá bị hủy vì quyền sở hữu đã thay đổi.';
      return;
    }
    const remaining = s.players.flatMap((p, i) =>
      p.bankrupt || auction.passed.includes(i) ? [] : [i],
    );
    if (remaining.length === 0 || (remaining.length === 1 && auction.leader === remaining[0])) {
      if (auction.leader !== null && s.players[auction.leader]!.cash >= auction.highest) {
        const winner = auction.leader;
        transferMoney(
          s,
          winner,
          auction.seller!,
          auction.highest,
          `Đấu giá ${BOARD[auction.square]!.name}`,
        );
        s.properties[auction.square]!.owner = winner;
        s.notice = `${BOARD[auction.square]!.name} bán giá ${auction.highest}.`;
      } else s.notice = 'Không ai mua đất trong phiên đấu giá.';
      s.auction = null;
      s.phase = auction.resume!;
      if (s.buildable === auction.square && auction.leader !== null) s.buildable = null;
    } else if (advance || s.auction!.passed.includes(s.auction!.bidder)) {
      s.auction!.bidder = next(s, auction.bidder);
      while (s.auction!.passed.includes(s.auction!.bidder)) {
        s.auction!.bidder = next(s, s.auction!.bidder);
      }
    }
  }

  onBid(ctx: Action<{ amount: number }>): State {
    if (ctx.state.phase !== 'auction' || ctx.state.auction?.bidder !== ctx.player.seat)
      ctx.reject('Chưa tới lượt đấu giá của bạn');
    const s = copy(ctx.state);
    const amount = ctx.payload.amount;
    const station = s.auction!.seller === undefined;
    if (station) {
      requireTurn(ctx, 'auction');
      if (s.players[s.turn]!.position !== s.auction!.square || s.pending !== s.auction!.square)
        ctx.reject('Chỉ được góp tiền khi bước vào bến xe');
      if (s.auction!.passed.includes(s.turn)) ctx.reject('Bạn đã từ bỏ bến xe này');
    }
    if (
      (station
        ? amount !== s.auction!.highest + STATION_CONTRIBUTION_STEP
        : amount < s.auction!.highest + auctionRaise(s.auction!.square)) ||
      amount > s.players[ctx.player.seat]!.cash
    )
      ctx.reject('Giá đấu phải cao hơn và trong số tiền bạn có');
    if (station) {
      transferMoney(s, ctx.player.seat, null, amount, 'Góp tiền bến xe');
      s.auction!.bids[ctx.player.seat]! += amount;
    }
    s.auction!.highest = amount;
    s.auction!.leader = ctx.player.seat;
    s.notice = `${ctx.player.name} trả ${amount}.`;
    if (station) this.endStationVisit(s);
    else this.auctionStep(s);
    return this.complete(s, ctx);
  }

  private endStationVisit(s: State) {
    const { bidder: _bidder, ...auction } = s.auction!;
    s.stationAuctions[auction.square] = auction;
    s.auction = null;
    s.pending = null;
    s.phase = s.after;
  }

  onPass(ctx: Action): State {
    if (ctx.state.phase !== 'auction' || ctx.state.auction?.bidder !== ctx.player.seat)
      ctx.reject('Chưa tới lượt đấu giá của bạn');
    const s = copy(ctx.state);
    const station = s.auction!.seller === undefined;
    if (station) {
      requireTurn(ctx, 'auction');
      if (s.players[s.turn]!.position !== s.auction!.square || s.pending !== s.auction!.square)
        ctx.reject('Chỉ được từ bỏ khi bước vào bến xe');
      if (s.auction!.passed.includes(s.turn)) ctx.reject('Bạn đã từ bỏ bến xe này');
    } else if (s.auction!.leader === ctx.player.seat) {
      ctx.reject('Giá bạn đã trả vẫn đang cao nhất');
    }
    if (s.auction!.leader === ctx.player.seat) s.auction!.leader = null;
    s.auction!.passed.push(ctx.player.seat);
    s.notice = `${ctx.player.name} bỏ đấu giá.`;
    if (station) this.endStationVisit(s);
    else this.auctionStep(s);
    return this.complete(s, ctx);
  }

  onEndTurn(ctx: Action): State {
    requireTurn(ctx);
    if (ctx.state.phase !== 'end' && ctx.state.phase !== 'buy') ctx.reject('Thao tác chưa hợp lệ');
    const s = copy(ctx.state);
    s.pending = null;
    const previous = s.turn;
    const expired = expireMortgages(s, previous);
    startTurn(s, next(s, s.turn));
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
    s.notice = `${expired.length ? `Thu hồi ${expired.join(', ')} do hết hạn chuộc. ` : ''}Tới lượt ${ctx.players[s.turn]!.name}.`;
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
    if (deed.mortgaged) ctx.reject('Phải chuộc tài sản trước khi bán công trình');
    if (!deed.houses) ctx.reject('Ô này không có nhà');
    if (deed.houses === 5 && bankHouses(s) < 4)
      ctx.reject('Ngân hàng thiếu 4 nhà để đổi khách sạn');
    deed.houses--;
    transferMoney(s, null, ctx.player.seat, cell.houseCost! / 2, `Bán nhà ở ${cell.name}`);
    s.notice = `Bán nhà ở ${cell.name}, nhận ${cell.houseCost! / 2}.`;
    return this.complete(s, ctx);
  }

  onMortgage(ctx: Action<{ square: number } | { squares: number[] }>): State {
    requireManagement(ctx);
    const squares = 'squares' in ctx.payload ? ctx.payload.squares : [ctx.payload.square];
    if (new Set(squares).size !== squares.length) ctx.reject('Danh sách thế chấp bị trùng ô');
    for (const square of squares) {
      requireOwner({ ...ctx, payload: { square } });
      if (ctx.state.properties[square]!.mortgaged) ctx.reject('Đất này đã thế chấp');
    }
    const s = copy(ctx.state);
    let total = 0;
    for (const square of squares) {
      const amount = mortgageAmount(s, square);
      s.properties[square]!.mortgaged = true;
      s.properties[square]!.mortgage = {
        borrower: ctx.player.seat,
        deadline: s.playerTurns[ctx.player.seat]! + 3,
        principal: amount,
      };
      transferMoney(s, null, ctx.player.seat, amount, `Thế chấp ${BOARD[square]!.name}`);
      total += amount;
    }
    s.notice = `Thế chấp ${squares.length === 1 ? BOARD[squares[0]!]!.name : `${squares.length} tài sản`}, nhận ${total.toLocaleString('vi-VN')} ₫.`;
    return this.complete(s, ctx);
  }

  onRedeem(ctx: Action<{ square: number }>): State {
    requireManagement(ctx);
    const square = requireOwner(ctx);
    const s = copy(ctx.state);
    if (!s.properties[square]!.mortgaged) ctx.reject('Đất này chưa thế chấp');
    const amount = redeemAmount(s, square);
    if (s.players[ctx.player.seat]!.cash < amount) ctx.reject('Không đủ tiền chuộc đất');
    transferMoney(s, ctx.player.seat, null, amount, `Chuộc ${BOARD[square]!.name}`);
    s.properties[square]!.mortgaged = false;
    s.properties[square]!.mortgage = undefined;
    s.notice = `Chuộc ${BOARD[square]!.name} với ${amount}.`;
    return this.complete(s, ctx);
  }

  onPayDebt(ctx: Action): State {
    if (ctx.state.phase !== 'debt' || decisionSeat(ctx.state) !== ctx.player.seat)
      ctx.reject('Chưa tới lượt trả nợ của bạn');
    const s = copy(ctx.state);
    const debt = s.debt!;
    const payer = debt.payer ?? s.turn;
    if (s.players[payer]!.cash < debt.amount) ctx.reject('Bạn chưa đủ tiền trả nợ');
    transferMoney(s, payer, debt.creditor, debt.amount, debt.reason);
    s.debt = null;
    s.phase = debt.after;
    s.notice = `Đã trả ${debt.amount}: ${debt.reason}.`;
    if (debt.moveAfter !== undefined) {
      move(s, s.turn, debt.moveAfter, true, (s.dice?.[0] ?? 0) + (s.dice?.[1] ?? 0));
    }
    return this.complete(s, ctx);
  }

  onBankrupt(ctx: Action): State {
    if (ctx.state.phase !== 'debt' || decisionSeat(ctx.state) !== ctx.player.seat)
      ctx.reject('Chưa tới lượt trả nợ của bạn');
    const payer = decisionSeat(ctx.state);
    if (ctx.state.players[payer]!.cash >= ctx.state.debt!.amount)
      ctx.reject('Bạn đã đủ tiền trả nợ');
    const s = copy(ctx.state);
    const resume = s.debt!.after;
    const wasTurn = payer === s.turn;
    bankrupt(s, payer, s.debt!.creditor, ctx);
    if (!wasTurn) s.phase = resume;
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
    if (
      s.winner === null &&
      wasTurn &&
      ctx.state.debt?.payer !== undefined &&
      ctx.state.debt.payer !== ctx.player.seat
    ) {
      s.debt = { ...ctx.state.debt, after: 'roll' };
      s.phase = 'debt';
    }
    if (s.winner === null && !wasTurn) {
      if (ctx.state.trade && [ctx.state.trade.from, ctx.state.trade.to].includes(ctx.player.seat)) {
        s.phase = ctx.state.trade.resume;
        s.pending = ctx.state.pending;
      } else if (ctx.state.auction && ctx.state.auction.seller === undefined) {
        const auction = s.stationAuctions[ctx.state.auction.square]!;
        const remaining = s.players.filter(
          (p, seat) => !p.bankrupt && !auction.passed.includes(seat),
        );
        if (remaining.length <= 1) {
          s.phase = s.after;
        } else {
          s.auction = { ...auction, bidder: ctx.state.auction.bidder };
          s.phase = 'auction';
          s.pending = ctx.state.pending;
        }
      } else if (ctx.state.auction?.seller === ctx.player.seat) {
        s.phase =
          ctx.state.auction.resume === 'debt' ? ctx.state.debt!.after : ctx.state.auction.resume!;
        s.pending = ctx.state.pending;
      } else if (ctx.state.auction) {
        s.auction = {
          ...ctx.state.auction,
          passed: [...ctx.state.auction.passed, ctx.player.seat],
          bids: ctx.state.auction.bids.map((amount, seat) =>
            seat === ctx.player.seat ? 0 : amount,
          ),
        };
        if (s.auction.leader === ctx.player.seat) {
          s.auction.leader = null;
          s.auction.highest = 0;
        }
        s.phase = 'auction';
        s.pending = ctx.state.pending;
        s.debt = ctx.state.debt && {
          ...ctx.state.debt,
          creditor: ctx.state.debt.creditor === ctx.player.seat ? null : ctx.state.debt.creditor,
        };
        this.auctionStep(s, s.auction.bidder === ctx.player.seat);
      } else {
        s.phase =
          ctx.state.phase === 'debt' && decisionSeat(ctx.state) === ctx.player.seat
            ? ctx.state.debt!.after
            : ctx.state.phase;
        if (s.specialEvent) s.notice = ctx.state.notice;
        s.pending = ctx.state.pending;
        s.debt =
          ctx.state.debt && decisionSeat(ctx.state) !== ctx.player.seat
            ? {
                ...ctx.state.debt,
                creditor:
                  ctx.state.debt.creditor === ctx.player.seat ? null : ctx.state.debt.creditor,
              }
            : null;
      }
    }
    return this.complete(s, ctx, !s.specialEvent && !hasPvpClock(s, ctx.players));
  }
}
