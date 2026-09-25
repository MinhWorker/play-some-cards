/**
 * HUD scale: small screens (phones, and phones held sideways) shrink the React UI and the
 * board's text so everything fits instead of being cut off. 1 on desktop.
 * CSS reads it as `var(--hud)` through the `.hud` class (styles/base.css); Phaser scenes call `hudScale()`.
 */
const MIN = 0.66;

export function hudScale() {
  const { innerWidth: w, innerHeight: h } = window;
  return Math.max(MIN, Math.min(1, w / 440, h / 620));
}

/** Keeps `--hud` on <html> up to date. Call once at startup. */
export function installHudScale() {
  const apply = () => document.documentElement.style.setProperty('--hud', String(hudScale()));
  apply();
  window.addEventListener('resize', apply);
}
