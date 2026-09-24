import { games, type JoinedRoom, type RoomRole, type RoomSummary } from '@psc/shared';
import { useEffect, useState } from 'react';
import { request, socket } from '../socket';

interface Props {
  gameId: string;
  name: string;
  onBack: () => void;
  onEnter: (joined: JoinedRoom) => void;
}

const STATUS: Record<RoomSummary['status'], string> = {
  lobby: 'Đang chờ',
  playing: 'Đang chơi',
  finished: 'Vừa xong ván',
};

/** A game's live room list: create a room, join one as a player, or watch. */
export function GameRooms({ gameId, name, onBack, onEnter }: Props) {
  const game = games[gameId];
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const watch = () => {
      request('lobby:watch', { gameId })
        .then((res) => setRooms(res.rooms))
        .catch((err: Error) => setError(err.message));
    };
    const onRooms = (update: { gameId: string; rooms: RoomSummary[] }) => {
      if (update.gameId === gameId) setRooms(update.rooms);
    };
    if (socket.connected) watch();
    // Watch again after a reconnect (e.g. the server restarted).
    socket.on('connect', watch);
    socket.on('lobby:rooms', onRooms);
    return () => {
      socket.off('connect', watch);
      socket.off('lobby:rooms', onRooms);
      request('lobby:unwatch', {}).catch(() => {});
    };
  }, [gameId]);

  async function run(action: () => Promise<JoinedRoom>) {
    setError('');
    try {
      onEnter(await action());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const join = (roomCode: string, role: RoomRole) =>
    run(() => request('room:join', { roomCode, name, role }));

  const hasName = name.trim().length > 0;

  return (
    <>
      <section className="panel rooms" aria-label={`Phòng ${game?.name ?? ''}`}>
        <div className="rooms-head">
          <button
            type="button"
            className="btn secondary small"
            aria-label="Về đảo"
            onClick={onBack}
          >
            ←
          </button>
          <h2>{game?.name}</h2>
          <button
            type="button"
            className="btn"
            disabled={!hasName}
            onClick={() => run(() => request('room:create', { gameId, name }))}
          >
            + Tạo phòng
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {rooms === null ? (
          <p className="muted">Đang tải danh sách phòng…</p>
        ) : rooms.length === 0 ? (
          <p className="muted empty">Chưa có phòng nào</p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.code} className="room-row">
                <div className="room-info">
                  <b>Phòng của {r.hostName}</b>
                  <span className="muted">
                    {STATUS[r.status]} · 👤 {r.players}/{r.maxPlayers}
                    {r.spectators > 0 && ` · 👀 ${r.spectators}`}
                  </span>
                </div>
                <div className="room-actions">
                  <button
                    type="button"
                    className="btn small"
                    disabled={!hasName || !r.canJoin}
                    onClick={() => join(r.code, 'player')}
                  >
                    Vào chơi
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={!hasName}
                    onClick={() => join(r.code, 'spectator')}
                  >
                    Xem
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
