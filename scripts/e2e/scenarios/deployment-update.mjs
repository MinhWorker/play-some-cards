import assert from 'node:assert/strict';
import { DESKTOP, PHONE } from '../lib.mjs';

/** Same-protocol deploys must wait for the target commit, including a superseding deploy. */
export default async function run(t) {
  const page = await t.page(DESKTOP);
  let target = 'bbbbbbb';
  let health = { ok: true, db: 'up', commit: 'aaaaaaa', protocol: 0 };
  let failure = false;
  let requests = 0;
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.goto(t.url);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  assert.match(await page.title(), /Chơi chút bài/);
  const protocol = await page.evaluate(
    () => JSON.parse(document.querySelector('meta[name="psc-build"]').content).protocol,
  );
  health.protocol = protocol;
  await page.route(`${t.url.replace(/\/$/, '')}/`, async (route) => {
    if (route.request().isNavigationRequest()) return route.continue();
    const build = JSON.stringify({ commit: target, protocol, waitForServer: true });
    await route.fulfill({
      contentType: 'text/html',
      body: `<meta name="psc-build" content='${build}'><script type="module" src="/assets/${target}.js"></script>`,
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
  await loading.waitFor();
  const initialNavigations = navigations;
  const nextPoll = async () => {
    const before = requests;
    await page.waitForFunction(() => document.querySelector('.update-loading'));
    const deadline = Date.now() + 15_000;
    while (requests <= before && Date.now() < deadline) await page.waitForTimeout(100);
    assert.ok(requests > before, 'the backend check retries');
    await loading.waitFor();
    assert.equal(navigations, initialNavigations, 'does not reload before backend readiness');
    assert.equal(await page.locator('main').getAttribute('inert'), '', 'background UI is blocked');
  };
  await nextPoll(); // An old healthy backend with the same protocol/version is insufficient.
  await page.screenshot({ path: t.shot('waiting-desktop.png') });
  failure = true;
  await nextPoll();
  failure = false;
  health = { ...health, commit: target, db: 'down' };
  await nextPoll();
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
}
