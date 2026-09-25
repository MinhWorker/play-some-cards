import {
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  ClientToServerEvents,
  JoinedRoom,
  RoomRole,
  ServerToClientEvents,
  User,
} from '@psc/shared';
import type { Server, Socket } from 'socket.io';
import { AccountError, AccountsService } from '../accounts/accounts.service.js';
import { type Room, RoomError, RoomsService } from './rooms.service.js';

interface SocketData {
  /** Set by the auth middleware; every connected socket is logged in. */
  user: User;
  /** The room this socket shows. Your member id in it is `user.id`. */
  roomCode?: string;
  /** Game whose room list this socket is watching. */
  lobby?: string;
}

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type Result = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

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

  constructor(
    private readonly rooms: RoomsService,
    private readonly accounts: AccountsService,
  ) {}

  afterInit(server: AppServer) {
    // The client sees a refused connection as `connect_error` with this message.
    server.use((socket, next) => {
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
      const room = this.rooms.rename(user.id, user.name);
      if (room) this.broadcast(room);
      return { user };
    });
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
  create(socket: AppSocket, req: { gameId: string }) {
    return this.handle(() => {
      this.leaveCurrentRoom(socket);
      const { room } = this.rooms.create(req.gameId, socket.data.user);
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

  private enter(socket: AppSocket, room: Room): JoinedRoom {
    const userId = socket.data.user.id;
    this.unwatchLobby(socket);
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
    for (const socket of this.server.sockets.sockets.values()) {
      const { roomCode, user } = socket.data;
      if (roomCode === room.code && user) {
        socket.emit('room:state', this.rooms.snapshotFor(room, user.id));
      }
    }
    this.broadcastLobby(room.game.id);
  }

  private async handle(fn: () => object | Promise<object>): Promise<Result> {
    try {
      return { ok: true, ...(await fn()) };
    } catch (err) {
      if (err instanceof RoomError || err instanceof AccountError) {
        return { ok: false, error: err.message };
      }
      console.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }
}
