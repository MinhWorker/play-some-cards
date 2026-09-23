import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { boardScenes } from '../games';
import { bridge, type Stage } from './bridge';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { SkyScene } from './scenes/SkyScene';

const FOREGROUND = ['hub', ...Object.keys(boardScenes)];

/** Applies a Stage: runs the right foreground scene and pushes fresh board props. */
function applyStage(game: Phaser.Game, stage: Stage) {
  const target = stage.mode === 'hub' ? 'hub' : stage.mode === 'board' ? stage.gameId : null;
  if (stage.mode === 'board') game.registry.set('board', stage);
  for (const key of FOREGROUND) {
    if (key !== target && game.scene.isActive(key)) game.scene.stop(key);
  }
  if (!target) return;
  if (game.scene.isActive(target)) {
    if (stage.mode === 'board') bridge.emit('board:props', stage);
  } else {
    game.scene.start(target);
  }
}

/** Full-screen Phaser canvas behind the React UI. */
export function PhaserStage({ stage }: { stage: Stage }) {
  const parent = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const ready = useRef(false);
  const latest = useRef(stage);
  latest.current = stage;

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
        scene: [BootScene, SkyScene, HubScene, ...Object.values(boardScenes)],
      });
      g.events.once('booted', () => {
        ready.current = true;
        applyStage(g, latest.current);
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
    if (game.current && ready.current) applyStage(game.current, stage);
  }, [stage]);

  return <div ref={parent} className="stage" />;
}
