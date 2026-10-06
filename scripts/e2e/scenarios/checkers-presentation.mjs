// A three-hop capture crowns the last piece, then the result waits for the animation.
// Reopening the result, reconnecting and disabling effects keep the authoritative board.
import { clickCanvas, cmd, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['checkers'];

async function tapSquare(page, sq) {
  const at = await page.evaluate((sq) => {
    const s = window.__phaser.scene.getScene('checkers');
    const { x, y } = s.pointXY(sq);
    return window.__toScreen('checkers', x, y);
  }, sq);
  await page.mouse.click(at.x, at.y);
}

const idle = (page) =>
  page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('checkers');
    return !s.runtime.inspect().motion && !s.runtime.inspect().waits;
  });

async function position(page) {
  const cells = Array(64).fill('.');
  cells[49] = 'b';
  for (const sq of [42, 28, 14]) cells[sq] = 'w';
  await cmd(
    page,
    `bot pause; state set board "${cells.join('')}"; state set turn "b"; state set last null`,
  );
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').pieces.size === 4);
}

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await signUp(t, page, 'Dam');
  await openRooms(page, 'checkers');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'checkers:setup', (s) => s.rows[0].chips[1].container);
  await clickCanvas(page, 'checkers:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers')?.pieces?.size === 24);
  await position(page);
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('checkers');
    s.runtime.setSpeed(0.25);
    window.__checkersSounds = [];
    const audio = s.runtime.audio;
    const play = audio.playIn.bind(audio);
    audio.playIn = (scope, name, options) => {
      const voice = play(scope, name, options);
      const record = { name };
      window.__checkersSounds.push(record);
      voice.started.then((result) => {
        record.started = result.status;
      });
      voice.finished.then((result) => {
        record.finished = result.status;
      });
      return voice;
    };
  });
  for (const sq of [49, 35, 21, 7]) await tapSquare(page, sq);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('checkers');
    return s.ctx.state.end && s.runtime.inspect().motion > 0;
  });
  if (await page.evaluate(() => window.__phaser.scene.getScene('checkers').panel.shown))
    throw new Error('Result covered the capture before it finished');
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').panel.shown);
  await idle(page);
  const crowned = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('checkers');
    return (
      s.pieces.size === 1 &&
      s.pieces.get(7)?.image.texture.key === 'checkers/piece-black-king' &&
      s.ctx.state.taken.b === 3 &&
      s.leaving.size === 0
    );
  });
  if (!crowned) throw new Error('Capture/crown presentation differs from the final board');
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('checkers').runtime.audio.count === 0,
  );
  const sound = await page.evaluate(() =>
    window.__checkersSounds.filter((r) =>
      ['checkers-capture', 'checkers-promote', 'checkers-win'].includes(r.name),
    ),
  );
  if (sound.length !== 5 || sound.some((r) => r.started !== 'started' || r.finished !== 'ended'))
    throw new Error(
      `Capture/crown/result audio was missing or cut short: ${JSON.stringify(sound)}`,
    );
  await page.screenshot({ path: t.shot('capture-crown-result.png') });
  await clickCanvas(page, 'checkers', (s) => s.panel.close.container);
  await page.waitForFunction(() => !window.__phaser.scene.getScene('checkers').panel.shown);
  await clickCanvas(page, 'checkers', (s) => s.buttons.result.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').panel.shown);
  await page.reload();
  await page.waitForFunction(() => window.__phaser?.scene.getScene('checkers')?.panel?.shown);
  await idle(page);
  await page.screenshot({ path: t.shot('reconnected-result.png') });
  await page.getByRole('button', { name: 'Chơi ván mới' }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').pieces.size === 24);
  await clickCanvas(page, 'checkers', (s) => s.buttons.effects.container);
  await position(page);
  for (const sq of [49, 35, 21, 7]) await tapSquare(page, sq);
  await page.waitForFunction(() => window.__phaser.scene.getScene('checkers').panel.shown);
  const quiet = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('checkers');
    return (
      !s.effects &&
      !s.runtime.inspect().motion &&
      s.pieces.get(7)?.image.texture.key === 'checkers/piece-black-king'
    );
  });
  if (!quiet) throw new Error('Effects off still animated or failed to crown');
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('mobile-result.png') });
}
