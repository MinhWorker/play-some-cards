/** Start Nest's watcher with dev commands enabled on every OS. */
import { spawn } from 'node:child_process';

const child = spawn(
  process.execPath,
  ['../../node_modules/@nestjs/cli/bin/nest.js', 'start', '--watch', '--preserveWatchOutput'],
  { stdio: 'inherit', env: { ...process.env, XOMDAO_DEV: '1' } },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
