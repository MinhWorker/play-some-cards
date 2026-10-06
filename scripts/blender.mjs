// Bake a game's Python sources with Blender or the bpy module, without LFS intermediates.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [id, ...names] = process.argv.slice(2);
const root = join(import.meta.dirname, '..');
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run blender -- <id> [names…]');
  process.exit(1);
}
const script = join(root, 'games', id, 'sources', 'render_assets.py');
if (!existsSync(script)) {
  console.error(`No Blender script: games/${id}/sources/render_assets.py`);
  process.exit(1);
}
const python = process.env.PSC_BLENDER_PYTHON;
const executable = python ?? process.env.PSC_BLENDER_BIN ?? 'blender';
const bowls = join(root, 'games', id, 'sources', 'render_bowls.py');
const bowlNames = names.filter((name) => name === 'bowl' || name === 'bowl-lid');
const assetNames = names.filter((name) => !bowlNames.includes(name));
const scripts = [];
if (!names.length || assetNames.length) scripts.push([script, assetNames]);
if (existsSync(bowls) && (!names.length || bowlNames.length)) scripts.push([bowls, bowlNames]);
if (!scripts.length) {
  console.error(`No renderer for: ${names.join(', ')}`);
  process.exit(1);
}
for (const [source, selected] of scripts) {
  const args = python
    ? [source, '--', ...selected]
    : ['-b', '-t', '4', '--python', source, '--', ...selected];
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit' });
  if (result.error)
    console.error(
      `${result.error.message}\nSet PSC_BLENDER_PYTHON to a Python with bpy and Pillow, or PSC_BLENDER_BIN to Blender.`,
    );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
