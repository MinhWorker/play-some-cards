/**
 * @psc/sdk/client: what a game's screens (browser only) may use.
 * `games/<id>/src/client.ts` does `export default defineClient({ scene: MyView, setup?, background?, hud? })`.
 */

import type { GameBackgroundScene } from './GameBackgroundScene.js';
import type { GameView } from './GameView.js';
import type { RoomSetupScene } from './RoomSetupScene.js';

export * from './followFrame.js';
export * from './frame.js';
export * from './GameBackgroundScene.js';
export * from './GameScene.js';
export * from './GameView.js';
export * from './graphics.js';
export * from './host.js';
export * from './props.js';
export * from './RoomSetupScene.js';
export * from './SceneDirector.js';
export * from './text.js';

/** What `games/<id>/src/client.ts` exports by default. */
export interface GameClient {
  // biome-ignore lint/suspicious/noExplicitAny: scenes of different games have different types
  scene: new () => GameView<any, any>;
  /**
   * Board/sandbox background: omitted keeps the app's sky; false sleeps/hides it; a scene
   * replaces it behind the board. Setup screens keep the sky. The scene restarts for each
   * board opening, survives round changes, and stops when leaving the board.
   */
  background?: false | (new () => GameBackgroundScene);
  /**
   * Optional room settings screen the game designs itself ("Tạo phòng", "Tuỳ chỉnh"). Without
   * it the room is created right away with the default options.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each game has its own options type
  setup?: new () => RoomSetupScene<any>;
  /**
   * The question a player gets when they tap "Rời phòng" mid-game (leaving stops the game for
   * everyone, or loses it in a game with `onLeave`). Change any of its texts, or `false` for a
   * game where leaving needs no question.
   */
  leaveConfirm?: LeaveConfirm | false;
  /**
   * The screen shows who won itself (e.g. a standings screen): the app's result panel then only
   * has its buttons ("Chơi ván mới"), without its "… thắng!" title.
   */
  showsResult?: boolean;
  /**
   * The screen lists the players itself (names, pictures, whose turn): the room bar hides its
   * list of players while a game is on.
   */
  showsPlayers?: boolean;
  /**
   * Room controls the board draws itself, with its own art and placement. The app hides its
   * own while the board is shown; the board reads `ctx.room` and calls the `GameView` room
   * actions (`leaveRoom`, `openSettings`, `newGame`, `customize`, `takeSeat`).
   */
  hud?: BoardHud;
}

/** Which of the app's room controls a board replaces (see `GameClient.hud`). */
export interface BoardHud {
  /**
   * The room bar: "←" (`leaveRoom()`), "🏠" (`leaveRoom('home')`), the players and the
   * spectators (`ctx.room.watchers`). The board gets the whole height: `ctx.screen.top` is
   * near 0.
   */
  nav?: boolean;
  /** The settings button in the top-right corner: `openSettings()` opens its panel. */
  settings?: boolean;
  /**
   * The panel after a game: "Chơi ván mới" (`newGame()`), "Tuỳ chỉnh" (`customize()`),
   * "Vào chơi" (`takeSeat()`) and "waiting for the host" for the others. Errors and the
   * "leave mid-game?" question stay the app's.
   */
  result?: boolean;
}

/** Texts of the "leave mid-game?" question; the ones left out keep the app's. */
export interface LeaveConfirm {
  /** Default: "Bỏ dở ván này?" */
  title?: string;
  /** Default: "Bạn rời phòng thì ván đang chơi sẽ dừng lại cho cả bàn." */
  message?: string;
  /** The button that keeps playing. Default: "Ở lại chơi tiếp" */
  stay?: string;
  /** The button that leaves. Default: "Rời phòng" */
  leave?: string;
}

export function defineClient(client: GameClient): GameClient {
  return client;
}

export type { FlowContext, FlowHandle, FlowResult, RunOptions } from './runtime/Flow.js';
export type {
  PreparedSound,
  SceneAudio,
  SoundFinish,
  SoundHandle,
  SoundOptions,
  SoundStart,
} from './runtime/SceneAudio.js';
export type { FiniteTweenConfig } from './runtime/SceneMotion.js';
export { SceneRuntime } from './runtime/SceneRuntime.js';
