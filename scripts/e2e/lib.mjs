// Helpers every e2e scenario shares: the Phaser canvas, accounts, the island map, rooms.
// A scenario gets a `t` (see ../e2e.mjs): its own browser, a screenshot folder and a run tag.

/**
 * Page position (CSS px) of a Phaser object, read from the dev-only window.__phaser handle.
 * Scenes lay out in design units; window.__toScreen turns those into page pixels.
 */
export async function canvasPoint(page, sceneKey, pick) {
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), sceneKey);
  return page.evaluate(
    ({ key, pickSrc }) => {
      const scene = window.__phaser.scene.getScene(key);
      const obj = new Function('scene', `return (${pickSrc})(scene)`)(scene);
      const m = obj.getWorldTransformMatrix();
      return window.__toScreen(key, m.tx, m.ty);
    },
    { key: sceneKey, pickSrc: pick.toString() },
  );
}

export async function clickCanvas(page, sceneKey, pick) {
  const { x, y } = await canvasPoint(page, sceneKey, pick);
  await page.mouse.click(x, y);
}

export const PASSWORD = 'e2e-pass';
export const DESKTOP = { width: 1280, height: 760 };
/** A phone held sideways (the app is played in landscape). */
export const PHONE = { width: 844, height: 390 };

/** Opens the app and creates an account whose in-game name is `name`. */
export async function signUp(t, page, name, shot) {
  await page.goto(t.url);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
  await page.getByLabel('Tên đăng nhập').fill(t.username(name));
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Tên trong game').fill(name);
  if (shot) await page.screenshot({ path: t.shot(shot) });
  await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await page.getByRole('button', { name: 'Sửa hồ sơ' }).waitFor();
}

/**
 * Picks a game on the island strip by id: the arrows step it into focus (it may be off
 * screen), then a tap opens its room list.
 */
export async function openRooms(page, gameId) {
  const create = page.getByRole('button', { name: '+ Tạo phòng' });
  for (let i = 0; i < 8 && !(await create.count()); i++) {
    await page.waitForTimeout(800); // let the strip settle
    await page.waitForFunction(() => window.__phaser?.scene.isActive('hub'));
    const off = await page.evaluate((id) => {
      const hub = window.__phaser.scene.getScene('hub');
      return hub.views.findIndex((v) => v.portal.gameId === id) - hub.focus;
    }, gameId);
    const pick = off
      ? `(s) => s.arrows[${off > 0 ? 1 : 0}]`
      : `(s) => s.views.find((v) => v.portal.gameId === '${gameId}').container`;
    await clickCanvas(page, 'hub', new Function(`return ${pick}`)());
    // The room list opens after the cloud transition; tapping again meanwhile would wait on a
    // hub that is closing.
    if (!off) await create.waitFor({ timeout: 10000 }).catch(() => {});
  }
  await create.waitFor();
}

/** The leave button (←, "Về danh sách phòng"), confirming "Bỏ dở ván này?" when a game is running. */
export async function leaveRoom(page) {
  await page.getByRole('button', { name: 'Về danh sách phòng' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.waitFor({ timeout: 1000 }).catch(() => {});
  if (await confirm.count()) {
    await confirm.getByRole('button', { name: 'Rời phòng', exact: true }).click();
  }
}

/** Caro's setup screen (a Phaser scene): taps `pick`, e.g. 'opponents[0]' for "Bạn bè". */
export async function caroSetup(page, pick) {
  await page.waitForTimeout(500);
  await clickCanvas(page, 'tic-tac-toe:setup', new Function(`return (s) => s.${pick}.tile`)());
}

/**
 * A Caro move on the tile at `x`, `y`, once it is this page's turn (the sandbox plays every seat)
 * and the board's camera has stopped gliding.
 */
export async function caroPlay(page, x, y) {
  await page.waitForFunction(() => {
    const s = window.__phaser?.scene.getScene('tic-tac-toe');
    // The scene can exist a moment before its first `ctx` arrives.
    if (!s?.ctx || !s.layer) return false;
    const myTurn = !s.ctx.me || s.ctx.state.turn === s.ctx.me.id;
    return myTurn && !s.tweens.isTweening(s.layer);
  });
  await clickCanvas(page, 'tic-tac-toe', new Function(`return (s) => s.tiles.get('${x},${y}')`)());
  await page.waitForTimeout(400);
}

/** Run the same console path as the keyboard UI and pins, with a useful failure message. */
export async function cmd(page, line) {
  await page.waitForFunction(() => typeof window.__devCommand === 'function');
  const result = await page.evaluate((line) => window.__devCommand(line), line);
  if (!result.ok) throw new Error(`Dev Console ${JSON.stringify(line)}: ${result.error}`);
  return result.output;
}
