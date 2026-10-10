import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConsoleError, type ConsoleIssue } from '@xomdao/sdk';
import {
  COIN,
  type JoinedRoom,
  type RoomRole,
  type ServerToClientEvents,
  type User,
} from '@xomdao/shared';
import { AccountError, AccountsService } from '../accounts/accounts.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { DevConsoleService } from '../dev/dev-console.service.js';
import { followRoomLog } from '../dev/room-log.js';
import { EventError, EventsService } from '../events/events.service.js';
import { InventoryError, InventoryService } from '../inventory/inventory.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { ShopError, ShopService } from '../shop/shop.service.js';
import { StatsError, StatsService } from '../stats/stats.service.js';
import { type Room, RoomError, RoomsService } from './rooms.service.js';

export interface SocketData {
  /** Set when the client logs in (`WsGateway`); handlers only see logged-in clients. */
  user: User;
  /** The room this socket shows. Your member id in it is `user.id`. */
  roomCode?: string;
  /** Game whose room list this socket is watching. */
  lobby?: string;
  /** Removed whenever this socket disconnects or leaves its room. */
  devLogOff?: () => void;
}

/**
 * A logged-in client: a WebSocket connection wrapped by `WsGateway`. Handlers only read `data` and
 * `emit` events.
 */
export interface Client {
  data: SocketData;
  emit<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): boolean;
}
/** A handler's reply, sent back as the request's ack. */
export type Result =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string; issue?: ConsoleIssue };

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

/** The handler method of each client event, filled by `@On`. */
const HANDLERS = new Map<string, string>();

/** Marks a method as the handler of a client event (`room:create`…). */
function On(event: string): MethodDecorator {
  return (_target, name) => {
    HANDLERS.set(event, String(name));
  };
}
/**
 * The computer "thinks" this long before its move, so players can follow the game. CI's e2e
 * sets BOT_DELAY_MS lower: a test doesn't need to follow along.
 */
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS) || 700;
/**
 * How long a new quick-match room (CHƠI) waits for other people before the computer takes the
 * empty seats (QUICK_WAIT_MS overrides it).
 */
const QUICK_WAIT_MS = Number(process.env.QUICK_WAIT_MS) || 6000;

/**
 * Translates client requests into RoomsService calls. Each handler's return value is sent back as
 * the request's ack. After every change we push a fresh `room:state` to each member (filtered per
 * member so hidden cards stay hidden) and a fresh room list to everyone browsing that game.
 *
 * Clients come from `WsGateway` (plain WebSocket + JSON): they join `clients()` through `attach`
 * once logged in and leave through `handleDisconnect` + `detach`. Being in a room belongs to the
 * account, so one account can have several clients (tabs, devices) showing the same seat.
 */
@Injectable()
export class RoomsGateway implements OnModuleInit, OnModuleDestroy {
  /** Pending computer moves, by room code. */
  private readonly botTimers = new Map<string, NodeJS.Timeout>();
  /** Pending game timers (`ctx.setTimer`), by room code. */
  private readonly gameTimers = new Map<string, NodeJS.Timeout>();
  /** Quick-match rooms waiting for people before the computer fills them, by room code. */
  private readonly quickTimers = new Map<string, NodeJS.Timeout>();
  /** Logged-in clients (`WsGateway`). */
  private readonly connected = new Set<Client>();
  private pruner?: NodeJS.Timeout;

  constructor(
    private readonly rooms: RoomsService,
    private readonly accounts: AccountsService,
    private readonly devConsole: DevConsoleService,
    private readonly matches: MatchesService,
    private readonly catalog: CatalogService,
    private readonly ledger: LedgerService,
    private readonly inventory: InventoryService,
    private readonly shop: ShopService,
    private readonly events: EventsService,
    private readonly stats: StatsService,
  ) {
    rooms.onFinished((game) => {
      this.matches.record(game).catch((err) => console.error('Could not save a match', err));
    });
    rooms.onFinished((game) => {
      const paid = this.ledger.rewardMatch(game).then(
        (notices) => {
          for (const notice of notices) {
            for (const s of this.socketsOf(notice.userId)) s.emit('reward', notice);
          }
        },
        (err) => console.error('Could not pay rewards', err),
      );
      // After the game's own rewards, so an achievement's balances include them.
      paid
        .then(() => this.stats.recordMatch(game))
        .then(
          (notices) => {
            for (const { userId, ...notice } of notices) {
              for (const s of this.socketsOf(userId)) s.emit('achievement', notice);
            }
          },
          (err) => console.error('Could not count stats', err),
        );
    });
    rooms.onFinished((game) => {
      this.events.recordMatch(game).catch((err) => console.error('Could not count points', err));
    });
  }

  onModuleInit() {
    this.pruner = setInterval(() => this.rooms.pruneEmptyRooms(), PRUNE_INTERVAL_MS);
    this.pruner.unref();
  }

  onModuleDestroy() {
    clearInterval(this.pruner);
  }

  /** A WebSocket client that just logged in. */
  attach(client: Client) {
    this.connected.add(client);
  }

  /** A WebSocket client that closed (after `handleDisconnect`). */
  detach(client: Client) {
    this.connected.delete(client);
  }

  /** The handler of a client event (an `@On` method), for `WsGateway`; `undefined` if unknown. */
  handlerFor(event: string): ((client: Client, req: unknown) => Promise<Result>) | undefined {
    const name = HANDLERS.get(event);
    const method = name && (this as unknown as Record<string, unknown>)[name];
    if (typeof method !== 'function') return undefined;
    return (client, req) => method.call(this, client, req) as Promise<Result>;
  }

  /** The account changed how it shows: its sockets and its room (pushed to everyone) follow. */
  private changed(user: User) {
    for (const s of this.socketsOf(user.id)) s.data.user = user;
    const room = this.rooms.rename(user.id, user);
    if (room) this.broadcast(room);
    return user;
  }

  /** Offline only when none of the account's sockets still shows the room. */
  handleDisconnect(socket: Client) {
    this.stopDevLogs(socket);
    const { roomCode, user } = socket.data;
    if (!roomCode || !user) return;
    const stillHere = this.socketsOf(user.id).some(
      (s) => s !== socket && s.data.roomCode === roomCode,
    );
    if (stillHere) return;
    const room = this.rooms.setConnected(roomCode, user.id, false);
    if (room) this.broadcast(room);
  }

  @On('session:resume')
  resume(socket: Client) {
    return this.handle(async () => {
      const balances = await this.ledger.balances(socket.data.user.id);
      const room = this.rooms.roomOf(socket.data.user.id);
      return { user: socket.data.user, room: room ? this.enter(socket, room) : null, balances };
    });
  }

  @On('profile:update')
  updateProfile(socket: Client, req: unknown) {
    return this.handle(async () => {
      const me = socket.data.user;
      // A frame is worn from Túi đồ: one you don't own can't be picked here either.
      const frame = (req as { frame?: unknown } | null)?.frame;
      if (
        typeof frame === 'string' &&
        frame !== me.frame &&
        !(await this.inventory.ownsLook(me.id, 'frame', frame))
      ) {
        throw new InventoryError('Bạn chưa có khung này');
      }
      return { user: this.changed(await this.accounts.updateProfile(me.id, req)) };
    });
  }

  @On('shop:list')
  shopList(socket: Client) {
    return this.handle(async () => ({ items: await this.shop.list(socket.data.user.id) }));
  }

  @On('shop:buy')
  shopBuy(socket: Client, req: { itemId?: unknown }) {
    return this.handle(() => this.shop.buy(socket.data.user.id, String(req?.itemId ?? '')));
  }

  @On('inventory:get')
  inventoryGet(socket: Client, req: { userId?: unknown } | undefined) {
    return this.handle(() => {
      const userId = typeof req?.userId === 'string' ? req.userId : socket.data.user.id;
      return this.inventory.profile(userId);
    });
  }

  @On('inventory:equip')
  equip(socket: Client, req: { itemId?: unknown }) {
    return this.handle(async () => {
      const user = await this.inventory.equip(socket.data.user.id, String(req?.itemId ?? ''));
      return { user: this.changed(user) };
    });
  }

  @On('event:get')
  eventGet(socket: Client, req: { eventId?: unknown }) {
    return this.handle(() => this.events.progress(socket.data.user.id, String(req?.eventId ?? '')));
  }

  @On('event:claim')
  eventClaim(socket: Client, req: { eventId?: unknown; tier?: unknown }) {
    return this.handle(() =>
      this.events.claim(socket.data.user.id, String(req?.eventId ?? ''), Number(req?.tier)),
    );
  }

  @On('stats:get')
  statsGet(socket: Client, req: { userId?: unknown } | undefined) {
    return this.handle(() => {
      const userId = typeof req?.userId === 'string' ? req.userId : socket.data.user.id;
      return this.stats.playerStats(userId);
    });
  }

  @On('ranking:get')
  rankingGet(socket: Client, req: { board?: unknown }) {
    return this.handle(() => this.stats.ranking(String(req?.board ?? ''), socket.data.user.id));
  }

  @On('history:recent')
  history(socket: Client) {
    return this.handle(async () => ({ matches: await this.matches.recent(socket.data.user.id) }));
  }

  @On('catalog:get')
  getCatalog() {
    return this.handle(() => this.catalog.catalog());
  }

  @On('lobby:watch')
  watch(socket: Client, req: { gameId: string }) {
    return this.handle(() => {
      this.unwatchLobby(socket);
      socket.data.lobby = req.gameId;
      return { rooms: this.rooms.list(req.gameId) };
    });
  }

  @On('lobby:unwatch')
  unwatch(socket: Client) {
    return this.handle(() => {
      this.unwatchLobby(socket);
      return {};
    });
  }

  @On('room:create')
  create(socket: Client, req: { gameId: string; options?: unknown }) {
    return this.handle(() => {
      this.refuseClosedEvent(req?.gameId);
      this.leaveCurrentRoom(socket);
      const { room } = this.rooms.create(req.gameId, socket.data.user, req.options);
      return this.enter(socket, room);
    });
  }

  @On('room:quick')
  quick(socket: Client, req: { gameId: string }) {
    return this.handle(() => {
      this.refuseClosedEvent(req?.gameId);
      this.leaveCurrentRoom(socket);
      const { room, created } = this.rooms.quickMatch(req?.gameId, socket.data.user);
      const joined = this.enter(socket, room);
      if (this.rooms.isFull(room)) this.fillQuick(room.code);
      else if (created) {
        const timer = setTimeout(() => this.fillQuick(room.code), QUICK_WAIT_MS);
        this.quickTimers.set(room.code, timer);
      }
      return joined;
    });
  }

  @On('room:join')
  join(socket: Client, req: { roomCode: string; role: RoomRole }) {
    return this.handle(() => {
      const role = req.role === 'spectator' ? 'spectator' : 'player';
      this.leaveCurrentRoom(socket, req.roomCode);
      const { room } = this.rooms.join(req.roomCode, socket.data.user, role);
      return this.enter(socket, room);
    });
  }

  @On('room:leave')
  leave(socket: Client) {
    return this.handle(() => {
      const { roomCode } = this.requireSeat(socket);
      this.leaveRoom(socket, roomCode);
      return {};
    });
  }

  @On('room:sit')
  sit(socket: Client) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.sit(roomCode, playerId));
      return {};
    });
  }

  @On('room:options')
  setOptions(socket: Client, req: { options: unknown }) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.setOptions(roomCode, playerId, req?.options));
      return {};
    });
  }

  @On('game:start')
  start(socket: Client) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.start(roomCode, playerId));
      return {};
    });
  }

  @On('game:restart')
  restart(socket: Client) {
    return this.start(socket);
  }

  @On('game:move')
  move(socket: Client, req: { move: unknown }) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.move(roomCode, playerId, req?.move));
      return {};
    });
  }

  @On('dev:logs')
  devLogs(socket: Client, req: { on: boolean }) {
    return this.handle(() => {
      this.requireDev();
      const { roomCode, playerId } = this.requireSeat(socket);
      const room = this.rooms.devRoom(roomCode, playerId);
      this.stopDevLogs(socket);
      if (req?.on === true)
        socket.data.devLogOff = followRoomLog(room, (entry) => socket.emit('dev:log', entry));
      return { entries: req?.on === true ? (room.dev?.log ?? []) : [] };
    });
  }

  private stopDevLogs(socket: Client) {
    socket.data.devLogOff?.();
    socket.data.devLogOff = undefined;
  }

  @On('dev:command')
  devCommand(socket: Client, req: { line: string }) {
    return this.handle(() => {
      this.requireDev();
      const { roomCode, playerId } = this.requireSeat(socket);
      return this.devConsole.execute(roomCode, playerId, req?.line, (room) => this.broadcast(room));
    });
  }

  @On('dev:schema')
  devSchema(socket: Client) {
    return this.handle(() => {
      this.requireDev();
      const { roomCode, playerId } = this.requireSeat(socket);
      return this.devConsole.schema(this.rooms.devRoom(roomCode, playerId));
    });
  }

  @On('dev:coins')
  devCoins(socket: Client, req: { amount?: unknown }) {
    return this.handle(async () => {
      this.requireDev();
      const amount = Number(req?.amount);
      if (!Number.isInteger(amount) || amount <= 0) throw new RoomError('Số xu không hợp lệ');
      const userId = socket.data.user.id;
      await this.ledger.apply({
        userId,
        resource: COIN,
        amount,
        reason: 'dev:coins',
        key: `dev:${randomUUID()}`,
      });
      return { balances: await this.ledger.balances(userId) };
    });
  }

  @On('dev:clock')
  devClock(_socket: Client, req: { at?: unknown }) {
    return this.handle(() => {
      this.requireDev();
      try {
        this.events.clock.set(typeof req?.at === 'string' ? req.at : null);
      } catch {
        throw new RoomError('Ngày không hợp lệ');
      }
      return { now: new Date(this.events.clock.now()).toISOString() };
    });
  }

  /** An event's rooms open only while it is (rooms already playing finish their game). */
  private refuseClosedEvent(gameId: unknown) {
    if (typeof gameId === 'string' && this.events.closed(gameId)) {
      throw new RoomError('Sự kiện chưa mở hoặc đã kết thúc');
    }
  }

  private requireDev() {
    if (!this.rooms.devEnabled) throw new RoomError('Server không bật chế độ dev');
  }

  private enter(socket: Client, room: Room): JoinedRoom {
    const userId = socket.data.user.id;
    this.unwatchLobby(socket);
    this.stopDevLogs(socket);
    socket.data.roomCode = room.code;
    this.rooms.setConnected(room.code, userId, true);
    this.broadcast(room);
    return { roomCode: room.code, playerId: userId };
  }

  /** Before entering a room: quit the account's other room, if any. */
  private leaveCurrentRoom(socket: Client, unlessCode?: string) {
    const current = this.rooms.roomOf(socket.data.user.id);
    if (
      current &&
      current.code !==
        String(unlessCode ?? '')
          .replace(/\s/g, '')
          .toUpperCase()
    )
      this.leaveRoom(socket, current.code);
  }

  /**
   * The account quits the room. Its other sockets still showing the room are sent out
   * with `room:closed`; `socket` (the one asking) already knows.
   */
  private leaveRoom(socket: Client, roomCode: string) {
    const userId = socket.data.user.id;
    const { room, closed } = this.rooms.leave(roomCode, userId);
    for (const s of this.socketsOf(userId)) {
      if (s.data.roomCode !== roomCode) continue;
      if (s !== socket) {
        s.emit('room:closed', { gameId: room.game.id, reason: 'Bạn đã rời phòng' });
      }
      this.stopDevLogs(s);
      s.data.roomCode = undefined;
    }
    if (closed) this.disband(room);
    else this.broadcast(room);
  }

  private requireSeat(socket: Client) {
    const { roomCode, user } = socket.data;
    if (!roomCode) throw new RoomError('Bạn chưa ở trong phòng nào');
    return { roomCode, playerId: user.id };
  }

  private socketsOf(userId: string) {
    return this.clients().filter((s) => s.data.user?.id === userId);
  }

  /** Every logged-in client, on both transports. */
  private clients(): Client[] {
    return [...this.connected];
  }

  /** Starts a quick-match room, with the computer in the seats nobody came for. */
  private fillQuick(code: string) {
    clearTimeout(this.quickTimers.get(code));
    this.quickTimers.delete(code);
    try {
      const room = this.rooms.fillQuick(code);
      if (room) this.broadcast(room);
    } catch (err) {
      console.error(`Quick match ${code} could not start:`, err);
    }
  }

  /** Sends everyone still in a deleted room back out, then refreshes the room list. */
  private disband(room: Room) {
    clearTimeout(this.quickTimers.get(room.code));
    this.quickTimers.delete(room.code);
    for (const socket of this.clients()) {
      if (socket.data.roomCode !== room.code) continue;
      socket.emit('room:closed', { gameId: room.game.id, reason: 'Phòng đã giải tán' });
      this.stopDevLogs(socket);
      socket.data.roomCode = undefined;
    }
    this.broadcastLobby(room.game.id);
  }

  private broadcastLobby(gameId: string) {
    const watchers = this.clients().filter((s) => s.data.lobby === gameId);
    if (!watchers.length) return;
    const rooms = this.rooms.list(gameId);
    for (const socket of watchers) socket.emit('lobby:rooms', { gameId, rooms });
  }

  private unwatchLobby(socket: Client) {
    socket.data.lobby = undefined;
  }

  /** Sends each member its own filtered snapshot, and the new room list to browsers. */
  private broadcast(room: Room) {
    // A timer the game just set goes into the snapshots, so screens can show the countdown.
    const timer = this.rooms.syncTimer(room);
    for (const socket of this.clients()) {
      const { roomCode, user } = socket.data;
      if (roomCode === room.code && user) {
        socket.emit('room:state', this.rooms.snapshotFor(room, user.id));
      }
    }
    this.broadcastLobby(room.game.id);
    this.scheduleBot(room);
    this.scheduleTimer(room, timer);
  }

  /** Waits for the game's new timer (if any), then runs its hook; drops a cancelled one. */
  private scheduleTimer(room: Room, timer: { key: string; ms: number } | null) {
    if (!room.timer || room.dev?.timerPaused) {
      clearTimeout(this.gameTimers.get(room.code));
      this.gameTimers.delete(room.code);
    }
    if (!timer || room.dev?.timerPaused) return;
    clearTimeout(this.gameTimers.get(room.code));
    const handle = setTimeout(() => {
      this.gameTimers.delete(room.code);
      try {
        const changed = this.rooms.fireTimer(room.code, timer.key);
        if (changed) this.broadcast(changed);
      } catch (err) {
        console.error(`Timer ${timer.key} failed in ${room.game.id}:`, err);
      }
    }, timer.ms);
    this.gameTimers.set(room.code, handle);
  }

  /** After a change in a game with computer seats, let a bot move after a short pause. */
  private scheduleBot(room: Room) {
    clearTimeout(this.botTimers.get(room.code));
    this.botTimers.delete(room.code);
    if (room.status !== 'playing' || room.dev?.botsPaused || !room.players.some((p) => p.bot))
      return;
    clearTimeout(this.botTimers.get(room.code));
    const timer = setTimeout(() => {
      this.botTimers.delete(room.code);
      try {
        const moved = this.rooms.botMove(room.code);
        if (moved) this.broadcast(moved);
      } catch (err) {
        console.error(`Bot move failed in ${room.game.id}:`, err);
      }
    }, BOT_DELAY_MS);
    this.botTimers.set(room.code, timer);
  }

  private async handle(fn: () => object | Promise<object>): Promise<Result> {
    try {
      return { ok: true, ...(await fn()) };
    } catch (err) {
      if (err instanceof ConsoleError) return { ok: false, error: err.message, issue: err.issue };
      if (
        err instanceof RoomError ||
        err instanceof AccountError ||
        err instanceof InventoryError ||
        err instanceof ShopError ||
        err instanceof EventError ||
        err instanceof StatsError
      ) {
        return { ok: false, error: err.message };
      }
      console.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }
}
