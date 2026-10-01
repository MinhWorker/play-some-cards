import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientHost } from '../host.js';
import type { FlowContext } from './Flow.js';
import { type SoundFinish, type SoundHandle, type SoundStart, skippedSound } from './SceneAudio.js';
import { SceneRuntime } from './SceneRuntime.js';

class Events {
  private listeners = new Map<string, Set<(...args: number[]) => void>>();
  on(name: string, fn: (...args: number[]) => void) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(fn);
    this.listeners.set(name, listeners);
  }
  off(name: string, fn: (...args: number[]) => void) {
    this.listeners.get(name)?.delete(fn);
  }
  emit(name: string, ...args: number[]) {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(...args);
  }
  get size() {
    return [...this.listeners.values()].reduce((n, entries) => n + entries.size, 0);
  }
}

const runtimes: SceneRuntime[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function harness(voice?: SoundHandle) {
  const events = new Events();
  const gameEvents = new Events();
  const report = vi.fn();
  const host: ClientHost = {
    assets: () => ({ images: {}, atlases: {}, sounds: { hit: '/hit.wav' } }),
    prepareSound: async () => 'ready',
    playSound: () => voice ?? skippedSound('muted'),
    avatars: () => ({}),
    playUiSound() {},
  };
  const scene = {
    events,
    sys: { settings: { key: 'test' }, game: { events: gameEvents } },
  } as unknown as Phaser.Scene;
  const runtime = new SceneRuntime(scene, host, 'round', report);
  runtimes.push(runtime);
  const tick = async (delta = 100) => {
    events.emit('update', 0, delta);
    await flush();
  };
  return { runtime, events, gameEvents, report, tick };
}

describe('SceneRuntime public flow contract', () => {
  it('runs FIFO lanes independently and reports only queued work as pending', async () => {
    const { runtime, tick } = harness();
    const order: string[] = [];
    const first = runtime.run(
      async (fx) => {
        order.push('a');
        await fx.wait(200);
        order.push('b');
      },
      { lane: 'turn' },
    );
    const second = runtime.run(
      async () => {
        order.push('c');
      },
      { lane: 'turn' },
    );
    const other = runtime.run(
      async () => {
        order.push('independent');
      },
      { lane: 'camera' },
    );
    expect(runtime.pending('turn')).toBe(1);
    expect(runtime.busy('turn')).toBe(true);
    await other.done;
    await tick();
    expect(order).toEqual(['a', 'independent']);
    await tick();
    expect(await first.done).toEqual({ status: 'completed' });
    expect(await second.done).toEqual({ status: 'completed' });
    expect(order).toEqual(['a', 'independent', 'b', 'c']);
    expect(runtime.busy('turn')).toBe(false);
  });

  it('replace waits for finally and LIFO cleanup, cancelling queued bodies before they start', async () => {
    const { runtime } = harness();
    const order: string[] = [];
    const first = runtime.run(
      async (fx) => {
        fx.defer(() => order.push('cleanup1'));
        fx.defer(() => order.push('cleanup2'));
        try {
          await fx.wait(1000);
        } finally {
          order.push('finally');
        }
      },
      { lane: 'turn' },
    );
    const queued = runtime.run(
      async () => {
        order.push('stale');
      },
      { lane: 'turn' },
    );
    const replacement = runtime.run(
      async () => {
        order.push('new');
      },
      { lane: 'turn', policy: 'replace' },
    );
    expect(await first.done).toEqual({ status: 'cancelled', reason: 'replaced' });
    expect(await queued.done).toEqual({ status: 'cancelled', reason: 'replaced' });
    await replacement.done;
    expect(order).toEqual(['finally', 'cleanup2', 'cleanup1', 'new']);
    expect(runtime.inspect().resources).toBe(0);
  });

  it('does not overlap a replacement with an external promise which has not cooperated', async () => {
    const { runtime } = harness();
    let resolve!: () => void;
    let newStarted = false;
    const first = runtime.run(
      async (fx) => {
        await new Promise<void>((done) => {
          resolve = done;
        });
        fx.checkpoint();
      },
      { lane: 'turn' },
    );
    const replacement = runtime.run(
      async () => {
        newStarted = true;
      },
      { lane: 'turn', policy: 'replace' },
    );
    await flush();
    expect(newStarted).toBe(false);
    resolve();
    expect((await first.done).status).toBe('cancelled');
    await replacement.done;
    expect(newStarted).toBe(true);
  });

  it('cancels waits while paused, changes speed mid-wait/frame and caps long frames', async () => {
    const { runtime, events, tick } = harness();
    let elapsed = 0;
    const flow = runtime.run(async (fx) => {
      await fx.wait(150);
      await fx.frame((delta) => {
        elapsed += delta;
        return elapsed >= 500;
      });
    });
    await tick(1000);
    expect(elapsed).toBe(0);
    runtime.setSpeed(2);
    await tick(25);
    await tick(1000);
    expect(elapsed).toBe(200);
    events.emit('pause');
    await tick(1000);
    expect(elapsed).toBe(200);
    flow.cancel();
    flow.cancel();
    expect((await flow.done).status).toBe('cancelled');
    expect(runtime.inspect().waits).toBe(0);
    expect(() => runtime.setSpeed(0)).toThrow();
    expect(() => runtime.setSpeed(Number.NaN)).toThrow();
  });

  it('keeps game and scene pause independent and discards the first resumed delta', async () => {
    const { runtime, events, gameEvents, tick } = harness();
    let elapsed = 0;
    const flow = runtime.run(async (fx) => {
      await fx.frame((delta) => {
        elapsed += delta;
        return elapsed >= 200;
      });
    });
    gameEvents.emit('pause');
    events.emit('pause');
    events.emit('resume');
    await tick();
    expect(elapsed).toBe(0);
    expect(runtime.inspect().paused).toBe(true);
    gameEvents.emit('resume');
    await tick(5000);
    expect(elapsed).toBe(0);
    await tick();
    await tick();
    expect((await flow.done).status).toBe('completed');
    runtime.dispose();
    expect(gameEvents.size).toBe(0);
    expect(events.size).toBe(0);
  });

  it('new rounds close the old epoch before hooks can enqueue new work, retaining scene work and speed', async () => {
    const { runtime, tick } = harness();
    runtime.setSpeed(2);
    const old = runtime.run(async (fx) => {
      await fx.wait(1000);
    });
    const decoration = runtime.run(
      async (fx) => {
        await fx.wait(200);
      },
      { lifetime: 'scene' },
    );
    runtime.newRound();
    const next = runtime.run(async (fx) => {
      await fx.wait(200);
    });
    expect(await old.done).toEqual({ status: 'cancelled', reason: 'new-round' });
    await tick();
    expect((await decoration.done).status).toBe('completed');
    expect((await next.done).status).toBe('completed');
    runtime.dispose();
    expect(runtime.inspect().resources).toBe(0);
  });

  it('parallel failure aborts siblings, runs their finally/cleanup and recovers FIFO after reporting once', async () => {
    const { runtime, report } = harness();
    const order: string[] = [];
    const error = new Error('branch');
    const flow = runtime.run(
      async (fx) => {
        await fx.parallel(
          async (child) => {
            child.defer(() => order.push('cleanup'));
            try {
              await child.wait(1000);
            } finally {
              order.push('finally');
            }
          },
          async () => {
            throw error;
          },
        );
      },
      { lane: 'turn', onFailure: () => order.push('recover') },
    );
    const next = runtime.run(
      async () => {
        order.push('next');
      },
      { lane: 'turn' },
    );
    expect(await flow.done).toEqual({ status: 'failed', error });
    await next.done;
    expect(order).toEqual(['finally', 'cleanup', 'recover', 'next']);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(error, {
      scene: 'test',
      epoch: 1,
      lane: 'turn',
      step: 'parallel',
    });
  });

  it('cleanup failure does not suppress other cleanup, or turn cancellation into failure', async () => {
    const { runtime, report } = harness();
    const cleaned = vi.fn();
    const flow = runtime.run(async (fx) => {
      fx.defer(cleaned);
      fx.defer(() => {
        throw new Error('cleanup');
      });
      await fx.wait(100);
    });
    flow.cancel();
    expect((await flow.done).status).toBe('cancelled');
    expect(cleaned).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
  });

  it('overflow rejects new work visibly, cancels the lane, and permits a fresh snapshot flow', async () => {
    const { runtime, report } = harness();
    const first = runtime.run(
      async (fx) => {
        await fx.wait(1000);
      },
      { lane: 'turn' },
    );
    for (let i = 0; i < 64; i++) runtime.run(async () => {}, { lane: 'turn' });
    const recover = vi.fn();
    const overflow = runtime.run(async () => {}, { lane: 'turn', onFailure: recover });
    expect((await overflow.done).status).toBe('failed');
    expect((await first.done).status).toBe('cancelled');
    expect(recover).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
    const next = runtime.run(async () => {}, { lane: 'turn' });
    expect((await next.done).status).toBe('completed');
    expect(() => runtime.run(async () => {}, { policy: 'queue' })).toThrow();
    expect(() => runtime.run(async () => {}, { lane: 'turn', lifetime: 'scene' })).toThrow();
  });

  it('audio completion cannot advance presentation during pause and cancellation stops its voice', async () => {
    let start!: (result: SoundStart) => void;
    let finish!: (result: SoundFinish) => void;
    const stop = vi.fn(() => {
      start({ status: 'cancelled' });
      finish({ status: 'stopped' });
    });
    const voice: SoundHandle = {
      started: new Promise((resolve) => {
        start = resolve;
      }),
      finished: new Promise((resolve) => {
        finish = resolve;
      }),
      stop,
    };
    const { runtime, events, tick } = harness(voice);
    let advanced = false;
    const flow = runtime.run(async (fx) => {
      await fx.sound('hit');
      fx.checkpoint();
      advanced = true;
    });
    events.emit('pause');
    start({ status: 'started' });
    await tick();
    expect(advanced).toBe(false);
    flow.cancel();
    expect((await flow.done).status).toBe('cancelled');
    expect(stop).toHaveBeenCalled();
    runtime.dispose();
    expect(events.size).toBe(0);
  });

  it('a completion/round-change race is blocked by checkpoint before a direct side effect', async () => {
    const { runtime, events } = harness();
    let touched = false;
    const flow = runtime.run(async (fx: FlowContext) => {
      await fx.wait(0);
      fx.checkpoint();
      touched = true;
    });
    events.emit('update', 0, 16);
    runtime.newRound();
    expect((await flow.done).status).toBe('cancelled');
    expect(touched).toBe(false);
  });
});
