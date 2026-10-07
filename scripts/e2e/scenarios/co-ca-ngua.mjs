// A real server room: normal and ranked finishes, celebration, reconnection and replay.
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
  await cmd(page, 'rng push 0');
  await clickCanvas(page, 'co-ca-ngua', (s) => s.die);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return s.ctx.state.phase === 'choose' && s.ctx.state.lastRoll?.value === 1 && !s.rolling;
  });
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
  await page.screenshot({ path: t.shot('05-rematch.png') });
  // Finish the rematch, then change the mode through the room's actual settings screen.
  await cmd(page, 'finish 0');
  await page.getByRole('button', { name: 'Tuỳ chỉnh' }).click();
  await clickCanvas(page, 'co-ca-ngua:setup', (s) => s.modeButtons[1].container);
  // Changing bot count must preserve the chosen mode.
  await clickCanvas(page, 'co-ca-ngua:setup', (s) => s.buttons[3].container);
  await page.screenshot({ path: t.shot('06-ranked-setup.png') });
  await clickCanvas(page, 'co-ca-ngua:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Chơi ván mới' }).click();
  await page.waitForFunction(() => {
    const s = window.__phaser?.scene.getScene('co-ca-ngua');
    return s?.ctx?.options.mode === 'ranked' && !s.ctx.result;
  });
  await cmd(page, 'bot pause; timer pause');
  for (const seat of [0, 2, 1]) {
    for (const [horse, value] of [6, 5, 4, 3].entries()) {
      await cmd(
        page,
        `state set turn ${seat}; state set phase "roll"; set-horse ${seat} ${horse} 51; roll-dice ${value}`,
      );
      await page.waitForFunction(() => {
        const s = window.__phaser.scene.getScene('co-ca-ngua');
        return !s.rolling && s.moving.size === 0;
      });
      if (seat === 0)
        await clickCanvas(
          page,
          'co-ca-ngua',
          new Function(`return (s) => s.horseButtons[${horse}].container`)(),
        );
      else await cmd(page, `as ${seat} move ${horse}`);
      await page.waitForFunction(
        ({ seat, horse }) =>
          window.__phaser.scene.getScene('co-ca-ngua').ctx.state.horses[seat][horse].finished,
        { seat, horse },
      );
      if (horse === 3) {
        await page.waitForFunction(
          () => window.__phaser.scene.getScene('co-ca-ngua').moving.size === 4,
        );
        await page.waitForTimeout(700);
        const dancing = await page.evaluate((seat) => {
          const s = window.__phaser.scene.getScene('co-ca-ngua');
          return s.pieces[seat].every((p) => Math.abs(p.image.angle) > 0.1);
        }, seat);
        if (!dancing) throw new Error(`Finisher ${seat} did not dance`);
        await page.screenshot({ path: t.shot(`07-celebration-seat-${seat}.png`) });
      }
      await page.waitForFunction(
        () => window.__phaser.scene.getScene('co-ca-ngua').moving.size === 0,
      );
    }
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ca-ngua');
      return { rankings: s.ctx.state.rankings, over: Boolean(s.ctx.result) };
    });
    if (seat !== 1 && state.over)
      throw new Error('Ranked game stopped before all places were decided');
    if (seat === 0) {
      await cmd(page, 'timer resume');
      await page.waitForFunction(() => {
        const s = window.__phaser.scene.getScene('co-ca-ngua');
        return s.ctx.state.phase === 'roll' && s.ctx.state.turn === 1;
      });
      await cmd(page, 'timer pause');
      await page.reload();
      await page.waitForFunction(() => {
        const s = window.__phaser?.scene.getScene('co-ca-ngua');
        return (
          s?.ctx?.state.rankings[0] === 0 &&
          !s.ctx.result &&
          s.playerRows[0].score.text === 'Hạng 1'
        );
      });
      await page.screenshot({ path: t.shot('08-ranked-reconnected.png') });
    }
  }
  const rankings = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ca-ngua').ctx.state.rankings,
  );
  if (JSON.stringify(rankings) !== '[0,2,1,3]') throw new Error(`Wrong rankings: ${rankings}`);
  await page.getByText('Bạn thắng! 🎉', { exact: true }).waitFor();
  await page.screenshot({ path: t.shot('09-ranked-result.png') });
  await page.getByRole('button', { name: 'Chơi ván mới' }).click();
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ca-ngua');
    return (
      !s.ctx.result &&
      s.ctx.state.rankings.length === 0 &&
      s.ctx.state.horses.flat().every((h) => h.position === -1)
    );
  });
  await page.getByRole('button', { name: 'Về danh sách phòng' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Rời phòng', exact: true })
    .click();
  await page.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
}
