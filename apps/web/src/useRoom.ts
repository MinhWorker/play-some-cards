import type { JoinedRoom, RoomSnapshot } from '@psc/shared';
import { useCallback, useEffect, useState } from 'react';
import { loadSession, saveSession } from './session';
import { request, socket } from './socket';

/** Owns the connection to the current room: joining, leaving, rejoining and live state. */
export function useRoom() {
  const [session, setSession] = useState<JoinedRoom | null>(loadSession);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);

  const enter = useCallback((joined: JoinedRoom) => {
    saveSession(joined);
    setSession(joined);
    const url = new URL(window.location.href);
    url.searchParams.set('room', joined.roomCode);
    window.history.replaceState(null, '', url);
  }, []);

  const exit = useCallback(() => {
    saveSession(null);
    setSession(null);
    setSnapshot(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  }, []);

  useEffect(() => {
    socket.on('room:state', setSnapshot);
    return () => {
      socket.off('room:state', setSnapshot);
    };
  }, []);

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
