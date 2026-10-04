// Real room: confirm a human flight, then observe a bot flight confirmed by its real decision hook.
import { clickCanvas, cmd, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';
export const games = ['co-ty-phu-classic'];
export default async function run(t) {
  const page = await t.page(DESKTOP);
  page.setDefaultTimeout(60000);
  await signUp(t, page, 'Airport');
  await openRooms(page, 'co-ty-phu-classic');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.choices[1].container);
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  await cmd(page, 'bot pause; timer pause; seed 1');
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.playbackSpeed = 2;
    s.runtime.setSpeed(2);
    s.airportFrames = new Set();
    s.airportTiles = new Set();
    s.events.on('update', () => {
      if (s.activeRoll?.from !== 20 || !s.moving[s.airportSeat]) return;
      s.airportFrames.add(
        `${s.tokens[s.airportSeat].x.toFixed(2)},${s.tokens[s.airportSeat].y.toFixed(2)}`,
      );
      if (s.movingTiles[s.airportSeat] !== null) s.airportTiles.add(s.movingTiles[s.airportSeat]);
    });
  });
  for (const automatic of [false, true]) {
    const seat = automatic ? 1 : 0;
    if (automatic) await cmd(page, 'restart');
    await page.waitForFunction(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
    );
    await page.evaluate((seat) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      s.airportSeat = seat;
      s.airportFrames.clear();
      s.airportTiles.clear();
    }, seat);
    await cmd(page, `state set turn ${seat}; tp ${seat} 18; dice 1 1; as ${seat} roll`);
    await page.waitForFunction((seat) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        s.shownPositions[seat] === 20 &&
        s.ctx.state.specialEvent?.kind === 'airport'
      );
    }, seat);
    await cmd(page, 'rng push 0.1'); // square 3, a direct flight without an additional special event
    if (!automatic) {
      const heading = await page.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').heading.text,
      );
      if (heading !== 'Sân bay') throw new Error(`Wrong airport heading: ${heading}`);
      await page.screenshot({ path: t.shot('airport-confirm-desktop.png') });
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else {
      await cmd(page, 'bot step');
    }
    await page.waitForFunction((seat) => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        !s.runtime.busy('turn') &&
        s.shownPositions[seat] === 3 &&
        s.ctx.state.players[seat].position === 3
      );
    }, seat);
    const flight = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return { frames: s.airportFrames.size, tiles: s.airportTiles.size };
    });
    if (flight.frames < 2 || flight.tiles !== 1)
      throw new Error(`Flight was not direct: ${JSON.stringify(flight)}`);
    if (automatic) {
      await page.setViewportSize(PHONE);
      await page.screenshot({ path: t.shot('airport-arrival-phone.png') });
    }
  }
}
