/**
 * @psc/sdk/client: what a game's board (browser only) may use.
 * `games/<id>/src/client.ts` does `export default defineClient({ scene: MyScene })`.
 */
import type { BoardScene } from './BoardScene.js';

export * from './BoardScene.js';
export * from './host.js';
export * from './text.js';

/** What `games/<id>/src/client.ts` exports by default. */
export interface GameClient {
  // biome-ignore lint/suspicious/noExplicitAny: scenes of different games have different types
  scene: new () => BoardScene<any, any>;
}

export function defineClient(client: GameClient): GameClient {
  return client;
}
