import { games, type JoinedRoom } from '@psc/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProfileBadge } from './ProfileBadge';
import { GameRooms } from './pages/GameRooms';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { bridge, type Stage } from './phaser/bridge';
import { PhaserStage } from './phaser/PhaserStage';
import { loadProfile, type Profile, saveProfile } from './profile';
import { SoundControl } from './SoundControl';
import { request } from './socket';
import { installButtonSounds, playSfx } from './sound';
import { useConnected } from './useConnected';
import { useRoom } from './useRoom';

/** The game whose room list is open, kept in the URL (?game=<id>) so refresh keeps it. */
function gameFromUrl() {
  const id = new URLSearchParams(window.location.search).get('game');
  return id && games[id] ? id : null;
}

export function App() {
  const connected = useConnected();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState(loadProfile);
  const [browsing, setBrowsing] = useState(gameFromUrl);

  const changeProfile = (value: Profile) => {
    setProfile(value);
    saveProfile(value);
  };

  const browse = useCallback((gameId: string | null) => {
    setBrowsing(gameId);
    const url = new URL(window.location.href);
    if (gameId) url.searchParams.set('game', gameId);
    else url.searchParams.delete('game');
    window.history.replaceState(null, '', url);
  }, []);

  // The room was disbanded while we were in it: back to that game's room list.
  const onClosed = useCallback(
    ({ gameId, reason }: { gameId: string; reason: string }) => {
      browse(gameId);
      setNotice(reason);
      setTimeout(() => setNotice(''), 2500);
    },
    [browse],
  );
  const { session, snapshot, enter, leave } = useRoom(onClosed);

  useEffect(installButtonSounds, []);

  // Win/lose sound, only when a game ends while we watch it happen (not when rejoining a
  // finished room). Draws and spectators get no sound.
  const lastStatus = useRef(snapshot?.status);
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = snapshot?.status;
    if (!session || !snapshot?.result || was !== 'playing') return;
    const { winners } = snapshot.result;
    const playing = snapshot.players.some((p) => p.id === session.playerId);
    if (!playing || winners.length === 0) return;
    playSfx(winners.includes(session.playerId) ? 'game-win' : 'game-lose');
  }, [session, snapshot]);

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
    if (!session) return browsing ? { mode: 'sky' } : { mode: 'hub' };
    if (!snapshot || snapshot.status === 'lobby') return { mode: 'sky' };
    return {
      mode: 'board',
      gameId: snapshot.gameId,
      view: snapshot.view,
      me: session.playerId,
      players: snapshot.players,
      result: snapshot.result,
      score: snapshot.score,
    };
  }, [session, snapshot, browsing]);

  const onEnter = (joined: JoinedRoom) => {
    setError('');
    enter(joined);
  };

  // Leaving a room goes back to that game's room list.
  const onLeave = () => {
    if (snapshot) browse(snapshot.gameId);
    void leave();
  };

  return (
    <>
      <PhaserStage stage={stage} />
      <main className="ui">
        {!connected && (
          <p className="banner">Đang kết nối tới server… lần đầu có thể mất tới 1 phút.</p>
        )}
        {session ? (
          <Room session={session} snapshot={snapshot} onLeave={onLeave} error={error} />
        ) : browsing ? (
          <GameRooms
            gameId={browsing}
            name={profile.name}
            onBack={() => browse(null)}
            onEnter={onEnter}
          />
        ) : (
          <Home onPickGame={browse} />
        )}
        {!session && <ProfileBadge profile={profile} onChange={changeProfile} />}
        {notice && <p className="toast">{notice}</p>}
        <SoundControl />
      </main>
    </>
  );
}
