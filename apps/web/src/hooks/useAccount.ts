import type { AuthResponse, JoinedRoom, User } from '@psc/shared';
import { useCallback, useEffect, useState } from 'react';
import { loadToken, logout, saveToken } from '@/lib/auth';
import type { Profile } from '@/lib/profile';
import { request, socket } from '@/lib/socket';

/** `loading`: a saved token is being checked (or the server is still waking up). */
export type Account = { status: 'loading' } | { status: 'guest' } | { status: 'in'; user: User };

/** Retry delay when the server refused the socket for a reason other than a bad token. */
const RETRY_MS = 3000;

/**
 * Who is logged in. The socket only connects with a login token. After every (re)connect we ask
 * the server who we are and which room our account is in; `onResume` gets that room, so a
 * refresh, a new tab or another device puts the player back in their seat.
 */
export function useAccount(onResume: (room: JoinedRoom | null) => void) {
  const [account, setAccount] = useState<Account>(() =>
    loadToken() ? { status: 'loading' } : { status: 'guest' },
  );

  useEffect(() => {
    const resume = () => {
      request('session:resume', {})
        .then(({ user, room }) => {
          setAccount({ status: 'in', user });
          onResume(room);
        })
        .catch(() => {});
    };
    const refused = (err: Error) => {
      if (err.message === 'unauthorized') {
        // Token unknown to the server (logged out elsewhere, or a server without a database
        // restarted): back to the login screen.
        saveToken(null);
        setAccount({ status: 'guest' });
        onResume(null);
      } else if (!socket.active) {
        setTimeout(() => loadToken() && socket.connect(), RETRY_MS);
      }
    };
    socket.on('connect', resume);
    socket.on('connect_error', refused);
    if (socket.connected) resume();
    else if (loadToken()) socket.connect();
    return () => {
      socket.off('connect', resume);
      socket.off('connect_error', refused);
    };
  }, [onResume]);

  const signIn = useCallback(({ token, user }: AuthResponse) => {
    saveToken(token);
    setAccount({ status: 'in', user });
    socket.disconnect().connect();
  }, []);

  const signOut = useCallback(() => {
    const token = loadToken();
    saveToken(null);
    socket.disconnect();
    setAccount({ status: 'guest' });
    onResume(null);
    if (token) void logout(token);
  }, [onResume]);

  /** Saves a new display name / avatar; throws with the server's message on failure. */
  const updateProfile = useCallback(async (profile: Profile) => {
    const { user } = await request('profile:update', profile);
    setAccount({ status: 'in', user });
  }, []);

  return { account, signIn, signOut, updateProfile };
}
