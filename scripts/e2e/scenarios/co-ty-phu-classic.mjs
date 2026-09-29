// Play several turns through the real Phaser controls in the sandbox, switching seats.
import { clickCanvas, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(PHONE);
  const url = new URL(t.url);
  url.search = '?play=co-ty-phu-classic&players=2';
  await page.goto(url.toString());
  await page.waitForFunction(() => window.__phaser?.scene.isActive('co-ty-phu-classic'));
  await page.screenshot({ path: t.shot('10-start.png') });

  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[3]);
  const detail = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').detail.text,
  );
  if (!detail.includes('Hàng Đào')) throw new Error('Selecting a property did not show its deed');
  await page.screenshot({ path: t.shot('11-deed.png') });

  let purchases = 0;
  for (let i = 0; i < 24; i++) {
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return { turn: s.turn, phase: s.phase, cash: s.players[s.turn].cash, pending: s.pending };
    });
    await page.getByRole('button', { name: `Người ${state.turn + 1}`, exact: true }).click();
    if (state.phase === 'roll') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else if (state.phase === 'buy') {
      const price = await page.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.pending,
      );
      if (
        state.cash >=
        (await page.evaluate((n) => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.ctx.state.pending === n
            ? Number(scene.main[0].text.text.match(/\d+/)?.[0])
            : 0;
        }, price))
      ) {
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
        purchases++;
      } else {
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[1].hit);
      }
    } else if (state.phase === 'end') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else if (state.phase === 'auction') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[3].hit);
    } else if (state.phase === 'debt') {
      const enough = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
        return s.players[s.turn].cash >= s.debt.amount;
      });
      if (enough) await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      else break;
    }
    await page.waitForTimeout(160);
  }
  if (purchases < 1) throw new Error('No property was purchased through the board controls');
  await page.screenshot({ path: t.shot('12-played.png') });
}
