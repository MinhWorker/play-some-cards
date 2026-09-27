/**
 * Keeps the screen on while the app is in front, so a phone doesn't dim and lock in the middle
 * of a game. The browser drops the lock whenever the page is hidden, so it is asked for again
 * when the page comes back, and on a tap (some browsers only grant it after one). Browsers
 * without the Screen Wake Lock API just let the screen sleep as usual.
 */
export function installWakeLock() {
  if (!('wakeLock' in navigator)) return;
  let lock: WakeLockSentinel | null = null;
  let asking = false;
  const request = () => {
    if (asking || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    asking = true;
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => {})
      .finally(() => {
        asking = false;
      });
  };
  request();
  document.addEventListener('visibilitychange', request);
  document.addEventListener('pointerdown', request, { passive: true });
}
