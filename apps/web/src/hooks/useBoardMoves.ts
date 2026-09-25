import { useEffect, useState } from 'react';
import { request } from '@/lib/socket';
import { bridge } from '@/phaser/bridge';

/**
 * Sends moves made on the Phaser board to the server. Returns the last error
 * (e.g. "Chưa tới lượt bạn") so React can show it, and a way to clear it.
 */
export function useBoardMoves() {
  const [error, setError] = useState('');
  useEffect(() => {
    const onMove = (move: unknown) => {
      setError('');
      request('game:move', { move }).catch((err: Error) => setError(err.message));
    };
    bridge.on('board:move', onMove);
    return () => {
      bridge.off('board:move', onMove);
    };
  }, []);
  return [error, setError] as const;
}
