// Headless browser test of the real app: three people create accounts, two (desktop + phone)
// pick Caro on the island map, create/join a room from the room list and play to a win while a
// third person watches. Mid-game the phone player closes the browser and logs in again on a new
// one: they must land back in their seat. Screenshots go to .e2e/ so you can look at them.
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

const tag = Date.now().toString(36);
const PASSWORD = 'e2e-pass';
/** Unique per run so the accounts never clash with earlier runs. */
const usernameOf = (name) => `${name}${tag}`;

const browser = await chromium.launch({ headless: true });
try {
  const host = await (
    await browser.newContext({ viewport: { width: 1280, height: 760 } })
  ).newPage();
  const phone = () => browser.newContext({ viewport: { width: 390, height: 844 } });
  let guest = await (await phone()).newPage();
  const fan = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  const watchErrors = (p) => p.on('pageerror', (e) => errors.push(e.message));
  for (const p of [host, guest, fan]) watchErrors(p);

  /** Opens the app and creates an account whose in-game name is `name`. */
  async function signUp(page, name, shot) {
    await page.goto(url);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
    await page.getByLabel('Tên đăng nhập').fill(usernameOf(name));
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Tên trong game').fill(name);
    if (shot) await page.screenshot({ path: `${out}/${shot}` });
    await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
    await page.getByRole('button', { name: 'Sửa hồ sơ' }).waitFor();
  }

  /**
   * Picks a game on the island strip by id. On phones a side island first slides into focus,
   * so tap again until the room list opens.
   */
  async function openRooms(page, gameId) {
    const create = page.getByRole('button', { name: '+ Tạo phòng' });
    for (let i = 0; i < 3 && !(await create.count()); i++) {
      await page.waitForTimeout(800); // let the strip settle
      await clickCanvas(
        page,
        'hub',
        new Function(
          `return (s) => s.views.find((v) => v.portal.gameId === '${gameId}').container`,
        )(),
      );
    }
    await create.waitFor();
  }
  const openCaroRooms = (page) => openRooms(page, 'tic-tac-toe');

  // Wrong password is refused with a message; usernames with special characters too.
  await guest.goto(url);
  await guest.getByLabel('Tên đăng nhập').fill(usernameOf('nobody'));
  await guest.getByLabel('Mật khẩu', { exact: true }).fill('wrong-pass');
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByText('Sai tên đăng nhập hoặc mật khẩu').waitFor();
  await guest.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  if ((await guest.getByLabel('Mật khẩu', { exact: true }).getAttribute('type')) !== 'text')
    throw new Error('"Hiện mật khẩu" did not reveal the password');
  await guest.screenshot({ path: `${out}/0-login-phone.png` });
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
  await guest.getByLabel('Tên đăng nhập').fill('lan_ơi');
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await guest.getByText('chỉ gồm chữ không dấu và số').waitFor();

  await signUp(guest, 'Lan', '0-register-phone.png');
  await guest.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  await guest.getByRole('button', { name: 'Bạn nữ' }).click();
  await guest.getByRole('button', { name: 'Tên ngẫu nhiên' }).click();
  await guest.screenshot({ path: `${out}/0-profile-phone.png` });
  await guest.getByLabel('Tên', { exact: true }).fill('Lan');
  await guest.getByRole('button', { name: 'Xong' }).click();
  await guest.waitForTimeout(800);
  // Taps on the modal must not reach the islands underneath.
  if (
    (await guest.getByText('Game này sắp có').count()) ||
    (await guest.getByRole('button', { name: '+ Tạo phòng' }).count())
  )
    throw new Error('A tap on the profile modal reached an island');
  await guest.screenshot({ path: `${out}/1-hub-phone.png` });
  await signUp(host, 'Minh');
  await openCaroRooms(host);
  await host.getByRole('button', { name: 'Về đảo' }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: `${out}/1-hub.png` });
  await openCaroRooms(host);
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await host.getByText('Phòng của Minh').waitFor();

  // The guest finds Minh's room in the live list and takes the free seat.
  await openCaroRooms(guest);
  const row = guest.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await row.waitFor();
  await guest.screenshot({ path: `${out}/2-room-list-phone.png` });
  await row.getByRole('button', { name: 'Vào chơi' }).click();
  await host.getByText('Lan').waitFor();

  // Full room: the fan can't take a seat, only watch.
  await signUp(fan, 'Hoa');
  await openCaroRooms(fan);
  const fanRow = fan.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await fanRow.getByText('👤 2/2').waitFor();
  if (await fanRow.getByRole('button', { name: 'Vào chơi' }).isEnabled())
    throw new Error('Full room still offers "Vào chơi"');
  await fanRow.getByRole('button', { name: 'Xem' }).click();
  await host.getByText('👀 1 đang xem').waitFor();
  await host.screenshot({ path: `${out}/3-lobby.png` });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();

  // Host is X. X takes the top row.
  const play = async (page, cell) => {
    await clickCanvas(page, 'tic-tac-toe', new Function(`return (s) => s.tiles[${cell}]`)());
    await page.waitForTimeout(400);
  };
  await play(host, 0);
  await play(guest, 4);

  // Lan closes her browser without leaving, then logs in on a fresh one: back in her seat.
  await guest.context().close();
  guest = await (await phone()).newPage();
  watchErrors(guest);
  await guest.goto(url);
  await guest.getByLabel('Tên đăng nhập').fill(usernameOf('Lan').toUpperCase());
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByRole('button', { name: '← Rời phòng' }).waitFor();
  await guest.waitForTimeout(800);
  await guest.screenshot({ path: `${out}/3b-back-in-seat-phone.png` });

  const moves = [
    [host, 1],
    [guest, 8],
    [host, 2],
  ];
  for (const [page, cell] of moves) await play(page, cell);
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
  console.log(
    `OK: Lan came back after closing her browser, Minh won 1–0, host passed to Lan, room disbanded. Screenshots in ${out}/`,
  );
} catch (err) {
  console.error('E2E FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
