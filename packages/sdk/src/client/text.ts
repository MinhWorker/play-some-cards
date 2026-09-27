import type Phaser from 'phaser';
import { currentFrame } from './frame.js';

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

/**
 * HUD scale: multiply font and button sizes by it (not board sizes). About 1.35 in design units
 * (docs/ui-guide.md), times the HUD size the player picked.
 */
export function hudScale() {
  return currentFrame().hud;
}
