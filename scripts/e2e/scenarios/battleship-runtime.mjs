// Restart, resync and leave while a real game presentation is still running.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = ['battleship'];

export default async function run(t) {
  const id = 'battleship';
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=${id}&players=2`);
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), id);
  await page.evaluate((key) => window.__phaser.scene.getScene(key).runtime.setSpeed(0.25), id);
  await clickCanvas(page, id, (s) => s.buttons.ready.container);
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await clickCanvas(page, id, (s) => s.buttons.ready.container);
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();
  const at = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    return window.__toScreen(
      'battleship',
      s.bigSea.x0 + s.bigSea.cell / 2,
      s.bigSea.y0 + s.bigSea.cell / 2,
    );
  });
  await page.mouse.click(at.x, at.y);
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
  await clickCanvas(page, id, (s) => s.buttons.resign.container);
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.waitForFunction((key) => {
    const s = window.__phaser.scene.getScene(key);
    return !s.ctx.result && s.runtime.inspect().motion === 0 && s.runtime.inspect().waits === 0;
  }, id);
  const clean = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    return (
      !s.resignArmed &&
      !s.children.list.some((o) => o.type === 'Arc') &&
      s.ctx.state.phase === 'setup'
    );
  });
  if (!clean) throw new Error('A cancelled shot or surrender survived the new round');
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
