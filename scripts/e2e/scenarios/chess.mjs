// Cờ Vua against the computer on a phone: the one-form setup, a few moves as White by tapping
// a piece and then one of its marked squares, then "Đầu hàng" (tapped twice) ends the game.
import { clickCanvas, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['chess'];

/** Page point of square `sq` (the scene knows where it drew it, in design units). */
const pointOf = (page, sq) =>
  page.evaluate((s) => {
    const { x, y } = window.__phaser.scene.getScene('chess').pointXY(s);
    return window.__toScreen('chess', x, y);
  }, sq);

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp(t, page, 'Linh');
  await openRooms(page, 'chess');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'chess:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'chess:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-chess-setup.png') });
  await clickCanvas(page, 'chess:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('chess')?.pieces?.size === 32);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('11-chess-start.png') });

  for (let move = 0; move < 4; move++) {
    await page.waitForFunction(() => {
      const { state, result } = window.__phaser.scene.getScene('chess').ctx;
      return result || state.turn === 'w';
    });
    const plies = await page.evaluate(
      () => window.__phaser.scene.getScene('chess').ctx.state.plies,
    );
    // White's pieces, pawns and knights first: tap each until one shows where it may go.
    const mine = await page.evaluate(() =>
      window.__phaser.scene
        .getScene('chess')
        .ctx.state.board.map((p, sq) => ({ p, sq }))
        .filter(({ p }) => p && 'PNBRQK'.includes(p))
        .sort((a, b) => 'PNBRQK'.indexOf(a.p) - 'PNBRQK'.indexOf(b.p))
        .map(({ sq }) => sq),
    );
    let moved = false;
    for (const sq of mine.slice(move)) {
      const at = await pointOf(page, sq);
      await page.mouse.click(at.x, at.y);
      const targets = await page.evaluate(() => window.__phaser.scene.getScene('chess').targets);
      if (!targets.length) continue;
      if (move === 0) await page.screenshot({ path: t.shot('12-chess-picked.png') });
      const to = await pointOf(page, targets[0]);
      await page.mouse.click(to.x, to.y);
      moved = true;
      break;
    }
    if (!moved) throw new Error(`White found no move to play (move ${move + 1})`);
    // The computer answers: two plies later it is White's turn again.
    await page.waitForFunction(
      (n) => window.__phaser.scene.getScene('chess').ctx.state.plies >= n + 2,
      plies,
      { timeout: 10000 },
    );
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('13-chess-moves.png') });

  await clickCanvas(page, 'chess', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'chess', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('chess').ctx.state.end);
  const status = await page.evaluate(() => window.__phaser.scene.getScene('chess').status.text);
  if (!status.includes('đầu hàng')) throw new Error(`After resigning the status says "${status}"`);
  await page.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await page.screenshot({ path: t.shot('14-chess-resigned.png') });
}
