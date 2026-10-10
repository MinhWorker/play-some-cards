// Makes new files from scripts/templates/, like "Create > C# Script" in Unity.
//
//   npm run new:game -- <id> "Tên" --genre <g> [--layout ban|hanh-dong]   a whole game
//   npm run new:event -- <id> "Tên" [--opens 2026-11-01] [--closes 2026-11-30]   a whole event
//   npm run new -- logic <game> [Name]            src/game/<Name>Game.ts + test: a `Game`
//   npm run new -- view <game> [Name]             src/scenes/<Name>View.ts: a `GameView`
//   npm run new -- setup <game> [Name]            src/scenes/<Name>Setup.ts (+ src/game/options.ts)
//
// A game or event is a small working one: rules + tests (src/), its Godot table in a sample
// layout (godot/: Bàn or Hành động, docs/experience.md) with GUT tests, an e2e scenario
// (scripts/e2e/scenarios/godot-<id>.mjs), RULES.md, a README and a stand-in card picture.
//
// For one file, run from inside games/<id>/ and <game> can be left out. Name defaults to the
// game's name in PascalCase. Existing files are never overwritten.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gdtoolkit } from '../tools/godot/lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(root, 'scripts/templates');
const {
  values: flags,
  positionals: [kind, ...args],
} = parseArgs({
  allowPositionals: true,
  options: {
    genre: { type: 'string' },
    layout: { type: 'string', default: 'ban' },
    opens: { type: 'string' },
    closes: { type: 'string' },
  },
});

const USAGE = `Usage:
  npm run new:game -- <id> "Tên" --genre <g> [--layout ban|hanh-dong]
                                                a new game (id like "tien-len"), genre from
                                                packages/shared/src/catalog.ts
  npm run new:event -- <id> "Tên" [--opens YYYY-MM-DD] [--closes YYYY-MM-DD]
                                                a new event (default: open today for 4 weeks)
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

// ── A whole game or event ────────────────────────────────────────────────────────────────────

/** The sample layouts of a game's table (docs/experience.md, "Trong trận"). */
const LAYOUTS = { ban: 'Bàn', 'hanh-dong': 'Hành động' };
const EVENT_GENRE = 'su-kien';

/** Genre ids from `genres` in packages/shared/src/catalog.ts. */
function genreIds() {
  const source = readFileSync(join(root, 'packages/shared/src/catalog.ts'), 'utf8');
  const list = source.slice(source.indexOf('export const genres'));
  return [...list.slice(0, list.indexOf('];')).matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/** A YYYY-MM-DD date in Vietnam, `days` from today. */
function day(days = 0) {
  const at = new Date(Date.now() + days * 86_400_000);
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const isDay = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));

function newGame(event, id, name = id) {
  if (!isId(id)) fail('Give the game an id like "tien-len".');
  const target = join(root, 'games', id);
  if (existsSync(target)) fail(`games/${id} already exists`);
  const scenario = join(root, 'scripts/e2e/scenarios', `godot-${id}.mjs`);
  if (existsSync(scenario)) fail(`${relative(root, scenario)} already exists`);
  const values = { __ID__: id, __NAME__: name, __Name__: pascal(id) };
  if (event) {
    values.__GENRE__ = EVENT_GENRE;
    values.__LAYOUT__ = LAYOUTS['hanh-dong'];
    values.__OPENS__ = flags.opens ?? day();
    values.__CLOSES__ = flags.closes ?? day(28);
    if (!isDay(values.__OPENS__) || !isDay(values.__CLOSES__)) fail('Dates look like 2026-11-01.');
    if (values.__OPENS__ >= values.__CLOSES__) fail('The event must close after it opens.');
  } else {
    const genres = genreIds().filter((g) => g !== EVENT_GENRE);
    if (!flags.genre) fail(`Pick its island with --genre (${genres.join(', ')}).`);
    if (flags.genre === EVENT_GENRE) fail('An event is made with npm run new:event.');
    if (!genres.includes(flags.genre))
      fail(`Unknown genre "${flags.genre}" (${genres.join(', ')}).`);
    if (!LAYOUTS[flags.layout]) fail(`Unknown layout "${flags.layout}" (ban, hanh-dong).`);
    values.__GENRE__ = flags.genre;
    values.__LAYOUT__ = LAYOUTS[flags.layout];
  }

  const copy = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const src = join(from, entry);
      const dest = join(to, fill(entry, values));
      if (statSync(src).isDirectory()) copy(src, dest);
      else if (/\.(ts|json|md|gd|tscn|mjs)$/.test(entry)) {
        writeFileSync(dest, fill(readFileSync(src, 'utf8'), values));
      } else writeFileSync(dest, readFileSync(src));
    }
  };
  // The starter game, then (for an event) the event's own rules and screens over it.
  copy(join(templates, 'game'), target);
  if (event) copy(join(templates, 'event'), target);
  const godot = join(target, 'godot');
  write(join(godot, 'main.gd'), `godot/${event ? 'event' : flags.layout}/main.gd`, values);
  write(join(godot, 'main.tscn'), 'godot/main.tscn', values);
  write(join(godot, 'test/test_main.gd'), `godot/test/${event ? 'event' : 'table'}.gd`, values);
  write(scenario, `e2e/${event ? 'event' : 'table'}.mjs`, values);

  // Links the new workspace package and regenerates the game list.
  const run = (command, list) => {
    const result = spawnSync(command, list, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  run('npm', ['install', '--no-audit', '--no-fund']);
  run(process.execPath, ['tools/godot/link.mjs']);
  // gdformat's line breaks depend on the names filled in.
  const gdformat = gdtoolkit('gdformat');
  if (existsSync(gdformat))
    run(gdformat, [join(godot, 'main.gd'), join(godot, 'test/test_main.gd')]);

  console.log(`
Created games/${id}/ (status: 'wip', locked on the production site until you set 'ready').

  src/game/${values.__Name__}Game.ts   the rules (server): events and hooks
  src/index.ts   its meta: genre, card, ${event ? 'dates and reward tiers' : 'room options'}
  godot/main.gd   its table in the Godot client (${values.__LAYOUT__} layout)
  RULES.md   its rules for players, in Vietnamese
  scripts/e2e/scenarios/godot-${id}.mjs   its browser test

  npm run godot:check   GDScript checks and GUT tests (writes .uid files: commit them)
  npm run check   lint, type checks and tests
  npm run godot:export -- --debug, then npm run dev (restart it if it was running) and open
    http://localhost:5033/godot/?play=${id}   to try it alone
  npm run e2e -- --only godot-${id}
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

if (kind === 'game' || kind === 'event') newGame(kind === 'event', ...args);
else if (['logic', 'view', 'setup'].includes(kind)) newFile();
else fail(kind ? `Unknown kind "${kind}"` : 'What should it make?');
