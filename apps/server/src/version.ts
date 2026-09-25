import { readFileSync } from 'node:fs';

/**
 * The app version (root package.json, bumped by release-please) and the deployed commit.
 * Render sets RENDER_GIT_COMMIT; locally there is no commit.
 */
const rootPackage = new URL('../../../package.json', import.meta.url);

export const APP_VERSION: string = JSON.parse(readFileSync(rootPackage, 'utf8')).version;
export const APP_COMMIT: string | null = process.env.RENDER_GIT_COMMIT?.slice(0, 7) || null;
