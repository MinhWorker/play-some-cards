// Play several turns through the real Phaser controls in the sandbox, switching seats.
import { clickCanvas, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(PHONE);
  const url = new URL(t.url);
  url.search = '?play=co-ty-phu-classic&players=2';
  await page.goto(url.toString());
  await page.waitForFunction(() => window.__phaser?.scene.isActive('co-ty-phu-classic'));
  const symbolsMatchBoard = await page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
    const source = scene.boardImage.texture.getSourceImage();
    return scene.ownerSymbols.width === source.width && scene.ownerSymbols.height === source.height;
  });
  if (!symbolsMatchBoard) throw new Error('Owner symbols did not use the loaded board artwork');
  // Start after assets load so the opening clock cannot expire during initial loading.
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'ready',
  );
  const ready = await page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      phase: scene.visualPhase,
      names: scene.readyNames.filter((text) => text.visible).map((text) => text.text),
      cash: scene.readyCash.filter((text) => text.visible).map((text) => text.text),
    };
  });
  if (
    ready.phase !== 'ready' ||
    ready.names.length !== 2 ||
    ready.cash.some((cash) => !cash.endsWith(' ₫'))
  )
    throw new Error(`Opening table is incomplete: ${JSON.stringify(ready)}`);
  await page.screenshot({ path: t.shot('10-start.png') });
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.readyAmounts.length === 2 && s.readyAmounts.every((amount) => amount === 1500);
  });
  await page.screenshot({ path: t.shot('10-money.png') });
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
  );
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[3]);
  const detail = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').detail.text,
  );
  if (!detail.includes('Hàng Đào')) throw new Error('Selecting a property did not show its deed');
  await page.screenshot({ path: t.shot('11-deed.png') });

  let purchases = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForFunction(
      () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
    );
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return { turn: s.turn, phase: s.phase, cash: s.players[s.turn].cash, pending: s.pending };
    });
    await page.getByRole('button', { name: `Người ${state.turn + 1}`, exact: true }).click();
    if (state.phase === 'roll') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      if (i === 0) {
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.ctx.state.dice &&
            scene.visualPhase === 'rolling' &&
            scene.shownPositions[0] === 0 &&
            !scene.moving[0] &&
            scene.playerPlace[0].text === 'Xuất phát' &&
            scene.main.every((button) => !button.hit.visible)
          );
        });
        await page.screenshot({ path: t.shot('12-dice.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'result' &&
            scene.dice.settled &&
            scene.dice.values.every((value, die) => value === scene.ctx.state.dice[die])
          );
        });
        await page.screenshot({ path: t.shot('12-dice-result.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'moving' &&
            scene.moving[0] &&
            scene.playerPlace[0].text === 'Xuất phát'
          );
        });
        await page.screenshot({ path: t.shot('12-hop.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'landing' &&
            scene.selected === null &&
            (scene.landingBeat.to === 10
              ? scene.heading.text ===
                (scene.landingBeat.jailed ? 'Bị đưa vào tù!' : 'Ghé thăm nhà tù')
              : scene.heading.text.startsWith('Đến ') &&
                scene.heading.text.slice(4).startsWith(scene.detail.text.replace(/…$/, '')))
          );
        });
        const repeatedCard = await page.evaluate(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.card.visible && scene.notice.text === scene.card.text;
        });
        if (repeatedCard) throw new Error('The landing announcement repeats the card message');
        await page.screenshot({ path: t.shot('12-landed.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'decision' &&
            scene.shownPositions[0] === scene.ctx.state.players[0].position &&
            !scene.dice.visible
          );
        });
      }
    } else if (state.phase === 'event') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else if (state.phase === 'buy') {
      const price = await page.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.pending,
      );
      if (
        state.cash >=
        (await page.evaluate((n) => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.ctx.state.pending === n
            ? Number(scene.main[0].text.text.match(/\d+/)?.[0])
            : 0;
        }, price))
      ) {
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
        await page.waitForFunction((square) => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.ctx.state.properties[square].owner === scene.ctx.me.seat;
        }, price);
        purchases++;
      } else {
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[1].hit);
      }
    } else if (state.phase === 'end') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else if (state.phase === 'auction') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[3].hit);
    } else if (state.phase === 'debt') {
      const enough = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
        return s.players[s.turn].cash >= s.debt.amount;
      });
      if (enough) await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      else break;
    }
    await page.waitForTimeout(160);
  }
  if (purchases < 1) throw new Error('No property was purchased through the board controls');
  await page.screenshot({ path: t.shot('12-played.png') });

  // Force a known opening card through the sandbox's real rules and controls.
  const eventsPage = await t.page(PHONE);
  await eventsPage.goto(url.toString());
  await eventsPage.waitForFunction(() => window.__phaser?.scene.isActive('co-ty-phu-classic'));
  const restartEvents = async () =>
    eventsPage.evaluate(() => {
      const original = Math.random;
      try {
        Math.random = () => 0;
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent === 'Ván mới')
          .click();
      } finally {
        Math.random = original;
      }
    });
  const rollEvent = async () =>
    eventsPage.evaluate(() => {
      const original = Math.random;
      try {
        Math.random = () => 0;
        window.__phaser.scene.getScene('co-ty-phu-classic').send('roll');
      } finally {
        Math.random = original;
      }
    });
  await restartEvents();
  await eventsPage.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
  );
  await rollEvent();
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.phase === 'event' &&
      s.visualPhase === 'decision' &&
      s.main[0].hit.visible &&
      s.ctx.timer?.event === 'auto-confirm-event' &&
      s.eventCountdown.commandBuffer.length > 0
    );
  });
  const preview = await eventsPage.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      cash: s.ctx.state.players[0].cash,
      shownCash: s.shownCash[0],
      label: s.main[0].text.text,
      countdown: s.eventCountdown.commandBuffer.length,
      notice: s.notice.text,
    };
  });
  if (
    preview.cash !== 1500 ||
    preview.shownCash !== 1500 ||
    preview.label !== 'Xác nhận' ||
    !preview.countdown ||
    !preview.notice.includes('200 ₫')
  )
    throw new Error(`Event did not pause before payment: ${JSON.stringify(preview)}`);
  await eventsPage.screenshot({ path: t.shot('13-event-confirm.png') });
  await clickCanvas(eventsPage, 'co-ty-phu-classic', (s) => s.main[0].hit);
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.players[0].cash === 1700 &&
      s.shownCash[0] === 1700 &&
      s.visualPhase === 'decision' &&
      s.ctx.timer === null
    );
  });
  await restartEvents();
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'decision' && s.ctx.state.players[0].cash === 1500;
  });
  await rollEvent();
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.phase === 'event' &&
      s.visualPhase === 'decision' &&
      s.ctx.timer?.event === 'auto-confirm-event'
    );
  });
  await eventsPage.getByRole('button', { name: 'Khán giả', exact: true }).click();
  if (
    await eventsPage.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').main[0].hit.visible,
    )
  )
    throw new Error('Spectators can confirm a special event');
  await eventsPage.screenshot({ path: t.shot('14-event-countdown.png') });
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.ctx.state.specialEvent === null && s.ctx.state.players[0].cash === 1700;
  });
  await eventsPage.screenshot({ path: t.shot('15-event-auto-confirm.png') });
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'decision' && !s.activeMoney;
  });
  // Receive a jail move while dice presentation still precedes the pawn flight.
  await eventsPage.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const seat = 1;
    const state = structuredClone(s.ctx.state);
    state.turn = seat;
    state.phase = 'end';
    state.dice = [3, 4];
    state.players[seat].position = 10;
    state.players[seat].jailed = true;
    state.lastCard = null;
    state.notice = 'Bị đưa vào tù!';
    s.ctx = { ...s.ctx, state };
    s.shownPositions[seat] = 30;
    const start = s.pawnSpot(30, seat);
    s.tokens[seat].setPosition(start.x, start.y);
    const originalSfx = s.sfx;
    s.jailSounds = [];
    s.sfx = function (key, ...args) {
      if (key === 'tycoon-jail')
        this.jailSounds.push({ moving: this.moving[seat], phase: this.visualPhase });
      return originalSfx.call(this, key, ...args);
    };
    s.onRoll(s.ctx, { player: { seat } });
    s.onState(s.ctx);
    if (s.jailSounds.length) throw new Error('Jail sound played before pawn flight');
  });
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'result';
  });
  if (
    await eventsPage.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').jailSounds.length,
    )
  )
    throw new Error('Jail sound played during dice presentation');
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.jailSounds.length === 1 && s.moving[1];
  });
  await eventsPage.screenshot({ path: t.shot('16-jail-flight.png') });
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.shownPositions[1] === 10 && !s.moving[1];
  });
  const jailSounds = await eventsPage.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.onState(s.ctx);
    return s.jailSounds;
  });
  if (jailSounds.length !== 1 || !jailSounds[0].moving || jailSounds[0].phase !== 'moving')
    throw new Error(`Jail sound did not match pawn flight: ${JSON.stringify(jailSounds)}`);
  await eventsPage.close();

  const host = await t.page(DESKTOP);
  await signUp(t, host, 'TyPhu');
  await openRooms(host, 'co-ty-phu-classic');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.choices[1].container);
  await host.screenshot({ path: t.shot('20-bot-setup.png') });
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await host.waitForTimeout(800);
  await host.screenshot({ path: t.shot('20-bot-room.png') });
  await host.getByText('🤖 Máy', { exact: true }).waitFor({ timeout: 5000 });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  await host.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );

  await host.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
  );
  for (let i = 0; i < 12; i++) {
    await host.waitForFunction(() => {
      const scene = window.__phaser?.scene.getScene('co-ty-phu-classic');
      return (
        scene?.visualPhase === 'decision' &&
        (scene.ctx.state.turn === 1 || scene.main[0].hit.visible)
      );
    });
    const state = await host.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state,
    );
    if (state.turn === 1) break;
    if (!['roll', 'buy', 'end', 'event'].includes(state.phase))
      throw new Error(`Unexpected phase: ${state.phase}`);
    await clickCanvas(host, 'co-ty-phu-classic', (s) => s.main[0].hit);
    await host.waitForTimeout(160);
  }
  await host.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return s.players[1].position !== 0;
    },
    null,
    { timeout: 30000 },
  );
  await host.screenshot({ path: t.shot('21-bot-played.png') });
}
