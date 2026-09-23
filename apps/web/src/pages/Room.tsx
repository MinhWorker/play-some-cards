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
  const [copied, setCopied] = useState(false);

  if (!snapshot) return <p className="toast">Đang vào phòng…</p>;

  const me = session.playerId;
  const isHost = snapshot.hostId === me;
  const game = games[snapshot.gameId];
  const nameOf = (id: string) => snapshot.players.find((p) => p.id === id)?.name ?? '?';
  const inviteLink = `${window.location.origin}/?room=${snapshot.code}`;

  async function send(event: 'game:start' | 'game:restart') {
    setError('');
    await request(event, {}).catch((err: Error) => setError(err.message));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is still visible to copy by hand.
    }
  }

  const shownError = error || moveError;

  return (
    <>
      <header className="hud-top room-bar">
        <button type="button" className="btn secondary small" onClick={onLeave}>
          ← Rời phòng
        </button>
        <div className="room-title">
          <div className="muted">{game?.name}</div>
          <div className="room-code">Phòng {snapshot.code}</div>
        </div>
        <ul className="players">
          {snapshot.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              {p.id === snapshot.hostId && '👑 '}
              {p.name}
              {p.id === me && ' (bạn)'}
            </li>
          ))}
        </ul>
      </header>

      {snapshot.status === 'lobby' && (
        <div className="panel modal center">
          <h2>Rủ bạn bè vào chơi</h2>
          <p>
            Mã phòng: <b className="big-code">{snapshot.code}</b>
          </p>
          <button type="button" className="btn secondary" onClick={copyLink}>
            {copied ? 'Đã chép link!' : 'Chép link mời'}
          </button>
          <p className="muted">
            {snapshot.players.length}/{game?.maxPlayers} người đã vào
          </p>
          {isHost ? (
            <button type="button" className="btn" onClick={() => send('game:start')}>
              Bắt đầu
            </button>
          ) : (
            <p className="muted">Đang chờ chủ phòng bắt đầu…</p>
          )}
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
          ) : (
            <p className="muted">Chờ chủ phòng mở ván mới…</p>
          )}
        </div>
      )}

      {shownError && <p className="toast error">{shownError}</p>}
    </>
  );
}
