// Six seats, private peeking, public reveals, tokens and responsive table rebuilding.
import { canvasPoint, clickCanvas, PHONE } from '../lib.mjs';

export const games = ['bai-cao'];

export default async function run(t) {
  const page = await t.page(PHONE);
  await page.clock.install();
  await page.goto(`${t.url}/?play=bai-cao&players=6`);
  await page.waitForFunction(() => window.__phaser?.scene.isActive('bai-cao'));
  const sounds = await page.evaluate(async () => {
    const scene = window.__phaser.scene.getScene('bai-cao');
    return scene.runtime.audio.prepare([
      'bai-cao-chip',
      'bai-cao-deal',
      'bai-cao-peek',
      'bai-cao-reveal',
      'bai-cao-win',
      'bai-cao-lose',
      'bai-cao-ba-tay',
      'bai-cao-end',
      'bai-cao-tick',
      'music-bai-cao',
    ]);
  });
  if (sounds.some((s) => s.status !== 'ready'))
    throw new Error(`Audio did not decode: ${JSON.stringify(sounds)}`);

  for (let seat = 2; seat <= 6; seat++) {
    await page.getByRole('button', { name: `Người ${seat}`, exact: true }).click();
    await clickCanvas(page, 'bai-cao', (s) => s.buttons.bets[(s.ctx.me.seat - 1) % 3].container);
  }
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('bai-cao').ctx.state.phase === 'reveal',
  );
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();
  await page.waitForTimeout(350);
  const at = await canvasPoint(page, 'bai-cao', (s) => s.seats[0].cards[0]);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 30, at.y - 15, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bai-cao');
    return s.seats[0].cards[0].card !== null && !s.ctx.state.revealed[0];
  });
  await page.screenshot({ path: t.shot('six-phone-peek.png') });

  await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('bai-cao').ctx.me === null);
  const privateHands = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('bai-cao');
    return (
      s.ctx.state.hands.every((h) => h === null) &&
      s.seats.every((seat) => seat.cards.every((card) => card.card === null)) &&
      s.buttons.bets.every((b) => !b.container.visible) &&
      !s.buttons.reveal.container.visible
    );
  });
  if (!privateHands) throw new Error('Spectator saw private cards or player controls');
  await page.screenshot({ path: t.shot('six-phone-spectator.png') });

  for (let seat = 1; seat <= 6; seat++) {
    await page.getByRole('button', { name: `Người ${seat}`, exact: true }).click();
    await clickCanvas(page, 'bai-cao', (s) => s.buttons.reveal.container);
  }
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('bai-cao').ctx.state.phase === 'showdown',
  );
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.clock.runFor(1200);
  const count = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('bai-cao');
    return (
      s.seats.every(
        (seat) => seat.cards.every((c) => c.card !== null) && seat.hand.text && seat.delta.text,
      ) &&
      s.seats.filter((seat) => seat.chip.visible).length === 5 &&
      s.seats.filter((seat) => seat.dealer.visible).length === 1 &&
      s.ctx.state.points.reduce((a, b) => a + b, 0) === 0
    );
  });
  if (!count) throw new Error('Six-seat showdown did not show cards, counts and betting tokens');
  await page.screenshot({ path: t.shot('six-phone-showdown.png') });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.clock.runFor(250);
  await page.screenshot({ path: t.shot('six-tablet-showdown.png') });
  await page.setViewportSize({ width: 1600, height: 720 });
  await page.clock.runFor(250);
  await page.screenshot({ path: t.shot('six-desktop-showdown.png') });
}
