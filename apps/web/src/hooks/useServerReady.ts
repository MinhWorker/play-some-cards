import { useEffect, useState } from 'react';
import { serverUrl } from '@/lib/auth';
import type { DeploymentBuild } from '@/lib/deployment';
import { checkForNewBuild } from '@/lib/newBuild';

const RETRY_MS = 3000;
const REQUEST_MS = 10_000;

/** No health response is a connection wait, not evidence of a deployment. */
export type ServerReadiness = 'waiting' | 'deploying' | 'ready';

/** Wait for the running backend, not just an old healthy process with the same protocol. */
export function useServerReady(build: DeploymentBuild | null, enabled = true) {
  const [result, setResult] = useState<{ build: DeploymentBuild | null; state: ServerReadiness }>();
  const bypass = build?.waitForServer === false;

  useEffect(() => {
    if (!enabled || bypass) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const unavailable = () => {
      if (stopped) return;
      // Once a mismatch is observed, a restart is part of that update. Keep the evidence
      // for this target until the running backend reports a matching build.
      setResult((previous) =>
        previous?.build === build && previous.state === 'deploying'
          ? previous
          : { build, state: 'waiting' },
      );
    };
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
          if (stopped) return;
          if (
            health?.ok === true &&
            typeof health.commit === 'string' &&
            health.commit.length > 0 &&
            Number.isInteger(health.protocol)
          ) {
            if (health.commit !== build.commit || health.protocol !== build.protocol) {
              setResult({ build, state: 'deploying' });
            } else if (health.db === 'down') {
              // The target backend is already running; its DB outage is not a deploy.
              setResult({ build, state: 'waiting' });
            } else {
              setResult({ build, state: 'ready' });
              return;
            }
          } else {
            unavailable();
          }
        } else {
          unavailable();
        }
      } catch {
        unavailable();
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

  return bypass ? 'ready' : result?.build === build ? result.state : 'waiting';
}
