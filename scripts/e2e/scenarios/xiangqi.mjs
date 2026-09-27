// Cờ Tướng against the computer on a phone: the one-form setup, a few moves as Red by tapping
// a piece and then one of its marked points, then "Đầu hàng" (tapped twice) ends the game.
import { clickCanvas, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['xiangqi'];

/** Page point of board point `sq` (the scene knows where it drew it, in design units). */
const pointOf = (page, sq) =>
  page.evaluate((s) => {
    const { x, y } = window.__phaser.scene.getScene('xiangqi').pointXY(s);
    return window.__toScreen('xiangqi', x, y);
  }, sq);

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp(t, page, 'Tuan');
  await openRooms(page, 'xiangqi');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'xiangqi:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'xiangqi:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-xiangqi-setup.png') });
  await clickCanvas(page, 'xiangqi:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi')?.pieces?.size === 32);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('11-xiangqi-start.png') });

  for (let move = 0; move < 4; move++) {
    await page.waitForFunction(() => {
      const { state, result } = window.__phaser.scene.getScene('xiangqi').ctx;
      return result || state.turn === 'r';
    });
    const plies = await page.evaluate(
      () => window.__phaser.scene.getScene('xiangqi').ctx.state.plies,
    );
    // Red's pieces, soldiers and cannons first: tap each until one shows where it may go.
    const mine = await page.evaluate(() =>
      window.__phaser.scene
        .getScene('xiangqi')
        .ctx.state.board.map((p, sq) => ({ p, sq }))
        .filter(({ p }) => p && 'PCRNBAK'.includes(p))
        .sort((a, b) => 'PCRNBAK'.indexOf(a.p) - 'PCRNBAK'.indexOf(b.p))
        .map(({ sq }) => sq),
    );
    let moved = false;
    for (const sq of mine.slice(move)) {
      const at = await pointOf(page, sq);
      await page.mouse.click(at.x, at.y);
      const targets = await page.evaluate(() => window.__phaser.scene.getScene('xiangqi').targets);
      if (!targets.length) continue;
      if (move === 0) await page.screenshot({ path: t.shot('12-xiangqi-picked.png') });
      const to = await pointOf(page, targets[0]);
      await page.mouse.click(to.x, to.y);
      moved = true;
      break;
    }
    if (!moved) throw new Error(`Red found no move to play (move ${move + 1})`);
    // The computer answers: two plies later it is Red's turn again.
    await page.waitForFunction(
      (n) => window.__phaser.scene.getScene('xiangqi').ctx.state.plies >= n + 2,
      plies,
      { timeout: 10000 },
    );
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('13-xiangqi-moves.png') });

  await clickCanvas(page, 'xiangqi', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'xiangqi', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi').ctx.state.end);
  const status = await page.evaluate(() => window.__phaser.scene.getScene('xiangqi').status.text);
  if (!status.includes('đầu hàng')) throw new Error(`After resigning the status says "${status}"`);
  await page.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await page.screenshot({ path: t.shot('14-xiangqi-resigned.png') });
}
