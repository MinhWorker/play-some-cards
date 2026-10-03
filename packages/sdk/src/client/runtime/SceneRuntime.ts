import type Phaser from 'phaser';
import type { ClientHost } from '../host.js';
import {
  context,
  type FlowContext,
  type FlowHandle,
  type FlowResult,
  type RunOptions,
  resultOf,
} from './Flow.js';
import { PresentationClock } from './PresentationClock.js';
import { SceneAudio } from './SceneAudio.js';
import { type FiniteTweenConfig, SceneMotion } from './SceneMotion.js';
import { Scope } from './Scope.js';

type Entry = {
  epoch: number;
  scope: Scope;
  parent: Scope;
  body: (fx: FlowContext) => Promise<void>;
  options: RunOptions;
  settle: (result: FlowResult) => void;
};
type Lane = { lifetime: 'round' | 'scene'; active?: Entry; queue: Entry[] };
const MAX_PENDING = 64;

/** One scene run. A new round replaces only its round scope, keeping decoration and speed. */
export class SceneRuntime {
  readonly audio: SceneAudio;
  private readonly motion: SceneMotion;
  private readonly clock = new PresentationClock();
  private readonly root: Scope;
  private round: Scope;
  private epoch = 1;
  private lanes = new Map<string, Lane>();
  private closed = false;
  private sleeping = false;
  private hidden = false;
  private gamePaused = false;
  private skipDelta = false;
  private subscriptions: Array<() => void> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    host: ClientHost,
    private readonly defaultLifetime: 'round' | 'scene' = 'round',
    private readonly report: (
      error: unknown,
      details: { scene: string; epoch: number; lane?: string; step?: string },
    ) => void = (error, details) => console.error('Scene flow failed', details, error),
  ) {
    const reportScope = (error: unknown) =>
      this.reportError(error, { scene: scene.sys.settings.key, epoch: this.epoch });
    this.root = new Scope(reportScope);
    this.round = new Scope(reportScope, this.root);
    this.motion = new SceneMotion(scene, this.clock);
    this.audio = new SceneAudio(
      host,
      scene.sys.settings.key.split(':')[0] ?? '',
      () => this.defaultScope(),
      () => this.clock.paused,
    );
    const listen = (
      events: Phaser.Events.EventEmitter,
      event: string,
      fn: (...args: never[]) => void,
    ) => {
      events.on(event, fn);
      this.subscriptions.push(() => events.off(event, fn));
    };
    listen(scene.events, 'update', (_time: number, delta: number) => {
      this.clock.tick(this.skipDelta ? 0 : delta);
      this.skipDelta = false;
    });
    const pause = () => {
      this.sleeping = true;
      this.syncPause();
    };
    const resume = () => {
      this.sleeping = false;
      this.skipDelta = true;
      this.syncPause();
    };
    listen(scene.events, 'pause', pause);
    listen(scene.events, 'sleep', pause);
    listen(scene.events, 'resume', resume);
    listen(scene.events, 'wake', resume);
    if (scene.sys.game?.events) {
      listen(scene.sys.game.events, 'pause', () => {
        this.gamePaused = true;
        this.syncPause();
      });
      listen(scene.sys.game.events, 'resume', () => {
        this.gamePaused = false;
        this.skipDelta = true;
        this.syncPause();
      });
    }
    listen(scene.events, 'shutdown', () => this.dispose());
    listen(scene.events, 'destroy', () => this.dispose());
    if (typeof document !== 'undefined') {
      const visibility = () => {
        this.hidden = document.hidden;
        this.skipDelta = true;
        this.syncPause();
      };
      document.addEventListener('visibilitychange', visibility);
      this.subscriptions.push(() => document.removeEventListener('visibilitychange', visibility));
      visibility();
    }
  }

  private syncPause() {
    this.clock.paused = this.sleeping || this.hidden || this.gamePaused;
    if (this.clock.paused) this.audio.silence();
  }

  private defaultScope() {
    return this.defaultLifetime === 'round' ? this.round : this.root;
  }

  run(body: (fx: FlowContext) => Promise<void>, options: RunOptions = {}): FlowHandle {
    if (options.policy && !options.lane) throw new Error('Flow policy requires a lane');
    const lifetime = options.lifetime ?? this.defaultLifetime;
    const parent = lifetime === 'round' ? this.round : this.root;
    parent.checkpoint();
    let lane = options.lane ? this.lanes.get(options.lane) : undefined;
    if (lane && lane.lifetime !== lifetime) throw new Error('Cannot mix lifetimes on a lane');
    if (options.lane && !lane) {
      lane = { lifetime, queue: [] };
      this.lanes.set(options.lane, lane);
    }
    if (options.policy === 'replace' && options.lane) this.cancelLane(options.lane, 'replaced');
    let settle!: (result: FlowResult) => void;
    const done = new Promise<FlowResult>((resolve) => {
      settle = resolve;
    });
    const epoch = this.epoch;
    const flowScope = new Scope(
      (error) =>
        this.reportError(error, {
          scene: this.scene.sys.settings.key,
          epoch,
          lane: options.lane,
          step: flowScope.step,
        }),
      parent,
    );
    const entry: Entry = {
      epoch,
      scope: flowScope,
      parent,
      body,
      options,
      settle,
    };
    const cancel = () => {
      entry.scope.close('cancelled');
      if (lane && lane.active !== entry) {
        const index = lane.queue.indexOf(entry);
        if (index >= 0) lane.queue.splice(index, 1);
        entry.scope.finish();
        settle({ status: 'cancelled', reason: 'cancelled' });
      }
    };
    if (lane && lane.queue.length >= MAX_PENDING) {
      this.cancelLane(options.lane ?? '', 'overflow');
      entry.scope.finish();
      const error = new Error('Presentation lane overflow');
      settle({ status: 'failed', error });
      this.failure(entry, error);
    } else if (lane) {
      lane.queue.push(entry);
      this.pump(lane);
    } else void this.execute(entry);
    return { done, cancel };
  }

  private pump(lane: Lane) {
    if (lane.active || this.closed) return;
    const next = lane.queue.shift();
    if (!next) return;
    lane.active = next;
    void this.execute(next).then(() => {
      lane.active = undefined;
      this.pump(lane);
    });
  }

  private async execute(entry: Entry) {
    let result: FlowResult = { status: 'completed' };
    try {
      entry.scope.checkpoint();
      await entry.body(context(entry.scope, this.clock, this.motion, this.audio));
      entry.scope.checkpoint();
    } catch (error) {
      result = entry.scope.failure
        ? { status: 'failed', error: entry.scope.failure.error }
        : entry.scope.signal.aborted
          ? { status: 'cancelled', reason: String(entry.scope.signal.reason) }
          : resultOf(error);
    } finally {
      entry.scope.finish();
    }
    if (result.status === 'failed') this.failure(entry, result.error);
    entry.settle(result);
  }

  private reportError(
    error: unknown,
    details: { scene: string; epoch: number; lane?: string; step?: string },
  ) {
    try {
      this.report(error, details);
    } catch (reportError) {
      console.error('Scene flow error handler failed', reportError);
    }
  }

  private failure(entry: Entry, error: unknown) {
    this.reportError(error, {
      scene: this.scene.sys.settings.key,
      epoch: entry.epoch,
      lane: entry.options.lane,
      step: entry.scope.step,
    });
    if (entry.parent.signal.aborted) return;
    try {
      entry.options.onFailure?.(error);
    } catch (failure) {
      this.root.report(failure);
    }
  }

  cancelLane(name: string, reason = 'cancelled') {
    const lane = this.lanes.get(name);
    if (!lane) return;
    lane.active?.scope.close(reason);
    for (const entry of lane.queue.splice(0)) {
      entry.scope.close(reason);
      entry.scope.finish();
      entry.settle({ status: 'cancelled', reason });
    }
  }

  pending(name: string) {
    return this.lanes.get(name)?.queue.length ?? 0;
  }
  busy(name: string) {
    const lane = this.lanes.get(name);
    return !!lane?.active || !!lane?.queue.length;
  }

  /** Short independent UI feedback; sequential actions should use run() and fx.tween(). */
  tween(config: FiniteTweenConfig): FlowHandle {
    return this.run(async (fx) => {
      await fx.tween(config);
    });
  }

  /** Scoped delayed callback. Prefer fx.wait() when subsequent steps belong to one action. */
  after(ms: number, callback: () => void): FlowHandle {
    return this.run(async (fx) => {
      await fx.wait(ms);
      fx.checkpoint();
      callback();
    });
  }

  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4)
      throw new Error('Presentation speed must be 0.25–4');
    this.clock.speed = speed;
  }

  /** Called by GameView before new-round/resync hooks. */
  newRound(reason = 'new-round') {
    this.round.close(reason);
    for (const [name, lane] of this.lanes)
      if (lane.lifetime === 'round') this.cancelLane(name, reason);
    this.round.finish();
    this.round = new Scope(this.root.report, this.root);
    this.epoch++;
  }

  /** Cancel only managed writers before a game lays out or directly replaces their targets. */
  cancelTweens(targets: object | object[]) {
    this.motion.cancelTargets(targets);
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.root.close('shutdown');
    for (const name of this.lanes.keys()) this.cancelLane(name, 'shutdown');
    for (const off of this.subscriptions.splice(0)) off();
    this.audio.silence();
    this.round.finish();
    this.root.finish();
  }

  /** Metadata only: safe for the DEV panel, without state or private cards. */
  inspect() {
    return {
      epoch: this.epoch,
      speed: this.clock.speed,
      paused: this.clock.paused,
      resources: this.root.resourceCount,
      waits: this.clock.count,
      motion: this.motion.count,
      voices: this.audio.count,
      lanes: [...this.lanes].map(([name, lane]) => ({
        name,
        active: !!lane.active,
        pending: lane.queue.length,
      })),
    };
  }
}
