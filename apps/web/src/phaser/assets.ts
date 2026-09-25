import { type AssetOwner, imageUrl } from '@/lib/assetUrl';

/**
 * Every image Phaser uses, with the folder it lives in: 'shared' (apps/web/public/shared/images)
 * or a game id (apps/web/public/games/<id>/images). Keys match the entries in
 * assets/prompts.json (generate new art with `npm run gen:asset -- <name>`).
 */
const IMAGES = {
  sky: 'shared',
  'cloud-a': 'shared',
  'cloud-b': 'shared',
  'island-caro': 'shared',
  'island-cards': 'shared',
  'island-dice': 'shared',
  'island-chess': 'shared',
  sign: 'shared',
  'sign-hover': 'shared',
  orb: 'shared',
  bird: 'shared',
  vine: 'shared',
  lock: 'shared',
  tile: 'tic-tac-toe',
  'piece-x': 'tic-tac-toe',
  'piece-o': 'tic-tac-toe',
} satisfies Record<string, AssetOwner>;

export const IMAGE_KEYS = Object.keys(IMAGES) as ImageKey[];
export const imagePath = (key: ImageKey) => imageUrl(key, IMAGES[key]);

export type ImageKey = keyof typeof IMAGES;

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
