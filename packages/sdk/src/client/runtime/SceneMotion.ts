import type Phaser from 'phaser';
import type { PresentationClock } from './PresentationClock.js';
import { FlowCancelled, type Scope } from './Scope.js';

/** Finite presentation tweens; the runtime owns pausing and time scaling. */
export type FiniteTweenConfig = Omit<
  Phaser.Types.Tweens.TweenBuilderConfig,
  | 'paused'
  | 'persist'
  | 'timeScale'
  | 'loop'
  | 'repeat'
  | 'delay'
  | 'duration'
  | 'hold'
  | 'repeatDelay'
  | 'loopDelay'
  | 'completeDelay'
> & {
  paused?: never;
  persist?: never;
  timeScale?: never;
  loop?: number;
  repeat?: number;
  delay?: number;
  duration?: number;
  hold?: number;
  repeatDelay?: number;
  loopDelay?: number;
  completeDelay?: number;
};

function validate(config: FiniteTweenConfig) {
  for (const key of ['paused', 'persist', 'timeScale']) {
    if (config[key] !== undefined) throw new Error(`Managed tween cannot set ${key}`);
  }
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'targets' || key.endsWith('Params') || key === 'callbackScope') continue;
      if (
        [
          'duration',
          'delay',
          'hold',
          'repeatDelay',
          'loopDelay',
          'completeDelay',
          'repeat',
          'loop',
        ].includes(key)
      ) {
        if (typeof item !== 'number' || !Number.isFinite(item) || item < 0)
          throw new Error(`Managed tween requires finite non-negative ${key}`);
      } else if (key === 'props' || (item && typeof item === 'object' && !Array.isArray(item)))
        visit(item);
    }
  };
  visit(config);
}

/** Uses Phaser's interpolator, driven once by the runtime's capped presentation delta. */
export class SceneMotion {
  private owners = new Map<object, Scope>();
  private animations = new Map<Phaser.GameObjects.Sprite, Scope>();
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly clock: PresentationClock,
  ) {}

  cancelTargets(targets: object | object[]) {
    for (const target of Array.isArray(targets) ? targets : [targets]) {
      this.owners.get(target)?.close('target-lost');
    }
  }

  async tween(scope: Scope, config: FiniteTweenConfig) {
    scope.checkpoint();
    validate(config);
    const targets: object[] = Array.isArray(config.targets) ? config.targets : [config.targets];
    for (const target of targets) this.owners.get(target)?.close('replaced');
    let completed = false;
    let callbackError: unknown;
    let failed = false;
    const listeners: Array<() => void> = [];
    const unclaim = () => {
      for (const off of listeners.splice(0)) off();
      for (const target of targets)
        if (this.owners.get(target) === scope) this.owners.delete(target);
    };
    const wrapped = { ...config };
    for (const [key, value] of Object.entries(config)) {
      if (!key.startsWith('on') || typeof value !== 'function') continue;
      wrapped[key] = (...args: unknown[]) => {
        if (scope.signal.aborted) return;
        if (key === 'onComplete') {
          completed = true;
          unclaim();
        }
        try {
          value.apply(config.callbackScope ?? this.scene, args);
        } catch (error) {
          callbackError = error;
          failed = true;
        }
      };
    }
    const tween = this.scene.tweens.create(wrapped) as Phaser.Tweens.Tween;
    // create() deliberately does not register with TweenManager: no second clock or global scale.
    tween.reset();
    tween.on('complete', () => {
      completed = true;
      unclaim();
    });
    // Phaser emits its event before invoking the config callback. Invoke the user's stop
    // callback before closing the scope; cancellation itself must not call it afterwards.
    tween.setCallback(
      'onStop',
      (...args: unknown[]) => {
        if (scope.signal.aborted) return;
        try {
          config.onStop?.apply(
            config.callbackScope ?? this.scene,
            args as Parameters<NonNullable<typeof config.onStop>>,
          );
        } catch (error) {
          scope.fail(error);
          return;
        }
        scope.close('target-lost');
      },
      config.onStopParams,
    );
    const release = scope.own(() => {
      unclaim();
      tween.destroy();
    });
    for (const target of targets) {
      this.owners.set(target, scope);
      const obj = target as Partial<Phaser.GameObjects.GameObject>;
      if (typeof obj.once === 'function') {
        if (!obj.scene) {
          scope.close('target-lost');
          break;
        }
        const lost = () => scope.close('target-lost');
        obj.once('destroy', lost);
        listeners.push(() => obj.off?.('destroy', lost));
      }
    }
    try {
      await this.clock.frame(scope, (delta) => {
        if (tween.isDestroyed()) throw new FlowCancelled('target-lost');
        const ended = tween.update(delta / this.scene.tweens.timeScale);
        if (failed) throw callbackError;
        if (ended && !completed) throw new FlowCancelled('target-lost');
        return completed;
      });
      scope.checkpoint();
    } finally {
      release();
      unclaim();
      if (!tween.isDestroyed()) tween.destroy();
    }
  }

  async animate(scope: Scope, sprite: Phaser.GameObjects.Sprite, key: string) {
    scope.checkpoint();
    if (!sprite.scene) throw new FlowCancelled('target-lost');
    const animation = this.scene.anims.get(key);
    if (!animation || animation.repeat < 0) throw new Error(`Animation must be finite: ${key}`);
    this.animations.get(sprite)?.close('replaced');
    this.animations.set(sprite, scope);
    let completed = false;
    const lost = () => scope.close('target-lost');
    const complete = (anim: Phaser.Animations.Animation) => {
      if (anim.key === key) completed = true;
    };
    sprite.on('animationcomplete', complete);
    sprite.on('animationstop', lost);
    sprite.once('destroy', lost);
    const scale = sprite.anims.timeScale;
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      sprite.off('animationcomplete', complete);
      sprite.off('animationstop', lost);
      sprite.off('destroy', lost);
      if (this.animations.get(sprite) === scope) this.animations.delete(sprite);
      if (sprite.scene) {
        sprite.anims.stop();
        sprite.anims.timeScale = scale;
      }
    };
    const release = scope.own(dispose);
    try {
      sprite.play(key);
      sprite.anims.timeScale = 0;
      await this.clock.frame(scope, (delta) => {
        if (!sprite.scene) throw new FlowCancelled('target-lost');
        if (sprite.anims.currentAnim?.key !== key) throw new FlowCancelled('replaced');
        sprite.anims.timeScale = 1 / this.scene.anims.globalTimeScale;
        sprite.anims.update(0, delta);
        sprite.anims.timeScale = 0;
        return completed;
      });
      scope.checkpoint();
    } finally {
      release();
      dispose();
    }
  }

  get count() {
    return this.owners.size + this.animations.size;
  }
}
