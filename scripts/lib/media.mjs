// Turning original art into app-ready images. Used by assets.mjs and gen-asset.mjs.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

/**
 * Image -> WebP. `transparent` warns if the background isn't transparent and normally trims
 * empty edges; `preserveCanvas` keeps those edges for animation frames that share an anchor.
 * `maxSize` caps the longest side (default 1024).
 */
export async function toWebp(
  src,
  out,
  { transparent = false, preserveCanvas = false, maxSize = 1024, label = out } = {},
) {
  mkdirSync(dirname(out), { recursive: true });
  let img = sharp(src);
  if (transparent) {
    const { channels } = await img.metadata();
    const alpha = channels === 4 ? (await img.stats()).channels[3] : null;
    if (!alpha || alpha.min > 10) console.warn(`! ${label}: background is not transparent`);
    if (!preserveCanvas) img = sharp(await img.trim().toBuffer());
  }
  await img
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(out);
}

/** Whether an image has an alpha channel (then it is treated as transparent). */
export async function hasAlpha(src) {
  return (await sharp(src).metadata()).hasAlpha === true;
}
