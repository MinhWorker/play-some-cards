/**
 * Every image in apps/web/public/images. Keys match the file names and the entries in
 * assets/prompts.json (generate new art with `npm run gen:asset -- <name>`).
 */
export const IMAGE_KEYS = [
  'sky',
  'cloud-a',
  'cloud-b',
  'island-caro',
  'island-cards',
  'island-dice',
  'island-chess',
  'sign',
  'sign-hover',
  'orb',
  'bird',
  'vine',
  'lock',
  'tile',
  'piece-x',
  'piece-o',
] as const;

export type ImageKey = (typeof IMAGE_KEYS)[number];

/** Font loaded in index.html; Phaser text must wait for it (see PhaserStage). */
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
