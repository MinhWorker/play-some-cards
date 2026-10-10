// __NAME__ in the Godot client: the sandbox (?play=__ID__), a real room against the computer,
// played to the end with the +1 / +2 / +3 buttons on a phone. Needs the debug web build at
// /godot/ (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot } from '../godot.mjs';
import { PHONE } from '../lib.mjs';

export const games = ['__ID__'];
export { launch };

const TARGET = 21;

export default async function run(t) {
  const page = await openGodot(t, await t.page(PHONE), '?play=__ID__');
  await onScene(page, '__ID__', 60_000);
  await page.screenshot({ path: t.shot('1-table.png') });

  for (let move = 0; ; move++) {
    if (move > TARGET) throw new Error('The game did not end');
    // Your turn (the total so far), or the end of the game.
    const turn = await page.waitForFunction(() => {
      const { room, playerId } = window.xomdao.state();
      if (!room?.view) return null;
      if (room.status !== 'playing') return { done: true };
      const me = room.seats.findIndex((p) => p.id === playerId);
      return room.view.turn === me ? { total: room.view.total } : null;
    });
    const { done, total } = await turn.jsonValue();
    if (done) break;
    const amount = Math.min(3, TARGET - total);
    await page.waitForFunction((n) => window.xomdao.click(`Add_${n}`), amount, {
      timeout: 10_000,
    });
    await page.waitForFunction((before) => {
      const { room } = window.xomdao.state();
      return room.status !== 'playing' || room.view.total !== before;
    }, total);
  }
  await godotText(page, 'ResultTitle', /thắng!$/);
  await page.screenshot({ path: t.shot('2-result.png') });
}
