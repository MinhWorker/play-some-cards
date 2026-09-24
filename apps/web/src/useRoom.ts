import type { JoinedRoom, RoomSnapshot } from '@psc/shared';
import { useCallback, useEffect, useState } from 'react';
import { loadSession, saveSession } from './session';
import { request, socket } from './socket';

/**
 * Owns the connection to the current room: joining, leaving, rejoining and live state.
 * `onClosed` runs when the server disbands the room while we are in it.
 */
export function useRoom(onClosed: (info: { gameId: string; reason: string }) => void) {
  const [session, setSession] = useState<JoinedRoom | null>(loadSession);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);

  const enter = useCallback((joined: JoinedRoom) => {
    saveSession(joined);
    setSession(joined);
  }, []);

  const exit = useCallback(() => {
    saveSession(null);
    setSession(null);
    setSnapshot(null);
  }, []);

  useEffect(() => {
    const closed = (info: { gameId: string; reason: string }) => {
      exit();
      onClosed(info);
    };
    socket.on('room:state', setSnapshot);
    socket.on('room:closed', closed);
    return () => {
      socket.off('room:state', setSnapshot);
      socket.off('room:closed', closed);
    };
  }, [exit, onClosed]);

  // Rejoin on first load and after every reconnect (e.g. server restart, Wi-Fi drop).
  useEffect(() => {
    const rejoin = () => {
      const saved = loadSession();
      if (!saved) return;
      request('room:rejoin', { roomCode: saved.roomCode, sessionToken: saved.sessionToken }).catch(
        exit,
      );
    };
    if (socket.connected) rejoin();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
    };
  }, [exit]);

  const leave = useCallback(async () => {
    await request('room:leave', {}).catch(() => {});
    exit();
  }, [exit]);

  return { session, snapshot, enter, leave };
}
