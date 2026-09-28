import { useEffect, useState } from 'react';
import { onNewBuild } from '@/lib/newBuild';

/** Whether the site has a newer build than this page (lib/newBuild.ts): then it must reload. */
export function useNewBuild() {
  const [shown, setShown] = useState(false);
  useEffect(() => onNewBuild(() => setShown(true)), []);
  return shown;
}
