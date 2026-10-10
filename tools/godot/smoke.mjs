// npm run godot:smoke: serves the exported web build (npm run godot:export first) and opens it in
// headless Chromium at a phone's landscape size. Passes when the main scene prints xomdao:ready
// with no page errors; saves .shots/godot-<width>x<height>.png.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { client, root } from './lib.mjs';

const dist = join(client, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No web build. Run: npm run godot:export');
  process.exit(1);
}
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.pck': 'application/octet-stream',
};
const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  const file = join(dist, path === '/' ? 'index.html' : path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

// A 20:9 phone held sideways (CSS pixels), the widest frame in docs/ui-guide.md.
const viewport = { width: 800, height: 360 };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = page.waitForEvent('console', {
    predicate: (message) => message.text() === 'xomdao:ready',
    timeout: 60_000,
  });
  await page.goto(url);
  await ready;
  await page.waitForTimeout(500);
  mkdirSync(join(root, '.shots'), { recursive: true });
  const shot = join(root, '.shots', `godot-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: shot });
  console.log(`✓ ${url} reached xomdao:ready; screenshot ${shot}`);
} catch (error) {
  errors.push(error.message);
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
