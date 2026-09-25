declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string | null;

/** Set at build time (vite.config.ts): root package.json version and the git commit. */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;

/** e.g. `v0.2.0 · 1a2b3c4` */
export const versionLabel = `v${APP_VERSION}${APP_COMMIT ? ` · ${APP_COMMIT}` : ''}`;
