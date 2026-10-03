import type Phaser from 'phaser';
import type { PresentationClock } from './PresentationClock.js';
import type { SceneAudio, SoundOptions } from './SceneAudio.js';
import type { FiniteTweenConfig, SceneMotion } from './SceneMotion.js';
import { FlowCancelled, Scope } from './Scope.js';

export type FlowResult =
  | { status: 'completed' }
  | { status: 'cancelled'; reason: string }
  | { status: 'failed'; error: unknown };
export interface FlowHandle {
  readonly done: Promise<FlowResult>;
  cancel(): void;
}
export interface RunOptions {
  lane?: string;
  policy?: 'queue' | 'replace';
  lifetime?: 'round' | 'scene';
  onFailure?: (error: unknown) => void;
}
export interface FlowContext {
  readonly signal: AbortSignal;
  wait(ms: number): Promise<void>;
  tween(config: FiniteTweenConfig): Promise<void>;
  animate(sprite: Phaser.GameObjects.Sprite, key: string): Promise<void>;
  sound(name: string, options?: SoundOptions & { wait?: 'started' | 'finished' }): Promise<void>;
  frame(update: (deltaMs: number) => boolean): Promise<void>;
  parallel(...branches: Array<(fx: FlowContext) => Promise<void>>): Promise<void>;
  defer(cleanup: () => void): void;
  checkpoint(): void;
}

export function context(
  scope: Scope,
  clock: PresentationClock,
  motion: SceneMotion,
  audio: SceneAudio,
): FlowContext {
  const step = <T>(name: string, start: () => T): T => {
    scope.checkpoint();
    scope.step = name;
    return start();
  };
  return {
    signal: scope.signal,
    checkpoint: () => scope.checkpoint(),
    defer: (cleanup) => scope.defer(cleanup),
    wait: (ms) => step('wait', () => clock.wait(scope, ms)),
    frame: (update) => step('frame', () => clock.frame(scope, update)),
    tween: (config) => step('tween', () => motion.tween(scope, config)),
    animate: (sprite, key) => step('animate', () => motion.animate(scope, sprite, key)),
    sound: (name, options) =>
      step('sound', () => {
        const voice = audio.playIn(scope, name, options);
        return clock.observe(scope, options?.wait === 'finished' ? voice.finished : voice.started);
      }),
    parallel: async (...branches) => {
      scope.checkpoint();
      scope.step = 'parallel';
      const children = branches.map(() => new Scope(scope.report, scope));
      let failed = false;
      let failure: unknown;
      const results = children.map(async (child, i) => {
        try {
          await branches[i]?.(context(child, clock, motion, audio));
          child.checkpoint();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
            for (const sibling of children) sibling.close('parallel-cancelled');
          }
        } finally {
          child.finish();
        }
      });
      await Promise.all(results);
      scope.checkpoint();
      if (failed) throw failure;
    },
  };
}

export function resultOf(error: unknown): FlowResult {
  return error instanceof FlowCancelled
    ? { status: 'cancelled', reason: error.reason }
    : { status: 'failed', error };
}
