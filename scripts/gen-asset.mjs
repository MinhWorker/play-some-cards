// Generates game art with Codex CLI's image tool, then trims/resizes it to WebP.
//   npm run gen:asset -- <name> [<name>...]   regenerate specific assets
//   npm run gen:asset -- --missing            generate every asset that has no output yet
//   npm run gen:asset -- --edit <name> "<change>"   ask Codex to edit the existing image
//                                                   (keeps its style; e.g. "make the flag yellow")
// Prompts live in assets/prompts.json. Output: apps/web/public/assets/<name>.webp
// Raw full-size PNGs are kept in assets/raw/ (gitignored) for re-processing.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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
const outDir = join(root, 'apps/web/public/assets');
const rawDir = join(root, 'assets/raw');
mkdirSync(outDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

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
    ? Object.keys(config.assets).filter((n) => !existsSync(join(outDir, `${n}.webp`)))
    : args;
if (names.length === 0) {
  console.log('Usage: npm run gen:asset -- <name...> | --missing');
  console.log('Assets:', Object.keys(config.assets).join(', '));
  process.exit(1);
}

async function generate(name) {
  const asset = config.assets[name];
  if (!asset) throw new Error(`No prompt for "${name}" in assets/prompts.json`);
  const prompt = [config.style, asset.prompt, asset.transparent ? config.transparentSuffix : '']
    .filter(Boolean)
    .join(' ');
  const work = mkdtempSync(join(tmpdir(), `asset-${name}-`));
  const background = asset.transparent ? ' with a transparent background' : '';
  const save =
    'then copy the generated PNG to ./out.png in the current directory. Do nothing else.';
  const existing = join(rawDir, `${name}.png`);
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
  copyFileSync(raw, join(rawDir, `${name}.png`));
  rmSync(work, { recursive: true, force: true });
  await processRaw(name, asset);
}

export async function processRaw(name, asset) {
  const raw = join(rawDir, `${name}.png`);
  let img = sharp(raw);
  if (asset.transparent) {
    const { channels } = await img.metadata();
    const alpha = channels === 4 ? (await img.stats()).channels[3] : null;
    if (!alpha || alpha.min > 10) console.warn(`! ${name}: background is not transparent`);
    img = sharp(await img.trim().toBuffer());
  }
  await img
    .resize({
      width: asset.maxSize,
      height: asset.maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(join(outDir, `${name}.webp`));
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
