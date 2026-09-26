import type { GameClient } from '@psc/sdk/client';
import { useEffect, useState } from 'react';
import { loadClient } from '@/games';

/** A game's client.ts (its screens and UI texts), once loaded; `null` until then. */
export function useGameClient(gameId: string) {
  const [client, setClient] = useState<GameClient | null>(null);
  useEffect(() => {
    let current = true;
    setClient(null);
    if (!gameId) return;
    loadClient(gameId).then(
      (loaded) => current && setClient(loaded),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [gameId]);
  return client;
}
