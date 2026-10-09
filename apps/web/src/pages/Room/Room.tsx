import { games, type JoinedRoom, type RoomSnapshot } from '@xomdao/shared';
import { useEffect, useRef, useState } from 'react';
import { Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { useGameClient } from '@/hooks/useGameClient';
import { roomControls } from '@/lib/roomControls';
import { request } from '@/lib/socket';
import { bridge } from '@/phaser/bridge';
import { LeaveConfirm } from './LeaveConfirm';
import { RoomBar } from './RoomBar';
import './Room.css';

interface Props {
  session: JoinedRoom;
  snapshot: RoomSnapshot | null;
  /** Leaves the room: back to the game's room list, or (`home`) to the home map. */
  onLeave: (home: boolean) => void;
  /** Host, between games: open the game's settings screen to change the room's options. */
  onCustomize: () => void;
  /** Error from the last move (moves are sent from the Phaser board). */
  error: string;
}

/**
 * Inside a room. The board itself is drawn by Phaser (the game's `GameView`); React shows
 * the room bar, the "waiting for players" panel before a game and the result panel after it.
 * A board that draws its own room controls (`hud` in its client.ts) replaces the room bar and
 * the result panel while it is shown, and asks for their actions ('board:room').
 */
export function Room({ session, snapshot, onLeave, onCustomize, error: moveError }: Props) {
  const [error, setError] = useState('');
  /** Asking before leaving mid-game, and where to go after. */
  const [confirmLeave, setConfirmLeave] = useState<'rooms' | 'home' | null>(null);
  const client = useGameClient(snapshot?.gameId ?? '');
  const hasSetup = Boolean(client?.setup);
  const onBoard = Boolean(snapshot && snapshot.status !== 'lobby');
  const boardNav = onBoard && Boolean(client?.hud?.nav);

  // Without the room bar, the board has the whole height.
  useEffect(() => {
    if (!boardNav) return;
    bridge.emit('hud:top', null);
    return () => {
      bridge.emit('hud:top', undefined);
    };
  }, [boardNav]);

  // The board's own room controls ('board:room'), handled by the latest render (below).
  const onRoomAction = useRef<(action: unknown) => void>(() => {});
  useEffect(() => {
    const onRoom = (action: unknown) => onRoomAction.current(action);
    bridge.on('board:room', onRoom);
    return () => {
      bridge.off('board:room', onRoom);
    };
  }, []);

  if (!snapshot) return <Toast>Đang vào phòng…</Toast>;

  const me = session.playerId;
  const isPlayer = snapshot.players.some((p) => p.id === me);
  const game = games[snapshot.gameId];
  const nameOf = (id: string) =>
    [...snapshot.players, ...(snapshot.seats ?? [])].find((p) => p.id === id)?.name ?? '?';
  const hostName = snapshot.hostId ? nameOf(snapshot.hostId) : null;
  const can = roomControls(snapshot, me, hasSetup);

  async function send(event: 'game:start' | 'game:restart' | 'room:sit') {
    setError('');
    await request(event, {}).catch((err: Error) => setError(err.message));
  }

  // Spectators can take a free seat between games.
  const sitButton = can.sit && <Button onClick={() => send('room:sit')}>Vào chơi</Button>;
  const shownError = error || moveError;
  // A player leaving mid-game stops it for everyone: ask first (unless the game turned it off).
  const ask = client?.leaveConfirm !== false && isPlayer && snapshot.status === 'playing';
  function leave(to: 'rooms' | 'home') {
    if (ask) setConfirmLeave(to);
    else onLeave(to === 'home');
  }
  const customize = can.customize && (
    <Button variant="secondary" onClick={onCustomize}>
      Tuỳ chỉnh
    </Button>
  );
  const isHost = snapshot.hostId === me;
  onRoomAction.current = (action) => {
    if (action === 'leave') leave('rooms');
    else if (action === 'home') leave('home');
    else if (action === 'new-game' && can.newGame) void send('game:restart');
    else if (action === 'customize' && can.customize) onCustomize();
    else if (action === 'sit' && can.sit) void send('room:sit');
  };

  return (
    <>
      {!boardNav && (
        <RoomBar
          snapshot={snapshot}
          me={me}
          hidePlayers={Boolean(client?.showsPlayers) && snapshot.status !== 'lobby'}
          onLeave={() => leave('rooms')}
          onHome={() => leave('home')}
        />
      )}
      {confirmLeave && (
        <LeaveConfirm
          texts={client?.leaveConfirm || {}}
          onStay={() => setConfirmLeave(null)}
          onLeave={() => onLeave(confirmLeave === 'home')}
        />
      )}

      {snapshot.status === 'lobby' && (
        <div className="hud panel modal center">
          <h2>Đang chờ người chơi</h2>
          <p className="big-code">
            👤 {snapshot.players.length}/{game?.maxPlayers}
          </p>
          {isHost ? (
            <>
              <Button onClick={() => send('game:start')}>Bắt đầu</Button>
              {customize}
            </>
          ) : isPlayer ? (
            <p className="muted">Đang chờ {hostName ? `👑 ${hostName}` : 'chủ phòng'} bắt đầu…</p>
          ) : (
            sitButton
          )}
          {shownError && <p className="error">{shownError}</p>}
        </div>
      )}

      {snapshot.result && !client?.hud?.result && (
        <div
          className={snapshot.gameId === 'go' ? 'hud result result--go' : 'hud panel modal result'}
        >
          {!client?.showsResult && (
            <h2>
              {snapshot.result.winners.length === 0
                ? 'Hòa!'
                : snapshot.result.winners.includes(me)
                  ? 'Bạn thắng! 🎉'
                  : `${snapshot.result.winners.map(nameOf).join(', ')} thắng!`}
            </h2>
          )}
          {isHost ? (
            <>
              <Button onClick={() => send('game:restart')}>Chơi ván mới</Button>
              {customize}
            </>
          ) : isPlayer ? (
            <p className="muted">Chờ {hostName ? `👑 ${hostName}` : 'chủ phòng'} mở ván mới…</p>
          ) : (
            sitButton
          )}
        </div>
      )}

      {shownError && snapshot.status !== 'lobby' && <Toast error>{shownError}</Toast>}
    </>
  );
}
