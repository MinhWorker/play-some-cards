import type { GameResult, PlayerId } from './game.js';

/**
 * Socket.IO contract between web and server. Both sides import these types,
 * so changing an event here makes TypeScript point at every place to update.
 */

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
  /** Your member id (a player's id in the game, or a spectator's id). */
  playerId: PlayerId;
  /** Store this in the browser and send it back to rejoin after a refresh. */
  sessionToken: string;
}

export interface ClientToServerEvents {
  /** Subscribe to a game's room list; the server then pushes 'lobby:rooms' on every change. */
  'lobby:watch': (req: { gameId: string }, ack: Ack<{ rooms: RoomSummary[] }>) => void;
  'lobby:unwatch': (req: Record<string, never>, ack: Ack) => void;
  'room:create': (req: { gameId: string; name: string }, ack: Ack<JoinedRoom>) => void;
  'room:join': (
    req: { roomCode: string; name: string; role: RoomRole },
    ack: Ack<JoinedRoom>,
  ) => void;
  'room:rejoin': (req: { roomCode: string; sessionToken: string }, ack: Ack<JoinedRoom>) => void;
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
