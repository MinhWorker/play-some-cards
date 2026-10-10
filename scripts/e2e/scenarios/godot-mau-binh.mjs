// Mậu Binh in the Godot client (#121): the sandbox (?play=mau-binh) plays a 3-round game against
// three computer players. Each round you swap two cards, undo, let Tự xếp arrange and press Xong;
// the reveal shows chi by chi at every seat and the hub's result comes at the end. Needs the
// debug web build at /godot/ (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP } from '../lib.mjs';

export const games = ['mau-binh'];
export { launch };

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=mau-binh');
  await onScene(page, 'mau-binh', 60_000);
  const done = new Set();
  for (let i = 0; i < 800; i++) {
    const r = await room(page);
    if (r.status === 'finished') break;
    const v = r.view;
    const key = `${v.round}:${v.phase}`;
    if (v.phase === 'arrange' && v.mine === null && !done.has(key)) {
      done.add(key);
      await page.waitForTimeout(600);
      if (!done.has('swap')) {
        done.add('swap');
        await tap(page, 'Mine_0');
        await tap(page, 'Mine_12');
        await page.screenshot({ path: t.shot('1-arrange.png') });
        await tap(page, 'Undo');
      }
      await tap(page, 'Auto');
      await godotText(page, 'Status', 'Đang xếp');
      await tap(page, 'Done');
      await page.waitForFunction(
        () => {
          const v = window.xomdao.state().room?.view;
          return v && (v.mine !== null || v.phase !== 'arrange');
        },
        null,
        { timeout: 10_000 },
      );
    } else if (v.phase === 'show' && !done.has('reveal-shot')) {
      done.add('reveal-shot');
      await godotText(page, 'Info', 'Chi 2', 15_000);
      await page.screenshot({ path: t.shot('2-chi.png') });
      await godotText(page, 'Info', /Vòng sau|Tổng kết/, 15_000);
      await page.screenshot({ path: t.shot('3-totals.png') });
    }
    await page.waitForTimeout(250);
  }
  await godotText(page, 'ResultTitle', /thắng|Hoà/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
