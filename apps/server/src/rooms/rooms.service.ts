import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type AnyGameDefinition,
  type GameResult,
  getGame,
  type PlayerId,
  type RoomRole,
  type RoomScore,
  type RoomSnapshot,
  type RoomStatus,
  type RoomSummary,
} from '@psc/shared';

export class RoomError extends Error {}

/** Someone in a room: a seated player or a spectator. `id` is their account's user id. */
interface Member {
  id: PlayerId;
  name: string;
  connected: boolean;
}

/** The account entering a room (from the logged-in socket). */
export interface Account {
  id: string;
  name: string;
}

export interface Room {
  code: string;
  game: AnyGameDefinition;
  hostId: PlayerId | null;
  players: Member[];
  spectators: Member[];
  status: RoomStatus;
  state: unknown;
  result: GameResult | null;
  score: RoomScore;
  createdAt: number;
}

// No 0/O/1/I so codes are easy to read. Codes are internal ids; players pick rooms from a list.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rng = () => Math.random();

/**
 * All room and game state lives here, in memory. Restarting the server clears every room.
 * Each room belongs to one game; players browse a game's rooms with `list`.
 * This class knows nothing about sockets; the gateway translates events into these calls.
 * Members are accounts, and an account is in at most one room: the gateway makes a player
 * leave their old room before entering another one (see `roomOf`).
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  create(gameId: string, account: Account) {
    const game = getGame(gameId);
    if (!game) throw new RoomError(`Không có game: ${gameId}`);
    const player = this.newMember(account);
    const room: Room = {
      code: this.newCode(),
      game,
      hostId: player.id,
      players: [player],
      spectators: [],
      status: 'lobby',
      state: null,
      result: null,
      score: { wins: Array(game.maxPlayers).fill(0), draws: 0 },
      createdAt: Date.now(),
    };
    this.rooms.set(room.code, room);
    return { room, player };
  }

  /** Rooms of one game that someone is still in: open seats first, then oldest first. */
  list(gameId: string): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.game.id === gameId && this.members(room).some((m) => m.connected))
      .map((room) => this.summary(room))
      .sort((a, b) => Number(b.canJoin) - Number(a.canJoin));
  }

  /** Joining a room you are already in just puts you back in your place. */
  join(code: string, account: Account, role: RoomRole) {
    const room = this.get(code);
    const existing = this.members(room).find((m) => m.id === account.id);
    if (existing) {
      existing.connected = true;
      return { room, player: existing };
    }
    if (role === 'player') this.assertSeatFree(room);
    const member = this.newMember(account);
    if (role === 'player') {
      room.players.push(member);
      room.hostId ??= member.id;
    } else {
      room.spectators.push(member);
    }
    return { room, player: member };
  }

  /** A spectator moves to a free seat. */
  sit(code: string, memberId: PlayerId) {
    const room = this.get(code);
    const member = room.spectators.find((m) => m.id === memberId);
    if (!member) throw new RoomError('Bạn đã là người chơi rồi');
    this.assertSeatFree(room);
    room.spectators = room.spectators.filter((m) => m !== member);
    room.players.push(member);
    room.hostId ??= member.id;
    return room;
  }

  /** The room this account is in, if any. */
  roomOf(userId: string) {
    for (const room of this.rooms.values()) {
      if (this.members(room).some((m) => m.id === userId)) return room;
    }
    return undefined;
  }

  /** The account changed its display name: update it in its room (returned, if any). */
  rename(userId: string, name: string) {
    const room = this.roomOf(userId);
    const member = room && this.members(room).find((m) => m.id === userId);
    if (member) member.name = name;
    return room;
  }

  setConnected(code: string, memberId: PlayerId, connected: boolean) {
    const room = this.rooms.get(code);
    const member = room && this.members(room).find((m) => m.id === memberId);
    if (member) member.connected = connected;
    return room;
  }

  /**
   * A member leaves on purpose (a dropped connection only marks them offline, see
   * setConnected, so they can rejoin). A player leaving mid-game cancels that game, and after a
   * game the room goes back to waiting for players (the old board is gone). The next
   * player becomes host; with no players left the room is disbanded (`closed: true`) and the
   * caller must send the spectators out.
   */
  leave(code: string, memberId: PlayerId) {
    const room = this.get(code);
    const isPlayer = room.players.some((p) => p.id === memberId);
    room.players = room.players.filter((p) => p.id !== memberId);
    room.spectators = room.spectators.filter((m) => m.id !== memberId);
    if (isPlayer && room.status !== 'lobby') {
      room.status = 'lobby';
      room.state = null;
      room.result = null;
    }
    if (room.hostId === memberId) room.hostId = room.players[0]?.id ?? null;
    const closed = room.players.length === 0;
    if (closed) this.rooms.delete(code);
    return { room, closed };
  }

  start(code: string, playerId: PlayerId) {
    const room = this.get(code);
    if (room.hostId !== playerId) throw new RoomError('Chỉ chủ phòng mới bắt đầu được');
    if (room.status === 'playing') throw new RoomError('Ván đã bắt đầu');
    const count = room.players.length;
    if (count < room.game.minPlayers) {
      throw new RoomError(`Cần ít nhất ${room.game.minPlayers} người chơi`);
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
    if (!room.players.some((p) => p.id === playerId)) {
      throw new RoomError('Bạn đang xem, không đi được');
    }
    if (room.status !== 'playing') throw new RoomError('Ván chưa bắt đầu');
    const parsed = room.game.moveSchema.safeParse(rawMove);
    if (!parsed.success) throw new RoomError('Nước đi không hợp lệ');
    const error = room.game.validateMove(room.state, parsed.data, playerId);
    if (error) throw new RoomError(error);
    room.state = room.game.applyMove(room.state, parsed.data, playerId, rng);
    room.result = room.game.getResult(room.state);
    if (room.result) {
      room.status = 'finished';
      this.addToScore(room, room.result);
    }
    return room;
  }

  /** What `memberId` is allowed to see. Never send `room.state` directly. */
  snapshotFor(room: Room, memberId: PlayerId): RoomSnapshot {
    const isPlayer = room.players.some((p) => p.id === memberId);
    const info = ({ id, name, connected }: Member) => ({ id, name, connected });
    return {
      code: room.code,
      gameId: room.game.id,
      hostId: room.hostId,
      players: room.players.map(info),
      spectators: room.spectators.map(info),
      status: room.status,
      view: room.state === null ? null : room.game.getView(room.state, isPlayer ? memberId : null),
      result: room.result,
      score: room.score,
    };
  }

  /** Deletes rooms where nobody is connected. Called periodically by the gateway. */
  pruneEmptyRooms() {
    for (const [code, room] of this.rooms) {
      if (this.members(room).every((m) => !m.connected)) this.rooms.delete(code);
    }
  }

  /** Counts a finished game for the winners' seats (or as a draw). */
  private addToScore(room: Room, result: GameResult) {
    if (result.winners.length === 0) room.score.draws++;
    for (const id of result.winners) {
      const seat = room.players.findIndex((p) => p.id === id);
      if (seat >= 0) room.score.wins[seat] = (room.score.wins[seat] ?? 0) + 1;
    }
  }

  private summary(room: Room): RoomSummary {
    const host = room.players.find((p) => p.id === room.hostId);
    return {
      code: room.code,
      hostName: host?.name ?? '?',
      players: room.players.length,
      maxPlayers: room.game.maxPlayers,
      spectators: room.spectators.filter((m) => m.connected).length,
      status: room.status,
      canJoin: this.seatError(room) === null,
    };
  }

  private seatError(room: Room) {
    if (room.status === 'playing') return 'Ván đang chơi, bạn có thể vào xem';
    if (room.players.length >= room.game.maxPlayers) return 'Phòng đã đủ người, bạn có thể vào xem';
    return null;
  }

  private assertSeatFree(room: Room) {
    const error = this.seatError(room);
    if (error) throw new RoomError(error);
  }

  private members(room: Room) {
    return [...room.players, ...room.spectators];
  }

  private get(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('Phòng không còn nữa');
    return room;
  }

  private newMember(account: Account): Member {
    return { id: account.id, name: account.name, connected: true };
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
