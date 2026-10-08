import type Phaser from 'phaser';
export const THEME = {
  ink: 0x102c38,
  panel: 0x112e3b,
  gold: 0xcfad70,
  paper: '#fff0d1',
  muted: '#b9cdc9',
  teal: 0x68d7c9,
};
export const textStyle = (
  size: number,
  color = THEME.paper,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: '"Baloo 2", system-ui, sans-serif',
  fontSize: `${size}px`,
  fontStyle: '700',
  color,
  stroke: '#102631',
  strokeThickness: 2,
  align: 'center',
});
