import { games, type JoinedRoom, type RoomSnapshot } from '@psc/shared';
import { useState } from 'react';
import { Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { request } from '@/lib/socket';
import { RoomBar } from './RoomBar';
import './Room.css';

interface Props {
  session: JoinedRoom;
  snapshot: RoomSnapshot | null;
  onLeave: () => void;
  /** Error from the last move (moves are sent from the Phaser board). */
  error: string;
}

/**
 * Inside a room. The board itself is drawn by Phaser (games/<id>/<Name>Scene.ts); React shows
 * the room bar, the "waiting for players" panel before a game and the result panel after it.
 */
export function Room({ session, snapshot, onLeave, error: moveError }: Props) {
  const [error, setError] = useState('');

  if (!snapshot) return <Toast>Đang vào phòng…</Toast>;

  const me = session.playerId;
  const isHost = snapshot.hostId === me;
  const isPlayer = snapshot.players.some((p) => p.id === me);
  const game = games[snapshot.gameId];
  const nameOf = (id: string) => snapshot.players.find((p) => p.id === id)?.name ?? '?';
  const hostName = snapshot.hostId ? nameOf(snapshot.hostId) : null;
  const seatFree =
    snapshot.status !== 'playing' && snapshot.players.length < (game?.maxPlayers ?? 0);

  async function send(event: 'game:start' | 'game:restart' | 'room:sit') {
    setError('');
    await request(event, {}).catch((err: Error) => setError(err.message));
  }

  // Spectators can take a free seat between games.
  const sitButton = !isPlayer && seatFree && (
    <Button onClick={() => send('room:sit')}>Vào chơi</Button>
  );
  const shownError = error || moveError;

  return (
    <>
      <RoomBar
        snapshot={snapshot}
        me={me}
        gameName={game?.name}
        hostName={hostName}
        onLeave={onLeave}
      />

      {snapshot.status === 'lobby' && (
        <div className="hud panel modal center">
          <h2>Đang chờ người chơi</h2>
          <p className="big-code">
            👤 {snapshot.players.length}/{game?.maxPlayers}
          </p>
          {isHost ? (
            <Button onClick={() => send('game:start')}>Bắt đầu</Button>
          ) : isPlayer ? (
            <p className="muted">Đang chờ chủ phòng bắt đầu…</p>
          ) : (
            sitButton
          )}
          {shownError && <p className="error">{shownError}</p>}
        </div>
      )}

      {snapshot.result && (
        <div className="hud panel modal result">
          <h2>
            {snapshot.result.winners.length === 0
              ? 'Hòa!'
              : snapshot.result.winners.includes(me)
                ? 'Bạn thắng! 🎉'
                : `${snapshot.result.winners.map(nameOf).join(', ')} thắng!`}
          </h2>
          {isHost ? (
            <Button onClick={() => send('game:restart')}>Chơi ván mới</Button>
          ) : isPlayer ? (
            <p className="muted">Chờ chủ phòng mở ván mới…</p>
          ) : (
            sitButton
          )}
        </div>
      )}

      {shownError && snapshot.status !== 'lobby' && <Toast error>{shownError}</Toast>}
    </>
  );
}
