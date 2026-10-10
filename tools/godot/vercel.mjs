// The Godot part of the Vercel build (vercel.json): installs the editor and web templates, then
// exports the client into apps/client/dist, which `vite build` copies to /godot/. The production
// site gets the release build; PR previews get the debug build, which has the test bridge
// (window.xomdao) and the sandbox (?play=<id>). VITE_SERVER_URL tells it where the server is.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const run = (script, args) => {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('setup.mjs', ['--export-only']);
run('export.mjs', process.env.VERCEL_ENV === 'production' ? [] : ['--debug']);
