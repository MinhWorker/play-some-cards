// Re-encodes the app's sounds from the originals under assets/ (see assets/audio.json).
//   npm run audio              rebuild every sound
//   npm run audio -- <name>    rebuild only these
// Output: apps/web/public/shared/audio/<name>.<format>, or games/<game>/assets/<file or name> for
// sounds with "game" ("unsorted" ones stay in apps/web/public/audio/). mp3 (128 kbps) by default, or wav (mono 16-bit)
// for short effects, since MP3 always starts with ~25 ms of encoder padding. Short fades at cuts.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeSound } from './lib/media.mjs';

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
  const src = join(root, 'assets', sound.src);
  if (!existsSync(src)) {
    console.error(`✗ ${name}: missing ${src}`);
    process.exitCode = 1;
    continue;
  }
  const format = sound.format ?? 'mp3';
  const outDir = sound.unsorted
    ? join(root, 'apps/web/public/audio')
    : sound.game
      ? join(root, 'games', sound.game, 'assets')
      : join(root, 'apps/web/public/shared/audio');
  if (encodeSound(src, join(outDir, `${sound.file ?? name}.${format}`), sound))
    console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}: ffmpeg failed`);
    process.exitCode = 1;
  }
}
