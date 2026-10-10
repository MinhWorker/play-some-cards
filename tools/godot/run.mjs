// npm run godot -- <args>: the pinned Godot, on apps/client unless the args name a --path.
//   npm run godot -- --editor        open the client in the editor
//   npm run godot -- --headless --import
import { spawnSync } from 'node:child_process';
import { client, requireGodot, root } from './lib.mjs';

const args = process.argv.slice(2);
if (!args.includes('--path')) args.unshift('--path', client);
const result = spawnSync(requireGodot(), args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
