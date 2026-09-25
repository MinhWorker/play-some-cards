import type Phaser from 'phaser';

/** The app's font (loaded by the page before Phaser starts). */
export const FONT = '"Baloo 2", system-ui, sans-serif';

/** Chunky game-style text: white fill with a dark outline. */
export function titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${Math.round(size)}px`,
    fontStyle: '800',
    color: '#ffffff',
    stroke: '#5a3312',
    strokeThickness: Math.max(3, Math.round(size / 6)),
    align: 'center',
  };
}

const MIN_HUD = 0.66;

/**
 * HUD scale: small screens (phones, and phones held sideways) shrink UI text so everything
 * fits. 1 on desktop. Multiply font sizes by it.
 */
export function hudScale() {
  const { innerWidth: w, innerHeight: h } = window;
  return Math.max(MIN_HUD, Math.min(1, w / 440, h / 620));
}
