import type { JoinedRoom } from '@psc/shared';

const KEY = 'psc:session';

/** Remembered so a page refresh puts you back in your seat. */
export function loadSession(): JoinedRoom | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JoinedRoom) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: JoinedRoom | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode). Rejoin just won't work.
  }
}
