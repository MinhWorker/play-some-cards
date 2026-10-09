import type Phaser from 'phaser';
import type { Element } from '../game/model.js';

/** Garden storybook palette: cream paper, honey wood and warm plum ink. */
export const THEME = {
  ink: 0x5b3a2e,
  panel: 0xfff6e7,
  gold: 0xf4ba62,
  paper: '#5b3a2e',
  muted: '#8f6e5e',
  teal: 0x86d8be,
  outline: 0x8a5a43,
  shadow: 0x6f8f4f,
  wood: 0xd99a5b,
  woodDark: 0x9c6236,
  peach: 0xffd9bc,
  pink: 0xffa5b6,
  mint: 0xc8efd7,
  cream: 0xfff6e7,
  red: 0xf0566a,
  paperLight: '#fffaf1',
  white: '#ffffff',
  stroke: '#5b3a2e',
};

/** The five elemental friends, as players see them. */
export const CHARACTER: Record<Element, { name: string; bar: number; pastel: number }> = {
  fire: { name: 'Cáo Lửa', bar: 0xf25f6b, pastel: 0xffe0cc },
  water: { name: 'Hải Cẩu Nước', bar: 0x4aa8f0, pastel: 0xd3efff },
  lightning: { name: 'Thỏ Sét', bar: 0xa77cf0, pastel: 0xebdfff },
  ice: { name: 'Cánh Cụt Băng', bar: 0x37c2d6, pastel: 0xd8f6fb },
  wind: { name: 'Mèo Gió', bar: 0x55c98a, pastel: 0xd9f5df },
};

export const FONT = '"Baloo 2", system-ui, sans-serif';

export const textStyle = (
  size: number,
  color = THEME.paper,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: '700',
  color,
  strokeThickness: 0,
  align: 'center',
});

/** White game text with a dark outline (timer, buttons, banners). */
export const boldStyle = (
  size: number,
  color = THEME.white,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: '800',
  color,
  stroke: THEME.stroke,
  strokeThickness: Math.max(3, Math.round(size / 6)),
  align: 'center',
});
