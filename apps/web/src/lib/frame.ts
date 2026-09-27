/**
 * The frame (docs/ui-guide.md, `pickFrame` in @psc/sdk/client): measured from the window and its
 * safe area (notch, home bar), shared with Phaser (PhaserStage puts it in the registry) and with
 * CSS as variables on <html>:
 *   --frame-left/top/width/height  where the frame is, in CSS px (`.ui` covers it)
 *   --unit                         CSS px per design unit
 *   --hud                          `zoom` of `.hud` panels (design HUD scale × --unit)
 */
import { type Frame, pickFrame, setFrame } from '@psc/sdk/client';
import { devSetting, subscribeDevSettings } from '@/lib/devTools';

const listeners = new Set<(frame: Frame) => void>();
let current: Frame | null = null;

/** The safe area in CSS px, read from a fixed box inset by env(safe-area-inset-*). */
function safeArea() {
  let probe = document.getElementById('safe-area-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'safe-area-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;inset:var(--safe);visibility:hidden;pointer-events:none';
    document.body.append(probe);
  }
  const r = probe.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function measure() {
  const frame = pickFrame({
    screen: { width: window.innerWidth, height: window.innerHeight },
    safe: safeArea(),
    devicePixelRatio: window.devicePixelRatio || 1,
    width: devSetting('frameWidth') || undefined,
    maxDpr: devSetting('maxDpr') || undefined,
  });
  const { css } = frame;
  const style = document.documentElement.style;
  style.setProperty('--frame-left', `${css.left}px`);
  style.setProperty('--frame-top', `${css.top}px`);
  style.setProperty('--frame-width', `${css.width}px`);
  style.setProperty('--frame-height', `${css.height}px`);
  style.setProperty('--unit', String(css.unit));
  style.setProperty('--hud', String(frame.hud * css.unit));
  setFrame(frame);
  current = frame;
  for (const fn of listeners) fn(frame);
}

/** Measures the frame now and on every resize or turn. Call once at startup. */
export function installFrame() {
  measure();
  window.addEventListener('resize', measure);
  // Some browsers report the new size only after the turn has finished.
  screen.orientation?.addEventListener('change', () => setTimeout(measure, 100));
  subscribeDevSettings(measure);
}

export function currentAppFrame() {
  if (!current) measure();
  return current as Frame;
}

export function onFrame(fn: (frame: Frame) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
