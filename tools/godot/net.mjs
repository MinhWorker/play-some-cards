// npm run godot:net: the Godot SDK against a real server. Builds and starts the server on a free
// port (dev, no database), then runs the client's network GUT tests (test_net.gd) with
// XOMDAO_TEST_SERVER set to its /ws URL. godot:check skips those tests without it.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { godot, requireGodot, root } from './lib.mjs';

requireGodot();
for (const workspace of ['@xomdao/shared', '@xomdao/server']) {
  const built = spawnSync('npm', ['run', 'build', '-w', workspace], {
    cwd: root,
    stdio: 'inherit',
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const server = spawn(process.execPath, [join(root, 'apps/server/dist/main.js')], {
  cwd: join(root, 'apps/server'),
  env: { ...process.env, PORT: String(port), DATABASE_URL: '', XOMDAO_DEV: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let status = 1;
try {
  const health = `http://127.0.0.1:${port}/api/health`;
  for (let i = 0; ; i++) {
    if (
      await fetch(health).then(
        (res) => res.ok,
        () => false,
      )
    )
      break;
    if (i > 100 || server.exitCode !== null) throw new Error('The server did not start');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const imported = godot(['--import']);
  if (imported.status !== 0) throw new Error(imported.output);
  process.env.XOMDAO_TEST_SERVER = `ws://127.0.0.1:${port}/ws`;
  const result = godot(['-s', 'res://addons/gut/gut_cmdln.gd', '-gselect=test_net']);
  console.log(result.output.trim());
  status = result.status;
} catch (error) {
  console.error(error.message);
} finally {
  server.kill();
}
process.exit(status);
