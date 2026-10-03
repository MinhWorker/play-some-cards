import { FlowCancelled, type Scope } from './Scope.js';

export const MAX_PRESENTATION_DELTA = 100;

/** One subscription drives every presentation primitive; native time is reserved for audio. */
export class PresentationClock {
  speed = 1;
  paused = false;
  private steps = new Set<(delta: number) => void>();

  tick(delta: number) {
    if (this.paused) return;
    const scaled = Math.max(0, Math.min(MAX_PRESENTATION_DELTA, delta)) * this.speed;
    for (const step of [...this.steps]) if (this.steps.has(step)) step(scaled);
  }

  frame(scope: Scope, update: (delta: number) => boolean): Promise<void> {
    scope.checkpoint();
    return new Promise((resolve, reject) => {
      const dispose = () => {
        this.steps.delete(step);
        release();
      };
      const step = (delta: number) => {
        try {
          scope.checkpoint();
          if (!update(delta)) return;
          dispose();
          resolve();
        } catch (error) {
          dispose();
          reject(error);
        }
      };
      const release = scope.own(() => {
        dispose();
        reject(
          scope.failure ? scope.failure.error : new FlowCancelled(String(scope.signal.reason)),
        );
      });
      this.steps.add(step);
    });
  }

  wait(scope: Scope, ms: number) {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('wait requires finite non-negative ms');
    let elapsed = 0;
    return this.frame(scope, (delta) => {
      elapsed += delta;
      return elapsed >= ms;
    });
  }

  /** Even already-resolved external promises resume only on an active presentation frame. */
  async observe(scope: Scope, promise: Promise<unknown>) {
    let ready = false;
    let failure: unknown;
    let failed = false;
    void promise.then(
      () => {
        ready = true;
      },
      (error) => {
        failure = error;
        failed = true;
        ready = true;
      },
    );
    await this.frame(scope, () => ready);
    scope.checkpoint();
    if (failed) throw failure;
  }

  get count() {
    return this.steps.size;
  }
}
