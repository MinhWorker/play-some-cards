import { useEffect, useState } from 'react';
import { serverUrl } from '@/lib/auth';
import { socket } from '@/lib/socket';
import { APP_COMMIT, APP_VERSION, type BuildInfo, versionLabel } from '@/lib/version';
import './VersionTag.css';

const web: BuildInfo = { version: APP_VERSION, commit: APP_COMMIT };

/** Web and server versions, small in the bottom-left corner on every screen. */
export function VersionTag() {
  const [server, setServer] = useState<BuildInfo | null>(null);

  // Asked again on every (re)connect: the server may have been redeployed.
  useEffect(() => {
    const load = () => {
      fetch(`${serverUrl ?? ''}/api/health`)
        .then((res) => res.json() as Promise<BuildInfo>)
        .then(({ version, commit }) => setServer({ version, commit }))
        .catch(() => {});
    };
    if (socket.connected) load();
    socket.on('connect', load);
    return () => {
      socket.off('connect', load);
    };
  }, []);

  return <p className="version-tag">{versionLabel(web, server)}</p>;
}
