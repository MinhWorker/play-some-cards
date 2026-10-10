// The sample event in the Godot client (#124): with the server's event clock moved into Trung
// Thu (dev:clock), the lobby's banner and Sự kiện island show it; its board opens from the
// banner, Tham gia plays Câu cá until there are 10 points, and Nhận pays the first tier once
// (double tap). With the clock after the event, it is gone and its rooms are refused. Needs the
// debug web build at /godot/ (npm run godot:export -- --debug) and a dev server (XOMDAO_DEV=1).

import { godotText, launch, onScene, openGodot, tap } from '../godot.mjs';
import { DESKTOP } from '../lib.mjs';

export const games = ['trung-thu'];
export { launch };

const OPEN = '2026-09-25T20:00:00+07:00';
const CLOSED = '2026-10-04T00:00:00+07:00';

/** A request through the bridge; its reply. */
async function ask(page, event, data) {
  await page.evaluate(({ event, data }) => window.xomdao.request(event, data), { event, data });
  return (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
}

const coinsOf = (page) => page.evaluate(() => window.xomdao.state().balances['core:coin'] ?? 0);
const pointsOf = async (page) =>
  Number.parseInt(await godotText(page, 'EventPoints', /^\d+ điểm$/), 10);

export default async function run(t) {
  let page = await openGodot(t, await t.page(DESKTOP));
  await onScene(page, 'lobby');
  try {
    if (!(await ask(page, 'dev:clock', { at: OPEN })).ok) throw new Error('dev:clock refused');
    page = await openGodot(t, page);
    await onScene(page, 'lobby');
    await godotText(page, 'BannerTitle', 'Sự kiện');
    await godotText(page, 'BannerTag', 'Còn 9 ngày');
    await page.screenshot({ path: t.shot('1-lobby.png') });

    await tap(page, 'Banner');
    await onScene(page, 'select');
    let points = await pointsOf(page);
    await page.screenshot({ path: t.shot('2-board.png') });
    for (let game = 0; points < 10; game++) {
      if (game >= 8) throw new Error(`Still ${points} points after 8 games`);
      await tap(page, 'JoinEvent');
      await onScene(page, 'trung-thu');
      for (let cast = 1; cast <= 5; cast++) {
        await page.waitForFunction(() => window.xomdao.click('Cast'), null, { timeout: 10_000 });
        await page.waitForFunction(
          (n) => window.xomdao.state().room?.view?.caught?.length === n,
          cast,
        );
        if (game === 0 && cast === 3) {
          await page.waitForTimeout(300);
          await page.screenshot({ path: t.shot('3-fishing.png') });
        }
      }
      await godotText(page, 'ResultTitle', /^\+\d+ điểm sự kiện$/);
      if (game === 0) await page.screenshot({ path: t.shot('4-result.png') });
      await tap(page, 'Home');
      await onScene(page, 'select');
      await page.waitForFunction((before) => {
        const text = window.xomdao.text('EventPoints') ?? '';
        return Number.parseInt(text, 10) >= before;
      }, points);
      points = await pointsOf(page);
    }

    const before = await coinsOf(page);
    const claim = await page.evaluate(() => window.xomdao.rect('Claim_0'));
    await page.mouse.click(claim.x + claim.width / 2, claim.y + claim.height / 2, {
      clickCount: 2,
    });
    await page.waitForFunction(() => window.xomdao.rect('Claimed_0')?.width > 0);
    await page.waitForTimeout(500);
    const after = await coinsOf(page);
    if (after !== before + 50) throw new Error(`Tier 0 paid ${after - before} coins, not 50`);
    await page.screenshot({ path: t.shot('5-claimed.png') });

    if (!(await ask(page, 'dev:clock', { at: CLOSED })).ok) throw new Error('dev:clock refused');
    page = await openGodot(t, page);
    await onScene(page, 'lobby');
    await godotText(page, 'BannerTitle', 'Chợ');
    const quick = await ask(page, 'room:quick', { gameId: 'trung-thu' });
    if (quick.ok || quick.error !== 'Sự kiện chưa mở hoặc đã kết thúc')
      throw new Error(`A closed event's room: ${JSON.stringify(quick)}`);
    await page.screenshot({ path: t.shot('6-closed.png') });
  } finally {
    // Back to the real time before the page closes: other scenarios share the server.
    await ask(page, 'dev:clock', { at: null }).catch(() => {});
  }
}
