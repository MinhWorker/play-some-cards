import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { type SceneDefinition, SceneDirector } from './SceneDirector.js';

class Events {
  private listeners = new Map<string, { fn: () => void; once: boolean }[]>();
  on(name: string, fn: () => void, context?: unknown) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push({ fn: context ? fn.bind(context) : fn, once: false });
    this.listeners.set(name, listeners);
  }
  once(name: string, fn: () => void) {
    this.on(name, fn);
    const entries = this.listeners.get(name);
    const entry = entries?.at(-1);
    if (entry) entry.once = true;
  }
  off(name: string, fn: () => void) {
    this.listeners.set(
      name,
      (this.listeners.get(name) ?? []).filter((entry) => entry.fn !== fn),
    );
  }
  emit(name: string) {
    for (const entry of [...(this.listeners.get(name) ?? [])]) {
      if (entry.once) this.off(name, entry.fn);
      entry.fn();
    }
  }
}

function harness(load: (key: string) => Promise<SceneDefinition>) {
  const events = new Events();
  const makeScene = (key: string, status = 0) => ({
    events: new Events(),
    sys: { settings: { key, status } },
    runtime: { dispose: vi.fn() },
    load: { reset: vi.fn() },
  });
  const keys: Record<string, ReturnType<typeof makeScene>> = { sky: makeScene('sky', 5) };
  const required = (key: string) => {
    const found = keys[key];
    if (!found) throw new Error(`Unknown scene: ${key}`);
    return found;
  };
  const complete = (key: string) => {
    required(key).sys.settings.status = 5;
    required(key).events.emit('create');
  };
  const delayed = new Set<string>();
  const manager = {
    keys,
    add: vi.fn((key: string) => {
      keys[key] = makeScene(key);
    }),
    start: vi.fn((key: string) => {
      required(key).sys.settings.status = 3;
      if (!delayed.has(key)) complete(key);
    }),
    stop: vi.fn((key: string) => {
      required(key).sys.settings.status = 8;
    }),
    sleep: vi.fn((key: string) => {
      required(key).sys.settings.status = 7;
    }),
    wake: vi.fn((key: string) => {
      required(key).sys.settings.status = 5;
    }),
    isSleeping: (key: string) => keys[key]?.sys.settings.status === 7,
    isActive: (key: string) => keys[key]?.sys.settings.status === 5,
    getScene: (key: string) => keys[key],
    sendToBack: vi.fn(),
    bringToTop: vi.fn(),
  };
  const write = vi.fn();
  const push = vi.fn();
  const onError = vi.fn();
  const director = new SceneDirector({ events, scene: manager } as unknown as Phaser.Game, {
    background: new Set(['sky']),
    defaultBackground: 'sky',
    load,
    write,
    push,
    onError,
  });
  const tick = async () => {
    await Promise.resolve();
    events.emit('prestep');
  };
  const show = (key: string | null, instance = 'one') =>
    director.show({ key, instance, data: { key } });
  return { director, manager, keys, delayed, complete, write, push, onError, tick, show };
}

const scene = class {} as new () => Phaser.Scene;
const city: SceneDefinition = { scene, background: { key: 'game:background', scene } };

describe('SceneDirector background lifecycle', () => {
  it('loads the background before opening the board and preserves it across props/rounds', async () => {
    const h = harness(async () => city);
    h.delayed.add('game:background');
    const shown = h.show('game');
    await h.tick();
    expect(h.manager.isActive('sky')).toBe(true);
    expect(h.keys.game).toBeUndefined();
    h.complete('game:background');
    await h.tick();
    expect(await shown).toEqual({ status: 'shown' });
    expect(h.manager.isSleeping('sky')).toBe(true);
    expect(h.manager.isActive('game:background')).toBe(true);
    const updated = h.show('game');
    await h.tick();
    await updated;
    expect(h.manager.start.mock.calls).toEqual([['game:background'], ['game']]);
    expect(h.manager.bringToTop).toHaveBeenCalledWith('game');
    h.director.dispose();
  });

  it('restarts background resources for a new board opening and restores sky on exit', async () => {
    const h = harness(async () => city);
    const first = h.show('game');
    await h.tick();
    await first;
    const next = h.show('game', 'two');
    await h.tick();
    await next;
    expect(h.keys['game:background']?.runtime.dispose).toHaveBeenCalledOnce();
    expect(h.manager.start.mock.calls.filter(([key]) => key === 'game:background')).toHaveLength(2);
    const exit = h.show(null);
    await h.tick();
    await exit;
    expect(h.manager.isActive('sky')).toBe(true);
    expect(h.keys['game:background']?.sys.settings.status).toBe(8);
    h.director.dispose();
  });

  it('supports disabling sky without a replacement, then opening a default-background game', async () => {
    const h = harness(async (key) => ({ scene, background: key === 'bare' ? false : undefined }));
    const bare = h.show('bare');
    await h.tick();
    await bare;
    expect(h.manager.isSleeping('sky')).toBe(true);
    const normal = h.show('normal');
    await h.tick();
    await normal;
    expect(h.manager.isActive('sky')).toBe(true);
    h.director.dispose();
  });

  it('cancels a preloading replacement when a different stage supersedes it', async () => {
    const h = harness(async (key) => (key === 'game' ? city : { scene }));
    h.delayed.add('game:background');
    const old = h.show('game');
    await h.tick();
    const setup = h.show('game:setup', 'setup');
    await h.tick();
    expect(await old).toEqual({ status: 'superseded' });
    expect(await setup).toEqual({ status: 'shown' });
    expect(h.keys['game:background']?.load.reset).toHaveBeenCalledOnce();
    expect(h.keys.game).toBeUndefined();
    expect(h.manager.isActive('sky')).toBe(true);
    h.director.dispose();
  });

  it('ignores late client loads and reports load failure without hiding sky', async () => {
    let resolve!: (definition: SceneDefinition) => void;
    const h = harness((key) =>
      key === 'game'
        ? new Promise<SceneDefinition>((done) => {
            resolve = done;
          })
        : Promise.reject(new Error('offline')),
    );
    const old = h.show('game');
    const failed = h.show('bad');
    await h.tick();
    expect(await failed).toEqual({ status: 'failed' });
    resolve(city);
    await h.tick();
    expect(await old).toEqual({ status: 'superseded' });
    expect(h.keys['game:background']).toBeUndefined();
    expect(h.manager.isActive('sky')).toBe(true);
    expect(h.onError).toHaveBeenCalledOnce();
    h.director.dispose();
  });

  it('disposes pending background resources and restores the default', async () => {
    const h = harness(async () => city);
    h.delayed.add('game:background');
    const pending = h.show('game');
    await h.tick();
    h.director.dispose();
    expect(await pending).toEqual({ status: 'superseded' });
    expect(h.keys['game:background']?.runtime.dispose).toHaveBeenCalledOnce();
    expect(h.keys['game:background']?.load.reset).toHaveBeenCalledOnce();
    expect(h.manager.isActive('sky')).toBe(true);
  });
});
