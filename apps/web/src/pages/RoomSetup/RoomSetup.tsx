import { useEffect, useState } from 'react';
import { Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { bridge } from '@/phaser/bridge';

interface Props {
  /** Label of the back button, for screen readers. */
  backLabel: string;
  onBack: () => void;
  /** Straight to the home map. */
  onHome?: () => void;
  /** The setup scene's own cancel ('setup:cancel'); `onBack` when left out. */
  onCancel?: () => void;
  /** Creates the room or changes its options; rejects with the message to show. */
  onSubmit: (options: unknown) => Promise<unknown>;
}

/**
 * While a game's own settings screen runs on the canvas (its `setup` scene, for "Tạo phòng" or
 * "Tuỳ chỉnh"): a back button, and whatever options the scene hands over go to `onSubmit`.
 */
export function RoomSetup({ backLabel, onBack, onHome, onCancel, onSubmit }: Props) {
  const [error, setError] = useState('');

  useEffect(() => {
    const submit = (options: unknown) => {
      setError('');
      onSubmit(options).catch((err: Error) => setError(err.message));
    };
    const cancel = onCancel ?? onBack;
    bridge.on('setup:submit', submit);
    bridge.on('setup:cancel', cancel);
    return () => {
      bridge.off('setup:submit', submit);
      bridge.off('setup:cancel', cancel);
    };
  }, [onBack, onCancel, onSubmit]);

  return (
    <>
      <header className="hud hud-top">
        <div className="nav-buttons">
          <Button variant="secondary" size="small" aria-label={backLabel} onClick={onBack}>
            ←
          </Button>
          {onHome && (
            <Button variant="secondary" size="small" aria-label="Về trang chủ" onClick={onHome}>
              🏠
            </Button>
          )}
        </div>
      </header>
      {error && <Toast error>{error}</Toast>}
    </>
  );
}
