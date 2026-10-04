import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=4', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }, { move }, { decisionSeat }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
      import(`/@fs${root}games/co-ty-phu-classic/src/game/rules.ts`),
      import(`/@fs${root}games/co-ty-phu-classic/src/game/turnClock.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
    const ids = ['a', 'b', 'c', 'd'];
    let game, props, seq;
    const deliver = (last = null) => {
      const me = ids[decisionSeat(game.state)];
      s.receive({ ...props, me, view: game.view(me), last });
    };
    s.managementFixture = (kind) => {
      game = testGame(plugin, ids);
      seq = 0;
      if (kind === 'buy' || kind === 'buy-rich') {
        game.state.players[0].cash = kind === 'buy' ? 1 : 1000;
        if (kind === 'buy-rich') game.state.properties[1].owner = 0;
        move(game.state, 0, 3, false, 3);
      } else if (kind.startsWith('build') || kind.startsWith('hotel')) {
        game.state.properties[9].owner = 0;
        game.state.properties[1].owner = 0;
        game.state.properties[9].houses = kind.startsWith('hotel') ? 4 : 0;
        game.state.players[0].cash = kind.endsWith('poor') ? 158 : 175;
        move(game.state, 0, 9, false, 9);
        if (kind === 'build-remote') game.state.players[0].position = 0;
        if (kind === 'build-mortgaged') game.state.properties[9].mortgaged = true;
        if (kind === 'hotel-full') game.state.properties[9].houses = 5;
      } else {
        game.state.phase = 'end';
        game.state.properties[1].owner = 0;
        if (kind === 'bulk') {
          for (const square of [2, 3, 6, 8, 9, 11]) game.state.properties[square].owner = 0;
          game.state.properties[1].houses = 2;
          game.state.properties[3].houses = 5;
        }
      }
      props = {
        ...s.props,
        players: ids.map((id, seat) => ({ id, name: `Người ${seat + 1}`, connected: true })),
        hostId: 'a',
        round: s.props.round + 1,
        played: { ms: 10000, running: true },
        result: null,
        timer: null,
      };
      s.managementGame = game;
      s.selected = null;
      s.playbackSpeed = 3;
      s.runtime.setSpeed(3);
      deliver();
    };
    s.send = (event, payload = {}) => {
      const player = ids[decisionSeat(game.state)];
      game.send(player, event, payload);
      deliver({ seq: ++seq, player, move: { event, payload } });
    };
    s.borrowerNextTurn = () => {
      do {
        game.state.phase = 'end';
        game.send(ids[game.state.turn], 'end-turn');
      } while (game.state.turn !== 0);
      game.state.phase = 'end';
      deliver();
    };
  }, root);
  const idle = () =>
    page.waitForFunction(
      () => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return (
          s.visualPhase === 'decision' &&
          !s.activeMoney &&
          !s.payments.length &&
          !s.runtime.busy('turn')
        );
      },
      null,
      { timeout: 60000 },
    );
  const click = async (label) => {
    await idle();
    await clickCanvas(
      page,
      'co-ty-phu-classic',
      new Function(
        `return (s) => [...s.main, ...s.tools].find((b) => b.hit.visible && b.text.text === ${JSON.stringify(label)}).hit`,
      )(),
    );
  };
  const mortgage = async () => {
    await idle();
    await clickCanvas(
      page,
      'co-ty-phu-classic',
      (s) => s.tools.find((b) => b.hit.visible && b.text.text.startsWith('Thế chấp')).hit,
    );
    await clickCanvas(page, 'co-ty-phu-classic', (s) => s.mortgagePanel.confirm.hit);
  };
  const fixture = async (kind) => {
    await page.evaluate(
      (kind) => window.__phaser.scene.getScene('co-ty-phu-classic').managementFixture(kind),
      kind,
    );
    await idle();
  };
  const assertState = async (condition, message) => {
    if (!(await page.evaluate(condition))) throw new Error(message);
  };

  await fixture('buy');
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const buttons = [...s.main, ...s.tools].filter((b) => b.hit.visible);
    const labels = buttons.map((b) => b.text.text);
    const end = buttons.filter((b) => b.text.text === 'Hết lượt');
    return (
      end.length === 1 &&
      Math.abs(end[0].hit.x - (s.geometry.left + s.geometry.size / 2)) < 1 &&
      Math.abs(end[0].hit.y - (s.geometry.top + s.geometry.imageH * 0.645)) < 1 &&
      end[0].box.texture.key.endsWith('/button') &&
      !labels.some((text) => text.startsWith('Mua') || text === 'Đấu giá' || text === 'Bỏ qua')
    );
  }, 'An unaffordable street did not offer the original central Hết lượt control');
  await page.screenshot({ path: t.shot('unaffordable-end-turn-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('unaffordable-end-turn-phone.png') });
  await click('Hết lượt');
  await assertState(() => {
    const state = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
    return state.turn === 1 && state.properties[3].owner === null && state.auction === null;
  }, 'Ending an unaffordable purchase started an auction or transferred ownership');

  await fixture('buy-rich');
  const centralEnd = () => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const buttons = [...s.main, ...s.tools].filter((b) => b.hit.visible);
    const end = buttons.filter((b) => b.text.text === 'Hết lượt');
    return end.length === 1 && Math.abs(end[0].hit.x - (s.geometry.left + s.geometry.size / 2)) < 1;
  };
  await assertState(centralEnd, 'The affordable purchase replaced the central end-turn button');
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const buy = s.main.find((b) => b.hit.visible && b.text.text === 'Mua 180 ₫');
    const mortgage = s.tools.find((b) => b.hit.visible && b.text.text === 'Thế chấp tài sản');
    return (
      buy.enabled &&
      buy.box.texture.key.endsWith('/tile-button-primary') &&
      buy.hit.y < mortgage.hit.y &&
      mortgage.box.texture.key.endsWith('/tile-button')
    );
  }, 'The purchase did not take priority over mortgage management');
  await page.screenshot({ path: t.shot('affordable-purchase-phone.png') });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[1]);
  await assertState(
    centralEnd,
    'Inspecting owned land removed or duplicated the central end-turn button',
  );
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[3]);
  await click('Mua 180 ₫');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.ctx.state.properties[3].owner === 0 && s.ctx.state.players[0].cash === 820;
  }, 'The purchase button on the tile card was overwritten by the central end-turn control');
  await page.setViewportSize(DESKTOP);

  // Visible, priced construction must explain unavailable actions without sending a move.
  const construction = async (kind, label, enabled) => {
    await fixture(kind);
    await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[9]);
    await assertState(
      new Function(`return () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      const build = s.tools.find((b) => b.hit.visible && b.text.text === ${JSON.stringify(label)});
      const others = s.tools.filter((b) => b.hit.visible && b !== build);
      return build && build.enabled === ${enabled} && build.hit.input.enabled === ${enabled} &&
        build.box.texture.key.endsWith(${JSON.stringify(enabled ? '/tile-button-primary' : '/tile-button-disabled')}) &&
        others.every((b) => build.hit.getBounds().bottom < b.hit.getBounds().top &&
          b.box.texture.key.endsWith('/tile-button'));
    }`)(),
      'Construction was hidden, unpriced, wrongly styled, or below secondary actions',
    );
  };
  await construction('build-poor', 'Xây nhà 175 ₫', false);
  await page.screenshot({ path: t.shot('build-disabled-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('build-disabled-phone.png') });
  await click('Xây nhà 175 ₫');
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const source = s.textures.get(s.texture('tile-button-disabled')).getSourceImage();
    const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2]) return false;
    }
    return s.ctx.state.players[0].cash === 158 && s.ctx.state.properties[9].houses === 0;
  }, 'Disabled construction changed the game or the baked texture was not gray');
  await construction('build-remote', 'Xây nhà 175 ₫', false);
  await construction('build-mortgaged', 'Xây nhà 175 ₫', false);
  await construction('hotel-full', 'Xây khách sạn 175 ₫', false);
  await construction('hotel-poor', 'Xây khách sạn 175 ₫', false);
  await page.screenshot({ path: t.shot('hotel-disabled-phone.png') });
  await construction('hotel-rich', 'Xây khách sạn 175 ₫', true);
  await page.screenshot({ path: t.shot('hotel-primary-phone.png') });
  await click('Xây khách sạn 175 ₫');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const build = s.tools.find((b) => b.hit.visible && b.text.text === 'Xây khách sạn 175 ₫');
    return (
      s.ctx.state.properties[9].houses === 5 && s.ctx.state.players[0].cash === 0 && !build.enabled
    );
  }, 'The enabled hotel failed to build or allowed another upgrade');
  await construction('build-rich', 'Xây nhà 175 ₫', true);
  await page.screenshot({ path: t.shot('build-primary-phone.png') });
  await click('Xây nhà 175 ₫');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const build = s.tools.find((b) => b.hit.visible && b.text.text === 'Xây nhà 175 ₫');
    return (
      s.ctx.state.properties[9].houses === 1 && s.ctx.state.players[0].cash === 0 && !build.enabled
    );
  }, 'The enabled house failed to build or allowed a second construction on the same visit');
  await page.setViewportSize(DESKTOP);

  await fixture('owned');
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[1]);
  await click('Đấu giá');
  await click('+40 (40)');
  await click('Rút / Bỏ giá');
  await click('Rút / Bỏ giá');
  await idle();
  await assertState(() => {
    const state = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
    return (
      state.properties[1].owner === 1 &&
      state.players[0].cash === 1040 &&
      state.players[1].cash === 960 &&
      state.phase === 'end'
    );
  }, 'The resale auction did not transfer the deed and payment to the seller');
  await page.screenshot({ path: t.shot('resale-paid-desktop.png') });

  await page.setViewportSize(PHONE);
  await fixture('owned');
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[1]);
  await mortgage();
  await idle();
  await assertState(() => {
    const state = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
    return (
      state.players[0].position === 0 &&
      state.properties[1].mortgaged &&
      state.properties[1].mortgage.deadline === 4
    );
  }, 'Remote mortgage did not store the personal-turn deadline');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() =>
      window.__phaser.scene.getScene('co-ty-phu-classic').borrowerNextTurn(),
    );
    await idle();
  }
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.rentTableButton.hit.getBounds().top > s.nextBuilding.getBounds().bottom &&
      s.ctx.state.properties[1].owner === 0 &&
      s.deedOwner.text.includes('hết lượt này') &&
      s.tools.some((b) => b.hit.visible && b.text.text === 'Chuộc 110 ₫')
    );
  }, 'The third-turn deed did not show its last opportunity to redeem');
  await page.screenshot({ path: t.shot('mortgage-third-turn-phone.png') });
  await click('Chuộc 110 ₫');
  await idle();
  await click('Hết lượt');
  await assertState(() => {
    const deed = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.properties[1];
    return deed.owner === 0 && !deed.mortgaged && !deed.mortgage;
  }, 'A redeemed deed was foreclosed at the end of the third turn');

  await fixture('owned');
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[1]);
  await mortgage();
  await idle();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() =>
      window.__phaser.scene.getScene('co-ty-phu-classic').borrowerNextTurn(),
    );
    await idle();
  }
  await click('Hết lượt');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.properties[1].owner === null &&
      !s.ctx.state.properties[1].mortgaged &&
      s.shownProperties[1].owner === null &&
      s.boardPrices.amounts[1] === '200'
    );
  }, 'An expired mortgage retained ownership, the bank seal, or rent on the board');
  await page.screenshot({ path: t.shot('mortgage-foreclosed-phone.png') });

  // A paged selector reviews several deeds, including houses/hotels, before one payment.
  await page.setViewportSize(DESKTOP);
  await fixture('bulk');
  await click('Thế chấp tài sản');
  await assertState(() => {
    const panel = window.__phaser.scene.getScene('co-ty-phu-classic').mortgagePanel;
    return panel.visible && !panel.confirm.enabled && panel.total.text.includes('Nhận 0 ₫');
  }, 'An empty mortgage selection allowed confirmation');
  const select = (square) =>
    clickCanvas(
      page,
      'co-ty-phu-classic',
      new Function(
        `return (s) => s.mortgagePanel.rows.find((row) => row.square === ${square}).hit`,
      )(),
    );
  await select(1);
  await select(3);
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.mortgagePanel.next.hit);
  await select(11);
  await select(11);
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.mortgagePanel.previous.hit);
  await assertState(() => {
    const panel = window.__phaser.scene.getScene('co-ty-phu-classic').mortgagePanel;
    return (
      panel.total.text === '2 tài sản · Nhận 515 ₫' &&
      panel.rows.find((row) => row.square === 1).amount.text === '+200 ₫' &&
      panel.rows.find((row) => row.square === 3).amount.text === '+315 ₫'
    );
  }, 'Selection pagination lost deeds or omitted buildings from the payout');
  await page.screenshot({ path: t.shot('bulk-mortgage-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('bulk-mortgage-phone.png') });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.mortgagePanel.cancel.hit);
  await assertState(() => {
    const state = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
    return (
      state.players[0].cash === 1000 &&
      !state.properties[1].mortgaged &&
      !state.properties[3].mortgaged
    );
  }, 'Canceling a mortgage changed the bank balance or deeds');
  await click('Thế chấp tài sản');
  await select(1);
  await select(3);
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.mortgagePanel.confirm.hit);
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const state = s.ctx.state;
    return (
      state.players[0].cash === 1515 &&
      state.properties[1].houses === 2 &&
      state.properties[3].houses === 5 &&
      state.properties[1].mortgaged &&
      state.properties[3].mortgaged &&
      s.boardPrices.amounts[1] === '0'
    );
  }, 'Bulk mortgage did not preserve buildings, disable rent, or pay the displayed total');
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[1]);
  await click('Chuộc 220 ₫');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.properties[1].houses === 2 &&
      !s.ctx.state.properties[1].mortgaged &&
      s.ctx.state.players[0].cash === 1295 &&
      s.boardPrices.amounts[1] === '220'
    );
  }, 'Redemption did not restore the original houses and rent for the quoted price');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() =>
      window.__phaser.scene.getScene('co-ty-phu-classic').borrowerNextTurn(),
    );
    await idle();
  }
  await click('Hết lượt');
  await idle();
  await assertState(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.shownProperties[1].houses === 2 &&
      s.shownProperties[1].owner === 0 &&
      s.shownProperties[3].houses === 0 &&
      s.shownProperties[3].owner === null &&
      s.boardPrices.amounts[3] === '180'
    );
  }, 'Foreclosure failed to demolish the hotel or damaged the separately redeemed houses');
  await page.screenshot({ path: t.shot('hotel-foreclosed-phone.png') });
  await fixture('bulk');
  await click('Thế chấp tài sản');
  await page.evaluate(() => window.__phaser.scene.getScene('co-ty-phu-classic').send('end-turn'));
  await assertState(
    () => !window.__phaser.scene.getScene('co-ty-phu-classic').mortgagePanel.visible,
    'The old player kept their mortgage selector after the turn changed',
  );
}
