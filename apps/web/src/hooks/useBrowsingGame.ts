import { games } from '@psc/shared';
import { useCallback, useState } from 'react';

/** The game whose room list is open, kept in the URL (?game=<id>) so refresh keeps it. */
function gameFromUrl() {
  const id = new URLSearchParams(window.location.search).get('game');
  return id && games[id] ? id : null;
}

/** Which game's room list is open (null = island map), synced with the URL. */
export function useBrowsingGame() {
  const [browsing, setBrowsing] = useState(gameFromUrl);

  const browse = useCallback((gameId: string | null) => {
    setBrowsing(gameId);
    const url = new URL(window.location.href);
    if (gameId) url.searchParams.set('game', gameId);
    else url.searchParams.delete('game');
    window.history.replaceState(null, '', url);
  }, []);

  return [browsing, browse] as const;
}
