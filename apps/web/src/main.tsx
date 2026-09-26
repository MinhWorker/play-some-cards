// Global styles first: component stylesheets (imported by each component) build on them.
import '@/styles/theme.css';
import '@/styles/base.css';
import { setClientHost } from '@psc/sdk/client';
import { AVATARS } from '@psc/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { DevTools } from '@/components/hud';
import { gameAssets, showWip } from '@/games';
import { imageUrl } from '@/lib/assetUrl';
import { devToolsEnabled } from '@/lib/devTools';
import { installHudScale } from '@/lib/hudScale';
import { loadSoundUrl, playSfx, playSoundUrl } from '@/lib/sound';
import { Sandbox, sandboxFromUrl } from '@/pages/Sandbox/Sandbox';

installHudScale();
// What game screens get from the app: their asset URLs, the app's sound channels and the
// button sounds (so a game's buttons click like the app's).
setClientHost({
  assets: gameAssets,
  loadSound: loadSoundUrl,
  playSound: playSoundUrl,
  playUiSound: (kind) => playSfx(kind === 'click' ? 'button-click' : 'button-hover'),
  avatars: () =>
    Object.fromEntries([...AVATARS, 'bot'].map((name) => [name, imageUrl(`avatar-${name}`)])),
});

// `/?play=<id>` tries a game alone (dev and PR previews only), otherwise the real app.
const sandbox = sandboxFromUrl(showWip);

// biome-ignore lint/style/noNonNullAssertion: #root is in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sandbox ? <Sandbox {...sandbox} /> : <App />}
    {devToolsEnabled && <DevTools />}
  </StrictMode>,
);
