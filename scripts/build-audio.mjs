// Re-encodes the app's sounds from the originals in assets/audio/ (see assets/audio.json).
//   npm run audio              rebuild every sound
//   npm run audio -- <name>    rebuild only these
// Output: apps/web/public/audio/<name>.<format>: mp3 (128 kbps) by default, or wav (mono 16-bit)
// for short effects, since MP3 always starts with ~25 ms of encoder padding. Short fades at cuts.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { sounds } = JSON.parse(readFileSync(join(root, 'assets/audio.json'), 'utf8'));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(sounds);

for (const name of names) {
  const sound = sounds[name];
  if (!sound) {
    console.error(`✗ ${name}: not in assets/audio.json (have: ${Object.keys(sounds).join(', ')})`);
    process.exitCode = 1;
    continue;
  }
  const src = join(root, 'assets/audio', sound.src);
  if (!existsSync(src)) {
    console.error(`✗ ${name}: missing ${src}`);
    process.exitCode = 1;
    continue;
  }
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
  const format = sound.format ?? 'mp3';
  args.push('-map_metadata', '-1');
  if (format === 'wav') args.push('-ac', '1', '-c:a', 'pcm_s16le');
  else args.push('-b:a', '128k');
  args.push(join(root, 'apps/web/public/audio', `${name}.${format}`));
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status === 0) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}: ffmpeg failed`);
    process.exitCode = 1;
  }
}
