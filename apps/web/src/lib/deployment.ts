import { PROTOCOL_VERSION } from '@psc/shared';
import { APP_COMMIT } from './version';

declare const __WAIT_FOR_SERVER__: boolean;

/** Production deploys share a commit; PR previews intentionally use the production server. */
export interface DeploymentBuild {
  commit: string | null;
  protocol: number;
  waitForServer: boolean;
}

export const currentBuild: DeploymentBuild = {
  commit: APP_COMMIT,
  protocol: PROTOCOL_VERSION,
  waitForServer: __WAIT_FOR_SERVER__,
};

/** Read the target build without downloading or executing its JavaScript. */
export function deploymentOf(html: string): DeploymentBuild | null {
  try {
    const content = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('meta[name="psc-build"]')
      ?.getAttribute('content');
    if (!content) return null;
    const build = JSON.parse(content) as DeploymentBuild;
    if (
      (build.commit === null || typeof build.commit === 'string') &&
      Number.isInteger(build.protocol) &&
      typeof build.waitForServer === 'boolean'
    )
      return build;
  } catch {}
  return null;
}
