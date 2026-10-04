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
      subtitle: scene.readySubtitle.text,
      names: scene.readyNames.filter((text) => text.visible).map((text) => text.text),
      cash: scene.readyCash.filter((text) => text.visible).map((text) => text.text),
    };
  });
  if (
    ready.phase !== 'ready' ||
    ready.subtitle !== 'Mỗi người bắt đầu với 1.000 ₫' ||
    ready.names.length !== 2 ||
    ready.cash.some((cash) => !cash.endsWith(' ₫'))
  )
    throw new Error(`Opening table is incomplete: ${JSON.stringify(ready)}`);
  await page.screenshot({ path: t.shot('10-start.png') });
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.readyAmounts.length === 2 && s.readyAmounts.every((amount) => amount === 1000);
  });
  await page.screenshot({ path: t.shot('10-money.png') });
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
  );
  const rollControl = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const button = { hit: s.diceHit };
    return {
      center: Math.abs(button.hit.x - (s.geometry.left + s.geometry.size / 2)) < 1,
      asset: s.dice.visible && s.rollHint.visible,
      height: button.hit.height,
      prices:
        s.boardPrices.image.texture.getSourceImage().width ===
        s.boardImage.texture.getSourceImage().width,
    };
  });
  if (!rollControl.center || !rollControl.asset || rollControl.height < 88 || !rollControl.prices)
    throw new Error(`Board prices/roll control are incomplete: ${JSON.stringify(rollControl)}`);
  await page.screenshot({ path: t.shot('10-roll-button.png') });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[3]);
  const detail = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').detail.text,
  );
  if (!detail.includes('Việt Trì')) throw new Error('Selecting a property did not show its deed');
  await page.screenshot({ path: t.shot('11-deed.png') });

  let purchases = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForFunction(
      () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.visualPhase === 'decision',
    );
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return {
        turn: s.turn,
        phase: s.phase,
        cash: s.players[s.turn].cash,
        pending: s.pending,
        // An auction is bid in turns: whoever's turn it is to bid decides.
        seat: s.phase === 'auction' ? s.auction.bidder : s.turn,
      };
    });
    await page.getByRole('button', { name: `Người ${state.seat + 1}`, exact: true }).click();
    if (state.phase === 'roll') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.diceHit);
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
      await clickCanvas(
        page,
        'co-ty-phu-classic',
        (s) =>
          s.main.find(
            (b) => b.hit.visible && (b.text.text.includes('Bỏ') || b.text.text === 'Từ bỏ'),
          ).hit,
      );
    } else if (state.phase === 'debt') {
      const enough = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
        return s.players[s.debt.payer ?? s.turn].cash >= s.debt.amount;
      });
      if (enough) await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      else break;
    }
    await page.waitForTimeout(160);
  }
  if (purchases < 1) throw new Error('No property was purchased through the board controls');
  await page.screenshot({ path: t.shot('12-played.png') });
  await page.close();

  // Force a known opening card through the sandbox's real rules and controls.
  const eventsPage = await t.page(PHONE);
  await eventsPage.goto(url.toString());
  await eventsPage.waitForFunction(() => window.__phaser?.scene.isActive('co-ty-phu-classic'));
  const restartEvents = async () => {
    const epoch = await eventsPage.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').runtime.inspect().epoch,
    );
    await eventsPage.evaluate(() => {
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
    await eventsPage.waitForFunction(
      (epoch) =>
        window.__phaser.scene.getScene('co-ty-phu-classic').runtime.inspect().epoch > epoch,
      epoch,
    );
    // Roll a double to visit Jail first; the next roll reaches the remaining Chest at 17.
    await eventsPage.waitForFunction(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
    );
    await eventsPage.evaluate(() => {
      const original = Math.random;
      try {
        Math.random = () => 2 / 3;
        window.__phaser.scene.getScene('co-ty-phu-classic').send('roll');
      } finally {
        Math.random = original;
      }
    });
    await eventsPage.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        s.ctx.state.players[0].position === 10 &&
        s.ctx.state.phase === 'roll'
      );
    });
  };
  const rollEvent = async () =>
    eventsPage.evaluate(() => {
      const original = Math.random;
      try {
        const dice = [2 / 6, 3 / 6];
        Math.random = () => dice.shift() ?? 0;
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
  await eventsPage.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'result',
  );
  if (
    await eventsPage.evaluate(
      () =>
        window.__phaser.scene.getScene('co-ty-phu-classic').ctx.timer?.event !== 'prepare-event',
    )
  )
    throw new Error('Card countdown started during the dice result, before the draw');
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'drawing' && s.eventDeck.active === 'chest';
  });
  const drawing = await eventsPage.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      hidden: s.main.every((b) => !b.hit.visible),
      text: s.notice.text,
      timer: s.ctx.timer?.event,
      cash: s.ctx.state.players[0].cash,
    };
  });
  if (!drawing.hidden || drawing.text || drawing.timer !== 'prepare-event' || drawing.cash !== 1000)
    throw new Error(`Card leaked before its draw finished: ${JSON.stringify(drawing)}`);
  await eventsPage.screenshot({ path: t.shot('13-card-draw.png') });
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'reveal' && s.notice.text.includes('200');
  });
  await eventsPage.screenshot({ path: t.shot('13-card-reveal.png') });
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
    preview.cash !== 1000 ||
    preview.shownCash !== 1000 ||
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
      s.ctx.state.players[0].cash === 1200 &&
      s.shownCash[0] === 1200 &&
      s.visualPhase === 'decision' &&
      s.ctx.timer?.event === 'turn-timeout'
    );
  });
  await restartEvents();
  await eventsPage.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'decision' && s.ctx.state.players[0].cash === 1000;
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
    return s.ctx.state.specialEvent === null && s.ctx.state.players[0].cash === 1200;
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
    const originalPlay = s.runtime.audio.playIn;
    s.jailSounds = [];
    s.runtime.audio.playIn = function (scope, key, ...args) {
      if (key === 'tycoon-jail')
        s.jailSounds.push({ moving: s.moving[seat], phase: s.visualPhase });
      return originalPlay.call(this, scope, key, ...args);
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

  // Return to a purchased street through real rolls: one upgrade without the rest of its color.
  const rulesPage = await t.page(PHONE);
  await rulesPage.goto(url.toString());
  await rulesPage.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  // Keep presentation within the live turn deadlines on software-rendered headless Chromium.
  await rulesPage.evaluate(() => {
    const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
    scene.playbackSpeed = 3;
    scene.runtime.setSpeed(3);
  });
  await rulesPage.getByRole('button', { name: 'Ván mới', exact: true }).click();
  const idle = () =>
    rulesPage.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        !s.activeMoney &&
        !s.runtime.busy('turn') &&
        !s.runtime.busy('money')
      );
    });
  const takeTurn = async (seat, dice, end = true) => {
    await idle();
    await rulesPage.getByRole('button', { name: `Người ${seat + 1}`, exact: true }).click();
    const sequence = await rulesPage.evaluate(
      ({ dice }) => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        const seq = s.ctx.state.moneySequence;
        const original = Math.random;
        let i = 0;
        try {
          Math.random = () => (dice[i++] - 0.5) / 6;
          s.diceHit.emit('pointerup');
        } finally {
          Math.random = original;
        }
        return seq;
      },
      { dice },
    );
    await rulesPage.waitForFunction(
      (seq) => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.moneySequence > seq,
      sequence,
    );
    await idle();
    if (
      await rulesPage.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase === 'buy',
      )
    ) {
      await clickCanvas(rulesPage, 'co-ty-phu-classic', (s) => s.main[0].hit);
      await rulesPage.waitForFunction(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase !== 'buy',
      );
      await idle();
    }
    // A utility (or a card) asks to confirm its event first.
    while (
      await rulesPage.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase === 'event',
      )
    ) {
      const seq = await rulesPage.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.moneySequence,
      );
      await clickCanvas(rulesPage, 'co-ty-phu-classic', (s) => s.main[0].hit);
      await rulesPage.waitForFunction((seq) => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
        return s.phase !== 'event' || s.moneySequence > seq;
      }, seq);
      await idle();
    }
    // Only the station visitor decides; passing leaves the other player as the owner.
    const auction = () =>
      rulesPage.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase === 'auction',
      );
    if (await auction()) {
      for (const who of [seat, 1 - seat]) {
        if (!(await auction())) break;
        await rulesPage.getByRole('button', { name: `Người ${who + 1}`, exact: true }).click();
        await idle();
        await clickCanvas(
          rulesPage,
          'co-ty-phu-classic',
          (s) =>
            s.main.find(
              (b) => b.hit.visible && (b.text.text.endsWith('Bỏ giá') || b.text.text === 'Từ bỏ'),
            ).hit,
        );
      }
      await rulesPage.waitForFunction(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.phase !== 'auction',
      );
      await rulesPage.getByRole('button', { name: `Người ${seat + 1}`, exact: true }).click();
      await idle();
    }
    if (end) {
      await rulesPage.waitForFunction((seat) => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return (
          s.ctx.me?.seat === seat &&
          s.ctx.state.turn === seat &&
          s.ctx.state.phase === 'end' &&
          s.main[0].hit.visible &&
          s.main[0].text.text === 'Hết lượt'
        );
      }, seat);
      const endControl = await rulesPage.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        const button = s.main[0];
        return {
          label: button.text.text,
          centered: Math.abs(button.hit.x - (s.geometry.left + s.geometry.size / 2)) < 1,
          y: Math.abs(button.hit.y - (s.geometry.top + s.geometry.imageH * 0.645)) < 1,
          asset: button.box.texture.key,
        };
      });
      if (
        endControl.label !== 'Hết lượt' ||
        !endControl.centered ||
        !endControl.y ||
        !endControl.asset.endsWith('/button')
      )
        throw new Error(`End-turn control moved or changed asset: ${JSON.stringify(endControl)}`);
      if (seat === 0) await rulesPage.screenshot({ path: t.shot('17-end-turn-center.png') });
      await clickCanvas(rulesPage, 'co-ty-phu-classic', (s) => s.main[0].hit);
      await rulesPage.waitForFunction(
        (seat) => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.turn !== seat,
        seat,
      );
    }
  };
  await takeTurn(0, [1, 2], false);
  if (
    await rulesPage.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.ctx.state.buildable !== null ||
        s.tools.some((b) => b.hit.visible && b.text.text.startsWith('Xây'))
      );
    })
  )
    throw new Error('A newly purchased street can be built on the same visit');
  await clickCanvas(rulesPage, 'co-ty-phu-classic', (s) => s.main[0].hit);
  await rulesPage.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.turn === 1,
  );
  for (const [index, dice] of [
    [5, 6],
    [5, 6],
    [4, 6],
    [3, 5],
  ].entries()) {
    // With 1,000 starting cash, avoid buying both expensive streets at 6 and 9:
    // this player must also pay for the two stations the visitor declines.
    await takeTurn(1, index === 1 ? [2, 4] : [1, 3]);
    await takeTurn(0, dice, index < 3);
  }
  const returnVisit = await rulesPage.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      position: s.ctx.state.players[0].position,
      buildable: s.ctx.state.buildable,
      otherOwner: s.ctx.state.properties[1].owner,
    };
  });
  if (returnVisit.position !== 3 || returnVisit.buildable !== 3 || returnVisit.otherOwner !== null)
    throw new Error(`Return visit failed: ${JSON.stringify(returnVisit)}`);
  await clickCanvas(
    rulesPage,
    'co-ty-phu-classic',
    (s) => s.tools.find((b) => b.hit.visible && b.text.text === 'Xây nhà').hit,
  );
  await rulesPage.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.properties[3].houses === 1,
  );
  await idle();
  if (
    await rulesPage.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return s.tools.some((b) => b.hit.visible && b.text.text.startsWith('Xây'));
    })
  )
    throw new Error('The return visit permits a second upgrade');
  await rulesPage.screenshot({ path: t.shot('17-return-build.png') });
  await rulesPage.close();

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
        (scene.ctx.state.turn === 1 || scene.main[0].hit.visible || scene.diceHit.visible)
      );
    });
    const state = await host.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state,
    );
    if (state.turn === 1) break;
    if (!['roll', 'buy', 'end', 'event'].includes(state.phase))
      throw new Error(`Unexpected phase: ${state.phase}`);
    await clickCanvas(host, 'co-ty-phu-classic', (s) =>
      s.ctx.state.phase === 'roll' ? s.diceHit : s.main[0].hit,
    );
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
