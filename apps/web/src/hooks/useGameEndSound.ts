import type { JoinedRoom, RoomSnapshot } from '@xomdao/shared';
import { useEffect, useRef } from 'react';
import { useGameClient } from '@/hooks/useGameClient';
import { playSfx } from '@/lib/sound';

/**
 * Win/lose sound, only when a game ends while we watch it happen (not when rejoining a
 * finished room). Draws and spectators get no sound, nor games that show their own result.
 */
export function useGameEndSound(session: JoinedRoom | null, snapshot: RoomSnapshot | null) {
  const lastStatus = useRef(snapshot?.status);
  const showsResult = useGameClient(snapshot?.gameId ?? '')?.showsResult;
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = snapshot?.status;
    if (!session || !snapshot?.result || was !== 'playing' || showsResult) return;
    const { winners } = snapshot.result;
    const playing = snapshot.players.some((p) => p.id === session.playerId);
    if (!playing || winners.length === 0) return;
    playSfx(winners.includes(session.playerId) ? 'game-win' : 'game-lose');
  }, [session, snapshot, showsResult]);
}
