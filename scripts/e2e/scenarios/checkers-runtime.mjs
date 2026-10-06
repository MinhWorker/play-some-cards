// Restart, resync and leave while a real game presentation is still running.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = ['checkers'];

export default async function run(t) {
  const id = 'checkers';
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=${id}&players=2`);
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), id);
  await page.evaluate((key) => window.__phaser.scene.getScene(key).runtime.setSpeed(0.25), id);
  const path = await page.evaluate((key) => {
    const s = window.__phaser.scene.getScene(key);
    return s.moves[0].path;
  }, id);
  for (const sq of path) {
    const at = await page.evaluate(
      ({ key, sq }) => {
        const s = window.__phaser.scene.getScene(key);
        const { x, y } = s.pointXY(sq);
        return window.__toScreen(key, x, y);
      },
      { key: id, sq },
    );
    await page.mouse.click(at.x, at.y);
  }
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
  await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('checkers');
    return (
      s.ctx.me === null && s.moves.length === 0 && !s.grid.flip && s.runtime.inspect().motion === 0
    );
  });
  await page.screenshot({ path: t.shot('spectator.png') });
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').grid.flip);
  await clickCanvas(page, id, (s) => s.buttons.resign.container);
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.waitForFunction((key) => {
    const s = window.__phaser.scene.getScene(key);
    return !s.ctx.result && s.runtime.inspect().motion === 0 && s.runtime.inspect().waits === 0;
  }, id);
  const clean = await page.evaluate((key) => {
    const s = window.__phaser.scene.getScene(key);
    const objects = key === 'go' ? s.stones : s.pieces;
    const expected = key === 'go' ? 0 : key === 'chess' ? 32 : 24;
    return (
      !s.resignArmed &&
      objects.size === expected &&
      [...objects.values()].every((obj) => {
        const image = obj.image ?? obj.look;
        return image.alpha === 1;
      })
    );
  }, id);
  if (!clean) throw new Error(`${id}: a cancelled move or surrender survived the new round`);
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
