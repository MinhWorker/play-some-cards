// Cờ Vây against the computer on a phone: the one-form setup (9 × 9), a few stones as Black by
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
  await signUp(t, page, 'Khoa');
  await openRooms(page, 'go');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'go:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'go:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-go-setup.png') });
  await clickCanvas(page, 'go:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('go')?.ctx?.state?.size === 9);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('11-go-start.png') });

  // Black plays near the middle; the computer answers each stone.
  for (const [row, col] of [
    [2, 2],
    [6, 6],
    [2, 6],
  ]) {
    await page.waitForFunction(() => {
      const { ctx } = window.__phaser.scene.getScene('go');
      return ctx.result || ctx.state.turn === 'b';
    });
    const before = await state(page);
    // The planned point, or the first free one if the computer took it.
    let p = row * 9 + col;
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
