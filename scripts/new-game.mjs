// Creates games/<id>/ from scripts/game-template/: a small working game ("race to 21") with
// status 'wip', a test and a placeholder island, ready to turn into your game.
//   npm run new:game -- <id> ["Tên tiếng Việt"]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [id, name = id] = process.argv.slice(2);

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run new:game -- <id> ["Tên tiếng Việt"]   (id like "tien-len")');
  process.exit(1);
}
const target = join(root, 'games', id);
if (existsSync(target)) {
  console.error(`games/${id} already exists`);
  process.exit(1);
}

const pascal = id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const fill = (text) =>
  text.replaceAll('__ID__', id).replaceAll('__NAME__', name).replaceAll('__Name__', pascal);

function copy(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dest = join(to, fill(entry));
    if (statSync(src).isDirectory()) copy(src, dest);
    else if (/\.(ts|json|md)$/.test(entry)) writeFileSync(dest, fill(readFileSync(src, 'utf8')));
    else writeFileSync(dest, readFileSync(src));
  }
}
copy(join(root, 'scripts/game-template'), target);

// Links the new workspace package and regenerates the game list.
const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (install.status !== 0) process.exit(install.status ?? 1);

console.log(`
Created games/${id}/ (status: 'wip', locked on the production site until you set 'ready').

  npm run dev     (restart it if it was running), then open
                  http://localhost:5033/?play=${id}&players=2   to try the board alone, or
                  http://localhost:5033                        to play it for real.
  npm run check   lint, type checks and tests (src/rules.test.ts)
`);
