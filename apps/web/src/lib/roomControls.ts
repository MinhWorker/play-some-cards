import type { RoomControls } from '@xomdao/sdk/client';
import { games, type RoomSnapshot } from '@xomdao/shared';

/**
 * What `me` may do with the room right now: the room panels' buttons, and `ctx.room` for a board
 * that draws its own (`hud` in its client.ts). `hasSetup`: the game has a setup screen.
 */
export function roomControls(snapshot: RoomSnapshot, me: string, hasSetup: boolean): RoomControls {
  const isHost = snapshot.hostId === me;
  const between = snapshot.status !== 'playing';
  const seated = snapshot.players.some((p) => p.id === me);
  const seatFree = snapshot.players.length < (games[snapshot.gameId]?.maxPlayers ?? 0);
  return {
    newGame: isHost && Boolean(snapshot.result),
    customize: isHost && hasSetup && between,
    sit: !seated && between && seatFree,
    watchers: snapshot.spectators.filter((s) => s.connected).length,
  };
}
