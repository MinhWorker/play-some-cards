// npm run godot:measure: how heavy and how fast the exported web build is (ADR 0001). Serves
// apps/client/dist like a static host does (brotli, ETag, revalidation), points it at a running
// game server, then in headless Chromium on a throttled phone profile measures, for a first
// visit and a repeat visit (service worker cache): bytes over the network, time until the first
// screen is ready to play (connected and logged in) and time until a Caro game against the
// computer shows its board (the pack loaded). Export first. A release build gives the real sizes
// and the time until the engine runs; the other timings need the test bridge of a debug build.
//
//   npm run godot:measure [-- --server http://localhost:8033] [--cpu 4] [--net fast4g|slow4g|none]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants } from 'node:zlib';
import { chromium } from 'playwright';
import { client } from './lib.mjs';

const { values: args } = parseArgs({
  options: {
    server: { type: 'string', default: 'http://localhost:8033' },
    cpu: { type: 'string', default: '4' },
    net: { type: 'string', default: 'fast4g' },
  },
});
// Chrome DevTools' presets (bytes per second, ms).
const NETWORKS = {
  fast4g: { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: 190_000 },
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: 90_000 },
  none: null,
};
if (!(args.net in NETWORKS)) throw new Error(`--net is one of ${Object.keys(NETWORKS).join(', ')}`);

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
};
const compressed = new Map();
function body(file) {
  if (!compressed.has(file)) {
    const raw = readFileSync(file);
    const brotli = ['.png'].includes(extname(file))
      ? null
      : brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
    const etag = `"${createHash('sha1').update(raw).digest('hex')}"`;
    compressed.set(file, { raw, brotli, etag });
  }
  return compressed.get(file);
}

const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  const file = join(dist, path === '/' ? 'index.html' : path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  const { raw, brotli, etag } = body(file);
  const headers = {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ETag: etag,
  };
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, headers).end();
    return;
  }
  const br = brotli && /\bbr\b/.test(request.headers['accept-encoding'] ?? '');
  if (br) headers['Content-Encoding'] = 'br';
  response.writeHead(200, headers).end(br ? brotli : raw);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const kb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('Files (raw, brotli):');
for (const name of ['index.wasm', 'index.pck', 'index.js', 'index.html']) {
  const { raw, brotli } = body(join(dist, name));
  console.log(
    `  ${name.padEnd(12)} ${kb(raw.length).padStart(9)} ${kb(brotli.length).padStart(9)}`,
  );
}
const manifest = JSON.parse(readFileSync(join(dist, 'content/manifest.json'), 'utf8'));
for (const pack of Object.values(manifest)) {
  const { raw, brotli } = body(join(dist, 'content', pack));
  console.log(`  ${pack} ${kb(raw.length)} ${kb(brotli.length)}`);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({
  viewport: { width: 800, height: 360 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
// The page asks the server given here (window.XOMDAO_SERVER), as on Vercel.
await context.addInitScript((server) => {
  window.XOMDAO_SERVER = server;
}, args.server);

async function visit(label) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  if (NETWORKS[args.net])
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETWORKS[args.net] });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (event) => {
    bytes += event.encodedDataLength;
  });
  const start = Date.now();
  const booted = page.waitForEvent('console', {
    predicate: (message) => message.text() === 'xomdao:ready',
    timeout: 180_000,
  });
  await page.goto(`${url}?measure=${label}`);
  await booted;
  const boot = Date.now() - start;
  const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
  let line = `${label.padEnd(7)} engine started ${seconds(boot)}`;
  const bridge = await page.evaluate(() => Boolean(window.xomdao));
  if (bridge) {
    // Ready to play: connected, logged in, the first screen up.
    await page.waitForFunction(() => window.xomdao.scene() === 'home', null, { timeout: 60_000 });
    line += `   ready to play ${seconds(Date.now() - start)}`;
    const before = Date.now();
    await page.evaluate(() => window.xomdao.click('PlayBot'));
    await page.waitForFunction(() => window.xomdao.scene() === 'tic-tac-toe', null, {
      timeout: 120_000,
    });
    line += `   Caro board after tapping ${seconds(Date.now() - before)}`;
    // Leave the room, so the next visit starts on the first screen again.
    await page.evaluate(() => window.xomdao.click('Menu') && window.xomdao.click('Leave'));
    await page.waitForFunction(() => window.xomdao.scene() === 'home', null, { timeout: 60_000 });
  } else {
    await page.waitForTimeout(1000);
  }
  console.log(`${line}   over the network ${kb(bytes)}`);
  await page.close();
}

try {
  console.log(`\nVisits: network ${args.net}, CPU ${args.cpu}× slower, 800 × 360 @3`);
  await visit('first');
  await visit('repeat');
} finally {
  await browser.close();
  server.close();
}
