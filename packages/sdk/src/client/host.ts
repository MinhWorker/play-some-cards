import type { SoundHandle, SoundOptions } from './runtime/SceneAudio.js';

/** Files in a game's `assets/` folder, by file name without the extension. */
export interface GameAssets {
  images: Record<string, string>;
  sounds: Record<string, string>;
  /**
   * `<name>.json` next to image `<name>`: that image is a texture atlas (Phaser's JSON hash or
   * array format, as texture packers write it), its frames animated with `GameScene.anim()`.
   */
  atlases: Record<string, string>;
}

/**
 * What the app provides to game scenes: asset URLs and its sound engine (which follows the
 * player's volume settings). Games never call this; `GameScene.sprite()` / `sfx()` do.
 */
export interface ClientHost {
  assets(gameId: string): GameAssets;
  prepareSound(url: string): Promise<'ready' | 'unavailable'>;
  /** `duck` dips music during a jingle; resolves at playback start or when audio is unavailable. */
  playSound(url: string, options?: SoundOptions): SoundHandle;
  /** Player pictures by avatar name (`boy`, `girl`, …, and `bot` for the computer). */
  avatars(): Record<string, string>;
  /** The app's own button sounds, so buttons in games sound like the app's. */
  playUiSound(kind: 'click' | 'hover'): void;
}

let current: ClientHost | null = null;

/** Called once by the app (or the sandbox) before any game scene starts. */
export function setClientHost(host: ClientHost) {
  current = host;
}

export function clientHost(): ClientHost {
  if (!current) throw new Error('setClientHost() was not called');
  return current;
}
