// npm run godot:export [-- --debug]: the single-threaded web build with PWA into apps/client/dist,
// plus one pack per game: dist/content/<id>.<hash>.pck and dist/content/manifest.json
// ({ "<id>": "<id>.<hash>.pck" }). The hash changes only when the pack does, so a deploy can
// keep older packs for players still running the previous build.
// Godot's export filters do not see through symlinks, so the export runs on a copy of the client
// in .tools/export/ with the games copied in, and with the game presets added to its
// export_presets.cfg. The copy keeps its .godot/ import cache between runs.
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { client, godot, requireGodot, templatesDir, tools } from './lib.mjs';
import { link } from './link.mjs';

const debug = process.argv.includes('--debug');
const mode = debug ? '--export-debug' : '--export-release';
requireGodot();
const templates = {
  debug: join(templatesDir, 'web_nothreads_debug.zip'),
  release: join(templatesDir, 'web_nothreads_release.zip'),
};
if (!existsSync(templates.debug) || !existsSync(templates.release)) {
  console.error('Web export templates are missing. Run: npm run setup:godot');
  process.exit(1);
}

const games = link();
const dist = join(client, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'content'), { recursive: true });
const project = join(tools, 'export/client');
mkdirSync(project, { recursive: true });
for (const name of readdirSync(project))
  if (name !== '.godot') rmSync(join(project, name), { recursive: true, force: true });
cpSync(client, project, {
  recursive: true,
  dereference: true,
  filter: (path) => !['.godot', 'dist'].includes(relative(client, path)),
});

/** A pack preset for one game: its resources under content/<id>/ minus its tests. The
 * game_pack feature blanks the project icon, which Godot otherwise adds to every pack. */
function packPreset(index, id, web) {
  const outside = readdirSync(project)
    .filter((name) => !name.startsWith('.') && name !== 'content')
    .map((name) => (statSync(join(project, name)).isDirectory() ? `${name}/*` : name))
    .concat(games.filter((other) => other !== id).map((other) => `content/${other}/*`))
    .concat(`content/${id}/test/*`);
  return web
    .replace(/^\[preset\.0\]/m, `[preset.${index}]`)
    .replace(/^\[preset\.0\.options\]/m, `[preset.${index}.options]`)
    .replace(/^name=.*$/m, `name="content:${id}"`)
    .replace(/^runnable=.*$/m, 'runnable=false')
    .replace(/^custom_features=.*$/m, 'custom_features="game_pack"')
    .replace(/^exclude_filter=.*$/m, `exclude_filter="${outside.join(', ')}"`);
}

function run(args, output) {
  const result = godot(args, { project });
  if (result.status !== 0 || !existsSync(output)) {
    console.error(result.output.trim());
    throw new Error(`godot ${args.join(' ')} failed`);
  }
}

const presetsFile = join(project, 'export_presets.cfg');
const web = readFileSync(presetsFile, 'utf8')
  .replace(/^custom_template\/debug=.*$/m, `custom_template/debug="${templates.debug}"`)
  .replace(/^custom_template\/release=.*$/m, `custom_template/release="${templates.release}"`);
const manifest = {};
try {
  writeFileSync(presetsFile, [web, ...games.map((id, i) => packPreset(i + 1, id, web))].join('\n'));
  run(['--import'], join(project, '.godot'));
  const index = join(dist, 'index.html');
  run([mode, 'Web', index], index);
  console.log(`✓ web ${debug ? 'debug' : 'release'} build`);
  for (const id of games) {
    const temp = join(dist, 'content', `${id}.pck`);
    run(['--export-pack', `content:${id}`, temp], temp);
    const hash = createHash('sha256').update(readFileSync(temp)).digest('hex').slice(0, 12);
    manifest[id] = `${id}.${hash}.pck`;
    renameSync(temp, join(dist, 'content', manifest[id]));
    console.log(`✓ ${manifest[id]}`);
  }
  writeFileSync(join(dist, 'content/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
