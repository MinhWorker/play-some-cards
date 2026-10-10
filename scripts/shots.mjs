// Screenshots of one page on real phone, tablet and desktop screens, held sideways, at their
// real pixel density: what a player sees, sharp or blurry. Headless Chromium, no emulator.
// Needs `npm run dev` running. Files go to .shots/.
//
//   npm run shots [webUrl]                    the lobby on every device
//   npm run shots -- --path '/?play=xiangqi'  a game's sandbox against the computer (debug build:
//                                             npm run godot:export -- --debug)
//   npm run shots -- --devices iphone-15,ipad some devices (comma separated)
//   npm run shots -- --tab                    in a browser tab (minus its bars), not the app
//   --wait MS    wait after the client's first screen past loading (default 2500)
//   --crop X,Y,W,H  the 1:1 detail crop, in CSS px (default: the middle of the screen)
//
// Per device it writes <device>.png (every device pixel) and <device>-crop.png (a 1:1 detail of
// it, small enough to view unscaled: that is where blur shows), and prints the canvas density
// against the screen's. A canvas at 1× on a 3× screen is stretched 3 times: blurry.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

/**
 * Landscape screens in CSS px with their pixel density, notch/home-bar insets (the app runs full
 * screen) and the browser bars a tab loses. Insets and bars are close, not exact, values.
 */
const DEVICES = {
  // Old and budget Android, 1280×720 panel.
  'android-720p': { width: 640, height: 360, dpr: 2, bar: 56 },
  // The common Android panel today (1080×2400), a camera hole on one side.
  'android-fhd': { width: 800, height: 360, dpr: 3, inset: { left: 32 }, bar: 56 },
  'pixel-7': { width: 915, height: 412, dpr: 2.625, inset: { left: 28 }, bar: 56 },
  'iphone-se': { width: 667, height: 375, dpr: 2, bar: 50 },
  'iphone-15': {
    width: 852,
    height: 393,
    dpr: 3,
    inset: { left: 59, right: 59, bottom: 21 },
    bar: 50,
  },
  ipad: { width: 1180, height: 820, dpr: 2, inset: { bottom: 20 }, bar: 74 },
  laptop: { width: 1366, height: 768, dpr: 1, desktop: true },
};

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    path: { type: 'string', default: '/' },
    devices: { type: 'string' },
    tab: { type: 'boolean', default: false },
    wait: { type: 'string', default: '2500' },
    crop: { type: 'string' },
  },
});
const base = positionals[0] ?? 'http://localhost:5033';
const out = '.shots';
const names = args.devices?.split(',') ?? Object.keys(DEVICES);
for (const name of names) {
  if (!DEVICES[name]) throw new Error(`No device "${name}": ${Object.keys(DEVICES).join(', ')}`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// SwiftShader WebGL 2, which the Godot client needs.
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

for (const name of names) {
  const d = DEVICES[name];
  const height = d.height - (args.tab ? (d.bar ?? 0) : 0);
  const context = await browser.newContext({
    viewport: { width: d.width, height },
    deviceScaleFactor: d.dpr,
    isMobile: !d.desktop,
    hasTouch: !d.desktop,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (d.inset && !args.tab) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: d.inset });
  }
  await page.goto(new URL(args.path, base).href);
  // The release build has no test bridge: then only the wait.
  await page
    .waitForFunction(
      () => window.xomdao && !['boot', 'status'].includes(window.xomdao.scene()),
      null,
      { timeout: 60_000 },
    )
    .catch(() => console.log(`  ${name}: no test bridge (release build?), shot after the wait`));
  await page.waitForTimeout(Number(args.wait));

  const file = join(out, `${name}.png`);
  const screenshot = await page.screenshot({ path: file });
  const [x, y, w, h] = args.crop?.split(',').map(Number) ?? [];
  // About 1000×600 device px: shown unscaled by image viewers and the agent's Read tool.
  const cw = w ?? Math.min(d.width, 1000 / d.dpr);
  const ch = h ?? Math.min(height, 600 / d.dpr);
  // Crop the same frame, so fading logs and animation match the full screenshot exactly.
  await sharp(screenshot)
    .extract({
      left: Math.round((x ?? (d.width - cw) / 2) * d.dpr),
      top: Math.round((y ?? (height - ch) / 2) * d.dpr),
      width: Math.round(cw * d.dpr),
      height: Math.round(ch * d.dpr),
    })
    .toFile(join(out, `${name}-crop.png`));

  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c && { density: c.width / c.getBoundingClientRect().width };
  });
  const density = canvas ? `canvas ${canvas.density.toFixed(2)}×` : 'no canvas';
  const warn = canvas && canvas.density < d.dpr - 0.01 ? '  ← blurry' : '';
  console.log(
    `${name.padEnd(13)} ${d.width}×${height} @${d.dpr}  screen ${d.dpr}× ${density}${warn}`,
  );
  for (const e of errors) console.log(`  page error: ${e}`);
  await context.close();
}

await browser.close();
console.log(`Screenshots in ${out}/`);
