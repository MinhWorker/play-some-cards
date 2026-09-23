// Headless browser test of the real app: two players (desktop + phone) create/join a room and
// play Caro 3×3 to a win. Screenshots go to .e2e/ so you can look at them.
// Needs `npm run dev` running (the owner usually has it open). Never opens a visible window.
//   npm run e2e [webUrl]      default http://localhost:5033
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5033';
const out = '.e2e';
mkdirSync(out, { recursive: true });

/** Screen position of a Phaser object, read from the dev-only window.__phaser handle. */
async function canvasPoint(page, sceneKey, pick) {
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), sceneKey);
  return page.evaluate(
    ({ key, pickSrc }) => {
      const scene = window.__phaser.scene.getScene(key);
      const obj = new Function('scene', `return (${pickSrc})(scene)`)(scene);
      const m = obj.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty };
    },
    { key: sceneKey, pickSrc: pick.toString() },
  );
}

async function clickCanvas(page, sceneKey, pick) {
  const { x, y } = await canvasPoint(page, sceneKey, pick);
  await page.mouse.click(x, y);
}

const browser = await chromium.launch({ headless: true });
try {
  const host = await (
    await browser.newContext({ viewport: { width: 1280, height: 760 } })
  ).newPage();
  const guest = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  const errors = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));

  await host.goto(url);
  await host.getByLabel('Tên của bạn').fill('Minh');
  await host.waitForTimeout(800); // let islands settle
  await host.screenshot({ path: `${out}/1-hub.png` });
  await clickCanvas(host, 'hub', (s) => s.views[0].container);
  await host.getByRole('button', { name: 'Tạo phòng' }).click();
  const title = host.getByText(/^Phòng [A-Z0-9]{4}$/);
  await title.waitFor();
  const code = (await title.textContent()).slice(-4);

  await guest.goto(`${url}/?room=${code}`);
  await guest.getByLabel('Tên của bạn').fill('Lan');
  await guest.getByRole('button', { name: 'Vào phòng' }).click();
  await host.getByText('Lan').waitFor();
  await host.screenshot({ path: `${out}/2-lobby.png` });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();

  // Host is X. X takes the top row.
  const moves = [
    [host, 0],
    [guest, 4],
    [host, 1],
    [guest, 8],
    [host, 2],
  ];
  for (const [page, cell] of moves) {
    await clickCanvas(page, 'tic-tac-toe', new Function(`return (s) => s.tiles[${cell}]`)());
    await page.waitForTimeout(400);
  }
  await host.getByText('Bạn thắng!').waitFor();
  await guest.getByText('Minh thắng!').waitFor();
  await host.screenshot({ path: `${out}/3-result-desktop.png` });
  await guest.screenshot({ path: `${out}/4-result-phone.png` });

  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
  console.log(`OK: room ${code}, Minh won. Screenshots in ${out}/`);
} catch (err) {
  console.error('E2E FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
