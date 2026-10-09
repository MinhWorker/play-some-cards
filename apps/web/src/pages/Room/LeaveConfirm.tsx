import type { LeaveConfirm as Texts } from '@psc/sdk/client';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useDialogKeys } from '@/hooks/useDialogKeys';

interface Props {
  /** The game's own texts (client.ts `leaveConfirm`); missing ones keep these defaults. */
  texts: Texts;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Asked when a player taps "Rời phòng" in the middle of a game: leaving stops the game for the
 * whole room. Staying is the default (Esc, or a tap outside the panel).
 */
export function LeaveConfirm({ texts, onStay, onLeave }: Props) {
  const {
    title = 'Bỏ dở ván này?',
    message = 'Bạn rời phòng thì ván đang chơi sẽ dừng lại cho cả bàn.',
    stay: stayText = 'Ở lại chơi tiếp',
    leave = 'Rời phòng',
  } = texts;
  const stay = useRef<HTMLButtonElement>(null);
  useDialogKeys();

  useEffect(() => {
    stay.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onStay();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onStay()}>
      <div className="hud panel modal" role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        <p className="muted">{message}</p>
        <Button ref={stay} onClick={onStay}>
          {stayText}
        </Button>
        <Button variant="secondary" onClick={onLeave}>
          {leave}
        </Button>
      </div>
    </div>
  );
}
