// Bake a game's Python sources with Blender or the bpy module, without LFS intermediates.
// Runs every games/<id>/sources/render*.py in name order; each script bakes only the names it
// owns from the list after `--` (all of them when the list is empty).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [id, ...names] = process.argv.slice(2);
const root = join(import.meta.dirname, '..');
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run blender -- <id> [names…]');
  process.exit(1);
}
const sources = join(root, 'games', id, 'sources');
const scripts = existsSync(sources)
  ? readdirSync(sources)
      .filter((file) => /^render.*\.py$/.test(file))
      .sort()
  : [];
if (!scripts.length) {
  console.error(`No Blender script: games/${id}/sources/render*.py`);
  process.exit(1);
}
// npm run setup:blender installs bpy in .tools/blender; an explicit variable wins over it.
const local = join(root, '.tools/blender', process.platform === 'win32' ? 'Scripts' : 'bin');
const installed = join(local, process.platform === 'win32' ? 'python.exe' : 'python');
const python =
  process.env.XOMDAO_BLENDER_PYTHON ??
  (!process.env.XOMDAO_BLENDER_BIN && existsSync(installed) ? installed : undefined);
const executable = python ?? process.env.XOMDAO_BLENDER_BIN ?? 'blender';
for (const script of scripts) {
  const source = join(sources, script);
  const args = python
    ? [source, '--', ...names]
    : ['-b', '-t', '4', '--python', source, '--', ...names];
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit' });
  if (result.error)
    console.error(
      `${result.error.message}\nRun npm run setup:blender, or set XOMDAO_BLENDER_PYTHON to a Python with bpy and Pillow, or XOMDAO_BLENDER_BIN to Blender.`,
    );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
