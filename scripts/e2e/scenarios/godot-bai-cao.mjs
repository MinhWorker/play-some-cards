// Bài Cào in the Godot client (#121): the sandbox (?play=bai-cao) plays a 5-round game against
// three computer players. Each round you bet (unless you are the dealer), open one card with a
// tap, squeeze another open by dragging it up, then Lật bài; the count shows at the seats and
// the hub's result comes at the end. Needs the debug web build at /godot/
// (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP } from '../lib.mjs';

export const games = ['bai-cao'];
export { launch };

/** Drags a card up by most of its height: the back slides off and the card stays open. */
async function squeeze(page, name) {
  const r = await (
    await page.waitForFunction((n) => window.xomdao.rect(n), name, { timeout: 10_000 })
  ).jsonValue();
  const x = r.x + r.width / 2;
  const y = r.y + r.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y - (r.height * 0.8 * i) / 8);
  await page.mouse.up();
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=bai-cao');
  await onScene(page, 'bai-cao', 60_000);
  const me = await page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.seats.findIndex((s) => s.id === playerId);
  });
  const done = new Set();
  for (let i = 0; i < 600; i++) {
    const r = await room(page);
    if (r.status === 'finished') break;
    const v = r.view;
    const key = `${v.round}:${v.phase}`;
    if (v.phase === 'bet' && v.dealer !== me && v.bets[me] === null && !done.has(key)) {
      done.add(key);
      await tap(page, 'Bet_10');
      if (!done.has('bet-shot')) {
        done.add('bet-shot');
        await page.waitForTimeout(400);
        await page.screenshot({ path: t.shot('1-bet.png') });
      }
    } else if (v.phase === 'reveal' && !v.revealed[me] && !done.has(key)) {
      done.add(key);
      // Wait for the deal on screen.
      await page.waitForTimeout(1200);
      await tap(page, 'Mine_0');
      await squeeze(page, 'Mine_1');
      await godotText(page, 'Status', 'Đã nặn 2/3');
      if (!done.has('peek-shot')) {
        done.add('peek-shot');
        await page.screenshot({ path: t.shot('2-peeked.png') });
      }
      await tap(page, 'Reveal');
    } else if (v.phase === 'showdown' && v.results && !done.has('count-shot')) {
      done.add('count-shot');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: t.shot('3-count.png') });
    }
    await page.waitForTimeout(250);
  }
  await godotText(page, 'ResultTitle', /thắng|Hoà/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
