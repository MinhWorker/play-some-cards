// Verify a game's optional background through the real board/setup lifecycle.
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=co-ty-phu-classic&players=4`);
  const board = 'co-ty-phu-classic';
  const background = `${board}:background`;
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), board);
  const initial = await page.evaluate((key) => {
    const game = window.__phaser;
    const scene = game.scene.getScene(key);
    window.__backgroundProbe = {
      cloud: scene.clouds[0].shape,
      runtime: scene.runtime,
      skyX: game.scene.getScene('sky').clouds[0].img.x,
      elapsed: scene.elapsed,
      light: scene.windowLights[0].alpha,
    };
    return {
      active: scene.sys.isActive(),
      skySleeping: game.scene.isSleeping('sky'),
      input: scene.input.enabled,
      behindBoard: game.scene.getScenes(true)[0] === scene,
    };
  }, background);
  if (!initial.active || !initial.skySleeping || initial.input || !initial.behindBoard)
    throw new Error(`Background did not replace sky behind board: ${JSON.stringify(initial)}`);

  await page.waitForFunction((key) => {
    const scene = window.__phaser.scene.getScene(key);
    return scene.elapsed > window.__backgroundProbe.elapsed + 0.6;
  }, background);
  const animated = await page.evaluate((key) => {
    const scene = window.__phaser.scene.getScene(key);
    return (
      scene.windowLights[0].alpha !== window.__backgroundProbe.light &&
      window.__phaser.scene.getScene('sky').clouds[0].img.x === window.__backgroundProbe.skyX
    );
  }, background);
  if (!animated) throw new Error('City lights did not animate, or sleeping sky kept updating');
  await page.screenshot({ path: t.shot('city-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('city-phone.png') });

  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.me === null,
  );
  const preserved = await page.evaluate((key) => {
    const scene = window.__phaser.scene.getScene(key);
    return (
      scene.runtime === window.__backgroundProbe.runtime &&
      scene.clouds[0].shape === window.__backgroundProbe.cloud
    );
  }, background);
  if (!preserved) throw new Error('New round/resync restarted background');

  // Setup restores the sky; reopening the board recreates background resources without leaks.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
    await page.waitForFunction((key) => window.__phaser.scene.isActive(`${key}:setup`), board);
    const stopped = await page.evaluate(
      (key) =>
        !window.__phaser.scene.isActive(key) &&
        window.__phaser.scene.isActive('sky') &&
        window.__phaser.scene.getScene(key).children.length === 0,
      background,
    );
    if (!stopped) throw new Error('Background leaked objects or sky was not restored in setup');
    if (i === 0) await page.screenshot({ path: t.shot('setup-sky.png') });
    await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
    await page.waitForFunction((key) => window.__phaser.scene.isActive(key), board);
    const restarted = await page.evaluate((key) => {
      const scene = window.__phaser.scene.getScene(key);
      return (
        scene.sys.isActive() &&
        window.__phaser.scene.isSleeping('sky') &&
        scene.clouds.length === 5 &&
        scene.windowLights.length === 4 &&
        scene.runtime !== window.__backgroundProbe.runtime &&
        scene.clouds[0].shape !== window.__backgroundProbe.cloud
      );
    }, background);
    if (!restarted) throw new Error('Board reopening did not create a clean background');
  }
}
