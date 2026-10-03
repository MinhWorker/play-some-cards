import type Phaser from 'phaser';
import type { SceneRuntime } from './runtime/SceneRuntime.js';

export interface SceneRequest<Data> {
  key: string | null;
  /** Identity of this opening of a room/setup/sandbox, independent of rounds and game IDs. */
  instance: string;
  data: Data;
}
export type SceneShowResult = { status: 'shown' | 'superseded' | 'failed' };
export interface SceneDirectorOptions<Data> {
  load(key: string, data: Data): Promise<new () => Phaser.Scene>;
  background: ReadonlySet<string>;
  write(data: Data): void;
  push(data: Data): void;
  onError(error: unknown): void;
}

/** Foreground operations run at Phaser's next pre-step, outside scene update processing. */
export class SceneDirector<Data> {
  private revision = 0;
  private disposed = false;
  private desired?: SceneRequest<Data>;
  private foreground?: { key: string; instance: string };
  private ready = false;
  private loaded = new Map<string, new () => Phaser.Scene>();
  private loading = new Map<string, Promise<new () => Phaser.Scene>>();
  private settle?: (result: SceneShowResult) => void;
  private offCreate?: () => void;

  constructor(
    private readonly game: Phaser.Game,
    private readonly options: SceneDirectorOptions<Data>,
  ) {
    game.events.on('prestep', this.apply, this);
  }

  show(request: SceneRequest<Data>): Promise<SceneShowResult> {
    if (this.disposed) return Promise.resolve({ status: 'superseded' });
    this.settle?.({ status: 'superseded' });
    const revision = ++this.revision;
    this.desired = request;
    const result = new Promise<SceneShowResult>((resolve) => {
      this.settle = resolve;
    });
    this.ready =
      !request.key || !!this.game.scene.keys[request.key] || this.loaded.has(request.key);
    // Keep registry fresh while the SAME instance preloads; stale requests never write it.
    if (this.foreground?.key === request.key && this.foreground.instance === request.instance)
      this.options.write(request.data);
    if (!this.ready && request.key) {
      const key = request.key;
      let load = this.loading.get(key);
      if (!load) {
        try {
          load = Promise.resolve(this.options.load(key, request.data));
        } catch (error) {
          load = Promise.reject(error);
        }
        this.loading.set(key, load);
      }
      void load.then(
        (scene) => {
          if (this.disposed) return;
          this.loading.delete(key);
          this.loaded.set(key, scene);
          if (this.disposed || revision !== this.revision) return;
          this.ready = true;
        },
        (error) => {
          this.loading.delete(key);
          if (this.disposed || revision !== this.revision) return;
          this.fail(error);
        },
      );
    }
    return result;
  }

  private finish(status: SceneShowResult['status']) {
    this.settle?.({ status });
    this.settle = undefined;
  }

  private fail(error: unknown) {
    this.finish('failed');
    try {
      this.options.onError(error);
    } catch (reportError) {
      console.error('Scene error handler failed', reportError);
    }
  }

  private stop(key: string) {
    const scene = this.game.scene.keys[key] as
      | (Phaser.Scene & { runtime?: SceneRuntime })
      | undefined;
    if (!scene) return;
    scene.runtime?.dispose();
    scene.load?.reset();
    this.game.scene.stop(key);
  }

  private apply() {
    const request = this.desired;
    if (this.disposed || !request || !this.settle) return;
    if (
      this.foreground &&
      (this.foreground.key !== request.key || this.foreground.instance !== request.instance)
    ) {
      this.offCreate?.();
      this.offCreate = undefined;
      this.stop(this.foreground.key);
      this.foreground = undefined;
    }
    for (const [key, scene] of Object.entries(this.game.scene.keys)) {
      if (this.options.background.has(key) || key === this.foreground?.key) continue;
      if (scene.sys.settings.status >= 2 && scene.sys.settings.status <= 7) this.stop(key);
    }
    if (!this.ready) return;
    try {
      this.options.write(request.data);
      if (!request.key) {
        this.finish('shown');
        return;
      }
      const key = request.key;
      if (this.foreground) {
        if (this.game.scene.isActive(key)) {
          this.options.push(request.data);
          this.finish('shown');
        }
        return;
      }
      if (!this.game.scene.keys[key]) {
        const scene = this.loaded.get(key);
        if (!scene) throw new Error(`Scene unavailable: ${key}`);
        this.game.scene.add(key, scene);
      }
      this.foreground = { key, instance: request.instance };
      const scene = this.game.scene.getScene(key);
      const created = () => {
        this.offCreate = undefined;
        if (
          this.disposed ||
          this.desired?.key !== key ||
          this.desired.instance !== request.instance
        )
          return;
        try {
          this.options.push(this.desired.data);
          this.finish('shown');
        } catch (error) {
          this.fail(error);
        }
      };
      scene.events.once('create', created);
      this.offCreate = () => scene.events.off('create', created);
      this.game.scene.start(key);
    } catch (error) {
      this.fail(error);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.revision++;
    this.finish('superseded');
    this.game.events.off('prestep', this.apply, this);
    this.offCreate?.();
    if (this.foreground) this.stop(this.foreground.key);
    this.foreground = undefined;
    this.desired = undefined;
    this.loaded.clear();
    this.loading.clear();
  }
}
