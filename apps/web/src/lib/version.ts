declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string | null;

/** Set at build time (vite.config.ts): root package.json version and the git commit. */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;

export interface BuildInfo {
  version: string;
  commit: string | null;
}

/**
 * Web build, then server build (they deploy separately). The project shares one version, so
 * when both match it is shown once with each side's commit: `v0.2.0 · 1a2b3c4 · 5d6e7f8`.
 * Otherwise each side in full: `v0.2.1 · 1a2b3c4 · v0.2.0 · 5d6e7f8`.
 */
export function versionLabel(web: BuildInfo, server?: BuildInfo | null) {
  const commits = (...list: (string | null)[]) => [...new Set(list.filter(Boolean))];
  if (!server || server.version === web.version)
    return [`v${web.version}`, ...commits(web.commit, server?.commit ?? null)].join(' · ');
  return [
    `v${web.version}`,
    ...commits(web.commit),
    `v${server.version}`,
    ...commits(server.commit),
  ].join(' · ');
}
