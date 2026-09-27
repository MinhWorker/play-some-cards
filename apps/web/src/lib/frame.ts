/**
 * The frame (docs/ui-guide.md, `pickFrame` in @psc/sdk/client): measured from the window and its
 * safe area (notch, home bar), shared with Phaser (PhaserStage puts it in the registry) and with
 * CSS as variables on <html>:
 *   --frame-left/top/width/height  where the frame is, in CSS px (`.ui` covers it)
 *   --unit                         CSS px per design unit
 *   --hud                          `zoom` of `.hud` panels (design HUD scale × --unit)
 *
 * The player's view settings (the settings panel; kept per device, since they suit a screen)
 * change it too: the HUD size scales text and buttons, the screen margin keeps the frame that
 * far from the screen's edges, and the picture quality caps the canvas's pixel density (fewer
 * pixels to draw: smoother on slow phones, a little softer).
 */
import { type Frame, pickFrame, setFrame } from '@psc/sdk/client';
import { devSetting, subscribeDevSettings } from '@/lib/devTools';

const listeners = new Set<(frame: Frame) => void>();
let current: Frame | null = null;

export interface ViewSettings {
  /** HUD size, 1 = 100% (HUD_SIZES). */
  hudSize: number;
  /** Extra space between the frame and the screen's edges, in CSS px (MARGINS). */
  margin: number;
  /** The highest pixel density the canvas draws at (QUALITIES). */
  quality: number;
}

export const HUD_SIZES = [0.8, 0.9, 1, 1.1, 1.2, 1.3];
export const MARGINS = [0, 8, 16, 24, 32];
/** Picture quality: the canvas's pixel density at most (low, medium, high). */
export const QUALITIES = [1, 2, 3];
const VIEW_KEY = 'psc:view';
const DEFAULT_VIEW: ViewSettings = { hudSize: 1, margin: 0, quality: 3 };
let view = loadView();

function loadView(): ViewSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as Partial<ViewSettings>;
    return {
      hudSize: HUD_SIZES.includes(saved?.hudSize ?? -1)
        ? (saved.hudSize as number)
        : DEFAULT_VIEW.hudSize,
      margin: MARGINS.includes(saved?.margin ?? -1)
        ? (saved.margin as number)
        : DEFAULT_VIEW.margin,
      quality: QUALITIES.includes(saved?.quality ?? -1)
        ? (saved.quality as number)
        : DEFAULT_VIEW.quality,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export function viewSettings() {
  return view;
}

/** Changes the player's view settings: saved on this device, and the frame follows at once. */
export function setViewSettings(change: Partial<ViewSettings>) {
  view = { ...view, ...change };
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {}
  measure();
}

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
  // The player's margin, but never so much that little is left.
  const m = Math.min(view.margin, r.width / 8, r.height / 8);
  return { left: r.left + m, top: r.top + m, width: r.width - 2 * m, height: r.height - 2 * m };
}

function measure() {
  const frame = pickFrame({
    screen: { width: window.innerWidth, height: window.innerHeight },
    safe: safeArea(),
    devicePixelRatio: window.devicePixelRatio || 1,
    width: devSetting('frameWidth') || undefined,
    maxDpr: devSetting('maxDpr') || view.quality,
    hudSize: view.hudSize,
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
