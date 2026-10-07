import { useEffect, useState } from 'react';
import { serverUrl } from '@/lib/auth';
import type { DeploymentBuild } from '@/lib/deployment';
import { checkForNewBuild } from '@/lib/newBuild';

const RETRY_MS = 3000;
const REQUEST_MS = 10_000;

/** Wait for the running backend, not just an old healthy process with the same protocol. */
export function useServerReady(build: DeploymentBuild | null, enabled = true) {
  const [ready, setReady] = useState<DeploymentBuild | null>(null);
  const bypass = build?.waitForServer === false;

  useEffect(() => {
    if (!enabled || bypass) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const poll = async () => {
      // Deploys may supersede the target while Render is still building it. Also recovers
      // an already-open page when the backend deploys before Vercel does.
      await checkForNewBuild();
      if (stopped) return;
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), REQUEST_MS);
      try {
        if (build?.commit) {
          const res = await fetch(`${serverUrl ?? ''}/api/health`, {
            cache: 'no-store',
            signal: request.signal,
          });
          const health = res.ok ? await res.json() : null;
          if (
            !stopped &&
            health?.ok === true &&
            health.db !== 'down' &&
            health.commit === build.commit &&
            health.protocol === build.protocol
          ) {
            setReady(build);
            return;
          }
        }
      } catch {
        // A restart or temporarily unavailable network keeps the update screen in place.
      } finally {
        clearTimeout(timeout);
      }
      if (!stopped) retry = setTimeout(() => void poll(), RETRY_MS);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(retry);
      request?.abort();
    };
  }, [build, enabled, bypass]);

  return bypass || (build !== null && ready === build);
}
