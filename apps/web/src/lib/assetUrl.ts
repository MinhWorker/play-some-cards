/**
 * URLs of files in apps/web/public/. Files used across the app live in `shared/`; files used
 * by one game only live in `games/<gameId>/`. The same split is used in assets/ (originals).
 */
export type AssetOwner = 'shared' | (string & {});

const folder = (owner: AssetOwner) => (owner === 'shared' ? '/shared' : `/games/${owner}`);

/** Generated art, e.g. imageUrl('sky') or imageUrl('tile', 'tic-tac-toe'). */
export const imageUrl = (name: string, owner: AssetOwner = 'shared') =>
  `${folder(owner)}/images/${name}.webp`;

/** Built sounds (see assets/audio.json): WAV for short effects, MP3 for music. */
export const soundUrl = (
  name: string,
  owner: AssetOwner = 'shared',
  format: 'wav' | 'mp3' = 'wav',
) => `${folder(owner)}/audio/${name}.${format}`;
