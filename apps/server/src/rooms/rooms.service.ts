import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type AnyGameDefinition,
  type GameResult,
  getGame,
  type PlayerId,
  type RoomSnapshot,
  type RoomStatus,
} from '@psc/shared';

export class RoomError extends Error {}

interface Player {
  id: PlayerId;
  name: string;
  sessionToken: string;
  connected: boolean;
}

export interface Room {
  code: string;
  game: AnyGameDefinition;
  hostId: PlayerId;
  players: Player[];
  status: RoomStatus;
  state: unknown;
  result: GameResult | null;
}

// No 0/O/1/I so codes are easy to read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rng = () => Math.random();

/**
 * All room and game state lives here, in memory. Restarting the server clears every room.
 * This class knows nothing about sockets; the gateway translates events into these calls.
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  create(gameId: string, name: string) {
    const game = getGame(gameId);
    if (!game) throw new RoomError(`Unknown game: ${gameId}`);
    const player = this.newPlayer(name);
    const room: Room = {
      code: this.newCode(),
      game,
      hostId: player.id,
      players: [player],
      status: 'lobby',
      state: null,
      result: null,
    };
    this.rooms.set(room.code, room);
    return { room, player };
  }

  join(code: string, name: string) {
    const room = this.get(code);
    if (room.status !== 'lobby') throw new RoomError('Game already started');
    if (room.players.length >= room.game.maxPlayers) throw new RoomError('Room is full');
    const player = this.newPlayer(name);
    room.players.push(player);
    return { room, player };
  }

  rejoin(code: string, sessionToken: string) {
    const room = this.get(code);
    const player = room.players.find((p) => p.sessionToken === sessionToken);
    if (!player) throw new RoomError('Session not found');
    player.connected = true;
    return { room, player };
  }

  setConnected(code: string, playerId: PlayerId, connected: boolean) {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.id === playerId);
    if (player) player.connected = connected;
    return room;
  }

  leave(code: string, playerId: PlayerId) {
    const room = this.get(code);
    if (room.status === 'playing') {
      // Keep the seat so the game can continue if they come back.
      this.setConnected(code, playerId, false);
      return room;
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return room;
    }
    if (room.hostId === playerId) room.hostId = room.players[0]!.id;
    return room;
  }

  start(code: string, playerId: PlayerId) {
    const room = this.get(code);
    if (room.hostId !== playerId) throw new RoomError('Only the host can start');
    if (room.status === 'playing') throw new RoomError('Game already started');
    const count = room.players.length;
    if (count < room.game.minPlayers) {
      throw new RoomError(`Need at least ${room.game.minPlayers} players`);
    }
    room.state = room.game.setup(
      room.players.map((p) => p.id),
      rng,
    );
    room.status = 'playing';
    room.result = null;
    return room;
  }

  move(code: string, playerId: PlayerId, rawMove: unknown) {
    const room = this.get(code);
    if (room.status !== 'playing') throw new RoomError('Game is not running');
    const parsed = room.game.moveSchema.safeParse(rawMove);
    if (!parsed.success) throw new RoomError('Invalid move');
    const error = room.game.validateMove(room.state, parsed.data, playerId);
    if (error) throw new RoomError(error);
    room.state = room.game.applyMove(room.state, parsed.data, playerId, rng);
    room.result = room.game.getResult(room.state);
    if (room.result) room.status = 'finished';
    return room;
  }

  /** What `playerId` is allowed to see. Never send `room.state` directly. */
  snapshotFor(room: Room, playerId: PlayerId): RoomSnapshot {
    return {
      code: room.code,
      gameId: room.game.id,
      hostId: room.hostId,
      players: room.players.map(({ id, name, connected }) => ({ id, name, connected })),
      status: room.status,
      view: room.state === null ? null : room.game.getView(room.state, playerId),
      result: room.result,
    };
  }

  /** Deletes rooms where nobody is connected. Called periodically by the gateway. */
  pruneEmptyRooms() {
    for (const [code, room] of this.rooms) {
      if (room.players.every((p) => !p.connected)) this.rooms.delete(code);
    }
  }

  private get(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('Room not found');
    return room;
  }

  private newPlayer(name: string): Player {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) throw new RoomError('Name is required');
    return {
      id: randomUUID(),
      name: trimmed,
      sessionToken: randomBytes(16).toString('hex'),
      connected: true,
    };
  }

  private newCode() {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
        '',
      );
    } while (this.rooms.has(code));
    return code;
  }
}
