import { games, type JoinedRoom, type RoomSnapshot } from '@psc/shared';
import { useState } from 'react';
import { request } from '../socket';

interface Props {
  session: JoinedRoom;
  snapshot: RoomSnapshot | null;
  onLeave: () => void;
  /** Error from the last move (moves are sent from the Phaser board). */
  error: string;
}

export function Room({ session, snapshot, onLeave, error: moveError }: Props) {
  const [error, setError] = useState('');

  if (!snapshot) return <p className="toast">Đang vào phòng…</p>;

  const me = session.playerId;
  const isHost = snapshot.hostId === me;
  const isPlayer = snapshot.players.some((p) => p.id === me);
  const game = games[snapshot.gameId];
  const nameOf = (id: string) => snapshot.players.find((p) => p.id === id)?.name ?? '?';
  const hostName = snapshot.hostId ? nameOf(snapshot.hostId) : null;
  const watching = snapshot.spectators.filter((s) => s.connected).length;
  const seatFree =
    snapshot.status !== 'playing' && snapshot.players.length < (game?.maxPlayers ?? 0);

  async function send(event: 'game:start' | 'game:restart' | 'room:sit') {
    setError('');
    await request(event, {}).catch((err: Error) => setError(err.message));
  }

  const sitButton = !isPlayer && seatFree && (
    <button type="button" className="btn" onClick={() => send('room:sit')}>
      Vào chơi
    </button>
  );
  const shownError = error || moveError;

  return (
    <>
      <header className="hud-top room-bar">
        <button type="button" className="btn secondary small" onClick={onLeave}>
          ← Rời phòng
        </button>
        <div className="room-title">
          <div className="muted">{game?.name}</div>
          <div className="room-code">{hostName ? `Phòng của ${hostName}` : 'Phòng trống'}</div>
        </div>
        <ul className="players">
          {snapshot.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              {p.id === snapshot.hostId && '👑 '}
              {p.name}
              {p.id === me && ' (bạn)'}
            </li>
          ))}
          {watching > 0 && <li className="watchers">👀 {watching} đang xem</li>}
        </ul>
      </header>

      {snapshot.status === 'lobby' && (
        <div className="panel modal center">
          <h2>Đang chờ người chơi</h2>
          <p className="big-code">
            👤 {snapshot.players.length}/{game?.maxPlayers}
          </p>
          {isHost ? (
            <button type="button" className="btn" onClick={() => send('game:start')}>
              Bắt đầu
            </button>
          ) : isPlayer ? (
            <p className="muted">Đang chờ chủ phòng bắt đầu…</p>
          ) : (
            sitButton
          )}
          {shownError && <p className="error">{shownError}</p>}
        </div>
      )}

      {snapshot.result && (
        <div className="panel modal result">
          <h2>
            {snapshot.result.winners.length === 0
              ? 'Hòa!'
              : snapshot.result.winners.includes(me)
                ? 'Bạn thắng! 🎉'
                : `${snapshot.result.winners.map(nameOf).join(', ')} thắng!`}
          </h2>
          {isHost ? (
            <button type="button" className="btn" onClick={() => send('game:restart')}>
              Chơi ván mới
            </button>
          ) : isPlayer ? (
            <p className="muted">Chờ chủ phòng mở ván mới…</p>
          ) : (
            sitButton
          )}
        </div>
      )}

      {shownError && snapshot.status !== 'lobby' && <p className="toast error">{shownError}</p>}
    </>
  );
}
