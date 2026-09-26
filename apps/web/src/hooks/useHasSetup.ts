import { useEffect, useState } from 'react';
import { loadClient } from '@/games';

/** Whether a game ships its own room settings screen (`setup` in its client.ts). */
export function useHasSetup(gameId: string) {
  const [hasSetup, setHasSetup] = useState(false);
  useEffect(() => {
    let current = true;
    loadClient(gameId).then(
      (client) => current && setHasSetup(Boolean(client.setup)),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [gameId]);
  return hasSetup;
}
