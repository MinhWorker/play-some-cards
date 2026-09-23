import { useEffect, useState } from 'react';
import { socket } from './socket';

/** Delay before reporting "disconnected", so quick reconnects don't flash the banner. */
const GRACE_MS = 1500;

/** Whether the socket is connected. The hosted server sleeps when idle and can take ~30s to wake. */
export function useConnected() {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      clearTimeout(timer);
      setConnected(true);
    };
    const off = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setConnected(socket.connected), GRACE_MS);
    };
    if (!socket.connected) off();
    socket.on('connect', on);
    socket.on('disconnect', off);
    return () => {
      clearTimeout(timer);
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, []);
  return connected;
}
