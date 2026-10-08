import type Phaser from 'phaser';
export const THEME = {
  ink: 0x603c50,
  panel: 0xfff6e7,
  gold: 0xf4ba62,
  paper: '#603c50',
  muted: '#927384',
  teal: 0x86d8be,
  outline: 0x9f695a,
  shadow: 0xc39176,
  wood: 0xe3aa70,
  peach: 0xffd9bc,
  pink: 0xffa5b6,
  mint: 0xc8efd7,
  cream: 0xfff6e7,
  paperLight: '#fffaf1',
};
export const textStyle = (
  size: number,
  color = THEME.paper,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: '"Baloo 2", system-ui, sans-serif',
  fontSize: `${size}px`,
  fontStyle: '700',
  color,
  strokeThickness: 0,
  align: 'center',
});
