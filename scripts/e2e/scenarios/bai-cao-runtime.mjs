// Restart, resync and leave while a real game presentation is still running.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = ['bai-cao'];

export default async function run(t) {
  const id = 'bai-cao';
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=${id}&players=2`);
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), id);
  await page.evaluate((key) => window.__phaser.scene.getScene(key).runtime.setSpeed(0.25), id);
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await clickCanvas(page, id, (s) => s.buttons.bets[0].container);
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();
  await clickCanvas(page, id, (s) => s.seats[0].cards[0]);
  await page.waitForFunction(
    (key) => window.__phaser.scene.getScene(key).runtime.inspect().motion > 0,
    id,
  );
  // Changing the viewer uses the SDK's resync path and must not replay the move.
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await page.waitForFunction((key) => {
    const s = window.__phaser.scene.getScene(key);
    return s.runtime.inspect().motion === 0 && s.runtime.inspect().waits === 0;
  }, id);
  await page.screenshot({ path: t.shot('resynced.png') });

  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.waitForFunction((key) => {
    const s = window.__phaser.scene.getScene(key);
    return !s.ctx.result && s.runtime.inspect().motion === 0 && s.runtime.inspect().waits === 0;
  }, id);
  const cards = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('bai-cao');
    return s.seats.every((seat) => seat.cards.every((card) => !card.visible && card.scaleX === 1));
  });
  if (!cards) throw new Error('A cancelled flip left cards visible or folded in the next round');
  await page.screenshot({ path: t.shot('new-round.png') });
  await page.evaluate((key) => {
    window.__leavingRuntime = window.__phaser.scene.getScene(key).runtime;
  }, id);
  await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
  await page.waitForFunction((key) => window.__phaser.scene.isActive(`${key}:setup`), id);
  const old = await page.evaluate(() => window.__leavingRuntime.inspect());
  if (old.resources || old.waits || old.motion || old.voices)
    throw new Error(`${id}: leaving kept old presentation resources alive`);
}
