// Bắn Tàu in the Godot client (#122): the sandbox (?play=battleship) plays the computer (easy).
// You drag a ship to a new place, turn another with two taps, press Sẵn sàng, then fire cell by
// cell on your turns until a fleet is sunk and the hub's result comes. Needs the debug web build
// at /godot/ (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP } from '../lib.mjs';

export const games = ['battleship'];
export { launch };

/** The middle of a cell of the big sea, on the page. */
async function cellPoint(page, cell) {
  const r = await (
    await page.waitForFunction(() => window.xomdao.rect('Big'), null, { timeout: 10_000 })
  ).jsonValue();
  const side = r.width / 10;
  return { x: r.x + ((cell % 10) + 0.5) * side, y: r.y + (Math.floor(cell / 10) + 0.5) * side };
}

async function tapCell(page, cell) {
  const p = await cellPoint(page, cell);
  await page.mouse.click(p.x, p.y);
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=battleship');
  await onScene(page, 'battleship', 60_000);
  await godotText(page, 'Status', 'Xếp tàu');
  const seat = async () => {
    const r = await room(page);
    return r.view.players.indexOf(r.players.find((p) => !p.bot)?.id);
  };
  const me = await seat();
  const fleet = async () => (await room(page)).view.waters[me].ships.map((s) => s.cells);
  // Turn the destroyer: tap it twice; the server gets the new fleet.
  const before = await fleet();
  const small = before.findIndex((cells) => cells.length === 2);
  await tapCell(page, before[small][0]);
  await tapCell(page, before[small][0]);
  await page.waitForTimeout(600);
  const turned = await fleet();
  // Drag the carrier by its first cell to the top-left corner (it may not fit: then it stays).
  const carrier = turned.findIndex((cells) => cells.length === 5);
  const from = await cellPoint(page, turned[carrier][0]);
  const to = await cellPoint(page, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  }
  await page.screenshot({ path: t.shot('1-drag.png') });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: t.shot('2-arranged.png') });
  await tap(page, 'Ready');
  await godotText(page, 'Status', /Lượt/);
  let shots = 0;
  for (let i = 0; i < 2000; i++) {
    const r = await room(page);
    if (r.status === 'finished') break;
    const v = r.view;
    if (v.phase === 'battle' && v.turn === me && !v.end) {
      const fired = new Set(v.waters[1 - me].shots.map((s) => s.cell));
      const next = [...Array(100).keys()].find((c) => !fired.has(c));
      await tapCell(page, next);
      shots++;
      if (shots === 12) await page.screenshot({ path: t.shot('3-battle.png') });
      await page.waitForFunction(
        (n) => window.xomdao.state().room?.view?.waters?.some((w) => w.shots.length >= n),
        fired.size + 1,
        { timeout: 10_000 },
      );
    }
    await page.waitForTimeout(120);
  }
  await godotText(page, 'ResultTitle', /thắng|Hoà|thua/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
