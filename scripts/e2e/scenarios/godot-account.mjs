// Accounts in the Godot client: a guest makes an account at Nhà › Tài khoản and comes back as it,
// logs out (a new guest) and logs in again; a player the old web app logged in (its token in
// localStorage) opens the Godot client as the same account. Needs the debug web build
// (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, tap, typeInto } from '../godot.mjs';

export const games = [];
export { launch };

const user = (page) => page.evaluate(() => window.xomdao.state().user);

export default async function run(t) {
  const username = `e2e${Date.now().toString(36)}`;
  const page = await openGodot(t, await t.page(DESKTOP));
  await onScene(page, 'lobby');
  const guest = await user(page);
  if (!guest.username.startsWith('khach')) throw new Error('Not a guest at first');

  await tap(page, 'Profile');
  await onScene(page, 'nha');
  await tap(page, 'AccountButton');
  await godotText(page, 'AccountSubmit', 'Vào chơi');
  await page.screenshot({ path: t.shot('1-form.png') });
  // A wrong password first: the server's message shows on the board.
  await typeInto(page, 'Username', 'khong-co-ai');
  await typeInto(page, 'Password', 'sai-mat-khau');
  await tap(page, 'AccountSubmit');
  await godotText(page, 'AccountError', /./);
  await page.screenshot({ path: t.shot('1-error.png') });

  // Tạo tài khoản: the second option of the mode switch.
  const mode = await page.evaluate(() => window.xomdao.rect('AccountMode'));
  await page.mouse.click(mode.x + mode.width * 0.75, mode.y + mode.height / 2);
  await godotText(page, 'AccountSubmit', 'Tạo tài khoản');
  await typeInto(page, 'Username', username);
  await typeInto(page, 'Password', 'mat-khau-e2e');
  await typeInto(page, 'DisplayName', 'Lan E2E');
  await page.screenshot({ path: t.shot('2-register.png') });
  await tap(page, 'AccountSubmit');
  await page.waitForFunction((u) => window.xomdao.state().user?.username === u, username, {
    timeout: 30_000,
  });
  await onScene(page, 'lobby');

  // Đăng xuất: a new guest.
  await tap(page, 'Profile');
  await onScene(page, 'nha');
  await tap(page, 'AccountButton');
  await godotText(page, 'AccountUsername', new RegExp(username));
  await page.screenshot({ path: t.shot('3-signed-in.png') });
  await tap(page, 'SignOut');
  await page.waitForFunction(() => window.xomdao.state().user?.username.startsWith('khach'), null, {
    timeout: 30_000,
  });

  // Đăng nhập with the new account.
  await onScene(page, 'lobby');
  await tap(page, 'Profile');
  await onScene(page, 'nha');
  await tap(page, 'AccountButton');
  await typeInto(page, 'Username', username);
  await typeInto(page, 'Password', 'mat-khau-e2e');
  await tap(page, 'AccountSubmit');
  await page.waitForFunction((u) => window.xomdao.state().user?.username === u, username, {
    timeout: 30_000,
  });

  // The old web app's token (localStorage) logs a fresh browser in as the same account.
  const fresh = await t.page(DESKTOP);
  await fresh.goto(new URL('/api/health', t.url).href);
  const token = await fresh.evaluate(async (name) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password: 'mat-khau-e2e' }),
    });
    return (await res.json()).token;
  }, username);
  await fresh.evaluate((tk) => localStorage.setItem('xomdao:token', tk), token);
  await openGodot(t, fresh);
  await onScene(fresh, 'lobby');
  if ((await user(fresh)).username !== username) throw new Error('The old token was not used');
  await fresh.screenshot({ path: t.shot('4-legacy.png') });
}
