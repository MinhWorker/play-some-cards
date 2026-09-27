import { useEffect, useState } from 'react';
import { onNewBuild } from '@/lib/newBuild';

/**
 * Whether to offer a reload because the site has a newer build than this page (lib/newBuild.ts).
 * `later` hides the offer until the next check finds it again (another failed download).
 */
export function useNewBuild() {
  const [shown, setShown] = useState(false);
  useEffect(() => onNewBuild(() => setShown(true)), []);
  return { shown, later: () => setShown(false) };
}
