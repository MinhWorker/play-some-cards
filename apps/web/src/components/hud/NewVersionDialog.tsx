import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Shown when the site was updated while this page was open: the old page can't open games any
 * more, so it offers a reload (a room in progress takes the player back to their seat).
 */
export function NewVersionDialog({ onLater }: { onLater: () => void }) {
  const reload = useRef<HTMLButtonElement>(null);
  useEffect(() => reload.current?.focus(), []);
  return (
    <div className="modal-backdrop">
      <div className="hud panel modal" role="alertdialog" aria-label="Đã có phiên bản mới">
        <h2>Đã có phiên bản mới</h2>
        <Button ref={reload} onClick={() => window.location.reload()}>
          Tải lại
        </Button>
        <Button variant="secondary" onClick={onLater}>
          Để sau
        </Button>
      </div>
    </div>
  );
}
