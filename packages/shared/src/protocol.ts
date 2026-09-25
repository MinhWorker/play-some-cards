import type { ProfileUpdate, User } from './account.js';
import type { GameResult, PlayerId } from './game.js';

/**
 * Socket.IO contract between web and server. Both sides import these types,
 * so changing an event here makes TypeScript point at every place to update.
 * The socket only connects when logged in: the client passes `auth: { token }` (from
 * POST /api/auth/login or /register) and the server refuses the connection otherwise.
 */

/**
 * Bump this whenever a change here breaks older clients or servers (renamed/removed events,
 * changed payloads). Web and server deploy separately, so they compare it on connect: the
 * client sends it in `auth.protocol`, and the server refuses a mismatch with
 * `PROTOCOL_MISMATCH` (the error's `data.protocol` is the server's version). CI fails when this
 * file changes without a bump, unless the PR has the `protocol:compatible` label.
 */
export const PROTOCOL_VERSION = 1;

/** `connect_error` message when the client's PROTOCOL_VERSION differs from the server's. */
export const PROTOCOL_MISMATCH = 'protocol-mismatch';

/** What the client passes as Socket.IO `auth` when connecting. */
export interface HandshakeAuth {
  token: string;
  protocol: number;
}

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  connected: boolean;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/** Players take a seat (limited to the game's maxPlayers); spectators only watch (no limit). */
export type RoomRole = 'player' | 'spectator';

/**
 * Wins per seat (seat = position in `players`, e.g. Caro seat 0 is red X, seat 1 blue O) and
 * draws, counted over every game played in the room. Only reset when the room is disbanded.
 */
export interface RoomScore {
  wins: number[];
  draws: number;
}

/** What one specific member sees of a room. `view` is already filtered by `getView`. */
export interface RoomSnapshot {
  code: string;
  gameId: string;
  /** `null` when every seat is empty (only spectators left); the next to sit becomes host. */
  hostId: PlayerId | null;
  players: PlayerInfo[];
  spectators: PlayerInfo[];
  status: RoomStatus;
  view: unknown;
  result: GameResult | null;
  score: RoomScore;
}

/** One row in a game's room list. */
export interface RoomSummary {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  /** Connected spectators. */
  spectators: number;
  status: RoomStatus;
  /** True when a new player can take a seat right now. */
  canJoin: boolean;
}

/** Every request gets either `{ ok: true, ...data }` or `{ ok: false, error }`. */
export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface JoinedRoom {
  roomCode: string;
  /** Your member id in the room: your account's user id. */
  playerId: PlayerId;
}

export interface ClientToServerEvents {
  /**
   * Sent after every (re)connect: who you are, and the room your account is in (if any). Being
   * in a room follows the account, not the browser: closing the tab and logging in anywhere
   * puts you back in your seat. An account is in at most one room.
   */
  'session:resume': (
    req: Record<string, never>,
    ack: Ack<{ user: User; room: JoinedRoom | null }>,
  ) => void;
  /** Change display name and avatar (also updates your name in your current room). */
  'profile:update': (req: ProfileUpdate, ack: Ack<{ user: User }>) => void;
  /** Subscribe to a game's room list; the server then pushes 'lobby:rooms' on every change. */
  'lobby:watch': (req: { gameId: string }, ack: Ack<{ rooms: RoomSummary[] }>) => void;
  'lobby:unwatch': (req: Record<string, never>, ack: Ack) => void;
  /** Creating or joining a room first leaves the room you were in (if it is another one). */
  'room:create': (req: { gameId: string }, ack: Ack<JoinedRoom>) => void;
  'room:join': (req: { roomCode: string; role: RoomRole }, ack: Ack<JoinedRoom>) => void;
  /**
   * A player leaving mid-game cancels that game; during or after a game the room goes back
   * to the lobby. When the host leaves, the next
   * player becomes host; when no player is left, the room is disbanded ('room:closed').
   */
  'room:leave': (req: Record<string, never>, ack: Ack) => void;
  /** A spectator takes a free seat (only before the game starts or after it ends). */
  'room:sit': (req: Record<string, never>, ack: Ack) => void;
  'game:start': (req: Record<string, never>, ack: Ack) => void;
  'game:move': (req: { move: unknown }, ack: Ack) => void;
  'game:restart': (req: Record<string, never>, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'lobby:rooms': (update: { gameId: string; rooms: RoomSummary[] }) => void;
  /** The room was disbanded (no players left); everyone still inside is sent out. */
  'room:closed': (info: { gameId: string; reason: string }) => void;
}
