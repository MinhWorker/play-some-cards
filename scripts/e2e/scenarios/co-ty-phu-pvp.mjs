import { canvasPoint, clickCanvas, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const host = await t.page(DESKTOP);
  const guest = await t.page(PHONE);
  await signUp(t, host, 'ClockHost');
  await signUp(t, guest, 'ClockGuest');
  await openRooms(host, 'co-ty-phu-classic');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.clockChoices[2].container);
  await host.screenshot({ path: t.shot('setup-clock.png') });
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await host.getByRole('heading', { name: 'Đang chờ người chơi' }).waitFor();
  await openRooms(guest, 'co-ty-phu-classic');
  await guest
    .locator('.room-row', { hasText: 'Phòng của ClockHost' })
    .last()
    .getByRole('button', { name: 'Vào chơi' })
    .click();
  await host.getByText('ClockGuest', { exact: true }).waitFor();
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  const root = new URL('../../../', import.meta.url).pathname;
  for (const page of [host, guest]) {
    await page
      .waitForFunction(() => {
        const s = window.__phaser?.scene.getScene('co-ty-phu-classic');
        return s?.ctx?.timer?.event === 'turn-timeout' && s.countdownLabel?.visible;
      })
      .catch(async () => {
        const details = await page.evaluate(() => {
          const s = window.__phaser?.scene.getScene('co-ty-phu-classic');
          return (
            s && {
              phase: s.visualPhase,
              timer: s.ctx?.timer,
              readyElapsed: s.readyElapsed,
              clock: s.runtime.clock,
              state: s.ctx?.state,
              runtime: s.runtime.inspect(),
            }
          );
        });
        throw new Error(`PvP countdown did not render: ${JSON.stringify(details)}`);
      });
    await page.evaluate(async (root) => {
      const { clientHost } = await import(`/@fs${root}packages/sdk/src/client/host.ts`);
      const host = clientHost();
      window.uiSounds = [];
      window.gameSounds = [];
      const ui = host.playUiSound;
      const sound = host.playSound;
      host.playUiSound = function (kind) {
        window.uiSounds.push(kind);
        return ui.call(this, kind);
      };
      host.playSound = function (url, ...args) {
        window.gameSounds.push(url.split('/').pop().split('?')[0]);
        return sound.call(this, url, ...args);
      };
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      if (s.ctx.options.turnSeconds !== 60 || s.ctx.timer.ms !== 60000)
        throw new Error('Setup duration was not applied to the server timer');
    }, root);
  }
  const point = await canvasPoint(host, 'co-ty-phu-classic', (s) => s.main[0].hit);
  await host.mouse.move(point.x, point.y);
  await host.waitForFunction(() => window.uiSounds.includes('hover'));
  const tinted = await host.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').main[0].box.tint === 0xffedc0,
  );
  if (!tinted) throw new Error('Desktop button hover did not highlight the button');
  await host.mouse.move(0, 0);
  await host.screenshot({ path: t.shot('turn-countdown.png') });
  // A real server move: notify only the recipient, then let the unanswered offer expire.
  await host.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.send('offer-trade', { to: 1, give: -1, take: -1, giveCash: 50, takeCash: 0 });
  });
  await guest
    .waitForFunction(
      () => window.gameSounds.filter((s) => s === 'tycoon-trade-request.mp3').length === 1,
    )
    .catch(async () => {
      const snapshots = await Promise.all(
        [host, guest].map((page) =>
          page.evaluate(() => {
            const s = window.__phaser.scene.getScene('co-ty-phu-classic');
            return {
              phase: s.ctx.state.phase,
              turn: s.ctx.state.turn,
              trade: s.ctx.state.trade,
              me: s.ctx.me,
              last: s.props.last,
              sounds: window.gameSounds,
              runtime: s.runtime.inspect(),
              alerts: [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent),
            };
          }),
        ),
      );
      throw new Error(`Trade notification missing: ${JSON.stringify(snapshots)}`);
    });
  if (await host.evaluate(() => window.gameSounds.includes('tycoon-trade-request.mp3')))
    throw new Error('The trade sender heard the recipient’s notification');
  await guest.screenshot({ path: t.shot('trade-request.png') });
  await host.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return s.ctx.state.lastAutoAction?.event === 'decline-trade' && !s.ctx.state.trade;
    },
    null,
    { timeout: 75000 },
  );
  const balances = await host.evaluate(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.players.map((p) => p.cash),
  );
  if (balances.some((cash) => cash !== 1500)) throw new Error('An expired trade transferred money');
  await host.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return s.ctx.state.lastAutoAction?.event === 'roll' && s.visualPhase === 'rolling';
    },
    null,
    { timeout: 75000 },
  );
  await host.screenshot({ path: t.shot('automatic-roll.png') });
  // Complete the landing choices, then leave the end-turn button untouched.
  for (let i = 0; i < 8; i++) {
    await host.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        !s.runtime.busy('turn') &&
        !s.activeMoney &&
        (s.main[0].hit.visible || s.diceHit.visible)
      );
    });
    const phase = await host.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase,
    );
    if (phase === 'end') break;
    await clickCanvas(host, 'co-ty-phu-classic', (s) =>
      s.ctx.state.phase === 'roll' ? s.diceHit : s.main[0].hit,
    );
  }
  await host.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.ctx.state.phase === 'end' && s.visualPhase === 'decision' && s.main[0].hit.visible;
  });
  await host.screenshot({ path: t.shot('end-turn-center.png') });
  await guest.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return s.ctx.state.turn === 1 && s.ctx.state.lastAutoAction?.event === 'end-turn';
    },
    null,
    { timeout: 75000 },
  );
  await guest.screenshot({ path: t.shot('next-player.png') });
  if (
    await guest.evaluate(
      () => window.gameSounds.filter((s) => s === 'tycoon-trade-request.mp3').length !== 1,
    )
  )
    throw new Error('The trade notification repeated on later room updates');
}
