// node scripts/ui-sounds.mjs: synthesizes the shared UI sounds of the Godot client
// (docs/art-direction.md, "Chuyển động và âm thanh") into apps/client/addons/xomdao_sdk/ui/sounds/:
// tap (a wooden knock), panel (a paper rustle) and coin (two bright pings). 16-bit mono WAV.
// Seeded, so a rerun writes the same files.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 44100;
const out = join(import.meta.dirname, '../apps/client/addons/xomdao_sdk/ui/sounds');

let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return (seed / 2147483648) * 2 - 1;
};

/** Samples of `seconds` from fn(t, i), clipped to [-1, 1]. */
function render(seconds, fn) {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = Math.max(-1, Math.min(1, fn(i / RATE, i)));
  return samples;
}

/** A two-pole resonant band-pass over a signal. */
function bandpass(samples, freq, q) {
  const w = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const [b0, b2, a0, a1, a2] = [alpha, -alpha, 1 + alpha, -2 * Math.cos(w), 1 - alpha];
  const outSamples = new Float32Array(samples.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    outSamples[i] = y;
  }
  return outSamples;
}

function normalize(samples, peak) {
  const max = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0) || 1;
  return samples.map((s) => (s / max) * peak);
}

function wav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (const [i, s] of samples.entries()) data.writeInt16LE(Math.round(s * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  writeFileSync(join(out, `${name}.wav`), Buffer.concat([head, data]));
}

// Tap: a short noise burst through two wooden resonances, decaying fast.
const knock = render(0.12, (t) => noise() * Math.exp(-t * 90));
const wood = bandpass(knock, 520, 9).map((s, i) => s + bandpass(knock, 1240, 7)[i] * 0.5);
wav('tap', normalize(wood, 0.7));

// Panel: rustling paper, crackles of band-passed noise under a soft swell.
const crackle = render(0.32, (t) => {
  const swell = Math.sin(Math.PI * Math.min(1, t / 0.32)) ** 1.5;
  return noise() * swell * (0.4 + 0.6 * (noise() > 0.7 ? 1 : 0.3));
});
wav('panel', normalize(bandpass(crackle, 3200, 0.8), 0.45));

// Coin: two bright pings a fifth apart, with a metallic partial.
const ping = (t, start, freq) =>
  t < start
    ? 0
    : Math.exp(-(t - start) * 9) *
      (Math.sin(2 * Math.PI * freq * (t - start)) +
        0.35 * Math.sin(2 * Math.PI * freq * 2.76 * (t - start)));
wav(
  'coin',
  normalize(
    render(0.6, (t) => ping(t, 0, 1568) + 0.8 * ping(t, 0.08, 2349)),
    0.6,
  ),
);
console.log(`UI sounds written to ${out}`);
