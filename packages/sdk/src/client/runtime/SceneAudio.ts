import type { ClientHost } from '../host.js';
import type { Scope } from './Scope.js';

export type SoundStart =
  | { status: 'started' }
  | { status: 'skipped'; reason: 'muted' | 'blocked' | 'missing' | 'late' | 'unavailable' }
  | { status: 'cancelled' };
export type SoundFinish = { status: 'ended' | 'stopped' | 'skipped' };
export interface SoundHandle {
  readonly started: Promise<SoundStart>;
  readonly finished: Promise<SoundFinish>;
  stop(): void;
}
export interface SoundOptions {
  duck?: boolean;
  maxStartDelayMs?: number;
}
export type PreparedSound = { name: string; status: 'ready' | 'unavailable' };

export function skippedSound(
  reason: Extract<SoundStart, { status: 'skipped' }>['reason'],
): SoundHandle {
  return {
    started: Promise.resolve({ status: 'skipped', reason }),
    finished: Promise.resolve({ status: 'skipped' }),
    stop() {},
  };
}

export class SceneAudio {
  private voices = new Set<SoundHandle>();
  constructor(
    private readonly host: ClientHost,
    private readonly gameId: string,
    private readonly scope: () => Scope,
    private readonly paused: () => boolean,
  ) {}

  async prepare(names: readonly string[]): Promise<readonly PreparedSound[]> {
    const sounds = this.host.assets(this.gameId).sounds;
    return Promise.all(
      names.map(async (name) => ({
        name,
        status: sounds[name]
          ? await this.host.prepareSound(sounds[name])
          : ('unavailable' as const),
      })),
    );
  }

  play(name: string, options?: SoundOptions): SoundHandle {
    return this.playIn(this.scope(), name, options);
  }

  playIn(scope: Scope, name: string, options?: SoundOptions): SoundHandle {
    scope.checkpoint();
    const url = this.host.assets(this.gameId).sounds[name];
    const voice = this.paused()
      ? skippedSound('blocked')
      : url
        ? this.host.playSound(url, options)
        : skippedSound('missing');
    const release = scope.own(() => voice.stop());
    this.voices.add(voice);
    void voice.finished.then(() => {
      release();
      this.voices.delete(voice);
    });
    return voice;
  }

  silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  get count() {
    return this.voices.size;
  }
}
