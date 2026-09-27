import { describe, expect, it } from 'vitest';
import { HUD_BASE, pickFrame } from './frame.js';

const full = (width: number, height: number) => ({
  screen: { width, height },
  safe: { left: 0, top: 0, width, height },
});

describe('pickFrame', () => {
  it('takes the widest ratio the screen holds', () => {
    // A 1080×2400 Android phone held sideways: exactly 20:9.
    expect(pickFrame({ ...full(800, 360), devicePixelRatio: 3 }).view).toEqual({
      width: 1600,
      height: 720,
    });
    // 16:9 laptop, 4:3 iPad, 16:10 laptop, 2:1 phone.
    expect(pickFrame({ ...full(1366, 768), devicePixelRatio: 1 }).view.width).toBe(1280);
    expect(pickFrame({ ...full(1024, 768), devicePixelRatio: 2 }).view.width).toBe(960);
    expect(pickFrame({ ...full(1440, 900), devicePixelRatio: 2 }).view.width).toBe(1152);
    expect(pickFrame({ ...full(720, 360), devicePixelRatio: 2 }).view.width).toBe(1440);
  });

  it('falls back to 4:3 on narrow and portrait screens', () => {
    const frame = pickFrame({ ...full(390, 844), devicePixelRatio: 3 });
    expect(frame.view.width).toBe(960);
    // Fits the width, centred vertically.
    expect(frame.css.width).toBeCloseTo(390);
    expect(frame.css.top).toBeCloseTo((844 - 292.5) / 2);
  });

  it('fits the safe area and centres the frame in it', () => {
    // iPhone 15 sideways: the notch and the home bar leave 734×372.
    const frame = pickFrame({
      screen: { width: 852, height: 393 },
      safe: { left: 59, top: 0, width: 734, height: 372 },
      devicePixelRatio: 3,
    });
    expect(frame.view.width).toBe(1280);
    // 16:9 is narrower than 734:372: the height is the limit, the rest is sky at the sides.
    expect(frame.css.unit).toBeCloseTo(372 / 720);
    expect(frame.css.top).toBeCloseTo(0);
    expect(frame.css.left).toBeCloseTo(59 + (734 - (1280 * 372) / 720) / 2);
  });

  it('draws at the pixel density, capped at 3', () => {
    const frame = pickFrame({ ...full(800, 360), devicePixelRatio: 3.5 });
    expect(frame.dpr).toBe(3);
    expect(frame.canvas).toEqual({ width: 2400, height: 1080 });
    expect(frame.zoom).toBeCloseTo(1.5);
    expect(pickFrame({ ...full(800, 360), devicePixelRatio: 3, maxDpr: 1.5 }).dpr).toBe(1.5);
  });

  it('reports the bleed around the frame in design units', () => {
    // 16:9 frame on a 20:9 screen: sky on both sides.
    const frame = pickFrame({ ...full(800, 360), devicePixelRatio: 2, width: 1280 });
    expect(frame.bleed.left).toBeCloseTo(-160);
    expect(frame.bleed.right).toBeCloseTo(1440);
    expect(frame.bleed.top).toBeCloseTo(0);
    expect(frame.bleed.bottom).toBeCloseTo(720);
  });

  it('scales the HUD by the player’s size', () => {
    expect(pickFrame({ ...full(800, 360), devicePixelRatio: 1 }).hud).toBe(HUD_BASE);
    expect(pickFrame({ ...full(800, 360), devicePixelRatio: 1, hudSize: 1.2 }).hud).toBeCloseTo(
      HUD_BASE * 1.2,
    );
  });
});
