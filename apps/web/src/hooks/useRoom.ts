import type { JoinedRoom, RoomSnapshot } from '@psc/shared';
import { useCallback, useEffect, useState } from 'react';
import { request, socket } from '@/lib/socket';

/**
 * Owns the current room: entering, leaving and live state. Which room you are in comes from
 * the server (useAccount's `onResume` calls `resume`), not from this browser.
 * `onClosed` runs when the server sends us out of the room (disbanded, or we left elsewhere).
 */
export function useRoom(onClosed: (info: { gameId: string; reason: string }) => void) {
  const [session, setSession] = useState<JoinedRoom | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);

  const exit = useCallback(() => {
    setSession(null);
    setSnapshot(null);
  }, []);

  // The server sends the room's `room:state` before answering, so the snapshot is already here.
  const enter = useCallback((joined: JoinedRoom) => setSession(joined), []);

  const resume = useCallback(
    (room: JoinedRoom | null) => (room ? enter(room) : exit()),
    [enter, exit],
  );

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

  const leave = useCallback(async () => {
    await request('room:leave', {}).catch(() => {});
    exit();
  }, [exit]);

  return { session, snapshot, enter, resume, leave };
}
