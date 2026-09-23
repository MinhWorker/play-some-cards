import { games, type JoinedRoom, type RoomSnapshot } from '@psc/shared';
import { useState } from 'react';
import { boards } from '../games';
import { request } from '../socket';

interface Props {
  session: JoinedRoom;
  snapshot: RoomSnapshot | null;
  onLeave: () => void;
}

export function Room({ session, snapshot, onLeave }: Props) {
  const [error, setError] = useState('');

  if (!snapshot) return <p>Đang kết nối…</p>;

  const me = session.playerId;
  const isHost = snapshot.hostId === me;
  const game = games[snapshot.gameId];
  const Board = boards[snapshot.gameId];
  const nameOf = (id: string) => snapshot.players.find((p) => p.id === id)?.name ?? '?';

  async function send<E extends 'game:start' | 'game:restart'>(event: E) {
    setError('');
    await request(event, {}).catch((err: Error) => setError(err.message));
  }

  async function sendMove(move: unknown) {
    setError('');
    await request('game:move', { move }).catch((err: Error) => setError(err.message));
  }

  const inviteLink = `${window.location.origin}/?room=${snapshot.code}`;

  return (
    <div className="stack">
      <div className="room-header">
        <div>
          <div className="muted">{game?.name}</div>
          <div className="room-code">Phòng {snapshot.code}</div>
        </div>
        <button type="button" className="secondary" onClick={onLeave}>
          Rời phòng
        </button>
      </div>

      <ul className="players">
        {snapshot.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'muted'}>
            {p.name}
            {p.id === me && ' (bạn)'}
            {p.id === snapshot.hostId && ' ★'}
            {!p.connected && ' (mất kết nối)'}
          </li>
        ))}
      </ul>

      {snapshot.status === 'lobby' && (
        <div className="card stack">
          <p>
            Rủ bạn bè vào bằng mã <b>{snapshot.code}</b> hoặc gửi link này:
          </p>
          <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
          {isHost ? (
            <button type="button" onClick={() => send('game:start')}>
              Bắt đầu
            </button>
          ) : (
            <p className="muted">Đang chờ chủ phòng bắt đầu…</p>
          )}
        </div>
      )}

      {snapshot.status !== 'lobby' && Board && (
        <Board view={snapshot.view} me={me} players={snapshot.players} sendMove={sendMove} />
      )}

      {snapshot.result && (
        <div className="card stack">
          <h2>
            {snapshot.result.winners.length === 0
              ? 'Hòa!'
              : `${snapshot.result.winners.map(nameOf).join(', ')} thắng!`}
          </h2>
          {isHost && (
            <button type="button" onClick={() => send('game:restart')}>
              Chơi ván mới
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
