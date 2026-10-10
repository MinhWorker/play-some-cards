// npm run setup:blender: installs Blender as a Python module (bpy) plus Pillow into
// .tools/blender, a Python 3.13 virtual environment (bpy is built for 3.13 only). npm run blender
// then uses it without XOMDAO_BLENDER_PYTHON. Skipped when requirements.txt has not changed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const venv = join(root, '.tools/blender');
const requirements = join(import.meta.dirname, 'requirements.txt');
const stamp = join(venv, 'requirements.txt');
const bin = join(venv, process.platform === 'win32' ? 'Scripts' : 'bin');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`setup:blender failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
}

/** The first Python 3.13 found: XOMDAO_PYTHON, python3.13, python3, python. */
function python313() {
  const candidates = [process.env.XOMDAO_PYTHON, 'python3.13', 'python3', 'python'];
  for (const python of candidates.filter(Boolean)) {
    const result = spawnSync(python, ['-c', 'import sys; print(sys.version_info[:2] == (3, 13))']);
    if (result.stdout?.toString().trim() === 'True') return python;
  }
  console.error('setup:blender needs Python 3.13 (set XOMDAO_PYTHON to one).');
  process.exit(1);
}

const wanted = readFileSync(requirements, 'utf8');
if (existsSync(stamp) && readFileSync(stamp, 'utf8') === wanted) {
  console.log(`bpy: installed in ${venv}`);
  process.exit(0);
}
rmSync(venv, { recursive: true, force: true });
run(python313(), ['-m', 'venv', venv]);
run(join(bin, 'python'), ['-m', 'pip', 'install', '-q', '-r', requirements]);
run(join(bin, 'python'), ['-c', 'import bpy, PIL; print("bpy", bpy.app.version_string)']);
writeFileSync(stamp, wanted);
