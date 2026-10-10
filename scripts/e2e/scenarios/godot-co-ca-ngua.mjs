// Cờ Cá Ngựa in the Godot client (#122): the sandbox (?play=co-ca-ngua) plays three computer
// players. You tap the dice and then a horse that can go for a few turns; then the Dev Console
// stages each of your horses at its home gate with the roll it needs (6, 5, 4, 3) and you tap
// them home one by one until you win and the hub's result comes. Needs the debug web build at
// /godot/ (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP } from '../lib.mjs';

export const games = ['co-ca-ngua'];
export { launch };

/** Runs a Dev Console line in the room. */
async function cmd(page, line) {
  await page.evaluate((line) => window.xomdao.request('dev:command', { line }), line);
  const reply = await (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
  if (!reply.ok) throw new Error(`Dev Console ${line}: ${reply.error}`);
}

/** Taps a node until the room's view changes as `done` says (the table may still be animating). */
async function tapUntil(page, name, done) {
  for (let i = 0; i < 20; i++) {
    await tap(page, name);
    try {
      await page.waitForFunction(done, null, { timeout: 700 });
      return;
    } catch {}
  }
  throw new Error(`${name} did nothing`);
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=co-ca-ngua');
  await onScene(page, 'co-ca-ngua', 60_000);
  const me = await page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.seats.findIndex((s) => s.id === playerId);
  });
  let turns = 0;
  for (let i = 0; i < 1200 && turns < 3; i++) {
    const v = (await room(page)).view;
    if (v.turn === me && v.phase === 'roll') {
      await tapUntil(page, 'Dice', () => window.xomdao.state().room.view.phase !== 'roll');
      if (turns === 0) await page.screenshot({ path: t.shot('1-roll.png') });
      turns++;
    } else if (v.turn === me && v.phase === 'choose') {
      const horse = await page.evaluate((seat) => {
        const s = window.xomdao.state().room.view;
        const team = s.horses[seat];
        const out = team.findIndex((h) => h.position < 0);
        if ((s.dice === 1 || s.dice === 6) && out >= 0) return out;
        return team.findIndex((h) => h.position >= 0 && !h.finished);
      }, me);
      await page.waitForTimeout(700);
      await page.screenshot({ path: t.shot('2-choose.png') });
      const moves = v.moves;
      await tapUntil(
        page,
        `Horse_${me}_${Math.max(0, horse)}`,
        new Function(`return window.xomdao.state().room.view.moves > ${moves}`),
      ).catch(() => {});
    }
    await page.waitForTimeout(150);
  }
  // Bring the four horses home with real taps on staged rolls.
  await cmd(page, 'bot pause; timer pause');
  await page.waitForTimeout(1500);
  for (const [horse, value] of [6, 5, 4, 3].entries()) {
    await cmd(
      page,
      `state set turn ${me}; state set phase "roll"; set-horse ${me} ${horse} 51; roll-dice ${value}`,
    );
    await page.waitForTimeout(900);
    await tapUntil(
      page,
      `Horse_${me}_${horse}`,
      new Function(`return window.xomdao.state().room.view.horses[${me}][${horse}].finished`),
    );
    if (horse === 2) await page.screenshot({ path: t.shot('3-home.png') });
  }
  await godotText(page, 'Status', 'Bạn thắng!');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: t.shot('4-won.png') });
  await godotText(page, 'ResultTitle', /thắng/, 30_000);
  await page.screenshot({ path: t.shot('5-result.png') });
}
