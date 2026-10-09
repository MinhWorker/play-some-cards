import { useEffect } from 'react';
import { bridge } from '@/phaser/bridge';

/**
 * While `open`, the board gets no key presses: Esc or Space meant for an app dialog must not also
 * open the game's rules or place a bomb behind it.
 */
export function useDialogKeys(open = true) {
  useEffect(() => {
    if (!open) return;
    bridge.emit('ui:dialog', true);
    return () => {
      bridge.emit('ui:dialog', false);
    };
  }, [open]);
}
