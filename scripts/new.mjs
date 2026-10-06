// Makes new files from scripts/templates/, like "Create > C# Script" in Unity.
//
//   npm run new -- game <id> ["Tên tiếng Việt"]   a whole game folder (a small working game)
//   npm run new -- logic <game> [Name]            src/game/<Name>Game.ts + test: a `Game`
//   npm run new -- view <game> [Name]             src/scenes/<Name>View.ts: a `GameView`
//   npm run new -- setup <game> [Name]            src/scenes/<Name>Setup.ts (+ src/game/options.ts)
//
// Run from inside games/<id>/ and <game> can be left out. Name defaults to the game's name in
// PascalCase. Existing files are never overwritten.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(root, 'scripts/templates');
const [kind, ...args] = process.argv.slice(2);

const USAGE = `Usage:
  npm run new -- game <id> ["Tên tiếng Việt"]   a new game folder (id like "tien-len")
  npm run new -- logic <game> [Name]            src/game/<Name>Game.ts + test (a Game)
  npm run new -- view <game> [Name]             src/scenes/<Name>View.ts (a GameView)
  npm run new -- setup <game> [Name]            src/scenes/<Name>Setup.ts (a RoomSetupScene)
Inside games/<id>/ you can leave out <game>.`;

function fail(message) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

const pascal = (text) =>
  text.replace(/(^|[-_\s])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');
const isId = (text) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text ?? '');
const fill = (text, values) =>
  Object.entries(values).reduce((out, [key, value]) => out.replaceAll(key, value), text);

/** Writes `file` from a template, unless it exists. Returns whether it wrote. */
function write(file, template, values) {
  const shown = relative(root, file);
  if (existsSync(file)) {
    console.log(`  exists   ${shown} (left as it is)`);
    return false;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, fill(readFileSync(join(templates, template), 'utf8'), values));
  console.log(`  created  ${shown}`);
  return true;
}

// ── A whole game ─────────────────────────────────────────────────────────────────────────────

function newGame(id, name = id) {
  if (!isId(id)) fail('Give the game an id like "tien-len".');
  const target = join(root, 'games', id);
  if (existsSync(target)) fail(`games/${id} already exists`);
  const values = { __ID__: id, __NAME__: name, __Name__: pascal(id) };

  const copy = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const src = join(from, entry);
      const dest = join(to, fill(entry, values));
      if (statSync(src).isDirectory()) copy(src, dest);
      else if (/\.(ts|json|md)$/.test(entry)) {
        writeFileSync(dest, fill(readFileSync(src, 'utf8'), values));
      } else writeFileSync(dest, readFileSync(src));
    }
  };
  copy(join(templates, 'game'), target);

  // Links the new workspace package and regenerates the game list.
  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (install.status !== 0) process.exit(install.status ?? 1);

  console.log(`
Created games/${id}/ (status: 'wip', locked on the production site until you set 'ready').

  src/game/${values.__Name__}Game.ts      the logic (server): events and hooks
  src/scenes/${values.__Name__}View.ts    the screen (browser): hooks and objects

  npm run dev     (restart it if it was running), then open
                  http://localhost:5033/?play=${id}&players=2   to try it alone, or
                  http://localhost:5033                        to play it for real.
  npm run check   lint, type checks and tests
`);
}

// ── One file in a game ───────────────────────────────────────────────────────────────────────

/** The game folder: named in the arguments, or the one the command was run from. */
function findGame() {
  const cwd = relative(join(root, 'games'), process.env.INIT_CWD ?? process.cwd());
  const here = cwd && !cwd.startsWith('..') ? cwd.split(sep)[0] : undefined;
  const named = args[0] && existsSync(join(root, 'games', args[0])) ? args[0] : undefined;
  // `new view co-ca-ngua Score`, `new view co-ca-ngua`, or from games/co-ca-ngua: `new view Score`.
  if (named && (args.length > 1 || !here)) return { id: named, name: args[1] };
  if (here) return { id: here, name: args[0] };
  fail(args[0] ? `There is no games/${args[0]}` : 'Which game?');
}

/** `Score`, `score-board` or `ScoreView` → `Score`, `ScoreBoard`, `Score`. */
function className(name, id, suffix) {
  const base = pascal(name ?? id);
  return base.endsWith(suffix) && base !== suffix ? base.slice(0, -suffix.length) : base;
}

/** The logic file a view imports its `State` from: the game's only `*Game.ts`, if there is one. */
function logicOf(dir) {
  const gameDir = join(dir, 'src/game');
  const files = existsSync(gameDir)
    ? readdirSync(gameDir).filter((f) => /Game\.ts$/.test(f) && !f.endsWith('.test.ts'))
    : [];
  return files.length === 1 ? files[0].replace(/\.ts$/, '') : null;
}

function newFile() {
  const { id, name } = findGame();
  const dir = join(root, 'games', id);
  const src = join(dir, 'src');

  if (kind === 'logic') {
    const Name = className(name, id, 'Game');
    const values = { __Name__: Name };
    write(join(src, `game/${Name}Game.ts`), 'logic.ts', values);
    write(join(src, `game/${Name}Game.test.ts`), 'logic.test.ts', values);
    console.log(`\nUse it in src/index.ts:  game: new ${Name}Game()`);
  } else if (kind === 'view') {
    const Name = className(name, id, 'View');
    const logic = logicOf(dir);
    const file = join(src, `scenes/${Name}View.ts`);
    if (write(file, 'view.ts', { __Name__: Name, __LOGIC__: logic ?? '' }) && !logic) {
      // No logic to take the state from (yet): the view says what it expects.
      const text = readFileSync(file, 'utf8').replace(
        "import type { State } from '../game/.js';",
        "\n/** What the game's `view` sends this screen (import your game's State here). */\ntype State = unknown;",
      );
      writeFileSync(file, text);
    }
    console.log(`\nShow it in src/client.ts:  defineClient({ scene: ${Name}View })`);
  } else {
    const Name = className(name, id, 'Setup');
    write(join(src, `scenes/${Name}Setup.ts`), 'setup.ts', { __Name__: Name });
    write(join(src, 'game/options.ts'), 'options.ts', {});
    console.log(`
Wire it up:
  src/client.ts   defineClient({ scene: …, setup: ${Name}Setup })
  src/index.ts    room: { options: optionsSchema }   (from './game/options.js')`);
  }
}

if (kind === 'game') newGame(...args);
else if (['logic', 'view', 'setup'].includes(kind)) newFile();
else fail(kind ? `Unknown kind "${kind}"` : 'What should it make?');
