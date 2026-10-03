/**
 * All app audio: background music and short UI sound effects, through one Web Audio graph
 * with a gain node per channel, following the settings panel's volume/mute for each
 * (iOS ignores `audio.volume`, so volume must go through gain nodes). Music is a streamed <audio> element, so it starts
 * before the whole file downloads. Settings are remembered per browser.
 */
import {
  type SoundFinish,
  type SoundHandle,
  type SoundOptions,
  type SoundStart,
} from '@psc/sdk/client';
import { type AssetOwner, soundUrl } from '@/lib/assetUrl';

const KEY = 'psc:sound';

export interface ChannelSettings {
  /** 0..1 */
  volume: number;
  muted: boolean;
}

export type Channel = 'music' | 'sfx';
export type SoundSettings = Record<Channel, ChannelSettings>;

export const isSilent = (s: ChannelSettings) => s.muted || s.volume === 0;

const DEFAULTS: SoundSettings = {
  music: { volume: 0.5, muted: false },
  sfx: { volume: 0.7, muted: false },
};

function readChannel(saved: unknown, fallback: ChannelSettings): ChannelSettings {
  const s = (saved ?? {}) as Partial<ChannelSettings>;
  const volume =
    typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : fallback.volume;
  return { volume, muted: typeof s.muted === 'boolean' ? s.muted : fallback.muted };
}

export function loadSound(): SoundSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    // Older saves were a single { volume, muted } for the music.
    const music = saved && 'music' in saved ? saved.music : saved;
    return {
      music: readChannel(music, DEFAULTS.music),
      sfx: readChannel(saved?.sfx, DEFAULTS.sfx),
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * The app's own short effects (public/shared/audio/<name>.wav). WAV: no MP3 start padding, so
 * they play instantly. Add a name here after adding its file to public/shared/audio/. A game's effects
 * are files in games/<id>/assets/, played by its game screen with `this.sfx(name)`.
 */
const SFX = {
  'button-click': 'shared',
  'button-hover': 'shared',
  'island-hover': 'shared',
  'island-click': 'shared',
  'island-locked': 'shared',
  'cloud-spread': 'shared',
  'game-win': 'shared',
  'game-lose': 'shared',
} satisfies Record<string, AssetOwner>;
export type Sfx = keyof typeof SFX;

/**
 * The app's own music (public/shared/audio/<name>.mp3): a random track per scene. A game's music
 * is every `music*` file in its assets/ (see `gameMusic` in games/index.ts).
 */
const APP_MUSIC = {
  sky: ['music-sky-a', 'music-sky-b'],
  hub: ['music-hub-a', 'music-hub-b', 'music-hub-c', 'music-hub-d'],
};
export const appMusic = (scene: keyof typeof APP_MUSIC) =>
  APP_MUSIC[scene].map((name) => soundUrl(name, 'shared', 'mp3'));

const pickTrack = (urls: string[]) => urls[Math.floor(Math.random() * urls.length)] ?? '';

let musicScene = 'sky';
const music = new Audio(pickTrack(appMusic('sky')));
music.loop = true;
music.preload = 'auto';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
/** Decoded effects by URL; `wanted` are URLs asked for before audio was unlocked. */
const buffers = new Map<string, AudioBuffer>();
const decoding = new Map<string, Promise<AudioBuffer | null>>();
const voices = new Set<SoundHandle>();
const ducks = new Set<symbol>();
let pendingStarts = 0;
let activeVoices = 0;
const skipped: Record<string, number> = {};
let cacheBytes = 0;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const wanted = new Set<string>(Object.entries(SFX).map(([name, owner]) => soundUrl(name, owner)));
let current = loadSound();

/** Web Audio is created on the first call; browsers only let it play after a user gesture. */
function ensureAudio() {
  if (ctx || typeof AudioContext === 'undefined') return;
  ctx = new AudioContext();
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(ctx.destination);
  sfxGain.connect(ctx.destination);
  ctx.createMediaElementSource(music).connect(musicGain);
  syncGains();
  for (const url of wanted) void decode(url);
}

function decode(url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) {
    buffers.delete(url);
    buffers.set(url, cached);
    return Promise.resolve(cached);
  }
  const pending = decoding.get(url);
  if (pending) return pending;
  const audio = ctx;
  if (!audio) return Promise.resolve(null);
  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Sound unavailable');
      return res.arrayBuffer();
    })
    .then((data) => audio.decodeAudioData(data))
    .then((buffer) => {
      const bytes = buffer.length * buffer.numberOfChannels * 4;
      while (cacheBytes + bytes > MAX_CACHE_BYTES && buffers.size) {
        const first = buffers.entries().next().value;
        if (!first) break;
        buffers.delete(first[0]);
        cacheBytes -= first[1].length * first[1].numberOfChannels * 4;
      }
      if (bytes <= MAX_CACHE_BYTES) {
        buffers.set(url, buffer);
        cacheBytes += bytes;
      }
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      decoding.delete(url);
    });
  decoding.set(url, request);
  return request;
}

/** Prepares without playback. Late completion warms the cache but cannot start a voice. */
export async function prepareSoundUrl(url: string): Promise<'ready' | 'unavailable'> {
  wanted.add(url);
  ensureAudio();
  if (!ctx) return 'unavailable';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const buffer = await Promise.race([
      decode(url),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 3000);
      }),
    ]);
    return buffer ? 'ready' : 'unavailable';
  } finally {
    clearTimeout(timeout);
  }
}

/** Downloads an effect ahead of time. */
export function loadSoundUrl(url: string) {
  void prepareSoundUrl(url);
}

function syncGains() {
  if (sfxGain) sfxGain.gain.value = isSilent(current.sfx) ? 0 : current.sfx.volume;
  if (ctx && musicGain) {
    const gain = musicGain.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    const value = isSilent(current.music) ? 0 : current.music.volume * (ducks.size ? 0.15 : 1);
    gain.setTargetAtTime(value, ctx.currentTime, 0.08);
  }
}

/** Starts or pauses the music to match settings; throws (async) while audio is still locked. */
function syncMusic() {
  if (isSilent(current.music)) {
    music.pause();
    return Promise.resolve();
  }
  if (!musicGain) music.volume = current.music.volume;
  return music.play();
}

// A tap/key unlocks audio (browser rule): resume Web Audio and start the music. Browsers don't
// count every event as a gesture (on phones a touch's pointerdown isn't one, its pointerup and
// touchend are), so keep trying on each of them until the audio really runs.
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
const unlock = () => {
  ensureAudio();
  void Promise.all([ctx?.resume(), syncMusic()])
    .then(() => {
      if (ctx && ctx.state !== 'running') return;
      for (const name of UNLOCK_EVENTS) window.removeEventListener(name, unlock);
    })
    .catch(() => {});
};
for (const name of UNLOCK_EVENTS) window.addEventListener(name, unlock);

/** Applies and saves settings (music and effects separately). */
export function applySound(settings: SoundSettings) {
  current = settings;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  ensureAudio();
  syncGains();
  if (isSilent(settings.sfx)) for (const voice of voices) voice.stop();
  void syncMusic().catch(() => {});
}

/**
 * Switches the background music to a random one of `tracks` when the scene changes (`scene` is
 * 'sky', 'hub' or a game id). The same scene keeps its current track.
 */
export function setMusicScene(scene: string, tracks: string[]) {
  if (scene === musicScene || tracks.length === 0) return;
  musicScene = scene;
  music.pause();
  music.src = pickTrack(tracks);
  music.load();
  if (!isSilent(current.music)) void syncMusic().catch(() => {});
}

/** Plays one of the app's effects. Silent until the first tap/click unlocks audio, or when muted. */
export function playSfx(name: Sfx) {
  playSoundUrl(soundUrl(name, SFX[name]));
}

export type PlayOptions = SoundOptions;

/** Every request owns its source, start deadline and duck token. Handles never reject. */
export function playSoundUrl(url: string, options: PlayOptions = {}): SoundHandle {
  const delay = options.maxStartDelayMs ?? 250;
  if (!Number.isFinite(delay) || delay < 0) throw new Error('Invalid sound start deadline');
  let startResolve!: (result: SoundStart) => void;
  let finishResolve!: (result: SoundFinish) => void;
  const started = new Promise<SoundStart>((resolve) => {
    startResolve = resolve;
  });
  const finished = new Promise<SoundFinish>((resolve) => {
    finishResolve = resolve;
  });
  const deadline = performance.now() + delay;
  let source: AudioBufferSourceNode | null = null;
  let ended = false;
  let began = false;
  let queued = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const duck = Symbol('voice');
  const complete = (result: SoundFinish, start?: SoundStart) => {
    if (ended) return;
    ended = true;
    clearTimeout(timeout);
    if (queued) {
      pendingStarts--;
      queued = false;
    }
    if (!began) startResolve(start ?? { status: 'cancelled' });
    if (began) activeVoices--;
    if (source) {
      source.onended = null;
      if (result.status === 'stopped') {
        try {
          source.stop();
        } catch {}
      }
      source.disconnect();
      source = null;
    }
    ducks.delete(duck);
    syncGains();
    voices.delete(handle);
    finishResolve(result);
  };
  const handle: SoundHandle = { started, finished, stop: () => complete({ status: 'stopped' }) };
  const skip = (reason: Extract<SoundStart, { status: 'skipped' }>['reason']) => {
    if (!ended) skipped[reason] = (skipped[reason] ?? 0) + 1;
    complete({ status: 'skipped' }, { status: 'skipped', reason });
  };
  const unavailable = () => {
    if (isSilent(current.sfx)) return 'muted' as const;
    if (document.hidden || !ctx || ctx.state !== 'running') return 'blocked' as const;
    return null;
  };
  const blocked = unavailable();
  if (blocked) {
    skip(blocked);
    return handle;
  }
  if (activeVoices >= 32 || pendingStarts >= 64) {
    skip('unavailable');
    return handle;
  }
  voices.add(handle);
  const start = (buffer: AudioBuffer | null) => {
    if (ended) return;
    if (performance.now() > deadline) {
      skip('late');
      return;
    }
    if (activeVoices >= 32) {
      skip('unavailable');
      return;
    }
    const reason = unavailable();
    if (reason) {
      skip(reason);
      return;
    }
    if (!buffer || !ctx || !sfxGain) {
      skip('unavailable');
      return;
    }
    try {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(sfxGain);
      source.onended = () => complete({ status: 'ended' });
      source.start();
      began = true;
      activeVoices++;
      if (queued) {
        pendingStarts--;
        queued = false;
      }
      clearTimeout(timeout);
      if (options.duck) {
        ducks.add(duck);
        syncGains();
      }
      startResolve({ status: 'started' });
    } catch {
      skip('unavailable');
    }
  };
  const cached = buffers.get(url);
  if (cached) start(cached);
  else {
    queued = true;
    pendingStarts++;
    timeout = setTimeout(() => skip('late'), delay);
    void decode(url).then(start);
  }
  return handle;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const voice of voices) voice.stop();
});

/** Metadata for developer diagnostics. */
export function soundDiagnostics() {
  return {
    voices: activeVoices,
    pending: pendingStarts,
    buffers: buffers.size,
    cacheBytes,
    ducks: ducks.size,
    skipped: { ...skipped },
    musicGain: musicGain?.gain.value ?? 0,
  };
}

type ButtonSoundKind = 'click' | 'hover';
const DEFAULT_BUTTON_SOUND: Record<ButtonSoundKind, Sfx> = {
  click: 'button-click',
  hover: 'button-hover',
};

/**
 * Data attributes that change the click/hover sound of a button, or of every button inside an
 * element (the nearest setting wins, so a button can override its container). `'none'` = silent,
 * leaving one out keeps the inherited sound. Spread onto an element:
 * `<form {...buttonSounds({ click: 'none', hover: 'none' })}>`, or use `Button`'s
 * `clickSound` / `hoverSound` props.
 */
export function buttonSounds(sounds: { click?: Sfx | 'none'; hover?: Sfx | 'none' }) {
  const attrs: Record<string, string> = {};
  if (sounds.click) attrs['data-click-sound'] = sounds.click;
  if (sounds.hover) attrs['data-hover-sound'] = sounds.hover;
  return attrs;
}

/** The sound a button makes, from the nearest `data-click-sound` / `data-hover-sound`. */
function buttonSound(button: Element, kind: ButtonSoundKind): Sfx | null {
  const attr = `data-${kind}-sound`;
  const name = button.closest(`[${attr}]`)?.getAttribute(attr);
  if (!name) return DEFAULT_BUTTON_SOUND[kind];
  if (name === 'none') return null;
  if (name in SFX) return name as Sfx;
  console.warn(`Unknown button sound "${name}"`);
  return DEFAULT_BUTTON_SOUND[kind];
}

/**
 * Click and hover sounds for every button in the React UI, via event delegation so new
 * buttons get them automatically. Hover sounds only for a real mouse (a tap would fire both).
 * Each button's sounds can be changed or muted with `buttonSounds`.
 */
export function installButtonSounds() {
  const buttonFrom = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLButtonElement>('button:not(:disabled)') : null;
  const play = (button: Element, kind: ButtonSoundKind) => {
    const name = buttonSound(button, kind);
    if (name) playSfx(name);
  };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const button = buttonFrom(e.target);
    // Only when entering the button, not when moving between its children.
    if (button && !button.contains(e.relatedTarget as Node | null)) play(button, 'hover');
  };
  const onClick = (e: MouseEvent) => {
    const button = buttonFrom(e.target);
    if (button) play(button, 'click');
  };
  document.addEventListener('pointerover', onOver);
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('click', onClick);
  };
}
