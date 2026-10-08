// Production crops from the original Image Gen garden background and 3 × 2 prop sheet.
// Usage: node <this-file> <background.png> <props.png>
// biome-ignore lint/style/noRestrictedImports: Offline art preparation; never imported by the game.
import { resolve } from 'node:path';
// biome-ignore lint/style/noRestrictedImports: Offline raster processing; never imported by the game.
import sharp from 'sharp';

const [background, props] = process.argv.slice(2);
if (!background || !props) throw new Error('Provide the garden background and six-cell prop sheet');
const assets = resolve(import.meta.dirname, '../assets');
await sharp(background)
  .resize({ width: 1920 })
  .webp({ quality: 91 })
  .toFile(`${assets}/background.webp`);
const { width, height } = await sharp(props).metadata();
const names = ['tile', 'tile-light', 'tile-flower', 'pillar', 'crate', 'border'];
for (let i = 0; i < names.length; i++) {
  const left = Math.round(((i % 3) * width) / 3);
  const top = Math.round((Math.floor(i / 3) * height) / 2);
  const cell = await sharp(props)
    .extract({
      left,
      top,
      width: Math.round((((i % 3) + 1) * width) / 3) - left,
      height: Math.round(((Math.floor(i / 3) + 1) * height) / 2) - top,
    })
    .png()
    .toBuffer();
  await sharp(cell)
    .trim({ threshold: 16 })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(`${assets}/${names[i]}.webp`);
}
