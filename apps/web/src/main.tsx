// Global styles first: component stylesheets (imported by each component) build on them.
import '@/styles/theme.css';
import '@/styles/base.css';
import { setClientHost } from '@psc/sdk/client';
import { AVATARS } from '@psc/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { DevTools, RotateHint } from '@/components/hud';
import { gameAssets, showWip } from '@/games';
import { imageUrl } from '@/lib/assetUrl';
import { devToolsEnabled } from '@/lib/devTools';
import { installFrame } from '@/lib/frame';
import { playSfx, playSoundUrl, prepareSoundUrl } from '@/lib/sound';
import { installWakeLock } from '@/lib/wakeLock';
import { Sandbox, sandboxFromUrl } from '@/pages/Sandbox/Sandbox';

installFrame();
installWakeLock();

// Chrome can install from the menu without a service worker, but its install promotion
// requires one with a fetch handler.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.error('Service worker registration failed', error);
  });
}

// What game screens get from the app: their asset URLs, the app's sound channels and the
// button sounds (so a game's buttons click like the app's).
setClientHost({
  assets: gameAssets,
  prepareSound: prepareSoundUrl,
  playSound: (url, options) => playSoundUrl(url, options),
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
    <RotateHint />
    {devToolsEnabled && <DevTools />}
  </StrictMode>,
);
