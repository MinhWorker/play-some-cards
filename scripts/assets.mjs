// Makes a game's app-ready files from its originals: games/<id>/sources/ -> games/<id>/assets/.
//   npm run assets               every game
//   npm run assets -- <id>...    only these games (--force: redo files that look up to date)
// Images (.png/.jpg/.jpeg/.webp) become trimmed, resized WebP with the same name; options per file
// come from sources/prompts.json (`transparent`, `maxSize`). Sounds are listed in
// sources/audio.json ({ "sounds": { "<name>": { "src": "move.wav", "start": 0.1, "format": "wav" } } }).
// Files you put straight into assets/ are used as they are; sources/ is optional.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeSound, hasAlpha, toWebp } from './lib/media.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
const ids = args.filter((a) => !a.startsWith('--'));
const games = ids.length
  ? ids
  : readdirSync(join(root, 'games')).filter((id) =>
      existsSync(join(root, 'games', id, 'package.json')),
    );

const newer = (src, out) =>
  force || !existsSync(out) || statSync(src).mtimeMs > statSync(out).mtimeMs;
const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;

let made = 0;
for (const id of games) {
  const sources = join(root, 'games', id, 'sources');
  const assets = join(root, 'games', id, 'assets');
  if (!existsSync(join(root, 'games', id))) {
    console.error(`✗ games/${id} does not exist`);
    process.exitCode = 1;
    continue;
  }
  if (!existsSync(sources)) continue;
  const prompts = readJson(join(sources, 'prompts.json'), { assets: {} }).assets ?? {};
  for (const file of readdirSync(sources)) {
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const name = file.slice(0, -extname(file).length);
    const src = join(sources, file);
    const out = join(assets, `${name}.webp`);
    if (!newer(src, out)) continue;
    const options = prompts[name] ?? {};
    await toWebp(src, out, {
      transparent: options.transparent ?? (await hasAlpha(src)),
      maxSize: options.maxSize,
      label: `${id}/${name}`,
    });
    console.log(`✓ ${id}/${name}.webp`);
    made++;
  }
  const { sounds = {} } = readJson(join(sources, 'audio.json'), {});
  for (const [name, sound] of Object.entries(sounds)) {
    const src = join(sources, sound.src);
    const out = join(assets, `${name}.${sound.format ?? 'mp3'}`);
    if (!existsSync(src)) {
      console.error(`✗ ${id}/${name}: missing sources/${sound.src}`);
      process.exitCode = 1;
      continue;
    }
    if (!newer(src, out) && !newer(join(sources, 'audio.json'), out)) continue;
    if (encodeSound(src, out, sound)) {
      console.log(`✓ ${id}/${name}`);
      made++;
    } else {
      console.error(`✗ ${id}/${name}: ffmpeg failed`);
      process.exitCode = 1;
    }
  }
}
console.log(made ? `${made} file(s) written.` : 'Everything is up to date.');
