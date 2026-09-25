/**
 * All app audio: background music and short UI sound effects, through one Web Audio graph
 * with a gain node per channel, following the speaker panel's volume/mute for each
 * (iOS ignores `audio.volume`, so volume must go through gain nodes). Music is a streamed <audio> element, so it starts
 * before the whole file downloads. Settings are remembered per browser.
 */
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
 * they play instantly. Add a name here after adding it to assets/audio.json. A game's effects
 * are files in games/<id>/assets/, played by its board scene with `this.sfx(name)`.
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
  for (const url of wanted) decode(url);
}

function decode(url: string) {
  void fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx?.decodeAudioData(data))
    .then((buffer) => buffer && buffers.set(url, buffer))
    .catch(() => {});
}

/** Downloads an effect ahead of time (games' sounds, when their board opens). */
export function loadSoundUrl(url: string) {
  if (wanted.has(url)) return;
  wanted.add(url);
  if (ctx) decode(url);
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

// The first tap/key unlocks audio (browser rule): resume Web Audio and start the music.
const unlock = () => {
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
  ensureAudio();
  void ctx?.resume().catch(() => {});
  void syncMusic().catch(() => {});
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

/** Applies and saves settings (music and effects separately). */
export function applySound(settings: SoundSettings) {
  current = settings;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  ensureAudio();
  if (musicGain) musicGain.gain.value = settings.music.volume;
  if (sfxGain) sfxGain.gain.value = settings.sfx.volume;
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

/** Plays an effect by URL on the effects channel. */
export function playSoundUrl(url: string) {
  ensureAudio();
  loadSoundUrl(url);
  const buffer = buffers.get(url);
  if (!ctx || !sfxGain || !buffer || isSilent(current.sfx) || ctx.state !== 'running') return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(sfxGain);
  source.start();
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
