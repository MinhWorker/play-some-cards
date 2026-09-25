import { useEffect, useState } from 'react';
import { Toast } from '@/components/hud';
import { portals } from '@/games';
import { bridge } from '@/phaser/bridge';

interface Props {
  /** An island was picked: show that game's room list. */
  onPickGame: (gameId: string) => void;
}

/** Typing in a field (e.g. the profile modal) must not move the island strip. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Island map: pick a game. The islands themselves are drawn by Phaser (phaser/scenes/HubScene).
 * This page listens for taps on them, moves the strip with the arrow keys and Enter, and offers
 * a hidden list of buttons (one per game) for keyboards and screen readers, since the canvas
 * has no labels. The profile badge is rendered by App.
 */
export function Home({ onPickGame }: Props) {
  const [toast, setToast] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLocked = () => {
      setToast('Game này sắp có, bạn chờ nhé!');
      clearTimeout(timer);
      timer = setTimeout(() => setToast(''), 2000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || document.querySelector('.modal-backdrop')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        bridge.emit('hub:step', e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        bridge.emit('hub:open');
      }
    };
    bridge.on('hub:select', onPickGame);
    bridge.on('hub:locked', onLocked);
    bridge.on('hub:focus', setFocused);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      bridge.off('hub:select', onPickGame);
      bridge.off('hub:locked', onLocked);
      bridge.off('hub:focus', setFocused);
      window.removeEventListener('keydown', onKey);
    };
  }, [onPickGame]);

  return (
    <>
      <nav className="sr-only" aria-label="Chọn game">
        {portals.map((p) => (
          <button
            key={p.gameId}
            type="button"
            aria-current={p.gameId === focused || undefined}
            aria-disabled={p.locked || undefined}
            onFocus={() => bridge.emit('hub:focus-to', p.gameId)}
            onClick={() => {
              bridge.emit('hub:focus-to', p.gameId);
              bridge.emit('hub:open');
            }}
          >
            {p.locked ? `${p.name} (sắp có)` : p.name}
          </button>
        ))}
      </nav>
      {toast && <Toast>{toast}</Toast>}
    </>
  );
}
