import { useEffect, useState } from 'react';
import { Toast } from '@/components/hud';
import { bridge } from '@/phaser/bridge';

interface Props {
  /** An island was picked: show that game's room list. */
  onPickGame: (gameId: string) => void;
}

/**
 * Island map: pick a game. The islands themselves are drawn by Phaser (phaser/scenes/HubScene);
 * this page only listens for taps on them. The profile badge is rendered by App.
 */
export function Home({ onPickGame }: Props) {
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onLocked = () => {
      setToast('Game này sắp có, bạn chờ nhé!');
      setTimeout(() => setToast(''), 2000);
    };
    bridge.on('hub:select', onPickGame);
    bridge.on('hub:locked', onLocked);
    return () => {
      bridge.off('hub:select', onPickGame);
      bridge.off('hub:locked', onLocked);
    };
  }, [onPickGame]);

  return toast ? <Toast>{toast}</Toast> : null;
}
