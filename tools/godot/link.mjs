// npm run godot:link: symlinks apps/client/content/<id> to games/<id>/godot for every game with a
// Godot folder, and removes links to games that no longer have one. content/ is git-ignored.
import { lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client, godotGames, root } from './lib.mjs';

export function link() {
  const content = join(client, 'content');
  mkdirSync(content, { recursive: true });
  const games = godotGames();
  for (const name of readdirSync(content)) {
    const path = join(content, name);
    if (lstatSync(path).isSymbolicLink() && !games.includes(name)) rmSync(path);
  }
  for (const id of games) {
    const path = join(content, id);
    const target = relative(content, join(root, 'games', id, 'godot'));
    let current = null;
    try {
      current = readlinkSync(path);
    } catch {}
    if (current === target) continue;
    rmSync(path, { recursive: true, force: true });
    symlinkSync(target, path, 'dir');
  }
  return games;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const games = link();
  console.log(games.length ? `Linked: ${games.join(', ')}` : 'No game has a godot/ folder yet');
}
