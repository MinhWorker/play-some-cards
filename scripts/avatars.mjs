// Builds the avatar pictures and frames in assets/app/images/. The two are separate:
// the app stacks a frame (frame-<id>) over a round, frameless avatar (avatar-<id>).
//   node scripts/avatars.mjs frames              frame-<id> recolored from frame-gold
//   node scripts/avatars.mjs emoji <assets dir>  avatar-<id> from Microsoft Fluent Emoji 3D (MIT):
//     npm pack @lobehub/fluent-emoji-3d && tar xzf lobehub-fluent-emoji-3d-*.tgz → package/assets
// The ids match AVATARS and FRAMES in packages/shared/src/account.ts.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);

/** Avatar id → emoji code point (file name in the Fluent Emoji package). */
const EMOJI = {
  cat: '1f431',
  dog: '1f436',
  fox: '1f98a',
  panda: '1f43c',
  frog: '1f438',
  tiger: '1f42f',
  rabbit: '1f430',
  bear: '1f43b',
  koala: '1f428',
  monkey: '1f435',
  pig: '1f437',
  hamster: '1f439',
  lion: '1f981',
  unicorn: '1f984',
  penguin: '1f427',
  owl: '1f989',
  chick: '1f425',
  octopus: '1f419',
  alien: '1f47d',
  ghost: '1f47b',
};

/** Frame id → sharp `modulate` applied to frame-gold. */
const FRAMES = {
  silver: { saturation: 0.05, brightness: 1.15 },
  bronze: { hue: -18, saturation: 0.8, brightness: 0.82 },
  jade: { hue: 105, saturation: 1, brightness: 0.95 },
  sapphire: { hue: 170, saturation: 1.1, brightness: 0.95 },
  ruby: { hue: -45, saturation: 1.2, brightness: 0.9 },
  amethyst: { hue: 225, saturation: 0.9, brightness: 0.95 },
  rose: { hue: -70, saturation: 0.6, brightness: 1.05 },
};

/** Every picture is SIZE square; an avatar is a disc of radius DISC, the frame's ring covers its edge. */
const SIZE = 256;
const DISC = 100;
const images = resolve(fileURLToPath(import.meta.url), '../../assets/app/images');
const webp = { quality: 88, alphaQuality: 100 };

const [mode, source] = process.argv.slice(2);
if (mode === 'frames') {
  for (const [id, modulate] of Object.entries(FRAMES)) {
    await sharp(join(images, 'frame-gold.webp'))
      .modulate(modulate)
      .webp(webp)
      .toFile(join(images, `frame-${id}.webp`));
    console.log(`frame-${id}.webp`);
  }
} else if (mode === 'emoji' && source) {
  const sky = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <defs><radialGradient id="g" cx="50%" cy="38%" r="62%">
        <stop offset="0" stop-color="#9fe4ff"/><stop offset="0.6" stop-color="#3fb4f2"/>
        <stop offset="1" stop-color="#1c7fd0"/></radialGradient></defs>
      <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${DISC}" fill="url(#g)"/>
    </svg>`,
  );
  const face = 160;
  const at = (SIZE - face) / 2;
  for (const [id, code] of Object.entries(EMOJI)) {
    const emoji = await sharp(join(source, `${code}.webp`))
      .resize(face, face)
      .toBuffer();
    await sharp(sky)
      .composite([{ input: emoji, left: at, top: at + 6 }])
      .webp(webp)
      .toFile(join(images, `avatar-${id}.webp`));
    console.log(`avatar-${id}.webp`);
  }
} else {
  console.error('usage: node scripts/avatars.mjs frames | emoji <fluent-emoji-3d package/assets>');
  process.exit(1);
}
