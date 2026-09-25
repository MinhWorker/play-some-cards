// Global styles first: component stylesheets (imported by each component) build on them.
import '@/styles/theme.css';
import '@/styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { installHudScale } from '@/lib/hudScale';

installHudScale();

// biome-ignore lint/style/noNonNullAssertion: #root is in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
