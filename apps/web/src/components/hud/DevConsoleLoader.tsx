/** Load the console UI only when its master dev setting is enabled. */
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { devSetting, devToolsEnabled, subscribeDevSettings } from '@/lib/devTools';

const DevConsole = lazy(() => import('./DevConsole/DevConsole'));
export function DevConsoleLoader() {
  const enabled = useSyncExternalStore(
    subscribeDevSettings,
    () => devToolsEnabled && devSetting('console'),
  );
  return enabled ? (
    <Suspense fallback={null}>
      <DevConsole />
    </Suspense>
  ) : null;
}
