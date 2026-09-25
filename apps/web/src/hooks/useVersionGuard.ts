import { PROTOCOL_MISMATCH, PROTOCOL_VERSION } from '@psc/shared';
import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

/**
 * `newer`: the server was updated and this page is old, so it reloads (once a minute at most, in
 * case the web host still serves the old page). `older`: this page is newer than the server,
 * which is still deploying; the socket keeps retrying until it catches up.
 */
export type VersionState = 'ok' | 'newer' | 'older';

const RELOAD_KEY = 'psc.versionReload';
const RELOAD_EVERY_MS = 60_000;
const RELOAD_DELAY_MS = 1500;

/** Watches for a server that speaks another PROTOCOL_VERSION (web and server deploy separately). */
export function useVersionGuard() {
  const [state, setState] = useState<VersionState>('ok');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refused = (err: Error & { data?: { protocol?: number } }) => {
      if (err.message !== PROTOCOL_MISMATCH) return;
      const server = err.data?.protocol ?? 0;
      if (server < PROTOCOL_VERSION) return setState('older');
      setState('newer');
      if (!canReload()) return;
      timer = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    };
    const connected = () => setState('ok');
    socket.on('connect_error', refused);
    socket.on('connect', connected);
    return () => {
      clearTimeout(timer);
      socket.off('connect_error', refused);
      socket.off('connect', connected);
    };
  }, []);

  return state;
}

function canReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_EVERY_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {}
  return true;
}
