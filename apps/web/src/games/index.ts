import type { GameAssets, GameClient } from '@psc/sdk/client';
import { type AnyGameDefinition, games } from '@psc/shared';

/**
 * The web side of the game plugins in games/<id>/. Nothing here names a game: rules and meta
 * come from @psc/shared's generated list, and these globs pick up every game's files.
 */

// URLs only (no download until used): every file in games/<id>/assets/.
const files = import.meta.glob('../../../../games/*/assets/*.{webp,png,jpg,wav,mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Each game's board code, loaded (and downloaded) the first time someone opens that game.
const clients = import.meta.glob<{ default: GameClient }>('../../../../games/*/src/client.ts');

const IMAGE = /\.(webp|png|jpg)$/;
const assetsById: Record<string, GameAssets> = {};
for (const [path, url] of Object.entries(files)) {
  const [, id, file] = path.match(/games\/([^/]+)\/assets\/(.+)$/) ?? [];
  if (!id || !file) continue;
  assetsById[id] ??= { images: {}, sounds: {} };
  const name = file.replace(/\.\w+$/, '');
  (IMAGE.test(file) ? assetsById[id].images : assetsById[id].sounds)[name] = url;
}

/** URLs of a game's `assets/`, by file name without the extension. */
export function gameAssets(gameId: string): GameAssets {
  return assetsById[gameId] ?? { images: {}, sounds: {} };
}

/** Loads a game's board code (scene). */
export async function loadClient(gameId: string): Promise<GameClient> {
  const load = clients[`../../../../games/${gameId}/src/client.ts`];
  if (!load) throw new Error(`games/${gameId}/src/client.ts not found`);
  return (await load()).default;
}

/**
 * Work-in-progress games are playable in dev and PR previews and locked in production
 * (set in vite.config.ts from Vercel's VERCEL_ENV).
 */
declare const __SHOW_WIP__: boolean;
export const showWip = __SHOW_WIP__;

/** Whether a game can be opened here (it exists and is not a locked work in progress). */
export function isPlayable(game: AnyGameDefinition | undefined): game is AnyGameDefinition {
  return !!game && (game.status === 'ready' || showWip);
}

/** Games on the home map: ready ones first, then works in progress. */
export const portals = Object.values(games)
  .sort((a, b) => Number(a.status === 'wip') - Number(b.status === 'wip'))
  .map((game) => ({
    gameId: game.id,
    name: game.name,
    texture: `portal:${game.id}`,
    url: gameAssets(game.id).images[game.portal.image] ?? '',
    locked: !isPlayable(game),
  }));
