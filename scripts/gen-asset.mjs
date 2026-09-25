// Generates game art with Codex CLI's image tool, then trims/resizes it to WebP.
//   npm run gen:asset -- <name> [<name>...]   regenerate specific assets
//   npm run gen:asset -- --missing            generate every asset that has no output yet
//   npm run gen:asset -- --edit <name> "<change>"   ask Codex to edit the existing image
//                                                   (keeps its style; e.g. "make the flag yellow")
// The app's prompts live in assets/prompts.json: output apps/web/public/shared/images/<name>.webp
// ("path" puts it elsewhere, relative to the repo root), raw PNG in assets/shared/images/.
// A game's prompts live in games/<id>/sources/prompts.json and are named "<id>/<name>": raw PNG
// in games/<id>/sources/<name>.png, output games/<id>/assets/<name>.webp (same as `npm run assets`).
// Raw PNGs are kept (Git LFS) for re-processing and --edit.
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toWebp } from './lib/media.mjs';

/** Runs a command with stdin closed (codex exec otherwise waits for stdin input). */
function run(cmd, args, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} exited with ${code}: ${stderr.trim().split('\n').pop()}`));
    });
  });
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'assets/prompts.json'), 'utf8'));

/** Every prompt by name, with where its raw PNG and its WebP go. */
const entries = {};
for (const [name, asset] of Object.entries(config.assets)) {
  entries[name] = {
    ...asset,
    raw: join(root, 'assets/shared/images', `${name}.png`),
    out: join(root, asset.path ?? `apps/web/public/shared/images/${name}.webp`),
  };
}
for (const id of readdirSync(join(root, 'games'))) {
  const file = join(root, 'games', id, 'sources/prompts.json');
  if (!existsSync(file)) continue;
  for (const [name, asset] of Object.entries(JSON.parse(readFileSync(file, 'utf8')).assets ?? {})) {
    entries[`${id}/${name}`] = {
      ...asset,
      raw: join(root, 'games', id, 'sources', `${name}.png`),
      out: join(root, 'games', id, 'assets', `${name}.webp`),
    };
  }
}

const args = process.argv.slice(2);
const editIndex = args.indexOf('--edit');
const edit = editIndex >= 0 ? { name: args[editIndex + 1], change: args[editIndex + 2] } : null;
if (edit && (!edit.name || !edit.change)) {
  console.log('Usage: npm run gen:asset -- --edit <name> "<what to change>"');
  process.exit(1);
}
const names = edit
  ? [edit.name]
  : args.includes('--missing')
    ? Object.keys(entries).filter((n) => !existsSync(entries[n].out))
    : args;
if (names.length === 0) {
  console.log('Usage: npm run gen:asset -- <name...> | --missing');
  console.log('Assets:', Object.keys(entries).join(', '));
  process.exit(1);
}

async function generate(name) {
  const asset = entries[name];
  if (!asset)
    throw new Error(`No prompt "${name}" (assets/prompts.json or games/<id>/sources/prompts.json)`);
  const prompt = [config.style, asset.prompt, asset.transparent ? config.transparentSuffix : '']
    .filter(Boolean)
    .join(' ');
  const work = mkdtempSync(join(tmpdir(), `asset-${name}-`));
  const background = asset.transparent ? ' with a transparent background' : '';
  const save =
    'then copy the generated PNG to ./out.png in the current directory. Do nothing else.';
  const existing = asset.raw;
  const isEdit = edit?.name === name;
  if (isEdit && !existsSync(existing)) throw new Error(`No existing image to edit: ${existing}`);
  const instruction = isEdit
    ? `Use your image generation tool to EDIT the attached image${background}: ${edit.change}. Keep everything else the same (style, composition, colors, framing), ${save}\n\nOriginal description: ${prompt}`
    : `Use your image generation tool to create exactly ONE image${background}, ${save}\n\nImage: ${prompt}`;
  const codexArgs = ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', work];
  // '--' stops -i (which takes several files) from swallowing the prompt.
  if (isEdit) codexArgs.push('-i', existing, '--');
  await run('codex', [...codexArgs, instruction], 10 * 60 * 1000);
  const raw = join(work, 'out.png');
  if (!existsSync(raw)) throw new Error(`Codex did not produce an image for "${name}"`);
  mkdirSync(dirname(asset.raw), { recursive: true });
  copyFileSync(raw, asset.raw);
  rmSync(work, { recursive: true, force: true });
  await toWebp(asset.raw, asset.out, {
    transparent: asset.transparent,
    maxSize: asset.maxSize,
    label: name,
  });
  console.log(`✓ ${name}`);
}

// Codex runs are slow; do a few at a time.
const queue = [...names];
await Promise.all(
  Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const name = queue.shift();
      try {
        await generate(name);
      } catch (err) {
        console.error(`✗ ${name}: ${err.message}`);
        process.exitCode = 1;
      }
    }
  }),
);
