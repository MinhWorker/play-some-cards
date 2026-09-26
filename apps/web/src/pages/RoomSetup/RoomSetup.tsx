import { useEffect, useState } from 'react';
import { Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { bridge } from '@/phaser/bridge';

interface Props {
  /** Label of the back button, for screen readers. */
  backLabel: string;
  onBack: () => void;
  /** Creates the room or changes its options; rejects with the message to show. */
  onSubmit: (options: unknown) => Promise<unknown>;
}

/**
 * While a game's own settings screen runs on the canvas (its `setup` scene, for "Tạo phòng" or
 * "Tuỳ chỉnh"): a back button, and whatever options the scene hands over go to `onSubmit`.
 */
export function RoomSetup({ backLabel, onBack, onSubmit }: Props) {
  const [error, setError] = useState('');

  useEffect(() => {
    const submit = (options: unknown) => {
      setError('');
      onSubmit(options).catch((err: Error) => setError(err.message));
    };
    bridge.on('setup:submit', submit);
    bridge.on('setup:cancel', onBack);
    return () => {
      bridge.off('setup:submit', submit);
      bridge.off('setup:cancel', onBack);
    };
  }, [onBack, onSubmit]);

  return (
    <>
      <header className="hud hud-top">
        <Button variant="secondary" size="small" aria-label={backLabel} onClick={onBack}>
          ←
        </Button>
      </header>
      {error && <Toast error>{error}</Toast>}
    </>
  );
}
