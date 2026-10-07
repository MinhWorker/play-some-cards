import { useEffect, useState } from 'react';
import { type NewBuild, onNewBuild } from '@/lib/newBuild';

/** Whether the site has a newer build than this page (lib/newBuild.ts): then it must reload. */
export function useNewBuild() {
  const [build, setBuild] = useState<NewBuild | null>(null);
  useEffect(() => onNewBuild(setBuild), []);
  return build;
}
