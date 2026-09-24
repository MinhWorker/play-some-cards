// Headless browser test of the real app: two players (desktop + phone) pick Caro on the island
// map, create/join a room from the room list and play to a win while a third person watches. Screenshots go to .e2e/ so you can look at them.
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
  const fan = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  for (const p of [host, guest, fan]) p.on('pageerror', (e) => errors.push(e.message));

  /** Changes the nickname through the profile modal (players start with a silly name). */
  async function setName(page, name) {
    await page.getByRole('button', { name: 'Sửa hồ sơ' }).click();
    await page.getByLabel('Tên', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Xong' }).click();
  }

  /** Opens the app, sets a name and picks the Caro island to reach its room list. */
  async function openCaroRooms(page, name) {
    await page.goto(url);
    await setName(page, name);
    await page.waitForTimeout(800); // let islands settle
    await clickCanvas(page, 'hub', (s) => s.views[0].container);
    await page.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  }

  await guest.goto(url);
  await guest.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  await guest.getByRole('button', { name: 'Bạn nữ' }).click();
  await guest.getByRole('button', { name: 'Tên ngẫu nhiên' }).click();
  await guest.screenshot({ path: `${out}/0-profile-phone.png` });
  await guest.getByRole('button', { name: 'Xong' }).click();
  await guest.waitForTimeout(800);
  // Taps on the modal must not reach the islands underneath.
  if (
    (await guest.getByText('Game này sắp có').count()) ||
    (await guest.getByRole('button', { name: '+ Tạo phòng' }).count())
  )
    throw new Error('A tap on the profile modal reached an island');
  await guest.screenshot({ path: `${out}/1-hub-phone.png` });
  await openCaroRooms(host, 'Minh');
  await host.getByRole('button', { name: 'Về đảo' }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: `${out}/1-hub.png` });
  await clickCanvas(host, 'hub', (s) => s.views[0].container);
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await host.getByText('Phòng của Minh').waitFor();

  // The guest finds Minh's room in the live list and takes the free seat.
  await openCaroRooms(guest, 'Lan');
  const row = guest.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await row.waitFor();
  await guest.screenshot({ path: `${out}/2-room-list-phone.png` });
  await row.getByRole('button', { name: 'Vào chơi' }).click();
  await host.getByText('Lan').waitFor();

  // Full room: the fan can't take a seat, only watch.
  await openCaroRooms(fan, 'Hoa');
  const fanRow = fan.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await fanRow.getByText('👤 2/2').waitFor();
  if (await fanRow.getByRole('button', { name: 'Vào chơi' }).isEnabled())
    throw new Error('Full room still offers "Vào chơi"');
  await fanRow.getByRole('button', { name: 'Xem' }).click();
  await host.getByText('👀 1 đang xem').waitFor();
  await host.screenshot({ path: `${out}/3-lobby.png` });
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
  await fan.getByText('Minh thắng!').waitFor();
  await host.screenshot({ path: `${out}/4-result-desktop.png` });
  await guest.screenshot({ path: `${out}/5-result-phone.png` });
  await fan.screenshot({ path: `${out}/6-result-spectator.png` });
  const score = await host.evaluate(() =>
    window.__phaser.scene.getScene('tic-tac-toe').score.numbers.text.replace(/\s+/g, ' '),
  );
  if (score !== '1 – 0') throw new Error(`Scoreboard shows "${score}", expected "1 – 0"`);

  // Host quits: Lan becomes host. Then Lan quits: no players left, the room is disbanded
  // and the spectator is sent back to the room list.
  await host.getByRole('button', { name: '← Rời phòng' }).click();
  await guest.getByText('👑 Lan').waitFor();
  await guest.getByRole('button', { name: 'Bắt đầu' }).waitFor();
  await guest.getByRole('button', { name: '← Rời phòng' }).click();
  await fan.getByText('Phòng đã giải tán').waitFor();
  await fan.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  await fan.screenshot({ path: `${out}/7-disbanded-spectator.png` });

  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
  console.log(`OK: Minh won 1–0, host passed to Lan, room disbanded. Screenshots in ${out}/`);
} catch (err) {
  console.error('E2E FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
