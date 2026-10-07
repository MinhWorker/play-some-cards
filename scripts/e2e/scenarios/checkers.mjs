// Cờ Đam against the computer on a phone: the one-form setup (8 × 8), a few moves by tapping a
// ringed piece and then each square of its move, then "Đầu hàng" (tapped twice) ends the game.
import { clickCanvas, PHONE, signUp } from '../lib.mjs';

export const games = ['checkers'];

/** Page point of square `sq` (the scene knows where it drew it, in design units). */
const pointOf = (page, sq) =>
  page.evaluate((s) => {
    const { x, y } = window.__phaser.scene.getScene('checkers').pointXY(s);
    return window.__toScreen('checkers', x, y);
  }, sq);

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp({ ...t, url: `${t.url}/?game=checkers` }, page, 'Nam');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'checkers:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'checkers:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-checkers-setup.png') });
  await clickCanvas(page, 'checkers:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers')?.pieces?.size === 24);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('11-checkers-start.png') });

  for (let move = 0; move < 4; move++) {
    await page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('checkers');
      const moving = s.runtime
        .inspect()
        .lanes.some((lane) => lane.name === 'move' && (lane.active || lane.pending > 0));
      return s.ctx.result || (s.moves.length > 0 && !moving);
    });
    const { plies, path, over } = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('checkers');
      return { plies: s.ctx.state.plies, path: s.moves[0]?.path ?? [], over: !!s.ctx.result };
    });
    if (over) break;
    for (const [i, sq] of path.entries()) {
      const at = await pointOf(page, sq);
      await page.mouse.click(at.x, at.y);
      if (move === 0 && i === 0) await page.screenshot({ path: t.shot('12-checkers-picked.png') });
    }
    // The computer answers: two plies later it is our turn again (or the game is over).
    await page.waitForFunction(
      (n) => {
        const s = window.__phaser.scene.getScene('checkers');
        return s.ctx.result || s.ctx.state.plies >= n + 2;
      },
      plies,
      { timeout: 10000 },
    );
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('13-checkers-moves.png') });

  await clickCanvas(page, 'checkers', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'checkers', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').ctx.state.end);
  const status = await page.evaluate(() => window.__phaser.scene.getScene('checkers').status.text);
  if (!status.includes('đầu hàng')) throw new Error(`After resigning the status says "${status}"`);
  await page.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').panel.shown);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('checkers').runtime.inspect().motion === 0,
  );
  await page.screenshot({ path: t.shot('14-checkers-resigned.png') });
}
