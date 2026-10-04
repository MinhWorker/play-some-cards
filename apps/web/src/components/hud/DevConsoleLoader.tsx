/** Lazy overlay loading and dev-only automation entry points, independent of the master switch. */
import type { RoomSnapshot } from '@psc/shared';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { devSetting, devToolsEnabled, subscribeDevSettings } from '@/lib/devTools';

const DevConsole = lazy(() => import('./DevConsole/DevConsole'));
let currentRoom: RoomSnapshot | null = null;
if (devToolsEnabled)
  Object.assign(window, {
    __devCommand: async (line: string) => {
      const store = await import('@/lib/devConsole');
      store.setConsoleRoom(currentRoom);
      return store.runCommand(line);
    },
    __devRoomLogs: async () => (await import('@/lib/devConsole')).readRoomLogs(),
  });
export function DevConsoleLoader({ room }: { room: RoomSnapshot | null }) {
  currentRoom = room;
  const enabled = useSyncExternalStore(
    subscribeDevSettings,
    () => devToolsEnabled && devSetting('console'),
  );
  return enabled ? (
    <Suspense fallback={null}>
      <DevConsole room={room} />
    </Suspense>
  ) : null;
}
