// npm run godot:check: everything an agent or CI checks on the Godot client and the games' Godot
// folders, headless. With --if-installed (npm run check) it is skipped when Godot is missing.
//   1. boundaries: a game's Godot files use only their own folder and addons/xomdao_sdk;
//   2. gdformat --check and gdlint (gdtoolkit);
//   3. import, then compile every script and load every scene (warnings set to errors fail it);
//   4. GUT tests: apps/client/test/ and every game's godot/**/test_*.gd.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import {
  client,
  gdtoolkit,
  godot,
  godotGames,
  hasGodot,
  requireGodot,
  root,
  walk,
} from './lib.mjs';
import { link } from './link.mjs';

if (!hasGodot()) {
  if (process.argv.includes('--if-installed')) {
    console.log('Godot is not installed: skipping godot:check (npm run setup:godot installs it)');
    process.exit(0);
  }
  requireGodot();
}

const SDK = 'res://addons/xomdao_sdk/';
const TEXT = /\.(gd|tscn|tres|gdshader|cfg)$/;
const errors = [];
const errorLine = /^(SCRIPT )?ERROR:/m;

function step(name, fn) {
  const problems = fn();
  if (problems.length) errors.push(`${name}:\n${problems.join('\n')}`);
  console.log(`${problems.length ? '✗' : '✓'} ${name}`);
}

/** Every .gd we lint: the client (not GUT or links), the games' Godot folders and this tool. */
function scripts() {
  const skip = new Set(['addons/gut', 'content'].map((path) => join(client, path)));
  const files = walk(client, skip);
  for (const id of godotGames()) files.push(...walk(join(root, 'games', id, 'godot')));
  files.push(join(import.meta.dirname, 'check_scripts.gd'));
  return files.filter((file) => file.endsWith('.gd'));
}

/** Names a game must not use: autoloads and class_names of the core and of other games. */
function coreNames() {
  const names = new Map();
  const project = readFileSync(join(client, 'project.godot'), 'utf8');
  const autoloads = project.split('[autoload]')[1]?.split(/^\[/m)[0] ?? '';
  for (const [, name] of autoloads.matchAll(/^(\w+)=/gm)) names.set(name, 'core');
  for (const file of scripts()) {
    const name = readFileSync(file, 'utf8').match(/^class_name\s+(\w+)/m)?.[1];
    const path = relative(root, file);
    const owner = path.startsWith('games/') ? path.split('/')[1] : 'core';
    if (name && !path.startsWith('apps/client/addons/xomdao_sdk/')) names.set(name, owner);
  }
  return names;
}

function boundaries() {
  const problems = [];
  const names = coreNames();
  for (const id of godotGames()) {
    const folder = join(root, 'games', id, 'godot');
    const own = `res://content/${id}/`;
    for (const file of walk(folder).filter((path) => TEXT.test(path))) {
      const where = relative(root, file);
      const text = readFileSync(file, 'utf8');
      const dir = `${own}${relative(folder, dirname(file))}`.replace(/\/?$/, '/');
      const paths = [...text.matchAll(/res:\/\/[^"'\s)]+/g)].map(([path]) => path);
      for (const [, path] of text.matchAll(/(?:pre)?load\(\s*"([^"]+)"/g))
        if (!/^\w+:\/\//.test(path)) paths.push(`res://${posix.join(dir.slice(6), path)}`);
      for (const path of paths)
        if (!path.startsWith(own) && !path.startsWith(SDK))
          problems.push(`  ${where}: ${path} is outside ${own} and ${SDK}`);
      if (!file.endsWith('.gd')) continue;
      if (text.includes('uid://')) problems.push(`  ${where}: use res:// paths, not uid://`);
      const code = text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$/gm, '""');
      for (const [name, owner] of names)
        if (owner !== id && new RegExp(`\\b${name}\\b`).test(code))
          problems.push(`  ${where}: uses ${name} (${owner}); go through ${SDK}`);
    }
  }
  return problems;
}

function gdtool(tool, args) {
  const result = spawnSync(gdtoolkit(tool), args, { cwd: root, encoding: 'utf8' });
  if (result.error) return [`  ${result.error.message} (npm run setup:godot installs gdtoolkit)`];
  if (result.status === 0) return [];
  return [`${result.stdout}${result.stderr}`.trim()];
}

function compile() {
  const imported = godot(['--import']);
  if (imported.status !== 0 || errorLine.test(imported.output)) return [imported.output.trim()];
  const checked = godot(['--script', join(import.meta.dirname, 'check_scripts.gd')]);
  if (checked.status !== 0 || errorLine.test(checked.output)) return [checked.output.trim()];
  return [];
}

function gut() {
  if (!existsSync(join(client, 'addons/gut/gut_cmdln.gd')))
    return ['  GUT is not installed: npm run setup:godot'];
  const result = godot(['-s', 'res://addons/gut/gut_cmdln.gd']);
  const summary = result.output
    .split('\n')
    .filter((line) => /Tests|Passing|Failing|Risky/.test(line));
  console.log(summary.map((line) => `  ${line.trim()}`).join('\n'));
  return result.status === 0 ? [] : [result.output.trim()];
}

link();
const files = scripts().map((file) => relative(root, file));
step('boundaries', boundaries);
step('gdformat', () => gdtool('gdformat', ['--check', ...files]));
step('gdlint', () => gdtool('gdlint', files));
step('scripts', compile);
step('GUT', gut);
if (errors.length) {
  console.error(`\n${errors.join('\n\n')}`);
  process.exit(1);
}
