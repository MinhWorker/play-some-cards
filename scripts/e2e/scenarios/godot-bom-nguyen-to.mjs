// Bom Nguyên Tố in the Godot client (#123): the sandbox (?play=bom-nguyen-to) puts you against one
// easy computer player. You pick a friend and get ready, hold the D-pad to walk, drop a bomb and
// watch it blow, use the skill and the dash; then the Dev Console knocks the computer out and the
// hub's result comes. Needs the debug web build (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';

export const games = ['bom-nguyen-to'];
export { launch };

/** Runs a Dev Console line in the room. */
async function cmd(page, line) {
  await page.evaluate((line) => window.xomdao.request('dev:command', { line }), line);
  const reply = await (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
  if (!reply.ok) throw new Error(`Dev Console ${line}: ${reply.error}`);
}

/** Your fighter in the latest snapshot. */
const mine = (page) =>
  page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.view.fighters.find((f) => f.id === playerId);
  });

/** Holds the D-pad's key towards `dir` with the mouse for `ms`. */
async function hold(page, dir, ms) {
  const pad = await page.evaluate(() => window.xomdao.rect('Pad'));
  const reach = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const x = pad.x + pad.width / 2 + reach[0] * pad.width * 0.3;
  const y = pad.y + pad.height / 2 + reach[1] * pad.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=bom-nguyen-to');
  await onScene(page, 'bom-nguyen-to', 60_000);
  await godotText(page, 'Status', 'Chọn bạn nhỏ');
  await tap(page, 'Pick_water');
  await page.waitForFunction(() => {
    const { room, playerId } = window.xomdao.state();
    return room.view.fighters.find((f) => f.id === playerId)?.element === 'water';
  });
  await page.screenshot({ path: t.shot('1-select.png') });
  await tap(page, 'Ready');
  await page.waitForFunction(() => window.xomdao.state().room.view.phase === 'playing');
  await page.waitForTimeout(800);
  // Walk: the spawn corner (1, 1) is open to the right and down.
  const start = await mine(page);
  await hold(page, 'right', 700);
  await hold(page, 'down', 500);
  await page.waitForTimeout(400);
  const moved = await mine(page);
  if (Math.abs(moved.x - start.x) + Math.abs(moved.y - start.y) < 0.5) {
    throw new Error(`the D-pad did not walk: ${JSON.stringify([start, moved])}`);
  }
  await page.screenshot({ path: t.shot('2-walk.png') });
  await tap(page, 'Bomb');
  await page.waitForFunction(() => window.xomdao.state().room.view.bombs.length > 0);
  await hold(page, 'up', 600);
  await hold(page, 'left', 600);
  await page.screenshot({ path: t.shot('3-bomb.png') });
  await page.waitForFunction(() => window.xomdao.state().room.view.blasts.length > 0, null, {
    timeout: 10_000,
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: t.shot('4-blast.png') });
  await tap(page, 'Skill');
  await page.waitForFunction(() => {
    const { room, playerId } = window.xomdao.state();
    return room.view.fighters.find((f) => f.id === playerId).skillReady > 0;
  });
  await tap(page, 'Dash');
  await page.waitForFunction(() => {
    const { room, playerId } = window.xomdao.state();
    return room.view.fighters.find((f) => f.id === playerId).dashReady > 0;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('5-skill.png') });
  // Knock the computer out: the last one standing wins.
  const view = (await room(page)).view;
  const me = await mine(page);
  const other = view.fighters.findIndex((f) => f.id !== me.id);
  await cmd(page, `state set fighters.${other}.hp 0`);
  await godotText(page, 'ResultTitle', /thắng/, 30_000);
  await page.screenshot({ path: t.shot('6-result.png') });
}
