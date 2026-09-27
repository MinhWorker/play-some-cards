import {
  BOARD_MOVE,
  BOARD_OPTIONS,
  BOARD_PROPS,
  FRAME,
  type Frame,
  SETUP_CANCEL,
  SETUP_CURRENT,
  SETUP_SUBMIT,
} from '@psc/sdk/client';
import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { loadClient } from '@/games';
import { currentAppFrame, onFrame } from '@/lib/frame';
import { bridge, type Stage } from './bridge';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { SkyScene } from './scenes/SkyScene';
import { textureAudit } from './textureAudit';

/** Scenes that stay on behind everything; any other one (hub, a board, a setup screen) is the foreground. */
const BACKGROUND = new Set(['boot', 'sky']);

/** Started and not yet shut down (includes loading its images). */
function isStarted(game: Phaser.Game, key: string) {
  const status = game.scene.getScene(key)?.sys.settings.status ?? Phaser.Scenes.PENDING;
  return status >= Phaser.Scenes.START && status <= Phaser.Scenes.SLEEPING;
}

/** Scene key for a stage: 'hub', a board (`<gameId>`), a setup screen (`<gameId>:setup`). */
function sceneKey(stage: Stage) {
  if (stage.mode === 'hub') return 'hub';
  if (stage.mode === 'board') return stage.gameId;
  if (stage.mode === 'setup') return `${stage.gameId}:setup`;
  return null;
}

/**
 * Applies a Stage: runs the right foreground scene and pushes fresh board props. A game's scenes
 * are downloaded and added the first time they are needed; `latest` is read again after that,
 * since the stage may have changed meanwhile.
 */
function applyStage(game: Phaser.Game, latest: () => Stage) {
  const stage = latest();
  const target = sceneKey(stage);
  if (stage.mode === 'board') game.registry.set('board', stage);
  if (stage.mode === 'setup') game.registry.set(SETUP_CURRENT, stage.current);
  for (const key of Object.keys(game.scene.keys)) {
    if (key !== target && !BACKGROUND.has(key) && isStarted(game, key)) game.scene.stop(key);
  }
  if (!target) return;
  if (!game.scene.keys[target]) {
    if (stage.mode !== 'board' && stage.mode !== 'setup') return;
    void loadClient(stage.gameId).then((client) => {
      const scene = stage.mode === 'setup' ? client.setup : client.scene;
      if (!scene) return;
      if (!game.scene.keys[target]) game.scene.add(target, scene);
      applyStage(game, latest);
    });
    return;
  }
  if (!isStarted(game, target)) game.scene.start(target);
  else if (stage.mode === 'board' && game.scene.isActive(target)) {
    game.events.emit(BOARD_PROPS, stage);
  }
}

/** The room bar's bottom edge (CSS px from the top of the page) in design units, or undefined. */
function hudTopUnits(px: number | undefined, frame: Frame) {
  return px === undefined ? undefined : (px - frame.css.top) / frame.css.unit;
}

/** Sizes the canvas to the screen at its pixel density and hands the frame to the scenes. */
function applyFrame(game: Phaser.Game, frame: Frame, hudTop: number | undefined) {
  const { width, height } = frame.canvas;
  if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
  game.scale.setZoom(1 / frame.dpr);
  game.registry.set('hudTop', hudTopUnits(hudTop, frame));
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
  const latest = useRef(stage);
  latest.current = stage;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;

  // The room bar's height, kept in the registry (in design units) so game screens can leave
  // room for it.
  const hudTop = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onHudTop = (px: number | undefined) => {
      hudTop.current = px;
      game.current?.registry.set('hudTop', hudTopUnits(px, currentAppFrame()));
    };
    bridge.on('hud:top', onHudTop);
    const offFrame = onFrame((frame) => {
      if (game.current && ready.current) applyFrame(game.current, frame, hudTop.current);
    });
    return () => {
      bridge.off('hud:top', onHudTop);
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
      // A game's setup screen hands its room options to React (RoomSetup), which creates the room.
      g.events.on(SETUP_SUBMIT, (options: unknown) => bridge.emit('setup:submit', options));
      g.events.on(SETUP_CANCEL, () => bridge.emit('setup:cancel'));
      // Before any scene starts: they read it in create().
      g.registry.set(FRAME, frame);
      g.events.once('booted', () => {
        ready.current = true;
        applyFrame(g, currentAppFrame(), hudTop.current);
        applyStage(g, () => latest.current);
        readyCallback.current?.();
      });
      game.current = g;
      // Lets scripts/e2e.mjs find objects on the canvas (dev server only): `__toScreen` turns a
      // scene's design units into page CSS px. `__textureAudit` lists stretched images (shots).
      if (import.meta.env.DEV) {
        Object.assign(window, {
          __phaser: g,
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
      game.current?.destroy(true);
      game.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = stage;
    if (game.current && ready.current) applyStage(game.current, () => latest.current);
  }, [stage]);

  return <div ref={parent} className="stage" />;
}
