// Tiến Lên in the Godot client (#118): the sandbox (?play=tien-len) deals a 3-round match against
// three computer players. Each round is dealt, you play your lowest card when you may (tapping it
// in the hand, then Đánh) or pass; the round's ranking shows between rounds and the hub's result
// at the end. Needs the debug web build (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, room } from '../godot.mjs';

export const games = ['tien-len'];
export { launch };

/** The hand's cards with where to tap each (its visible left strip) and whether it is picked. */
function handOf(page, cards) {
  return page.evaluate((cards) => {
    const rects = cards.map((card) => ({ card, r: window.xomdao.rect(`Card_${card}`) }));
    const shown = rects.filter((c) => c.r);
    const low = Math.max(...shown.map((c) => c.r.y));
    return shown.map(({ card, r }) => ({
      card,
      x: r.x + Math.min(8, r.width / 4),
      y: r.y + r.height * 0.3,
      picked: r.y < low - r.height * 0.1,
    }));
  }, cards);
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=tien-len');
  await onScene(page, 'tien-len', 60_000);
  await page.waitForFunction(() => window.xomdao.state().room?.view?.hand?.length === 13);
  const me = await page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.seats.findIndex((s) => s.id === playerId);
  });
  const shots = new Set();
  let progress = { key: '', at: Date.now() };
  for (let i = 0; i < 800; i++) {
    const r = await room(page);
    if (r.status === 'finished') break;
    const v = r.view;
    const key = JSON.stringify([v.round, v.phase, v.turn, v.played.length]);
    if (key !== progress.key) progress = { key, at: Date.now() };
    else if (Date.now() - progress.at > 30_000) {
      await page.screenshot({ path: t.shot('stalled.png') });
      throw new Error(`Tiến Lên stalled for 30 s: ${key}`);
    }
    if (v.phase === 'deal' && !shots.has('dealt')) {
      shots.add('dealt');
      await page.waitForTimeout(3500);
      await page.screenshot({ path: t.shot('1-dealt.png') });
    }
    if (v.played.length >= 6 && !shots.has('pile')) {
      shots.add('pile');
      await page.screenshot({ path: t.shot('2-pile.png') });
    }
    if (v.phase === 'over' && !shots.has('round')) {
      shots.add('round');
      await page.waitForFunction(() => window.xomdao.rect('RoundBoard')?.width > 0, null, {
        timeout: 5000,
      });
      await page.screenshot({ path: t.shot('3-round-over.png') });
    }
    if (v.phase === 'play' && v.turn === me) {
      // The hand must be still (dealt, or done sliding) before its cards are tapped.
      let hand = await handOf(page, v.hand);
      for (;;) {
        await page.waitForTimeout(250);
        const again = await handOf(page, v.hand);
        if (JSON.stringify(again) === JSON.stringify(hand)) break;
        hand = again;
      }
      const top = v.table ? Math.max(...v.table.cards) : -1;
      const pick =
        v.mustPlay !== null
          ? hand.find((h) => h.card === v.mustPlay)
          : !v.table
            ? hand[0]
            : v.table.cards.length === 1
              ? hand.find((h) => h.card > top)
              : null;
      for (const h of hand) {
        if (h.picked !== (h.card === pick?.card)) await page.mouse.click(h.x, h.y);
      }
      // The buttons are pressed through the bridge once they are enabled (it refuses before).
      const button = pick ? 'PlayCards' : 'Pass';
      await page.waitForFunction((b) => window.xomdao.click(b), button, { timeout: 10_000 });
      await page
        .waitForFunction(
          (seat) => {
            const { view } = window.xomdao.state().room;
            return view.phase !== 'play' || view.turn !== seat;
          },
          me,
          { timeout: 5000 },
        )
        .catch(() => {});
      continue;
    }
    await page
      .waitForFunction(
        ({ seat, key }) => {
          const r = window.xomdao.state().room;
          const v = r.view;
          return (
            r.status === 'finished' ||
            JSON.stringify([v.round, v.phase, v.turn, v.played.length]) !== key ||
            (v.phase === 'play' && v.turn === seat)
          );
        },
        { seat: me, key },
        { timeout: 5000, polling: 100 },
      )
      .catch(() => {});
  }
  for (const shot of ['dealt', 'pile', 'round'])
    if (!shots.has(shot)) throw new Error(`Never saw the ${shot} screen`);
  await godotText(page, 'ResultTitle', /thắng!$/);
  await page.screenshot({ path: t.shot('4-result.png') });
}
