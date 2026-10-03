// Migrated presentations through real sandbox controls, including cancellation during deals.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = [
  'counter',
  'co-ca-ngua',
  'tic-tac-toe',
  'xiangqi',
  'tien-len',
  'mau-binh',
  'co-ty-phu-classic',
];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  page.setDefaultTimeout(60000);
  const open = async (id) => {
    await page.goto(`${t.url}/?play=${id}&players=2`);
    await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), id);
    await page.evaluate((key) => window.__phaser.scene.getScene(key).runtime.setSpeed(4), id);
  };
  const restart = async (id) => {
    const before = await page.evaluate((key) => {
      const s = window.__phaser.scene.getScene(key);
      window.__sandboxCancelled = s.runtime.run(async (fx) => {
        await fx.wait(60000);
      });
      return s.registry.get('board').round;
    }, id);
    await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
    await page.waitForFunction(
      ({ key, before }) => window.__phaser.scene.getScene(key).registry.get('board').round > before,
      { key: id, before },
    );
    const result = await page.evaluate(async () => (await window.__sandboxCancelled.done).status);
    if (result !== 'cancelled') throw new Error(`${id}: new round kept the old flow`);
  };
  for (const id of ['counter', 'co-ca-ngua']) {
    await open(id);
    await clickCanvas(page, id, (s) => s.buttons[0].container);
    await page.waitForFunction((key) => {
      const s = window.__phaser.scene.getScene(key);
      return (s.ctx.state.count ?? s.ctx.state.total) > 0;
    }, id);
    await restart(id);
    await page.screenshot({ path: t.shot(`${id}-new-round.png`) });
  }

  await open('tic-tac-toe');
  await clickCanvas(page, 'tic-tac-toe', (s) => s.tiles.get('0,0'));
  await restart('tic-tac-toe');
  await page.screenshot({ path: t.shot('caro-new-round.png') });

  await open('xiangqi');
  const squares = await page.evaluate(() =>
    window.__phaser.scene
      .getScene('xiangqi')
      .ctx.state.board.flatMap((p, sq) => (p && 'PCRNBAK'.includes(p) ? [sq] : [])),
  );
  let moved = false;
  for (const sq of squares) {
    const at = await page.evaluate((sq) => {
      const s = window.__phaser.scene.getScene('xiangqi');
      const p = s.pointXY(sq);
      return window.__toScreen('xiangqi', p.x, p.y);
    }, sq);
    await page.mouse.click(at.x, at.y);
    const target = await page.evaluate(() => window.__phaser.scene.getScene('xiangqi').targets[0]);
    if (target === undefined) continue;
    const to = await page.evaluate((sq) => {
      const s = window.__phaser.scene.getScene('xiangqi');
      const p = s.pointXY(sq);
      return window.__toScreen('xiangqi', p.x, p.y);
    }, target);
    await page.mouse.click(to.x, to.y);
    moved = true;
    break;
  }
  if (!moved) throw new Error('Sandbox Xiangqi found no legal move');
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi').ctx.state.plies === 1);
  await restart('xiangqi');
  await page.screenshot({ path: t.shot('xiangqi-new-round.png') });
  await clickCanvas(page, 'xiangqi', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'xiangqi', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi').ctx.state.end);
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi').panel.shown);
  await page.screenshot({ path: t.shot('xiangqi-resize-result.png') });
  await page.setViewportSize(DESKTOP);

  for (const id of ['tien-len', 'mau-binh']) {
    await open(id);
    if (id === 'mau-binh') {
      // Keep the reveal round available even if rendering lags behind server timers.
      await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
      await clickCanvas(
        page,
        'mau-binh:setup',
        (s) => s.rows.find((row) => row.row.key === 'rounds').chips[0].container,
      );
      await clickCanvas(page, 'mau-binh:setup', (s) => s.submitButton.container);
      await page.waitForFunction(() => window.__phaser.scene.isActive('mau-binh'));
      await page.evaluate(() => window.__phaser.scene.getScene('mau-binh').runtime.setSpeed(4));
    }
    await restart(id); // cancel an actual deal and its temporary deck/parallel card flights.
    await page.waitForFunction((key) => !window.__phaser.scene.getScene(key).dealing, id, {
      timeout: 60000,
    });
    const hand = await page.evaluate((key) => {
      const s = window.__phaser.scene.getScene(key);
      if (key === 'tien-len')
        return {
          cards: [...s.hand.keys()].sort((a, b) => a - b),
          expected: [...s.ctx.state.hand].sort((a, b) => a - b),
        };
      return { count: s.blocks[0].cards.length };
    }, id);
    // The turn clock may already have played a card while headless renders the deal.
    if (
      id === 'tien-len'
        ? JSON.stringify(hand.cards) !== JSON.stringify(hand.expected)
        : hand.count !== 13
    )
      throw new Error(
        `${id}: cancelled deal did not restore the current hand (${JSON.stringify(hand)})`,
      );
    await page.screenshot({ path: t.shot(`${id}-dealt.png`) });
    if (id === 'mau-binh') {
      await page.waitForFunction(
        () => window.__phaser.scene.getScene('mau-binh').ctx.state.phase === 'arrange',
      );
      for (let seat = 1; seat <= 2; seat++) {
        await page.getByRole('button', { name: `Người ${seat}`, exact: true }).click();
        await clickCanvas(page, id, (s) => s.autoButton.container);
        await clickCanvas(page, id, (s) => s.doneButton.container);
      }
      await page.waitForFunction(
        () => window.__phaser.scene.getScene('mau-binh').ctx.state.phase === 'show',
      );
      await page.waitForFunction(
        () => {
          const s = window.__phaser.scene.getScene('mau-binh');
          return !s.runtime.busy('reveal') && s.board.visible;
        },
        null,
        { timeout: 60000 },
      );
      await page.screenshot({ path: t.shot('mau-binh-revealed.png') });
    }
    await restart(id);
    await page.evaluate((key) => {
      window.__oldSandboxRuntime = window.__phaser.scene.getScene(key).runtime;
    }, id);
    await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
    await page.waitForFunction((key) => window.__phaser.scene.isActive(`${key}:setup`), id);
    const old = await page.evaluate(() => window.__oldSandboxRuntime.inspect());
    if (old.resources || old.waits || old.motion || old.voices)
      throw new Error(`${id}: setup left presentation resources alive`);
    await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
    await page.waitForFunction((key) => window.__phaser.scene.isActive(key), id);
  }

  await open('co-ty-phu-classic');
  // Test presentation cancellation before the PvP AFK clock can start a different action.
  await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.clockChoices[3].container);
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await page.waitForFunction(() => window.__phaser.scene.isActive('co-ty-phu-classic'));
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.playbackSpeed = 2;
    s.runtime.setSpeed(2);
  });
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'decision' && s.diceHit.visible;
  });
  // The dice themselves are the roll control.
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.diceHit);
  await page.waitForFunction(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').runtime.busy('turn'),
  );
  await restart('co-ty-phu-classic');
  await page.screenshot({ path: t.shot('tycoon-new-round.png') });
}
