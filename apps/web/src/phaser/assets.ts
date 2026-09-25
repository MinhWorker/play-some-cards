import { type AssetOwner, imageUrl } from '@/lib/assetUrl';

export { FONT, titleStyle } from '@psc/sdk/client';

/**
 * Every image the app's own scenes use (apps/web/public/shared/images). Keys match the entries
 * in assets/prompts.json (generate new art with `npm run gen:asset -- <name>`). A game's images
 * live in games/<id>/assets/ and are loaded by its board scene.
 */
const IMAGES = {
  sky: 'shared',
  'cloud-a': 'shared',
  'cloud-b': 'shared',
  'island-cards': 'shared',
  'island-dice': 'shared',
  'island-chess': 'shared',
  sign: 'shared',
  'sign-hover': 'shared',
  orb: 'shared',
  bird: 'shared',
  vine: 'shared',
  lock: 'shared',
  arrow: 'shared',
} satisfies Record<string, AssetOwner>;

export const IMAGE_KEYS = Object.keys(IMAGES) as ImageKey[];
export const imagePath = (key: ImageKey) => imageUrl(key, IMAGES[key]);

export type ImageKey = keyof typeof IMAGES;
