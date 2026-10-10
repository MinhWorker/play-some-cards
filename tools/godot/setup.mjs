// Installs the pinned Godot toolchain into .tools/ (npm run setup:godot):
//   - the editor, in self-contained mode (its settings and caches stay next to it);
//   - the single-threaded web export templates, read out of the 1.3 GB template archive with
//     HTTP range requests (about 20 MB);
//   - gdtoolkit (gdlint, gdformat) in a Python virtual environment;
//   - GUT into apps/client/addons/gut (git-ignored).
// Each part is skipped when it is already there; every download is checked against version.json.
// --export-only installs just the editor and the templates (what godot:export needs, e.g. on
// Vercel). Needs curl (and ditto on macOS); git and Python 3 for the rest.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import {
  client,
  editorBuild,
  gdtoolkit,
  gdtoolkitDir,
  godotBin,
  godotDir,
  pin,
  templatesDir,
  tools,
} from './lib.mjs';

function sh(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...options });
  if (result.error) throw new Error(`${cmd}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with ${result.status}`);
  return result.stdout;
}

function sha512(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}

function checkHash(name, actual, expected) {
  if (actual !== expected) throw new Error(`${name}: SHA-512 mismatch, refusing to install it`);
}

const curl = ['-fsSL', '--retry', '3'];

/** Bytes [start, end] of a remote file (end inclusive). */
function range(url, start, end) {
  return sh('curl', [...curl, '-r', `${start}-${end}`, url], { maxBuffer: 256 * 1024 * 1024 });
}

/** Reads some entries of a remote zip without downloading all of it. */
function remoteZip(url, names) {
  // Suffix ranges (-r -N) are refused by some servers and proxies, so ask the size first.
  const headers = sh('curl', [...curl, '-r', '0-0', '-D', '-', '-o', '/dev/null', url]).toString();
  const total = Number(
    headers
      .match(/content-range: bytes 0-0\/(\d+)/gi)
      ?.pop()
      ?.split('/')[1],
  );
  if (!total) throw new Error(`${url}: no size`);
  return readZip(url, total, (start, end) => range(url, start, end), names);
}

/** Reads some entries of a zip file in memory. */
function localZip(name, buffer, names) {
  return readZip(name, buffer.length, (start, end) => buffer.subarray(start, end + 1), names);
}

/** Some entries of a zip of `total` bytes, read with `read(start, end)` (end inclusive). */
function readZip(where, total, read, names) {
  const tail = read(Math.max(0, total - 65557), total - 1);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`${where}: not a zip`);
  const size = tail.readUInt32LE(eocd + 12);
  const offset = tail.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error(`${where}: zip64 is not supported`);
  const dir = read(offset, offset + size - 1);
  const entries = new Map();
  for (let p = 0; p < dir.length && dir.readUInt32LE(p) === 0x02014b50; ) {
    const nameLength = dir.readUInt16LE(p + 28);
    const name = dir.toString('utf8', p + 46, p + 46 + nameLength);
    entries.set(name, {
      method: dir.readUInt16LE(p + 10),
      compressed: dir.readUInt32LE(p + 20),
      local: dir.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + dir.readUInt16LE(p + 30) + dir.readUInt16LE(p + 32);
  }
  const files = {};
  for (const name of names) {
    const entry = entries.get(name);
    if (!entry) throw new Error(`${where}: no ${name}`);
    const header = read(entry.local, entry.local + 29);
    const start = entry.local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const data = read(start, start + entry.compressed - 1);
    if (entry.method === 0) files[name] = data;
    else if (entry.method === 8) files[name] = inflateRawSync(data);
    else throw new Error(`${name}: unsupported zip method ${entry.method}`);
  }
  return files;
}

function installEditor() {
  const build = editorBuild();
  if (!build) throw new Error(`Godot has no editor build for ${process.platform}-${process.arch}`);
  if (existsSync(godotBin())) return console.log(`Godot ${pin.version}: installed`);
  console.log(`Godot ${pin.version}: downloading ${build.file}`);
  mkdirSync(godotDir, { recursive: true });
  const temp = mkdtempSync(join(tools, 'download-'));
  try {
    const zip = join(temp, build.file);
    sh('curl', [...curl, '-o', zip, `${pin.release}/${build.file}`]);
    checkHash(build.file, sha512(readFileSync(zip)), build.sha512);
    const top = build.bin.split('/')[0];
    rmSync(join(godotDir, top), { recursive: true, force: true });
    if (process.platform === 'darwin') {
      const out = join(temp, 'out');
      sh('ditto', ['-x', '-k', zip, out]);
      renameSync(join(out, top), join(godotDir, top));
    } else {
      // The Linux zip holds just the binary; read it here rather than needing unzip.
      writeFileSync(godotBin(), localZip(build.file, readFileSync(zip), [build.bin])[build.bin]);
      chmodSync(godotBin(), 0o755);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  // Self-contained mode: editor settings, caches and templates stay in .tools/.
  writeFileSync(join(dirname(godotBin()), '._sc_'), '');
}

function installTemplates() {
  const wanted = Object.entries(pin.templates.files).filter(
    ([name]) => !existsSync(join(templatesDir, basename(name))),
  );
  if (!wanted.length) return console.log('Web export templates: installed');
  console.log('Web export templates: downloading');
  const files = remoteZip(
    `${pin.release}/${pin.templates.file}`,
    wanted.map(([name]) => name),
  );
  mkdirSync(templatesDir, { recursive: true });
  for (const [name, hash] of wanted) {
    checkHash(name, sha512(files[name]), hash);
    writeFileSync(join(templatesDir, basename(name)), files[name]);
  }
}

function installGdtoolkit() {
  const stamp = join(gdtoolkitDir, 'version');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === pin.gdtoolkit)
    return console.log(`gdtoolkit ${pin.gdtoolkit}: installed`);
  console.log(`gdtoolkit ${pin.gdtoolkit}: installing`);
  rmSync(gdtoolkitDir, { recursive: true, force: true });
  const python = process.env.XOMDAO_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  sh(python, ['-m', 'venv', gdtoolkitDir], { stdio: 'inherit' });
  sh(gdtoolkit('python'), ['-m', 'pip', 'install', '-q', `gdtoolkit==${pin.gdtoolkit}`], {
    stdio: 'inherit',
  });
  writeFileSync(stamp, pin.gdtoolkit);
}

function installGut() {
  const target = join(client, 'addons/gut');
  const plugin = join(target, 'plugin.cfg');
  const version = pin.gut.tag.replace(/^v/, '');
  if (existsSync(plugin) && readFileSync(plugin, 'utf8').includes(`version="${version}"`))
    return console.log(`GUT ${version}: installed`);
  console.log(`GUT ${version}: downloading`);
  const temp = mkdtempSync(join(tools, 'gut-'));
  try {
    const clone = ['clone', '-q', '--depth', '1', '--branch', pin.gut.tag, pin.gut.repo, temp];
    sh('git', ['-c', 'advice.detachedHead=false', ...clone]);
    const commit = sh('git', ['-C', temp, 'rev-parse', 'HEAD']).toString().trim();
    if (commit !== pin.gut.commit) throw new Error(`GUT ${pin.gut.tag} is ${commit}, not pinned`);
    rmSync(target, { recursive: true, force: true });
    cpSync(join(temp, 'addons/gut'), target, { recursive: true });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

mkdirSync(tools, { recursive: true });
try {
  installEditor();
  installTemplates();
  if (!process.argv.includes('--export-only')) {
    installGdtoolkit();
    installGut();
  }
} catch (error) {
  console.error(`setup:godot failed: ${error.message}`);
  process.exit(1);
}
console.log(`Ready: ${godotBin()}`);
