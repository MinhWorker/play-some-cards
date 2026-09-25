/** Files in a game's `assets/` folder, by file name without the extension. */
export interface GameAssets {
  images: Record<string, string>;
  sounds: Record<string, string>;
}

/**
 * What the app provides to board scenes: asset URLs and its sound engine (which follows the
 * player's volume settings). Games never call this; `BoardScene.image()` / `sfx()` do.
 */
export interface ClientHost {
  assets(gameId: string): GameAssets;
  loadSound(url: string): void;
  playSound(url: string): void;
}

let current: ClientHost | null = null;

/** Called once by the app (or the sandbox) before any board scene starts. */
export function setClientHost(host: ClientHost) {
  current = host;
}

export function clientHost(): ClientHost {
  if (!current) throw new Error('setClientHost() was not called');
  return current;
}
