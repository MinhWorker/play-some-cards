import type { RoomRole, RoomSummary } from '@psc/shared';
import { Button } from '@/components/ui/Button';

const STATUS: Record<RoomSummary['status'], string> = {
  lobby: 'Đang chờ',
  playing: 'Đang chơi',
  finished: 'Vừa xong ván',
};

/** One room in the list: host, status, seats, and the join/watch buttons. */
export function RoomRow({ room, onJoin }: { room: RoomSummary; onJoin: (role: RoomRole) => void }) {
  return (
    <li className="room-row">
      <div className="room-info">
        <b>Phòng của {room.hostName}</b>
        <span className="muted">
          {STATUS[room.status]} · 👤 {room.players}/{room.maxPlayers}
          {room.spectators > 0 && ` · 👀 ${room.spectators}`}
        </span>
      </div>
      <div className="room-actions">
        <Button size="small" disabled={!room.canJoin} onClick={() => onJoin('player')}>
          Vào chơi
        </Button>
        <Button variant="secondary" size="small" onClick={() => onJoin('spectator')}>
          Xem
        </Button>
      </div>
    </li>
  );
}
