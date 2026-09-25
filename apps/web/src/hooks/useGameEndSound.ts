import type { JoinedRoom, RoomSnapshot } from '@psc/shared';
import { useEffect, useRef } from 'react';
import { playSfx } from '@/lib/sound';

/**
 * Win/lose sound, only when a game ends while we watch it happen (not when rejoining a
 * finished room). Draws and spectators get no sound.
 */
export function useGameEndSound(session: JoinedRoom | null, snapshot: RoomSnapshot | null) {
  const lastStatus = useRef(snapshot?.status);
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = snapshot?.status;
    if (!session || !snapshot?.result || was !== 'playing') return;
    const { winners } = snapshot.result;
    const playing = snapshot.players.some((p) => p.id === session.playerId);
    if (!playing || winners.length === 0) return;
    playSfx(winners.includes(session.playerId) ? 'game-win' : 'game-lose');
  }, [session, snapshot]);
}
