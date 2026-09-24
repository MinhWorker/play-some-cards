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
  PlayerId,
  RoomRole,
  ServerToClientEvents,
} from '@psc/shared';
import type { Server, Socket } from 'socket.io';
import { type Room, RoomError, RoomsService } from './rooms.service.js';

interface SocketData {
  roomCode?: string;
  playerId?: PlayerId;
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
 */
@WebSocketGateway({ cors: { origin: true } })
export class RoomsGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server!: AppServer;

  constructor(private readonly rooms: RoomsService) {}

  afterInit() {
    setInterval(() => this.rooms.pruneEmptyRooms(), PRUNE_INTERVAL_MS).unref();
  }

  handleDisconnect(socket: AppSocket) {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return;
    const room = this.rooms.setConnected(roomCode, playerId, false);
    if (room) this.broadcast(room);
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
  create(socket: AppSocket, req: { gameId: string; name: string }) {
    return this.handle(() => {
      const { room, player } = this.rooms.create(req.gameId, req.name);
      return this.enter(socket, room, player);
    });
  }

  @SubscribeMessage('room:join')
  join(socket: AppSocket, req: { roomCode: string; name: string; role: RoomRole }) {
    return this.handle(() => {
      const role = req.role === 'spectator' ? 'spectator' : 'player';
      const { room, player } = this.rooms.join(req.roomCode, req.name, role);
      return this.enter(socket, room, player);
    });
  }

  @SubscribeMessage('room:rejoin')
  rejoin(socket: AppSocket, req: { roomCode: string; sessionToken: string }) {
    return this.handle(() => {
      const { room, player } = this.rooms.rejoin(req.roomCode, req.sessionToken);
      return this.enter(socket, room, player);
    });
  }

  @SubscribeMessage('room:leave')
  leave(socket: AppSocket) {
    return this.handle(() => {
      const { roomCode, playerId } = this.requireSeat(socket);
      const { room, closed } = this.rooms.leave(roomCode, playerId);
      void socket.leave(roomCode);
      socket.data = {};
      if (closed) this.disband(room);
      else this.broadcast(room);
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

  private enter(
    socket: AppSocket,
    room: Room,
    player: { id: PlayerId; sessionToken: string },
  ): JoinedRoom {
    this.unwatchLobby(socket);
    socket.data = { roomCode: room.code, playerId: player.id };
    void socket.join(room.code);
    this.broadcast(room);
    return { roomCode: room.code, playerId: player.id, sessionToken: player.sessionToken };
  }

  private requireSeat(socket: AppSocket) {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) throw new RoomError('Bạn chưa ở trong phòng nào');
    return { roomCode, playerId };
  }

  /** Sends everyone still in a deleted room back out, then refreshes the room list. */
  private disband(room: Room) {
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data.roomCode !== room.code) continue;
      socket.emit('room:closed', { gameId: room.game.id, reason: 'Phòng đã giải tán' });
      void socket.leave(room.code);
      socket.data = {};
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
      const { roomCode, playerId } = socket.data;
      if (roomCode === room.code && playerId) {
        socket.emit('room:state', this.rooms.snapshotFor(room, playerId));
      }
    }
    this.broadcastLobby(room.game.id);
  }

  private handle(fn: () => object): Result {
    try {
      return { ok: true, ...fn() };
    } catch (err) {
      if (err instanceof RoomError) return { ok: false, error: err.message };
      console.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }
}
