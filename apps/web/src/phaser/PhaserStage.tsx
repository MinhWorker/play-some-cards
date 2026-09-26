import {
  BOARD_MOVE,
  BOARD_OPTIONS,
  BOARD_PROPS,
  SETUP_CANCEL,
  SETUP_CURRENT,
  SETUP_SUBMIT,
} from '@psc/sdk/client';
import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { loadClient } from '@/games';
import { bridge, type Stage } from './bridge';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { SkyScene } from './scenes/SkyScene';

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

/** Full-screen Phaser canvas behind the React UI. `onReady` fires once images are loaded. */
export function PhaserStage({ stage, onReady }: { stage: Stage; onReady?: () => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const ready = useRef(false);
  const latest = useRef(stage);
  latest.current = stage;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;

  // The room bar's height, kept in the registry so board scenes can leave room for it.
  const hudTop = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onHudTop = (px: number | undefined) => {
      hudTop.current = px;
      game.current?.registry.set('hudTop', px);
    };
    bridge.on('hud:top', onHudTop);
    return () => {
      bridge.off('hud:top', onHudTop);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Phaser draws text on a canvas, so the web font must be loaded first.
    void document.fonts.load('800 32px "Baloo 2"').finally(() => {
      if (cancelled || !parent.current) return;
      const g = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parent.current,
        backgroundColor: '#8fd3f4',
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
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
      g.events.once('booted', () => {
        ready.current = true;
        g.registry.set('hudTop', hudTop.current);
        applyStage(g, () => latest.current);
        readyCallback.current?.();
      });
      game.current = g;
      // Lets scripts/e2e.mjs find objects on the canvas (dev server only).
      if (import.meta.env.DEV) (window as unknown as { __phaser?: Phaser.Game }).__phaser = g;
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
