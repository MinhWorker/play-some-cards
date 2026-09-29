// Bài Cào with two computer players on a phone: round 1 you deal (the computer players bet),
// you look at your cards one by one and turn them over; round 2 you bet against the dealer.
// Each round ends with the count, and the points always add up to zero.
import { clickCanvas, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['bai-cao'];

const state = (page) => page.evaluate(() => window.__phaser.scene.getScene('bai-cao').ctx.state);
const phase = (page, round, name, timeout = 30000) =>
  page.waitForFunction(
    ([r, p]) => {
      const state = window.__phaser.scene.getScene('bai-cao')?.ctx?.state;
      return state?.round === r && state.phase === p;
    },
    [round, name],
    { timeout },
  );

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp(t, page, 'Tu');
  await openRooms(page, 'bai-cao');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'bai-cao:setup', (s) => s.rows[0].chips[2].container);
  await clickCanvas(page, 'bai-cao:setup', (s) => s.rows[1].chips[0].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-bai-cao-setup.png') });
  await clickCanvas(page, 'bai-cao:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  // Round 1: you deal. The computer players bet, the cards come.
  await phase(page, 1, 'reveal');
  const me = await page.evaluate(() => window.__phaser.scene.getScene('bai-cao').ctx.me.seat);
  if ((await state(page)).dealer !== me) throw new Error('The room creator should deal first');
  await page.waitForTimeout(800);
  // Picks run in the page, so each card is its own function.
  for (const pick of [
    (s) => s.seats[s.ctx.me.seat].cards[0],
    (s) => s.seats[s.ctx.me.seat].cards[1],
    (s) => s.seats[s.ctx.me.seat].cards[2],
  ]) {
    await clickCanvas(page, 'bai-cao', pick);
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: t.shot('11-bai-cao-peeked.png') });
  await clickCanvas(page, 'bai-cao', (s) => s.buttons.reveal.container);
  await phase(page, 1, 'showdown');
  await page.waitForTimeout(600);
  await page.screenshot({ path: t.shot('12-bai-cao-count.png') });
  const one = await state(page);
  if (one.points.reduce((a, b) => a + b, 0) !== 0)
    throw new Error(`Points ${one.points} don't add up`);

  // Round 2: the next seat deals; you bet 10.
  await phase(page, 2, 'bet');
  await clickCanvas(page, 'bai-cao', (s) => s.buttons.bets[1].container);
  await page.waitForFunction(
    (seat) => window.__phaser.scene.getScene('bai-cao').ctx.state.bets[seat] === 10,
    me,
  );
  await phase(page, 2, 'reveal');
  await page.waitForTimeout(800);
  await clickCanvas(page, 'bai-cao', (s) => s.buttons.reveal.container);
  await phase(page, 2, 'showdown');
  await page.waitForTimeout(600);
  await page.screenshot({ path: t.shot('13-bai-cao-round-2.png') });
  const two = await state(page);
  const mine = two.results?.find((r) => r.seat === me)?.delta;
  if (Math.abs(mine) !== 10 && Math.abs(mine) !== 20) {
    throw new Error(`A bet of 10 won or lost ${mine}`);
  }
}
