import assert from 'node:assert/strict';
import { DESKTOP, PHONE } from '../lib.mjs';

/** Same-protocol deploys must wait for the target commit, including a superseding deploy. */
export default async function run(t) {
  const page = await t.page(DESKTOP);
  let target = 'bbbbbbb';
  let health = { ok: true, db: 'up', commit: 'aaaaaaa', protocol: 0 };
  let failure = true;
  let requests = 0;
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.goto(t.url);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  assert.match(await page.title(), /Xóm Đảo/);
  const protocol = await page.evaluate(
    () => JSON.parse(document.querySelector('meta[name="xomdao-build"]').content).protocol,
  );
  health.protocol = protocol;
  await page.route(`${t.url.replace(/\/$/, '')}/`, async (route) => {
    if (route.request().isNavigationRequest()) return route.continue();
    const build = JSON.stringify({ commit: target, protocol, waitForServer: true });
    await route.fulfill({
      contentType: 'text/html',
      body: `<meta name="xomdao-build" content='${build}'><script type="module" src="/assets/${target}.js"></script>`,
    });
  });
  await page.route('**/api/health', async (route) => {
    requests++;
    await route.fulfill({
      status: failure ? 503 : 200,
      contentType: 'application/json',
      body: failure ? 'unavailable' : JSON.stringify(health),
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
  const dialog = page.getByRole('alertdialog', { name: 'Đã có phiên bản mới' });
  await dialog.waitFor();
  await page.screenshot({ path: t.shot('confirm.png') });
  await dialog.getByRole('button', { name: 'Tải lại', exact: true }).click();
  const loading = page.getByRole('status').filter({ hasText: 'Đang cập nhật' });
  const warmup = page.locator('.warmup').filter({ hasText: 'Đang hâm nóng server' });
  await warmup.last().waitFor();
  assert.equal(
    await page.locator('.update-loading').count(),
    0,
    'an unavailable server is not a deploy',
  );
  await page.screenshot({ path: t.shot('cold-start.png') });
  const initialNavigations = navigations;
  const nextPoll = async (expected = 'deploying') => {
    const before = requests;
    const deadline = Date.now() + 15_000;
    while (requests <= before && Date.now() < deadline) await page.waitForTimeout(100);
    assert.ok(requests > before, 'the backend check retries');
    if (expected === 'waiting') {
      await warmup.last().waitFor();
      assert.equal(await page.locator('.update-loading').count(), 0);
    } else {
      await loading.waitFor();
      assert.equal(await page.locator('.warmup:visible').count(), 0);
    }
    assert.equal(navigations, initialNavigations, 'does not reload before backend readiness');
    assert.equal(await page.locator('main').getAttribute('inert'), '', 'background UI is blocked');
  };
  await nextPoll('waiting');
  failure = false;
  await nextPoll(); // An old healthy backend with the same protocol/version is insufficient.
  await page.screenshot({ path: t.shot('waiting-desktop.png') });
  failure = true;
  await nextPoll();
  failure = false;
  health = { ...health, commit: target, db: 'down' };
  await nextPoll('waiting');
  health = { ...health, db: 'up', protocol: protocol + 1 };
  await nextPoll();
  target = 'ccccccc'; // The previous target is ready, but Vercel has already deployed another.
  health = { ...health, protocol };
  await nextPoll();
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('waiting-phone.png') });
  const reloaded = page.waitForEvent('framenavigated', {
    predicate: (frame) => frame === page.mainFrame(),
    timeout: 15_000,
  });
  health = { ...health, commit: target };
  await reloaded;
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(navigations, initialNavigations + 1, 'reloads once the latest backend is ready');
  assert.equal(await page.locator('.update-loading').count(), 0);
  await page.close();

  // A later socket outage on an unchanged web build still uses the original warm-up UI.
  const disconnected = await t.page(PHONE);
  await disconnected.addInitScript(() =>
    localStorage.setItem('xomdao:token', 'waiting-for-server'),
  );
  await disconnected.route('**/socket.io/**', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await disconnected.goto(t.url);
  await disconnected.locator('.warmup:visible').waitFor();
  assert.equal(await disconnected.locator('.update-loading').count(), 0);
  await disconnected.screenshot({ path: t.shot('disconnected.png') });
  await disconnected.close();

  // An older protocol in the real Socket.IO handshake is also positive deploy evidence,
  // including when the update dialog's health probe cannot reach the backend yet.
  const protocolWait = await t.page(PHONE);
  await protocolWait.addInitScript(() => localStorage.setItem('xomdao:token', 'older-protocol'));
  await protocolWait.route('**/socket.io/**', (route) => {
    const request = route.request();
    const body =
      request.method() === 'POST'
        ? 'ok'
        : new URL(request.url()).searchParams.has('sid')
          ? `44${JSON.stringify({ message: 'protocol-mismatch', data: { protocol: protocol - 1 } })}`
          : `0${JSON.stringify({ sid: 'old-server', upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 })}`;
    return route.fulfill({ contentType: 'text/plain', body });
  });
  await protocolWait.goto(t.url);
  await protocolWait.locator('.update-loading').waitFor();
  assert.equal(await protocolWait.locator('.warmup:visible').count(), 0);
  await protocolWait.route(`${t.url.replace(/\/$/, '')}/`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<meta name="xomdao-build" content='${JSON.stringify({ commit: target, protocol, waitForServer: true })}'><script type="module" src="/assets/protocol-update.js"></script>`,
    }),
  );
  await protocolWait.route('**/api/health', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await protocolWait.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
  await protocolWait.getByRole('alertdialog').getByRole('button', { name: 'Tải lại' }).click();
  await protocolWait.locator('.update-loading').waitFor();
  assert.equal(await protocolWait.locator('.warmup:visible').count(), 0);
  await protocolWait.screenshot({ path: t.shot('older-protocol.png') });
}
