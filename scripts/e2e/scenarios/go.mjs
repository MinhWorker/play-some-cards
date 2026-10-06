// Cờ Vây against the computer on a phone: standard 19 × 19, a few stones as Black by
// tapping points, "Bỏ lượt", then "Đầu hàng" (tapped twice) ends the game.
import { clickCanvas, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['go'];

/** Page point of board point `p` (the scene knows where it drew it, in design units). */
const pointOf = (page, p) =>
  page.evaluate((at) => {
    const { x, y } = window.__phaser.scene.getScene('go').pointXY(at);
    return window.__toScreen('go', x, y);
  }, p);

const state = (page) => page.evaluate(() => window.__phaser.scene.getScene('go').ctx.state);

export default async function run(t) {
  const page = await t.page(PHONE);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await signUp(t, page, 'Khoa');
  await openRooms(page, 'go');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'go:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'go:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => window.__phaser.scene.getScene('go:setup').rows.length);
  if (rows !== 3) throw new Error('Setup must only offer opponent, level and color');
  await page.screenshot({ path: t.shot('10-go-setup.png') });
  await clickCanvas(page, 'go:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('go')?.ctx?.state?.size === 19);
  await page.waitForTimeout(400);
  const fillsHeight = await page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('go');
    return scene.wood.displayHeight >= scene.view.height * 0.9;
  });
  if (!fillsHeight) throw new Error('The mobile board must fill at least 90% of the frame height');
  await page.screenshot({ path: t.shot('11-go-start.png') });

  // A real touch gesture previews the neighboring intersections before release commits.
  const start = await pointOf(page, 3 * 19 + 2);
  const target = await pointOf(page, 3 * 19 + 3);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y }],
  });
  await page.waitForFunction(() => window.__phaser.scene.getScene('go').touchLoupe.visible);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x, y: 1 }],
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if ((await state(page)).plies !== 0) throw new Error('Dragging outside the board did not cancel');
  if (await page.evaluate(() => window.__phaser.scene.getScene('go').touchLoupe.visible))
    throw new Error('The cancelled touch preview stayed visible');

  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y }],
  });
  await page.waitForFunction(() => window.__phaser.scene.getScene('go').touchLoupe.visible);
  if ((await state(page)).plies !== 0) throw new Error('Touch preview committed before release');
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: target.x, y: target.y }],
  });
  await page.screenshot({ path: t.shot('11-go-touch-preview.png') });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => window.__phaser.scene.getScene('go').ctx.state.plies >= 2);
  const placed = await state(page);
  if (placed.board[3 * 19 + 3] !== 'b' || placed.board[3 * 19 + 2] === 'b')
    throw new Error('Touch release did not commit the selected intersection');
  if (await page.evaluate(() => window.__phaser.scene.getScene('go').touchLoupe.visible))
    throw new Error('The touch preview survived release');

  // Black plays near the corners; the computer answers each stone.
  for (const [row, col] of [
    [15, 15],
    [3, 15],
  ]) {
    await page.waitForFunction(() => {
      const { ctx } = window.__phaser.scene.getScene('go');
      return ctx.result || ctx.state.turn === 'b';
    });
    const before = await state(page);
    // The planned point, or the first free one if the computer took it.
    let p = row * 19 + col;
    if (before.board[p] !== '.') p = before.board.indexOf('.');
    const at = await pointOf(page, p);
    await page.mouse.click(at.x, at.y);
    await page.waitForFunction(
      (n) => window.__phaser.scene.getScene('go').ctx.state.plies >= n + 2,
      before.plies,
      { timeout: 10000 },
    );
    const after = await state(page);
    if (after.board[p] !== 'b') throw new Error(`No black stone on point ${p} after tapping it`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('12-go-stones.png') });

  const plies = (await state(page)).plies;
  await clickCanvas(page, 'go', (s) => s.buttons.pass.container);
  await page.waitForFunction(
    (n) => window.__phaser.scene.getScene('go').ctx.state.plies > n,
    plies,
  );
  const status = await page.evaluate(() => window.__phaser.scene.getScene('go').status.text);
  if (!status.includes('bỏ lượt') && !status.includes('Đếm điểm')) {
    throw new Error(`After passing the status says "${status}"`);
  }
  await page.screenshot({ path: t.shot('13-go-passed.png') });

  await page.waitForFunction(() => {
    const { ctx } = window.__phaser.scene.getScene('go');
    return ctx.state.turn === 'b' || ctx.state.phase === 'scoring';
  });
  await clickCanvas(page, 'go', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'go', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('go').ctx.state.end);
  const end = await page.evaluate(() => window.__phaser.scene.getScene('go').status.text);
  if (!end.includes('đầu hàng')) throw new Error(`After resigning the status says "${end}"`);
  await page.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await page.screenshot({ path: t.shot('14-go-resigned.png') });
}
