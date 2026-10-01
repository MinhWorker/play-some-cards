import { clickCanvas, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(PHONE);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  const restart = async () => {
    const epoch = await page.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').runtime.inspect().epoch,
    );
    await page.evaluate(() => {
      const original = Math.random;
      try {
        Math.random = () => 0;
        [...document.querySelectorAll('button')].find((b) => b.textContent === 'Ván mới').click();
      } finally {
        Math.random = original;
      }
    });
    await page.waitForFunction((epoch) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.runtime.inspect().epoch > epoch &&
        s.visualPhase === 'decision' &&
        !s.runtime.busy('ready')
      );
    }, epoch);
  };
  await restart();
  const baseline = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const play = s.runtime.audio.playIn;
    s.drawSounds = [];
    s.runtime.audio.playIn = function (scope, name, ...args) {
      if (name === 'tycoon-card' || name === 'tycoon-card-flip') s.drawSounds.push(name);
      return play.call(this, scope, name, ...args);
    };
    return s.children.list.filter((object) => object.type === 'Container').length;
  });
  const draw = async (deck, dice) => {
    await page.evaluate((dice) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      const original = Math.random;
      let index = 0;
      try {
        Math.random = () => (dice[index++] - 0.5) / 6;
        s.main[0].action();
      } finally {
        Math.random = original;
      }
    }, dice);
    await page.waitForFunction(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'result',
    );
    if (
      await page.evaluate(
        () =>
          window.__phaser.scene.getScene('co-ty-phu-classic').ctx.timer?.event !== 'prepare-event',
      )
    )
      throw new Error('Countdown began before the card draw');
    await page.waitForFunction((deck) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return s.visualPhase === 'drawing' && s.eventDeck.active === deck;
    }, deck);
    const hidden = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        !s.notice.text &&
        s.main.every((b) => !b.hit.visible) &&
        s.ctx.state.players[0].cash === 1500
      );
    });
    if (!hidden) throw new Error(`${deck} announced or applied its card before the draw`);
  };
  await draw('chest', [1, 1]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: t.shot('chest-draw.png') });
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.visualPhase === 'decision' &&
      s.main[0].hit.visible &&
      s.ctx.timer?.event === 'auto-confirm-event'
    );
  });
  const sounds = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').drawSounds,
  );
  if (sounds.join(',') !== 'tycoon-card,tycoon-card-flip')
    throw new Error(`Draw sounds: ${sounds}`);
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.players[0].cash === 1700,
  );
  await restart();
  await draw('chance', [1, 6]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: t.shot('chance-draw.png') });
  // Restart during the scoped draw: discard its card, tween, sound and old event timer.
  await restart();
  const clean = await page.evaluate((baseline) => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const runtime = s.runtime.inspect();
    return (
      s.eventDeck.active === null &&
      runtime.motion === 0 &&
      !s.runtime.busy('turn') &&
      s.ctx.state.specialEvent === null &&
      s.ctx.timer === null &&
      s.children.list.filter((object) => object.type === 'Container').length === baseline
    );
  }, baseline);
  if (!clean) throw new Error('A cancelled card draw survived the new round');
  await page.screenshot({ path: t.shot('cancelled-draw.png') });
  await draw('chance', [1, 6]);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.visualPhase === 'decision' && s.main[0].hit.visible && s.notice.text.includes('Ga gần nhất')
    );
  });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.ctx.state.pending === 15 && s.visualPhase === 'decision' && !s.runtime.busy('turn');
  });
  await page.screenshot({ path: t.shot('chance-resolved.png') });
}
