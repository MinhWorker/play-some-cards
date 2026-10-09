import { useEffect, useState } from 'react';
import { request } from '@/lib/socket';
import { bridge } from '@/phaser/bridge';

/** How long a refused move's message stays up (the next move also clears it). */
const ERROR_MS = 3000;

/**
 * Sends moves (and the host's option changes) made on the Phaser board to the server. Returns
 * the last error (e.g. "Chưa tới lượt bạn") so React can show it, and a way to clear it.
 */
export function useBoardMoves() {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), ERROR_MS);
    return () => clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    const onMove = (move: unknown) => {
      setError('');
      request('game:move', { move }).catch((err: Error) => setError(err.message));
    };
    const onOptions = (options: unknown) => {
      setError('');
      request('room:options', { options }).catch((err: Error) => setError(err.message));
    };
    bridge.on('board:move', onMove);
    bridge.on('board:options', onOptions);
    return () => {
      bridge.off('board:move', onMove);
      bridge.off('board:options', onOptions);
    };
  }, []);
  return [error, setError] as const;
}
