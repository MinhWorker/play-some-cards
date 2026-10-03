import type { RoomSnapshot } from '@psc/shared';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { bridge } from '@/phaser/bridge';

/**
 * The bar across the top of a room, kept to the corners so the board gets the screen: the leave
 * (←) and home buttons on the left, and the players (with 👑 by the host, unless the board lists
 * them itself and shows the host its own way) and spectators. No room or game name: the player
 * knows where they are. It wraps onto several rows on narrow screens, so it tells the board how
 * tall it is, and how much of its row is free in the middle (see `reportGap`).
 */
export function RoomBar({
  snapshot,
  me,
  hidePlayers,
  onLeave,
  onHome,
}: {
  snapshot: RoomSnapshot;
  me: string;
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
    // Its parts too: the players' list moves when names or the buttons change size.
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
        <Button
          variant="secondary"
          size="small"
          aria-label="Về danh sách phòng"
          title="Về danh sách phòng"
          onClick={onLeave}
        >
          ←
        </Button>
        <Button
          variant="secondary"
          size="small"
          aria-label="Về trang chủ"
          title="Về trang chủ"
          onClick={onHome}
        >
          🏠
        </Button>
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

/**
 * Tells the board which part of the bar's row is free: between the buttons and the players (or
 * the settings button when no players are listed), in page px. Nothing when the bar wrapped onto
 * more rows, since then its row has no clear middle.
 */
function reportGap(bar: HTMLElement) {
  const [nav, players] = [...bar.children].map((c) => c.getBoundingClientRect());
  if (!nav || !players) return;
  const box = bar.getBoundingClientRect();
  const listed = players.width > 0;
  const wrapped = listed && players.top >= nav.bottom;
  bridge.emit(
    'hud:gap',
    wrapped
      ? undefined
      : {
          left: nav.right,
          right: listed ? players.left : box.right,
          top: box.top,
          bottom: nav.bottom,
        },
  );
}
