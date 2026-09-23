import type { JoinedRoom } from '@psc/shared';
import { useEffect, useMemo, useState } from 'react';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { bridge, type Stage } from './phaser/bridge';
import { PhaserStage } from './phaser/PhaserStage';
import { request } from './socket';
import { useConnected } from './useConnected';
import { useRoom } from './useRoom';

export function App() {
  const { session, snapshot, enter, leave } = useRoom();
  const connected = useConnected();
  const [error, setError] = useState('');

  // Moves come from the Phaser board; errors (e.g. "Chưa tới lượt bạn") show in React.
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

  const stage = useMemo<Stage>(() => {
    if (!session) return { mode: 'hub' };
    if (!snapshot || snapshot.status === 'lobby') return { mode: 'sky' };
    return {
      mode: 'board',
      gameId: snapshot.gameId,
      view: snapshot.view,
      me: session.playerId,
      players: snapshot.players,
      result: snapshot.result,
    };
  }, [session, snapshot]);

  const onEnter = (joined: JoinedRoom) => {
    setError('');
    enter(joined);
  };

  return (
    <>
      <PhaserStage stage={stage} />
      <main className="ui">
        {!connected && (
          <p className="banner">Đang kết nối tới server… lần đầu có thể mất tới 1 phút.</p>
        )}
        {session ? (
          <Room session={session} snapshot={snapshot} onLeave={leave} error={error} />
        ) : (
          <Home onEnter={onEnter} />
        )}
      </main>
    </>
  );
}
