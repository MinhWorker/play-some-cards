/**
 * The frame: every screen is laid out in design units on a landscape frame 720 units tall, in
 * one of five aspect ratios (docs/ui-guide.md). The app picks the widest one the screen holds and
 * scales it to fit; the canvas has the screen's real pixel density, so what is drawn stays sharp.
 *
 * A scene's camera maps design units onto the canvas: the frame's top-left corner is (0, 0) and
 * `view` its size. The camera covers the whole canvas, so what lies beyond the frame (`bleed`)
 * shows too: draw backgrounds out to it, keep what must be seen inside the frame.
 * `followFrame` (followFrame.ts) points a scene's camera at it.
 */
/** Registry key of the current `Frame` (the app sets it; scenes follow it). */
export const FRAME = 'frame';

/** The frame's height in design units. */
export const FRAME_HEIGHT = 720;
/** The frame's possible widths: 4:3, 16:10, 16:9, 2:1 and 20:9. */
export const FRAME_WIDTHS = [960, 1152, 1280, 1440, 1600] as const;
/** Pixel density is capped here: sharper than this isn't worth the memory and fill rate. */
export const MAX_DPR = 3;
/**
 * The HUD scale in design units at the player's 100%: sizes written for the old desktop layout
 * (`32 * hudScale()`) come out the size they had on phones.
 */
export const HUD_BASE = 1.35;

export interface Frame {
  /** The frame in design units. */
  view: { width: number; height: number };
  /** What the canvas shows around it, in design units (`left`/`top` ≤ 0). */
  bleed: { left: number; top: number; right: number; bottom: number };
  /** Canvas pixels per design unit (the cameras' zoom). */
  zoom: number;
  /** Canvas pixels per CSS pixel. */
  dpr: number;
  /** The canvas in canvas pixels. */
  canvas: { width: number; height: number };
  /** Where the frame is on the page in CSS pixels, and CSS pixels per design unit. */
  css: { left: number; top: number; width: number; height: number; unit: number };
  /** Multiply font and button sizes by it (`hudScale()`); board sizes don't. */
  hud: number;
}

export interface FrameInput {
  /** The page in CSS pixels. */
  screen: { width: number; height: number };
  /** The part of it clear of notches and the home bar, in CSS pixels. */
  safe: { left: number; top: number; width: number; height: number };
  devicePixelRatio: number;
  /** A frame width to use whatever the screen (dev tools). */
  width?: number;
  /** A lower cap on the pixel density than MAX_DPR (to trade sharpness for speed). */
  maxDpr?: number;
  /** The player's HUD size, 1 = 100%. */
  hudSize?: number;
}

/** The frame for a screen: the widest ratio the safe area holds, as big as it fits. */
export function pickFrame({
  screen,
  safe,
  devicePixelRatio,
  width,
  maxDpr = MAX_DPR,
  hudSize = 1,
}: FrameInput): Frame {
  const ratio = safe.width / Math.max(1, safe.height);
  const fits = FRAME_WIDTHS.filter((w) => w / FRAME_HEIGHT <= ratio + 1e-6);
  const viewWidth =
    width && (FRAME_WIDTHS as readonly number[]).includes(width)
      ? width
      : (fits[fits.length - 1] ?? FRAME_WIDTHS[0]);
  const unit = Math.min(safe.width / viewWidth, safe.height / FRAME_HEIGHT);
  const css = {
    left: safe.left + (safe.width - viewWidth * unit) / 2,
    top: safe.top + (safe.height - FRAME_HEIGHT * unit) / 2,
    width: viewWidth * unit,
    height: FRAME_HEIGHT * unit,
    unit,
  };
  const dpr = Math.max(1, Math.min(devicePixelRatio, maxDpr, MAX_DPR));
  const canvas = { width: Math.round(screen.width * dpr), height: Math.round(screen.height * dpr) };
  const zoom = unit * dpr;
  const x = css.left * dpr;
  const y = css.top * dpr;
  return {
    view: { width: viewWidth, height: FRAME_HEIGHT },
    bleed: {
      left: -x / zoom,
      top: -y / zoom,
      right: (canvas.width - x) / zoom,
      bottom: (canvas.height - y) / zoom,
    },
    zoom,
    dpr,
    canvas,
    css,
    hud: HUD_BASE * hudSize,
  };
}

let current: Frame | null = null;

/** The app sets the frame here (and in the registry, for scenes to follow). */
export function setFrame(frame: Frame) {
  current = frame;
}

/** The current frame, or a desktop-like default before the app has set one (tests). */
export function currentFrame(): Frame {
  return (
    current ??
    pickFrame({
      screen: { width: 1280, height: 720 },
      safe: { left: 0, top: 0, width: 1280, height: 720 },
      devicePixelRatio: 1,
    })
  );
}
