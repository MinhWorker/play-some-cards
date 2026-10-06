// A complete naval battle: hidden sprites, every sinking and winner audio on desktop.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = ['battleship'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=battleship&players=2`);
  await page.waitForFunction(() => window.__phaser?.scene.isActive('battleship'));
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    s.runtime.setSpeed(4);
    window.__navalSounds = [];
    const play = s.runtime.audio.playIn.bind(s.runtime.audio);
    s.runtime.audio.playIn = (scope, name, options) => {
      window.__navalSounds.push(name);
      return play(scope, name, options);
    };
  });
  await clickCanvas(page, 'battleship', (s) => s.buttons.shuffle.container);
  await clickCanvas(page, 'battleship', (s) => s.buttons.ready.container);
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  const fleet = await page.evaluate(() =>
    window.__phaser.scene.getScene('battleship').ctx.state.waters[1].ships.map((s) => s.cells),
  );
  await clickCanvas(page, 'battleship', (s) => s.buttons.ready.container);
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();
  const hidden = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    return s.bigFleet.length === 0 && s.smallFleet.length === 5;
  });
  if (!hidden) throw new Error('An afloat enemy ship was rendered');

  for (let ship = 0; ship < fleet.length; ship++) {
    for (const cell of fleet[ship]) {
      const point = await page.evaluate((at) => {
        const s = window.__phaser.scene.getScene('battleship');
        const p = s.pointXY(at);
        return window.__toScreen('battleship', p.x, p.y);
      }, cell);
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction((at) => {
        const s = window.__phaser.scene.getScene('battleship');
        return s.ctx.state.last?.cell === at;
      }, cell);
      await page.waitForFunction(() => {
        const s = window.__phaser.scene.getScene('battleship');
        return s.runtime.inspect().lanes.every((lane) => !lane.active && lane.pending === 0);
      });
    }
    const shown = await page.evaluate(
      () => window.__phaser.scene.getScene('battleship').bigFleet.length,
    );
    if (shown !== ship + 1) throw new Error(`Expected ${ship + 1} sunk sprites, got ${shown}`);
    if (ship === 0) {
      await page.screenshot({ path: t.shot('sunk-desktop.png') });
      await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
      const spectator = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('battleship');
        return (
          s.bigFleet.length === 1 && s.smallFleet.length === 0 && s.runtime.inspect().voices === 0
        );
      });
      if (!spectator) throw new Error('Spectating revealed a fleet or replayed sound');
      await page.screenshot({ path: t.shot('spectator-desktop.png') });
      await page.getByRole('button', { name: 'Người 1', exact: true }).click();
    }
  }
  const result = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    const sounds = window.__navalSounds;
    return (
      s.ctx.state.end?.reason === 'sunk' &&
      s.ctx.state.end.winner === 0 &&
      [
        'battleship-place',
        'battleship-ready',
        'battleship-fire',
        'battleship-hit',
        'battleship-sunk',
        'battleship-win',
      ].every((name) => sounds.includes(name))
    );
  });
  if (!result) throw new Error('Battle did not finish with the expected presentation sounds');
  await page.screenshot({ path: t.shot('win-desktop.png') });
}
