// Real sandbox input, repeat turns, viewer switches and cancellation, without a server console.
import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';
export const games = ['co-ca-ngua'];
const id = 'co-ca-ngua';
const settled = (page) =>
  page.waitForFunction(() => {
    const s = window.__phaser?.scene.getScene('co-ca-ngua');
    return s?.ctx && !s.rolling && s.moving.size === 0;
  });
const ready = (page, seat) =>
  page.waitForFunction((seat) => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return (
      s.ctx.state.phase === 'roll' && s.ctx.state.turn === seat && !s.rolling && s.moving.size === 0
    );
  }, seat);
const roll = async (page) => {
  await clickCanvas(page, id, (s) => s.rollButton.container);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ca-ngua').ctx.state.dice !== null,
  );
  await settled(page);
};

export default async function run(t) {
  const page = await t.page(PHONE);
  await page.addInitScript(() => {
    const random = Math.random;
    window.__ludoDie = 6;
    Math.random = () =>
      new Error().stack?.includes('CoCaNguaGame.roll') ? (window.__ludoDie - 0.5) / 6 : random();
  });
  await page.goto(`${t.url}/?play=${id}&players=2`);
  await settled(page);
  await clickCanvas(page, id, (s) => s.rulesButton.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('co-ca-ngua').rulesPanel.visible);
  await page.screenshot({ path: t.shot('01-rules-phone.png') });
  await clickCanvas(page, id, (s) => s.rulesClose.container);
  await page.waitForFunction(
    () => !window.__phaser.scene.getScene('co-ca-ngua').rulesPanel.visible,
  );
  await roll(page);
  await page.screenshot({ path: t.shot('02-choose-phone.png') });
  await clickCanvas(page, id, (s) => s.horseButtons[0].container);
  await ready(page, 0);
  if (
    (await page.evaluate(
      () => window.__phaser.scene.getScene('co-ca-ngua').ctx.state.horses[0][0].position,
    )) !== 0
  )
    throw new Error('Six did not leave the paddock');
  await page.evaluate(() => {
    window.__ludoDie = 3;
  });
  await roll(page);
  await clickCanvas(page, id, (s) => s.horseButtons[0].container);
  await ready(page, 1);
  if (
    (await page.evaluate(
      () => window.__phaser.scene.getScene('co-ca-ngua').ctx.state.horses[0][0].position,
    )) !== 3
  )
    throw new Error('The horse did not move three squares');
  await page.screenshot({ path: t.shot('03-move-phone.png') });
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await roll(page);
  await ready(page, 0);
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();

  await page.evaluate(() => {
    window.__ludoDie = 6;
    window.__phaser.scene.getScene('co-ca-ngua').runtime.setSpeed(0.25);
  });
  await clickCanvas(page, id, (s) => s.rollButton.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('co-ca-ngua').rolling);
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
  await settled(page);
  const clean = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return (
      s.ctx.me === null &&
      s.runtime.inspect().motion === 0 &&
      s.ctx.state.horses.flat().every((h) => h.position === -1) &&
      s.rollButton.container.alpha < 1
    );
  });
  if (!clean) throw new Error('Restart or spectator mode kept old input or dice motion');
  await page.screenshot({ path: t.shot('04-spectator-phone.png') });
  const desktop = await t.page(DESKTOP);
  await desktop.goto(`${t.url}/?play=${id}&players=4`);
  await settled(desktop);
  await desktop.screenshot({ path: t.shot('05-four-players-desktop.png') });
  await desktop.setViewportSize({ width: 1024, height: 768 });
  await settled(desktop);
  const bounds = await desktop.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return (
      s.horseButtons.every(
        (b) =>
          b.container.width >= 88 &&
          b.container.height >= 88 &&
          b.container.input.hitArea.width === b.container.width,
      ) && s.rulesButton.container.y + 36 <= s.ctx.screen.height
    );
  });
  if (!bounds) throw new Error('Tablet controls are clipped or too small');
  await desktop.screenshot({ path: t.shot('06-four-players-tablet.png') });
  await desktop.evaluate(() => {
    window.__ludoRuntime = window.__phaser.scene.getScene('co-ca-ngua').runtime;
  });
  await clickCanvas(desktop, id, (s) => s.rollButton.container);
  await desktop.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
  await desktop.waitForFunction(() => window.__phaser.scene.isActive('co-ca-ngua:setup'));
  const old = await desktop.evaluate(() => window.__ludoRuntime.inspect());
  if (old.resources || old.motion || old.waits || old.voices)
    throw new Error('Leaving the board kept presentation resources');
}
