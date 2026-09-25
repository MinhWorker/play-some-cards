// Global styles first: component stylesheets (imported by each component) build on them.
import '@/styles/theme.css';
import '@/styles/base.css';
import { setClientHost } from '@psc/sdk/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { gameAssets } from '@/games';
import { installHudScale } from '@/lib/hudScale';
import { loadSoundUrl, playSoundUrl } from '@/lib/sound';

installHudScale();
// What game boards get from the app: their asset URLs and the app's sound channels.
setClientHost({ assets: gameAssets, loadSound: loadSoundUrl, playSound: playSoundUrl });

// biome-ignore lint/style/noNonNullAssertion: #root is in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
