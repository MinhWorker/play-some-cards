// A real server room: play with three bots, then verify replay and a clean restart.
import { clickCanvas, cmd, openRooms, PHONE, signUp } from '../lib.mjs';
export const games = ['co-ca-ngua'];

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp(t, page, 'Ngoc');
  await openRooms(page, 'co-ca-ngua');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'co-ca-ngua:setup', (s) => s.buttons[3].container);
  await page.screenshot({ path: t.shot('01-setup.png') });
  await clickCanvas(page, 'co-ca-ngua:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ca-ngua')?.ctx?.players.length === 4,
  );
  await cmd(page, 'roll-dice 1');
  await page.waitForFunction(() => !window.__phaser.scene.getScene('co-ca-ngua').rolling);
  await clickCanvas(page, 'co-ca-ngua', (s) => s.horseButtons[0].container);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return s.ctx.state.horses[0][0].position === 0 && s.ctx.state.lastRoll.seat > 0;
  });
  await page.screenshot({ path: t.shot('02-bot-playing.png') });
  await page.waitForFunction(
    () =>
      window.__phaser.scene.getScene('co-ca-ngua').ctx.state.turn === 0 &&
      window.__phaser.scene.getScene('co-ca-ngua').ctx.state.phase === 'roll',
    null,
    { timeout: 30_000 },
  );
  await page.reload();
  await page.waitForFunction(() => {
    const s = window.__phaser?.scene.getScene('co-ca-ngua');
    return s?.ctx?.me?.seat === 0 && s.ctx.state.horses[0][0].position === 0;
  });
  await page.screenshot({ path: t.shot('03-reconnected.png') });
  // Stage the home gates through server-only dev commands, then finish with real taps.
  await cmd(page, 'bot pause; timer pause');
  for (const [horse, value] of [6, 5, 4, 3].entries()) {
    await cmd(
      page,
      `state set turn 0; state set phase "roll"; set-horse 0 ${horse} 51; roll-dice ${value}`,
    );
    await page.waitForFunction(
      () =>
        !window.__phaser.scene.getScene('co-ca-ngua').rolling &&
        window.__phaser.scene.getScene('co-ca-ngua').moving.size === 0,
    );
    await clickCanvas(
      page,
      'co-ca-ngua',
      new Function(`return (s) => s.horseButtons[${horse}].container`)(),
    );
    await page.waitForFunction(
      (horse) => window.__phaser.scene.getScene('co-ca-ngua').ctx.state.horses[0][horse].finished,
      horse,
    );
    await page.waitForFunction(
      () => window.__phaser.scene.getScene('co-ca-ngua').moving.size === 0,
    );
  }
  await page.getByText('Bạn thắng! 🎉', { exact: true }).waitFor();
  const parked = await page.evaluate(() =>
    window.__phaser.scene.getScene('co-ca-ngua').ctx.state.horses[0].map((h) => h.position),
  );
  if (JSON.stringify(parked) !== '[57,56,55,54]') throw new Error(`Wrong home order: ${parked}`);
  await page.screenshot({ path: t.shot('04-winner.png') });
  await page.getByRole('button', { name: 'Chơi ván mới' }).click();
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return (
      !s.ctx.result && s.ctx.state.horses.flat().every((h) => h.position === -1 && !h.finished)
    );
  });
  await cmd(page, 'timer resume; bot resume');
  await page.screenshot({ path: t.shot('05-rematch.png') });
  await page.getByRole('button', { name: 'Về danh sách phòng' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Rời phòng', exact: true })
    .click();
  await page.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
}
