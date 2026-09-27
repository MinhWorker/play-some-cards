import type { RoomSnapshot } from '@psc/shared';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { bridge } from '@/phaser/bridge';

/**
 * The bar across the top of a room: leave and home buttons, room name, players (unless the board
 * lists them) and spectators.
 * It wraps onto several rows on narrow screens, so it tells the board how tall it is.
 */
export function RoomBar({
  snapshot,
  me,
  gameName,
  hostName,
  hidePlayers,
  onLeave,
  onHome,
}: {
  snapshot: RoomSnapshot;
  me: string;
  gameName: string | undefined;
  hostName: string | null;
  /** The board lists the players itself. */
  hidePlayers?: boolean;
  /** Back to the room list. */
  onLeave: () => void;
  /** Leave the room straight to the home map. */
  onHome: () => void;
}) {
  const bar = useRef<HTMLElement>(null);
  const watching = snapshot.spectators.filter((s) => s.connected).length;

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const report = () => bridge.emit('hud:top', el.getBoundingClientRect().bottom);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      bridge.emit('hud:top', undefined);
    };
  }, []);

  return (
    <header ref={bar} className="hud hud-top room-bar">
      <div className="nav-buttons">
        <Button variant="secondary" size="small" onClick={onLeave}>
          ← Rời phòng
        </Button>
        <Button variant="secondary" size="small" aria-label="Về trang chủ" onClick={onHome}>
          🏠
        </Button>
      </div>
      <div className="room-title">
        <div className="muted">{gameName}</div>
        <div className="room-code">{hostName ? `Phòng của ${hostName}` : 'Phòng trống'}</div>
      </div>
      <ul className="players">
        {!hidePlayers &&
          snapshot.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              {p.id === snapshot.hostId && '👑 '}
              {p.bot && '🤖 '}
              {p.name}
              {p.id === me && ' (bạn)'}
            </li>
          ))}
        {watching > 0 && <li className="watchers">👀 {watching} đang xem</li>}
      </ul>
    </header>
  );
}
