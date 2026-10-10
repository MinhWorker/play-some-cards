// Paths and helpers shared by the Godot scripts. Everything they install lives in .tools/.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const root = join(import.meta.dirname, '../..');
export const pin = JSON.parse(readFileSync(join(import.meta.dirname, 'version.json'), 'utf8'));
export const client = join(root, 'apps/client');
export const tools = join(root, '.tools');
export const godotDir = join(tools, 'godot', pin.version);
export const templatesDir = join(godotDir, 'templates');
export const gdtoolkitDir = join(tools, 'gdtoolkit');

/** The pinned editor build for this machine, or null when Godot publishes none. */
export function editorBuild() {
  const key = process.platform === 'darwin' ? 'darwin' : `${process.platform}-${process.arch}`;
  return pin.editor[key] ?? null;
}

export function godotBin() {
  const build = editorBuild();
  return build && join(godotDir, build.bin);
}

export function hasGodot() {
  const bin = godotBin();
  return Boolean(bin && existsSync(bin));
}

export function requireGodot() {
  if (hasGodot()) return godotBin();
  console.error(`Godot ${pin.version} is not installed. Run: npm run setup:godot`);
  process.exit(1);
}

export function gdtoolkit(name) {
  return join(gdtoolkitDir, process.platform === 'win32' ? 'Scripts' : 'bin', name);
}

/** Runs Godot headless on a project (the client by default); output is captured and returned.
 * A run that outlives the timeout (an unknown flag leaves the editor waiting) is killed. */
export function godot(args, { project = client, inherit = false, timeout = 10 * 60_000 } = {}) {
  const result = spawnSync(requireGodot(), ['--headless', '--path', project, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });
  if (result.error) throw new Error(`godot ${args.join(' ')}: ${result.error.message}`);
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Ids of the games with a Godot folder (games/<id>/godot). */
export function godotGames() {
  return readdirSync(join(root, 'games'))
    .filter((id) => existsSync(join(root, 'games', id, 'godot')))
    .sort();
}

/** Every file under dir (following symlinks), skipping dot entries and the paths in `skip`. */
export function walk(dir, skip = new Set()) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (skip.has(path) || name.startsWith('.')) continue;
    if (statSync(path).isDirectory()) files.push(...walk(path, skip));
    else files.push(path);
  }
  return files;
}
