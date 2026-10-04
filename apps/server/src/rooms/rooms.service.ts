import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  type AnyGameDefinition,
  defaultOptions,
  type GameResult,
  getGame,
  type PlayerId,
  type RoomRole,
  type RoomScore,
  type RoomSnapshot,
  type RoomStatus,
  type RoomSummary,
} from '@psc/shared';

import { DEV_MODE } from '../dev/dev-mode.js';
import { newRoomDev, type RoomDev, remember, rngOf } from '../dev/room-dev.js';

export class RoomError extends Error {}

/** Someone in a room: a seated player or a spectator. `id` is their account's user id. */
interface Member {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Played by the computer (`game.bot`). Bots don't keep a room alive and are never host. */
  bot?: boolean;
  avatar?: string;
}

/** The account entering a room (from the logged-in socket). */
export interface Account {
  id: string;
  name: string;
  avatar?: string;
}

export interface Room {
  code: string;
  game: AnyGameDefinition;
  /** Settings picked when the room was created (`game.room`), passed to `setup` and `bot`. */
  options: unknown;
  hostId: PlayerId | null;
  players: Member[];
  spectators: Member[];
  status: RoomStatus;
  state: unknown;
  result: GameResult | null;
  /** How the game before the current one ended (`ctx.lastResult`). */
  lastResult: GameResult | null;
  score: RoomScore;
  /** Games started so far. */
  round: number;
  /** The last move of the current game. */
  last: { seq: number; player: PlayerId; move: unknown } | null;
  /** The game's pending timer (`ctx.setTimer`), once the gateway has started it. */
  timer: { key: string; event: string; ms: number; endsAt: number } | null;
  /** When the current (or last) game began and ended (`null` while it runs). */
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  /** Available only when the server starts with PSC_DEV=1. */
  dev?: RoomDev;
}

// No 0/O/1/I so codes are easy to read. Codes are internal ids; players pick rooms from a list.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

  constructor(@Optional() @Inject(DEV_MODE) readonly devEnabled = false) {
    if (devEnabled) new Logger('DevConsole').warn('PSC_DEV=1: Dev Console đang bật');
  }

  /** Dev requests require an actual member, including spectators. */
  devRoom(code: string, memberId: string) {
    if (!this.devEnabled) throw new RoomError('Server không bật chế độ dev');
    const room = this.get(code);
    if (!this.members(room).some((m) => m.id === memberId))
      throw new RoomError('Bạn chưa ở trong phòng này');
    return room;
  }

  /** `options` come from the game's setup screen, checked by `game.room.options`. */
  create(gameId: string, account: Account, rawOptions?: unknown) {
    const game = getGame(gameId);
    if (!game) throw new RoomError(`Không có game: ${gameId}`);
    const options = this.roomOptions(game, rawOptions);
    const player = this.newMember(account);
    const bots = this.newBots(this.botCount(game, options));
    const room: Room = {
      code: this.newCode(),
      game,
      options,
      hostId: player.id,
      players: [player, ...bots],
      spectators: [],
      status: 'lobby',
      state: null,
      result: null,
      lastResult: null,
      score: { wins: Array(game.maxPlayers).fill(0), draws: 0 },
      round: 0,
      last: null,
      timer: null,
      startedAt: null,
      endedAt: null,
      createdAt: Date.now(),
      ...(this.devEnabled && { dev: newRoomDev() }),
    };
    this.rooms.set(room.code, room);
    return { room, player };
  }

  /** Rooms of one game that someone is still in: open seats first, then oldest first. */
  list(gameId: string): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.game.id === gameId && this.humans(room).some((m) => m.connected))
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

  /** The account changed its name or picture: update it in its room (returned, if any). */
  rename(userId: string, { name, avatar }: { name: string; avatar?: string }) {
    const room = this.roomOf(userId);
    const member = room && this.members(room).find((m) => m.id === userId);
    if (member) Object.assign(member, { name, avatar });
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
   * setConnected, so they can rejoin). A player leaving mid-game loses it in a game with an
   * `onLeave` hook (the others play on, and a finished board stays up); in any other game it
   * cancels the game for everyone and the room waits for players again. The next player
   * becomes host; with no players left the room is
   * disbanded (`closed: true`) and the caller must send the spectators out.
   */
  leave(code: string, memberId: PlayerId) {
    const room = this.get(code);
    remember(room);
    const seat = room.players.findIndex((p) => p.id === memberId);
    room.players = room.players.filter((p) => p.id !== memberId);
    room.spectators = room.spectators.filter((m) => m.id !== memberId);
    if (seat >= 0 && room.status !== 'lobby') {
      room.lastResult = null;
      if (room.game.leave) {
        // The others play on (a finished board stays up).
        if (room.status === 'playing') {
          room.state = room.game.leave(room.state, memberId, rngOf(room), this.context(room));
          this.settle(room);
        }
      } else {
        room.status = 'lobby';
        room.state = null;
        room.result = null;
        room.last = null;
        room.timer = null;
      }
    }
    if (room.hostId === memberId) room.hostId = room.players.find((p) => !p.bot)?.id ?? null;
    // Bots don't play alone.
    const closed = room.players.every((p) => p.bot);
    if (closed) this.rooms.delete(code);
    return { room, closed };
  }

  /**
   * The host changes the room's options between games (see `room:options`). When they ask for
   * a different number of computer seats, bots join or leave; with other opponents the score and
   * the old board start over.
   */
  setOptions(code: string, playerId: PlayerId, rawOptions: unknown) {
    const room = this.get(code);
    if (room.hostId !== playerId) throw new RoomError('Chỉ chủ phòng mới đổi được');
    if (room.status === 'playing') throw new RoomError('Đợi hết ván rồi đổi nhé');
    if (!room.game.room) throw new RoomError('Game này không có tuỳ chọn');
    const options = this.roomOptions(room.game, rawOptions ?? {});
    const wanted = this.botCount(room.game, options);
    if (wanted !== room.players.filter((p) => p.bot).length) {
      const humans = room.players.filter((p) => !p.bot);
      if (humans.length + wanted > room.game.maxPlayers) {
        throw new RoomError('Phòng đủ người rồi, không thêm máy được');
      }
      room.players = [...humans, ...this.newBots(wanted)];
      room.score = { wins: Array(room.game.maxPlayers).fill(0), draws: 0 };
      room.status = 'lobby';
      room.state = null;
      room.result = null;
      room.lastResult = null;
      room.last = null;
      room.timer = null;
    }
    room.options = options;
    return room;
  }

  start(code: string, playerId: PlayerId) {
    const room = this.get(code);
    if (room.hostId !== playerId) throw new RoomError('Chỉ chủ phòng mới bắt đầu được');
    if (room.status === 'playing') throw new RoomError('Ván đã bắt đầu');
    const count = room.players.length;
    if (count < room.game.minPlayers) {
      throw new RoomError(`Cần ít nhất ${room.game.minPlayers} người chơi`);
    }
    remember(room);
    room.lastResult = room.result;
    room.state = room.game.setup(
      room.players.map((p) => p.id),
      rngOf(room),
      room.options,
      this.context(room),
    );
    room.status = 'playing';
    room.result = null;
    room.startedAt = Date.now();
    room.endedAt = null;
    room.round++;
    room.last = null;
    room.timer = null;
    this.settle(room);
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
    const context = this.context(room);
    const error = room.game.validateMove(room.state, parsed.data, playerId, context);
    if (error) throw new RoomError(error);
    remember(room);
    room.state = room.game.applyMove(room.state, parsed.data, playerId, rngOf(room), context);
    room.last = { seq: (room.last?.seq ?? 0) + 1, player: playerId, move: parsed.data };
    this.settle(room);
    return room;
  }

  /**
   * The game's timer, if it set a new one since the last call: the gateway waits `ms`, then
   * calls `fireTimer(code, key)`. Returns `null` when there is nothing new to wait for.
   */
  syncTimer(room: Room) {
    const timer = room.status === 'playing' ? room.game.timer(room.state) : null;
    if (!timer) {
      room.timer = null;
      return null;
    }
    const key = `${room.round}:${timer.id}`;
    if (room.timer?.key === key) return null;
    const ms = room.dev?.remaining ?? timer.ms;
    if (room.dev) room.dev.remaining = room.dev.timerPaused ? ms : null;
    room.timer = { key, event: timer.event, ms: timer.ms, endsAt: Date.now() + ms };
    return room.dev?.timerPaused ? null : { key, ms };
  }

  /** The timer `key` went off: runs its hook. Returns the room, or `null` if it's outdated. */
  fireTimer(code: string, key: string) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing' || room.timer?.key !== key) return null;
    remember(room);
    room.timer = null;
    if (room.dev) room.dev.remaining = null;
    room.state = room.game.fireTimer(room.state, rngOf(room), this.context(room));
    this.settle(room);
    return room;
  }

  /** After the game's state changed: is it over? */
  settle(room: Room) {
    room.result = room.game.getResult(room.state, this.context(room));
    if (room.result && room.status === 'playing') {
      room.status = 'finished';
      room.timer = null;
      room.endedAt = Date.now();
      this.addToScore(room, room.result);
    }
  }

  /**
   * The first computer seat with something to do makes its move. Returns the room when a move
   * was made, `null` otherwise (no bot's turn, game over, room gone). The gateway calls it after
   * a short pause following every change.
   */
  botMove(code: string, step = false) {
    const room = this.rooms.get(code);
    if (!room?.game.bot || room.status !== 'playing' || (room.dev?.botsPaused && !step))
      return null;
    for (const seat of room.players) {
      if (!seat.bot) continue;
      const move = room.game.bot(
        room.state,
        seat.id,
        rngOf(room),
        room.options,
        this.context(room),
      );
      if (move !== null) return this.move(code, seat.id, move);
    }
    return null;
  }

  /** What `memberId` is allowed to see. Never send `room.state` directly. */
  snapshotFor(room: Room, memberId: PlayerId): RoomSnapshot {
    const isPlayer = room.players.some((p) => p.id === memberId);
    const info = ({ id, name, connected, bot, avatar }: Member) => ({
      id,
      name,
      connected,
      ...(bot && { bot }),
      ...(avatar && { avatar }),
    });
    return {
      code: room.code,
      gameId: room.game.id,
      hostId: room.hostId,
      players: room.players.map(info),
      spectators: room.spectators.map(info),
      seats:
        room.state === null
          ? null
          : room.game.seats(room.state, this.context(room)).map((p) => ({
              id: p.id,
              name: p.name,
              connected: p.bot || Boolean(room.players.find((m) => m.id === p.id)?.connected),
              ...(p.bot && { bot: true }),
              ...(p.avatar && { avatar: p.avatar }),
              ...(p.left && { left: true }),
            })),
      status: room.status,
      view:
        room.state === null
          ? null
          : room.game.getView(room.state, isPlayer ? memberId : null, this.context(room)),
      result: room.result,
      score: room.score,
      options: room.options,
      round: room.round,
      last: room.last && {
        ...room.last,
        move: room.game.moveView
          ? room.game.moveView(room.last.move, room.last.player, isPlayer ? memberId : null)
          : room.last.move,
      },
      timer: room.timer && {
        event: room.timer.event,
        ms: room.timer.ms,
        left: room.dev?.timerPaused
          ? (room.dev.remaining ?? room.timer.ms)
          : Math.max(0, room.timer.endsAt - Date.now()),
      },
      played:
        room.status === 'lobby' || room.startedAt === null
          ? null
          : {
              ms: (room.endedAt ?? Date.now()) - room.startedAt,
              running: room.endedAt === null,
            },
    };
  }

  /** Deletes rooms where nobody is connected. Called periodically by the gateway. */
  pruneEmptyRooms() {
    for (const [code, room] of this.rooms) {
      if (this.humans(room).every((m) => !m.connected)) this.rooms.delete(code);
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

  private humans(room: Room) {
    return this.members(room).filter((m) => !m.bot);
  }

  private newBots(count: number): Member[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `bot:${i + 1}`,
      name: count > 1 ? `Máy ${i + 1}` : 'Máy',
      connected: true,
      bot: true,
    }));
  }

  /** What the rules get to know about the room around the game. */
  context(room: Room) {
    return {
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        bot: Boolean(p.bot),
        avatar: p.avatar,
      })),
      hostId: room.hostId,
      score: room.score,
      options: room.options,
      lastResult: room.lastResult,
    };
  }

  /** Seats the computer takes with these options. */
  private botCount(game: AnyGameDefinition, options: unknown) {
    return game.bot ? Math.min(game.room?.bots?.(options) ?? 0, game.maxPlayers - 1) : 0;
  }

  private roomOptions(game: AnyGameDefinition, raw: unknown) {
    if (!game.room) return undefined;
    if (raw === undefined) return defaultOptions(game);
    const parsed = game.room.options.safeParse(raw);
    if (!parsed.success) throw new RoomError('Tuỳ chọn phòng không hợp lệ');
    return parsed.data;
  }

  private get(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('Phòng không còn nữa');
    return room;
  }

  private newMember(account: Account): Member {
    return { id: account.id, name: account.name, avatar: account.avatar, connected: true };
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
