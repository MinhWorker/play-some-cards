import { games, type JoinedRoom, type RoomRole, type RoomSummary } from '@psc/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { request, socket } from '@/lib/socket';
import { RoomRow } from './RoomRow';
import './GameRooms.css';

interface Props {
  gameId: string;
  onBack: () => void;
  onEnter: (joined: JoinedRoom) => void;
}

/** A game's live room list: create a room, join one as a player, or watch. */
export function GameRooms({ gameId, onBack, onEnter }: Props) {
  const game = games[gameId];
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState('');

  // The server pushes the list again whenever a room of this game changes.
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
    run(() => request('room:join', { roomCode, role }));

  return (
    <section className="hud panel rooms" aria-label={`Phòng ${game?.name ?? ''}`}>
      <div className="rooms-head">
        <Button variant="secondary" size="small" aria-label="Về đảo" onClick={onBack}>
          ←
        </Button>
        <h2>{game?.name}</h2>
        <Button onClick={() => run(() => request('room:create', { gameId }))}>+ Tạo phòng</Button>
      </div>
      {error && <p className="error">{error}</p>}

      {rooms === null ? (
        <p className="muted">Đang tải danh sách phòng…</p>
      ) : rooms.length === 0 ? (
        <p className="muted empty">Chưa có phòng nào</p>
      ) : (
        <ul className="room-list">
          {rooms.map((r) => (
            <RoomRow key={r.code} room={r} onJoin={(role) => join(r.code, role)} />
          ))}
        </ul>
      )}
    </section>
  );
}
