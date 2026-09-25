// Turning original art and sound into app-ready files. Used by assets.mjs, gen-asset.mjs and
// build-audio.mjs.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

/**
 * Image -> WebP. `transparent` trims empty edges (and warns when the "transparent" background
 * isn't); `maxSize` caps the longest side (default 1024).
 */
export async function toWebp(src, out, { transparent = false, maxSize = 1024, label = out } = {}) {
  mkdirSync(dirname(out), { recursive: true });
  let img = sharp(src);
  if (transparent) {
    const { channels } = await img.metadata();
    const alpha = channels === 4 ? (await img.stats()).channels[3] : null;
    if (!alpha || alpha.min > 10) console.warn(`! ${label}: background is not transparent`);
    img = sharp(await img.trim().toBuffer());
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

/**
 * Sound -> app file with ffmpeg. `sound` is an audio.json entry: optional `start`/`duration`
 * (seconds), `speed`, `format` ('mp3' default, 'wav' for short effects: no MP3 start padding).
 * Returns true on success.
 */
export function encodeSound(src, out, sound = {}) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (sound.start) args.push('-ss', String(sound.start));
  args.push('-i', src);
  if (sound.duration) args.push('-t', String(sound.duration));
  // Fade in after a cut start (avoids a click); fade out before a cut end.
  const filters = [];
  if (sound.start) filters.push('afade=t=in:d=0.005');
  // Faster without changing pitch (atempo accepts 0.5–2).
  if (sound.speed) filters.push(`atempo=${sound.speed}`);
  if (sound.duration) filters.push(`afade=t=out:st=${Math.max(0, sound.duration - 0.1)}:d=0.1`);
  if (filters.length) args.push('-af', filters.join(','));
  args.push('-map_metadata', '-1');
  if ((sound.format ?? 'mp3') === 'wav') args.push('-ac', '1', '-c:a', 'pcm_s16le');
  else args.push('-b:a', '128k');
  mkdirSync(dirname(out), { recursive: true });
  args.push(out);
  return spawnSync('ffmpeg', args, { stdio: 'inherit' }).status === 0;
}
