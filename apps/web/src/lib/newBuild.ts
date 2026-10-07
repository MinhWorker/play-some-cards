/**
 * Notices when the web app was deployed again while this page is open. Each build names its
 * files by hash and the host only serves the newest ones, so an old page fails to download a
 * game's code (a 404) and can't open the game until it reloads.
 *
 * The check fetches index.html again (it is never cached) and compares its entry script with
 * the one this page runs. It runs when a download fails and when the tab comes back into view.
 * In dev the entry is /src/main.tsx in both, so it never fires.
 */

import { type DeploymentBuild, deploymentOf } from './deployment';

export interface NewBuild {
  entry: string;
  build: DeploymentBuild | null;
}

type Listener = (build: NewBuild) => void;
const listeners = new Set<Listener>();
let found: NewBuild | null = null;
let checking: Promise<void> | null = null;
let lastCheck = 0;
/** Checks on coming back into view are spaced out by this much. */
const RECHECK_MS = 5 * 60_000;

/** The entry script in `html`, e.g. "/assets/index-v5iJ465G.js". */
function entryOf(html: string) {
  return html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? null;
}

const current = entryOf(document.documentElement.outerHTML);

/** Calls `listener` once a newer build is found (right away if it already was). */
export function onNewBuild(listener: Listener) {
  listeners.add(listener);
  if (found) listener(found);
  return () => {
    listeners.delete(listener);
  };
}

/** Looks for a newer build now (one check at a time); `listener`s hear about it. */
export function checkForNewBuild() {
  if (!current) return Promise.resolve();
  checking ??= fetch('/', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    .then((res) => (res.ok ? res.text() : ''))
    .then((html) => {
      const latest = entryOf(html);
      if (!latest || (latest === current && !found)) return;
      const build = deploymentOf(html);
      if (found?.entry === latest && JSON.stringify(found.build) === JSON.stringify(build)) return;
      found = { entry: latest, build };
      for (const listener of listeners) listener(found);
    })
    .catch(() => {})
    .finally(() => {
      lastCheck = Date.now();
      checking = null;
    });
  return checking;
}

// A lazy file (a game's code) failed to download: most likely the page is older than the site.
window.addEventListener('vite:preloadError', () => void checkForNewBuild());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastCheck > RECHECK_MS) {
    void checkForNewBuild();
  }
});
