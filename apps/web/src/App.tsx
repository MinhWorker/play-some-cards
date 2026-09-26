import type { JoinedRoom } from '@psc/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  CloudCurtain,
  ProfileBadge,
  revealCurtain,
  SoundControl,
  Toast,
  transition,
  VersionTag,
} from '@/components/hud';
import { gameMusic } from '@/games';
import { useAccount } from '@/hooks/useAccount';
import { useBoardMoves } from '@/hooks/useBoardMoves';
import { useBrowsingGame } from '@/hooks/useBrowsingGame';
import { useConnected } from '@/hooks/useConnected';
import { useGameEndSound } from '@/hooks/useGameEndSound';
import { useRoom } from '@/hooks/useRoom';
import { useVersionGuard } from '@/hooks/useVersionGuard';
import { request } from '@/lib/socket';
import { appMusic, installButtonSounds, setMusicScene } from '@/lib/sound';
import { GameRooms } from '@/pages/GameRooms/GameRooms';
import { Home } from '@/pages/Home/Home';
import { Login } from '@/pages/Login/Login';
import { Room } from '@/pages/Room/Room';
import { RoomSetup } from '@/pages/RoomSetup/RoomSetup';
import type { Stage } from '@/phaser/bridge';
import { PhaserStage } from '@/phaser/PhaserStage';

/**
 * The whole app. Phaser draws the world full-screen (PhaserStage); React draws the UI on
 * top: one page (Login, Home, GameRooms or Room) plus the shared HUD (profile, sound, curtain).
 */
export function App() {
  const connected = useConnected();
  const version = useVersionGuard();
  const [notice, setNotice] = useState('');
  const [browsing, browse] = useBrowsingGame();
  /** The game's own settings screen is open: for a new room, or for the room we are in. */
  const [settingUp, setSettingUp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moveError, setMoveError] = useBoardMoves();

  // The room was disbanded while we were in it: back to that game's room list.
  const onClosed = useCallback(
    ({ gameId, reason }: { gameId: string; reason: string }) => {
      browse(gameId);
      setNotice(reason);
      setTimeout(() => setNotice(''), 2500);
    },
    [browse],
  );
  const { session, snapshot, enter, resume, leave } = useRoom(onClosed);
  const { account, signIn, signOut, updateProfile } = useAccount(resume);

  useEffect(installButtonSounds, []);
  useGameEndSound(session, snapshot);

  // What the Phaser canvas shows behind the UI.
  const stage = useMemo<Stage>(() => {
    if (account.status !== 'in') return { mode: 'sky' };
    if (!session) {
      if (browsing && settingUp) return { mode: 'setup', gameId: browsing, current: null };
      return browsing ? { mode: 'sky' } : { mode: 'hub' };
    }
    if (editing && snapshot) {
      return { mode: 'setup', gameId: snapshot.gameId, current: snapshot.options };
    }
    if (!snapshot || snapshot.status === 'lobby') return { mode: 'sky' };
    return {
      mode: 'board',
      gameId: snapshot.gameId,
      view: snapshot.view,
      me: session.playerId,
      players: snapshot.players,
      hostId: snapshot.hostId,
      result: snapshot.result,
      score: snapshot.score,
      options: snapshot.options,
      round: snapshot.round,
      last: snapshot.last,
    };
  }, [account.status, session, snapshot, browsing, settingUp, editing]);

  // Only the host edits the room, and only between games.
  const canEdit =
    !!session && snapshot?.hostId === session.playerId && snapshot.status !== 'playing';
  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  // Background music follows what the canvas shows; a game without music keeps the sky's.
  const musicScene = stage.mode === 'board' || stage.mode === 'setup' ? stage.gameId : stage.mode;
  useEffect(() => {
    const tracks =
      musicScene === 'hub' || musicScene === 'sky' ? appMusic(musicScene) : gameMusic(musicScene);
    if (tracks.length) setMusicScene(musicScene, tracks);
    else setMusicScene('sky', appMusic('sky'));
  }, [musicScene]);

  // Picking an island flies through the clouds to its room list.
  const pickGame = useCallback((gameId: string) => transition(() => browse(gameId)), [browse]);

  const onEnter = useCallback(
    (joined: JoinedRoom) => {
      setSettingUp(false);
      setMoveError('');
      enter(joined);
    },
    [enter, setMoveError],
  );
  const closeSetup = useCallback(() => setSettingUp(false), []);
  const createRoom = useCallback(
    (options: unknown) => request('room:create', { gameId: browsing ?? '', options }).then(onEnter),
    [browsing, onEnter],
  );
  const closeEditing = useCallback(() => setEditing(false), []);
  const changeOptions = useCallback(
    (options: unknown) => request('room:options', { options }).then(closeEditing),
    [closeEditing],
  );

  // Leaving a room goes back to that game's room list.
  const onLeave = () => {
    if (snapshot) browse(snapshot.gameId);
    void leave();
  };

  return (
    <>
      <PhaserStage stage={stage} onReady={revealCurtain} />
      <main className="ui">
        {version === 'newer' ? (
          <Banner>Đã có phiên bản mới, đang tải lại…</Banner>
        ) : version === 'older' ? (
          <Banner>Server đang cập nhật, chờ chút nhé…</Banner>
        ) : (
          !connected &&
          account.status !== 'guest' && (
            <Banner>Đang kết nối tới server… lần đầu có thể mất tới 1 phút.</Banner>
          )
        )}
        {account.status === 'guest' ? (
          <Login onSignIn={signIn} />
        ) : account.status === 'loading' ? null : session && editing ? (
          <RoomSetup backLabel="Về phòng" onBack={closeEditing} onSubmit={changeOptions} />
        ) : session ? (
          <Room
            session={session}
            snapshot={snapshot}
            onLeave={onLeave}
            onCustomize={() => setEditing(true)}
            error={moveError}
          />
        ) : browsing && settingUp ? (
          <RoomSetup backLabel="Về danh sách phòng" onBack={closeSetup} onSubmit={createRoom} />
        ) : browsing ? (
          <GameRooms
            gameId={browsing}
            onBack={() => browse(null)}
            onEnter={onEnter}
            onSetup={() => setSettingUp(true)}
          />
        ) : (
          <Home onPickGame={pickGame} />
        )}
        {account.status === 'in' && !session && !settingUp && (
          <ProfileBadge user={account.user} onChange={updateProfile} onSignOut={signOut} />
        )}
        {notice && <Toast>{notice}</Toast>}
        <SoundControl />
      </main>
      <CloudCurtain />
      <VersionTag />
    </>
  );
}
