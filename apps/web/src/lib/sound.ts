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
 * Short effects and where they live: 'shared' (public/shared/audio/<name>.wav) or a game id
 * (public/games/<id>/audio/<name>.wav). WAV: no MP3 start padding, so they play instantly.
 * Add a name here after adding it to assets/audio.json.
 */
const SFX = {
  'button-click': 'shared',
  'button-hover': 'shared',
  'island-hover': 'shared',
  'island-click': 'shared',
  'cloud-spread': 'shared',
  'mark-drop': 'tic-tac-toe',
  'xiangqi-start': 'xiangqi',
  'xiangqi-piece-select': 'xiangqi',
  'xiangqi-move': 'xiangqi',
  'xiangqi-capture': 'xiangqi',
  'xiangqi-check': 'xiangqi',
  'xiangqi-turn': 'xiangqi',
  'xiangqi-illegal': 'xiangqi',
  'tien-len-deal': 'tien-len',
  'tien-len-card-select': 'tien-len',
  'tien-len-card-play': 'tien-len',
  'tien-len-pass': 'tien-len',
  'tien-len-turn': 'tien-len',
  'tien-len-last-card': 'tien-len',
  'tien-len-combo': 'tien-len',
  'tien-len-special-cut': 'tien-len',
  'tien-len-special-hand': 'tien-len',
  'tien-len-trick-clear': 'tien-len',
  'game-win': 'shared',
  'game-lose': 'shared',
} satisfies Record<string, AssetOwner>;
export type Sfx = keyof typeof SFX;

const music = new Audio(soundUrl('music', 'shared', 'mp3'));
music.loop = true;
music.preload = 'auto';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
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
  for (const [name, owner] of Object.entries(SFX) as [Sfx, AssetOwner][]) {
    void fetch(soundUrl(name, owner))
      .then((res) => res.arrayBuffer())
      .then((data) => ctx?.decodeAudioData(data))
      .then((buffer) => buffer && buffers.set(name, buffer))
      .catch(() => {});
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

/** Plays a UI sound effect. Silent until the first tap/click unlocks audio, or when muted. */
export function playSfx(name: Sfx) {
  ensureAudio();
  const buffer = buffers.get(name);
  if (!ctx || !sfxGain || !buffer || isSilent(current.sfx) || ctx.state !== 'running') return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(sfxGain);
  source.start();
}

/**
 * Click and hover sounds for every button in the React UI, via event delegation so new
 * buttons get them automatically. Hover sounds only for a real mouse (a tap would fire both).
 */
export function installButtonSounds() {
  const buttonFrom = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLButtonElement>('button:not(:disabled)') : null;

  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const button = buttonFrom(e.target);
    // Only when entering the button, not when moving between its children.
    if (button && !button.contains(e.relatedTarget as Node | null)) playSfx('button-hover');
  };
  const onClick = (e: MouseEvent) => {
    if (buttonFrom(e.target)) playSfx('button-click');
  };
  document.addEventListener('pointerover', onOver);
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('click', onClick);
  };
}
