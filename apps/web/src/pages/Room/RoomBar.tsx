import type { RoomSnapshot } from '@psc/shared';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { bridge } from '@/phaser/bridge';

/**
 * The bar across the top of a room: leave and home buttons with the game's name beside them,
 * players (unless the board lists them) and spectators, and the room's name as small words by
 * the settings button. It wraps onto several rows on narrow screens, so it tells the board how
 * tall it is, and how much of its row is free in the middle (see `reportGap`).
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
    const report = () => {
      bridge.emit('hud:top', el.getBoundingClientRect().bottom);
      reportGap(el);
    };
    report();
    // Its parts too: the room's name moves when the words or the buttons change size.
    const observer = new ResizeObserver(report);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      bridge.emit('hud:top', undefined);
      bridge.emit('hud:gap', undefined);
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
        {gameName && !(hidePlayers && snapshot.status === 'playing') && (
          <span className="room-game">{gameName}</span>
        )}
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
      <div className="room-name">{hostName ? `Phòng của ${hostName}` : 'Phòng trống'}</div>
    </header>
  );
}

/**
 * Tells the board which part of the bar's row is free: between the buttons (with the game's
 * name) and the players or the room's name, in page px. Nothing when the bar wrapped onto more
 * rows, since then its row has no clear middle.
 */
function reportGap(bar: HTMLElement) {
  const [nav, players, name] = [...bar.children].map((c) => c.getBoundingClientRect());
  if (!nav || !players || !name) return;
  const listed = players.width > 0;
  const wrapped = name.top >= nav.bottom || (listed && players.top >= nav.bottom);
  bridge.emit(
    'hud:gap',
    wrapped
      ? undefined
      : {
          left: nav.right,
          right: listed ? players.left : name.left,
          top: bar.getBoundingClientRect().top,
          bottom: nav.bottom,
        },
  );
}
