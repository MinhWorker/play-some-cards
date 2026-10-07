import {
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConsoleError, type ConsoleIssue } from '@psc/sdk';
import {
  type ClientToServerEvents,
  type JoinedRoom,
  PROTOCOL_MISMATCH,
  PROTOCOL_VERSION,
  type RoomRole,
  type ServerToClientEvents,
  type User,
} from '@psc/shared';
import type { Server, Socket } from 'socket.io';
import { AccountError, AccountsService } from '../accounts/accounts.service.js';
import { DevConsoleService } from '../dev/dev-console.service.js';
import { followRoomLog } from '../dev/room-log.js';
import { MatchesService } from '../matches/matches.service.js';
import { type Room, RoomError, RoomsService } from './rooms.service.js';

interface SocketData {
  /** Set by the auth middleware; every connected socket is logged in. */
  user: User;
  /** The room this socket shows. Your member id in it is `user.id`. */
  roomCode?: string;
  /** Game whose room list this socket is watching. */
  lobby?: string;
  /** Removed whenever this socket disconnects or leaves its room. */
  devLogOff?: () => void;
}

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type Result =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string; issue?: ConsoleIssue };

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
/**
 * The computer "thinks" this long before its move, so players can follow the game. CI's e2e
 * sets BOT_DELAY_MS lower: a test doesn't need to follow along.
 */
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS) || 700;

const lobbyChannel = (gameId: string) => `lobby:${gameId}`;

/**
 * Translates Socket.IO events into RoomsService calls. Each handler's return value
 * is sent back as the ack. After every change we push a fresh `room:state` to each
 * member (filtered per member so hidden cards stay hidden) and a fresh room list to
 * everyone browsing that game.
 *
 * Sockets must be logged in (`auth: { token }`). Being in a room belongs to the account, so
 * one account can have several sockets (tabs, devices) showing the same seat.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RoomsGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server!: AppServer;
  /** Pending computer moves, by room code. */
  private readonly botTimers = new Map<string, NodeJS.Timeout>();
  /** Pending game timers (`ctx.setTimer`), by room code. */
  private readonly gameTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly rooms: RoomsService,
    private readonly accounts: AccountsService,
    private readonly devConsole: DevConsoleService,
    private readonly matches: MatchesService,
  ) {
    rooms.onFinished((game) => {
      this.matches.record(game).catch((err) => console.error('Could not save a match', err));
    });
  }

  afterInit(server: AppServer) {
    // The client sees a refused connection as `connect_error` with this message.
    server.use((socket, next) => {
      if (socket.handshake.auth?.protocol !== PROTOCOL_VERSION) {
        // Web and server deploy separately; the client reloads or waits (see PROTOCOL_VERSION).
        return next(
          Object.assign(new Error(PROTOCOL_MISMATCH), { data: { protocol: PROTOCOL_VERSION } }),
        );
      }
      this.accounts.authenticate(socket.handshake.auth?.token).then(
        (user) => {
          if (!user) return next(new Error('unauthorized'));
          socket.data.user = user;
          next();
        },
        (err) => {
          console.error(err);
          next(new Error('server'));
        },
      );
    });
    setInterval(() => this.rooms.pruneEmptyRooms(), PRUNE_INTERVAL_MS).unref();
  }

  /** Offline only when none of the account's sockets still shows the room. */
  handleDisconnect(socket: AppSocket) {
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

  @SubscribeMessage('session:resume')
  resume(socket: AppSocket) {
    return this.handle(() => {
      const room = this.rooms.roomOf(socket.data.user.id);
      return { user: socket.data.user, room: room ? this.enter(socket, room) : null };
    });
  }

  @SubscribeMessage('profile:update')
  updateProfile(socket: AppSocket, req: unknown) {
    return this.handle(async () => {
      const user = await this.accounts.updateProfile(socket.data.user.id, req);
      for (const s of this.socketsOf(user.id)) s.data.user = user;
      const room = this.rooms.rename(user.id, user);
      if (room) this.broadcast(room);
      return { user };
    });
  }

  @SubscribeMessage('history:recent')
  history(socket: AppSocket) {
    return this.handle(async () => ({ matches: await this.matches.recent(socket.data.user.id) }));
  }

  @SubscribeMessage('lobby:watch')
  watch(socket: AppSocket, req: { gameId: string }) {
    return this.handle(() => {
      this.unwatchLobby(socket);
      socket.data.lobby = req.gameId;
      void socket.join(lobbyChannel(req.gameId));
      return { rooms: this.rooms.list(req.gameId) };
    });
  }

  @SubscribeMessage('lobby:unwatch')
  unwatch(socket: AppSocket) {
    return this.handle(() => {
      this.unwatchLobby(socket);
      return {};
    });
  }

  @SubscribeMessage('room:create')
  create(socket: AppSocket, req: { gameId: string; options?: unknown }) {
    return this.handle(() => {
      this.leaveCurrentRoom(socket);
      const { room } = this.rooms.create(req.gameId, socket.data.user, req.options);
      return this.enter(socket, room);
    });
  }

  @SubscribeMessage('room:join')
  join(socket: AppSocket, req: { roomCode: string; role: RoomRole }) {
    return this.handle(() => {
      const role = req.role === 'spectator' ? 'spectator' : 'player';
      this.leaveCurrentRoom(socket, req.roomCode);
      const { room } = this.rooms.join(req.roomCode, socket.data.user, role);
      return this.enter(socket, room);
    });
  }

  @SubscribeMessage('room:leave')
  leave(socket: AppSocket) {
    return this.handle(() => {
      const { roomCode } = this.requireSeat(socket);
      this.leaveRoom(socket, roomCode);
      return {};
    });
  }

  @SubscribeMessage('room:sit')
  sit(socket: AppSocket) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.sit(roomCode, playerId));
      return {};
    });
  }

  @SubscribeMessage('room:options')
  setOptions(socket: AppSocket, req: { options: unknown }) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.setOptions(roomCode, playerId, req?.options));
      return {};
    });
  }

  @SubscribeMessage('game:start')
  start(socket: AppSocket) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.start(roomCode, playerId));
      return {};
    });
  }

  @SubscribeMessage('game:restart')
  restart(socket: AppSocket) {
    return this.start(socket);
  }

  @SubscribeMessage('game:move')
  move(socket: AppSocket, req: { move: unknown }) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      this.broadcast(this.rooms.move(roomCode, playerId, req?.move));
      return {};
    });
  }

  @SubscribeMessage('dev:logs')
  devLogs(socket: AppSocket, req: { on: boolean }) {
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

  private stopDevLogs(socket: AppSocket) {
    socket.data.devLogOff?.();
    socket.data.devLogOff = undefined;
  }

  @SubscribeMessage('dev:command')
  devCommand(socket: AppSocket, req: { line: string }) {
    return this.handle(() => {
      this.requireDev();
      const { roomCode, playerId } = this.requireSeat(socket);
      return this.devConsole.execute(roomCode, playerId, req?.line, (room) => this.broadcast(room));
    });
  }

  @SubscribeMessage('dev:schema')
  devSchema(socket: AppSocket) {
    return this.handle(() => {
      this.requireDev();
      const { roomCode, playerId } = this.requireSeat(socket);
      return this.devConsole.schema(this.rooms.devRoom(roomCode, playerId));
    });
  }

  private requireDev() {
    if (!this.rooms.devEnabled) throw new RoomError('Server không bật chế độ dev');
  }

  private enter(socket: AppSocket, room: Room): JoinedRoom {
    const userId = socket.data.user.id;
    this.unwatchLobby(socket);
    this.stopDevLogs(socket);
    socket.data.roomCode = room.code;
    void socket.join(room.code);
    this.rooms.setConnected(room.code, userId, true);
    this.broadcast(room);
    return { roomCode: room.code, playerId: userId };
  }

  /** Before entering a room: quit the account's other room, if any. */
  private leaveCurrentRoom(socket: AppSocket, unlessCode?: string) {
    const current = this.rooms.roomOf(socket.data.user.id);
    if (current && current.code !== unlessCode?.toUpperCase()) this.leaveRoom(socket, current.code);
  }

  /**
   * The account quits the room. Its other sockets still showing the room are sent out
   * with `room:closed`; `socket` (the one asking) already knows.
   */
  private leaveRoom(socket: AppSocket, roomCode: string) {
    const userId = socket.data.user.id;
    const { room, closed } = this.rooms.leave(roomCode, userId);
    for (const s of this.socketsOf(userId)) {
      if (s.data.roomCode !== roomCode) continue;
      if (s !== socket) {
        s.emit('room:closed', { gameId: room.game.id, reason: 'Bạn đã rời phòng' });
      }
      this.stopDevLogs(s);
      void s.leave(roomCode);
      s.data.roomCode = undefined;
    }
    if (closed) this.disband(room);
    else this.broadcast(room);
  }

  private requireSeat(socket: AppSocket) {
    const { roomCode, user } = socket.data;
    if (!roomCode) throw new RoomError('Bạn chưa ở trong phòng nào');
    return { roomCode, playerId: user.id };
  }

  private socketsOf(userId: string) {
    return [...this.server.sockets.sockets.values()].filter((s) => s.data.user?.id === userId);
  }

  /** Sends everyone still in a deleted room back out, then refreshes the room list. */
  private disband(room: Room) {
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data.roomCode !== room.code) continue;
      socket.emit('room:closed', { gameId: room.game.id, reason: 'Phòng đã giải tán' });
      this.stopDevLogs(socket);
      void socket.leave(room.code);
      socket.data.roomCode = undefined;
    }
    this.broadcastLobby(room.game.id);
  }

  private broadcastLobby(gameId: string) {
    this.server
      .to(lobbyChannel(gameId))
      .emit('lobby:rooms', { gameId, rooms: this.rooms.list(gameId) });
  }

  private unwatchLobby(socket: AppSocket) {
    if (socket.data.lobby) void socket.leave(lobbyChannel(socket.data.lobby));
    socket.data.lobby = undefined;
  }

  /** Sends each member its own filtered snapshot, and the new room list to browsers. */
  private broadcast(room: Room) {
    // A timer the game just set goes into the snapshots, so screens can show the countdown.
    const timer = this.rooms.syncTimer(room);
    for (const socket of this.server.sockets.sockets.values()) {
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
      if (err instanceof RoomError || err instanceof AccountError) {
        return { ok: false, error: err.message };
      }
      console.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }
}
