import {
  BOARD_MOVE,
  BOARD_OPTIONS,
  BOARD_PROPS,
  BOARD_ROOM,
  FRAME,
  type Frame,
  SceneDirector,
  SETUP_CANCEL,
  SETUP_CURRENT,
  SETUP_SUBMIT,
} from '@xomdao/sdk/client';
import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { loadClient } from '@/games';
import { currentAppFrame, onFrame } from '@/lib/frame';
import { soundDiagnostics } from '@/lib/sound';
import { bridge, type Stage } from './bridge';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { SkyScene } from './scenes/SkyScene';
import { textureAudit } from './textureAudit';

/** Persistent app scenes; the director can sleep the sky for a game background. */
const BACKGROUND = new Set(['boot', 'sky']);

/** Scene key for a stage: 'hub', a board (`<gameId>`), a setup screen (`<gameId>:setup`). */
function sceneKey(stage: Stage) {
  if (stage.mode === 'hub') return 'hub';
  if (stage.mode === 'board') return stage.gameId;
  if (stage.mode === 'setup') return `${stage.gameId}:setup`;
  return null;
}

function stageRequest(stage: Stage) {
  return {
    key: sceneKey(stage),
    instance: 'instance' in stage ? stage.instance : stage.mode,
    data: stage,
  };
}

/**
 * The room bar's bottom edge (CSS px from the top of the page) in design units: 0 for `null`
 * (no bar: the board draws its own), undefined when unknown.
 */
function hudTopUnits(px: number | null | undefined, frame: Frame) {
  if (px === null) return 0;
  return px === undefined ? undefined : (px - frame.css.top) / frame.css.unit;
}

/** The free middle of the room bar's row: a box in CSS px from the page's corner. */
type HudGap = { left: number; right: number; top: number; bottom: number } | undefined;

/** The room bar's free middle in design units (the registry key 'hudGap'), or undefined. */
function hudGapUnits(gap: HudGap, frame: Frame) {
  if (!gap) return undefined;
  const { left, top, unit } = frame.css;
  return {
    left: (gap.left - left) / unit,
    right: (gap.right - left) / unit,
    top: (gap.top - top) / unit,
    bottom: (gap.bottom - top) / unit,
  };
}

/** Sizes the canvas to the screen at its pixel density and hands the frame to the scenes. */
function applyFrame(
  game: Phaser.Game,
  frame: Frame,
  hud: { top: number | null | undefined; gap: HudGap },
) {
  const { width, height } = frame.canvas;
  if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
  game.scale.setZoom(1 / frame.dpr);
  game.registry.set('hudTop', hudTopUnits(hud.top, frame));
  game.registry.set('hudGap', hudGapUnits(hud.gap, frame));
  game.registry.set(FRAME, frame);
}

/**
 * Full-screen Phaser canvas behind the React UI, drawn at the screen's pixel density. Scenes lay
 * out in design units on the frame (`followFrame`). `onReady` fires once images are loaded.
 */
export function PhaserStage({ stage, onReady }: { stage: Stage; onReady?: () => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const ready = useRef(false);
  /** Who holds the board's keys: the Dev Console while typing, and open app dialogs. */
  const keyHolds = useRef({ typing: false, dialogs: 0 });
  const keyboardBefore = useRef<boolean | null>(null);
  const director = useRef<SceneDirector<Stage> | null>(null);
  const [sceneError, setSceneError] = useState(false);
  const latest = useRef(stage);
  latest.current = stage;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;

  // The room bar's height and the free middle of its row, kept in the registry (in design
  // units) so game screens can leave room for the bar and use the rest of its row.
  const hud = useRef<{ top: number | null | undefined; gap: HudGap }>({
    top: undefined,
    gap: undefined,
  });
  useEffect(() => {
    const onHudTop = (px: number | null | undefined) => {
      hud.current.top = px;
      game.current?.registry.set('hudTop', hudTopUnits(px, currentAppFrame()));
    };
    const onHudGap = (gap: HudGap) => {
      hud.current.gap = gap;
      game.current?.registry.set('hudGap', hudGapUnits(gap, currentAppFrame()));
    };
    const holdKeys = () => {
      const keyboard = game.current?.input.keyboard;
      if (!keyboard) return;
      const { typing, dialogs } = keyHolds.current;
      if (typing || dialogs > 0) {
        keyboardBefore.current ??= keyboard.enabled;
        keyboard.enabled = false;
      } else if (keyboardBefore.current !== null) {
        keyboard.enabled = keyboardBefore.current;
        keyboardBefore.current = null;
      }
    };
    const onTyping = (typing: boolean) => {
      keyHolds.current.typing = typing;
      holdKeys();
    };
    // An app dialog over the board (settings, "leave mid-game?") keeps keys from the game.
    const onDialog = (open: boolean) => {
      keyHolds.current.dialogs = Math.max(0, keyHolds.current.dialogs + (open ? 1 : -1));
      holdKeys();
    };
    bridge.on('dev:typing', onTyping);
    bridge.on('ui:dialog', onDialog);
    bridge.on('hud:top', onHudTop);
    bridge.on('hud:gap', onHudGap);
    const offFrame = onFrame((frame) => {
      if (game.current && ready.current) applyFrame(game.current, frame, hud.current);
    });
    return () => {
      bridge.off('dev:typing', onTyping);
      bridge.off('ui:dialog', onDialog);
      keyHolds.current = { typing: false, dialogs: 0 };
      holdKeys();
      bridge.off('hud:top', onHudTop);
      bridge.off('hud:gap', onHudGap);
      offFrame();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Phaser draws text on a canvas, so the web font must be loaded first.
    void document.fonts.load('800 32px "Baloo 2"').finally(() => {
      if (cancelled || !parent.current) return;
      const frame = currentAppFrame();
      const g = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parent.current,
        backgroundColor: '#8fd3f4',
        // As many canvas pixels as the screen has, shown at CSS size: sharp on every density.
        scale: {
          mode: Phaser.Scale.NONE,
          width: frame.canvas.width,
          height: frame.canvas.height,
          zoom: 1 / frame.dpr,
        },
        // Mipmaps for power-of-two images (256×256 pieces…): drawn at a fraction of their size,
        // they stay smooth instead of turning jagged.
        render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
        // Only listen on the canvas. Window listeners would let taps on React panels and
        // modals (drawn over the canvas) reach the islands or board underneath.
        input: { windowEvents: false },
        scene: [BootScene, SkyScene, HubScene],
      });
      // Moves made on a game's board go to React (useBoardMoves), which sends them.
      g.events.on(BOARD_MOVE, (move: unknown) => bridge.emit('board:move', move));
      g.events.on(BOARD_OPTIONS, (options: unknown) => bridge.emit('board:options', options));
      // Room controls a board draws itself (`hud` in its client.ts): Room or Sandbox acts.
      g.events.on(BOARD_ROOM, (action: unknown) => bridge.emit('board:room', action));
      // A game's setup screen hands its room options to React (RoomSetup), which creates the room.
      g.events.on(SETUP_SUBMIT, (options: unknown) => bridge.emit('setup:submit', options));
      g.events.on(SETUP_CANCEL, () => bridge.emit('setup:cancel'));
      // Before any scene starts: they read it in create().
      g.registry.set(FRAME, frame);
      g.events.once('booted', () => {
        const { typing, dialogs } = keyHolds.current;
        if ((typing || dialogs > 0) && g.input.keyboard) {
          keyboardBefore.current = g.input.keyboard.enabled;
          g.input.keyboard.enabled = false;
        }
        ready.current = true;
        applyFrame(g, currentAppFrame(), hud.current);
        director.current = new SceneDirector(g, {
          background: BACKGROUND,
          defaultBackground: 'sky',
          load: async (key, data) => {
            if (data.mode !== 'board' && data.mode !== 'setup')
              throw new Error(`Unknown scene: ${key}`);
            const client = await loadClient(data.gameId);
            const scene = data.mode === 'setup' ? client.setup : client.scene;
            if (!scene) throw new Error(`Scene unavailable: ${key}`);
            const background = data.mode === 'board' ? client.background : undefined;
            return {
              scene,
              background: background
                ? { key: `${data.gameId}:background`, scene: background }
                : background,
            };
          },
          write: (data) => {
            if (data.mode === 'board') g.registry.set('board', data);
            if (data.mode === 'setup') g.registry.set(SETUP_CURRENT, data.current);
          },
          push: (data) => {
            if (data.mode === 'board') g.events.emit(BOARD_PROPS, data);
          },
          onError: (error) => {
            console.error('Scene could not open', error);
            setSceneError(true);
          },
        });
        void director.current.show(stageRequest(latest.current));
        readyCallback.current?.();
      });
      game.current = g;
      // Lets scripts/e2e.mjs find objects on the canvas (dev server only): `__toScreen` turns a
      // scene's design units into page CSS px. `__textureAudit` lists stretched images (shots).
      if (import.meta.env.DEV) {
        Object.assign(window, {
          __phaser: g,
          __runtimeDiagnostics: () => ({
            scenes: g.scene.getScenes(true).flatMap((scene) => {
              const runtime = (
                scene as Phaser.Scene & { runtime?: import('@xomdao/sdk/client').SceneRuntime }
              ).runtime;
              return runtime ? [{ scene: scene.sys.settings.key, ...runtime.inspect() }] : [];
            }),
            audio: soundDiagnostics(),
          }),
          __toScreen: (key: string, x: number, y: number) => {
            const cam = g.scene.getScene(key).cameras.main;
            const { dpr } = g.registry.get(FRAME) as Frame;
            return {
              x: (cam.x + (x - cam.scrollX) * cam.zoom) / dpr,
              y: (cam.y + (y - cam.scrollY) * cam.zoom) / dpr,
            };
          },
          __textureAudit: () => textureAudit(g),
        });
      }
    });
    return () => {
      cancelled = true;
      ready.current = false;
      director.current?.dispose();
      director.current = null;
      game.current?.destroy(true);
      game.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = stage;
    setSceneError(false);
    if (ready.current) void director.current?.show(stageRequest(stage));
  }, [stage]);

  return (
    <>
      <div ref={parent} className="stage" />
      {sceneError && (
        <div className="hud">
          <span>Không tải được bàn chơi.</span>
          <button
            type="button"
            onClick={() => {
              setSceneError(false);
              void director.current?.show(stageRequest(latest.current));
            }}
          >
            Thử lại
          </button>
        </div>
      )}
    </>
  );
}
