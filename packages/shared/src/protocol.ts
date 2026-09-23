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

/** What one specific player sees of a room. `view` is already filtered by `getView`. */
export interface RoomSnapshot {
  code: string;
  gameId: string;
  hostId: PlayerId;
  players: PlayerInfo[];
  status: RoomStatus;
  view: unknown;
  result: GameResult | null;
}

/** Every request gets either `{ ok: true, ...data }` or `{ ok: false, error }`. */
export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface JoinedRoom {
  roomCode: string;
  playerId: PlayerId;
  /** Store this in the browser and send it back to rejoin after a refresh. */
  sessionToken: string;
}

export interface ClientToServerEvents {
  'room:create': (req: { gameId: string; name: string }, ack: Ack<JoinedRoom>) => void;
  'room:join': (req: { roomCode: string; name: string }, ack: Ack<JoinedRoom>) => void;
  'room:rejoin': (req: { roomCode: string; sessionToken: string }, ack: Ack<JoinedRoom>) => void;
  'room:leave': (req: Record<string, never>, ack: Ack) => void;
  'game:start': (req: Record<string, never>, ack: Ack) => void;
  'game:move': (req: { move: unknown }, ack: Ack) => void;
  'game:restart': (req: Record<string, never>, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
}
