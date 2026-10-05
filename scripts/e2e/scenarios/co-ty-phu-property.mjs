import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const { default: sharp } = await import('sharp');
  const page = await t.page(DESKTOP);
  const boardShot = async (name) => {
    const clip = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      const { left, top, size, imageH } = s.geometry;
      const a = window.__toScreen('co-ty-phu-classic', left, top);
      const b = window.__toScreen('co-ty-phu-classic', left + size, top + imageH);
      return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
    });
    await page.screenshot({ path: t.shot(`${name}-crop.png`), clip });
  };
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
    const game = testGame(plugin, ['a', 'b', 'c', 'd']);
    game.state.phase = 'end';
    game.state.players[0].position = 3;
    game.state.buildable = 3;
    for (const [square, owner, houses] of [
      [3, 0, 0],
      [13, 1, 2],
      [23, 2, 3],
      [33, 3, 5],
      [8, 3, 4],
    ])
      game.state.properties[square] = { owner, houses, mortgaged: false };
    const props = {
      ...s.props,
      players: ['a', 'b', 'c', 'd'].map((id, seat) => ({
        id,
        name: `Người ${seat + 1}`,
        connected: true,
      })),
      hostId: 'a',
      me: 'a',
      result: null,
      round: s.props.round + 1,
      last: null,
      timer: null,
      played: { ms: 10000, running: true },
      view: game.view('a'),
    };
    s.receive(props);
    s.propertySounds = [];
    const play = s.runtime.audio.playIn;
    s.runtime.audio.playIn = function (scope, name, ...args) {
      if (['tycoon-buy', 'tycoon-coin', 'tycoon-rent'].includes(name)) s.propertySounds.push(name);
      return play.call(this, scope, name, ...args);
    };
    const draw = s.fillSurfacePolygon;
    s.decals = [];
    s.fillSurfacePolygon = function (square, coords, color, ...args) {
      s.decals.push({ square, coords, color });
      return draw.call(this, square, coords, color, ...args);
    };
    game.send('a', 'build', { square: 3 });
    s.receive({
      ...props,
      view: game.view('a'),
      last: { seq: 1, player: 'a', move: { event: 'build', payload: { square: 3 } } },
    });
    s.propertyGame = game;
    s.propertyProps = props;
  }, root);
  try {
    await page.waitForFunction(
      () => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return !s.runtime.busy('money') && s.shownProperties[3].houses === 1;
      },
      null,
      { timeout: 60000 },
    );
  } catch (error) {
    await page.screenshot({ path: t.shot('build-timeout.png') });
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return {
        phase: s.visualPhase,
        properties: s.shownProperties[3],
        payments: s.payments,
        flow: s.runtime.inspect(),
      };
    });
    throw new Error(`${error.message}\nPresentation: ${JSON.stringify(state)}`);
  }
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.selected = 3;
    s.onState(s.ctx);
    if (s.boardPrices.amounts[3] !== '72' || !s.deedValues[1].text.includes('72'))
      throw new Error('Building did not update the board and deed rent');
    if (s.propertySounds.join() !== 'tycoon-buy')
      throw new Error('Building did not play purchase sound only');
    const colors = [0xdf6554, 0x5793d3, 0x60af72, 0xe6be52];
    for (const [square, owner, houses] of [
      [3, 0, 1],
      [13, 1, 2],
      [23, 2, 3],
      [33, 3, 5],
      [8, 3, 4],
    ]) {
      const decals = s.decals
        .filter((d) => d.square === square)
        .slice(-(houses === 5 ? 2 : houses + 1));
      const badge = decals[0];
      const buildings = decals.slice(1);
      if (
        !badge ||
        badge.color !== colors[owner] ||
        JSON.stringify(badge.coords) !==
          JSON.stringify([
            [0, 0.83],
            [1, 0.83],
            [1, 0.93],
            [0, 0.93],
          ]) ||
        buildings.length !== (houses === 5 ? 1 : houses) ||
        buildings.some(
          (d) => d.color !== 0xffffff || d.coords.length !== (houses === 5 ? 26 : 24),
        ) ||
        buildings.some((d) => d.coords.some((p) => p[1] <= 0.82 || p[1] >= 0.945))
      )
        throw new Error(`White buildings do not overlay the owner badge on ${square}`);
    }
  });
  await page.screenshot({ path: t.shot('houses-rent-desktop.png') });
  await boardShot('houses-rent-desktop');
  const width = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.screen.width,
  );
  await page.setViewportSize(PHONE);
  await page.waitForFunction(
    (width) => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.screen.width !== width,
    width,
  );
  await page.screenshot({ path: t.shot('houses-rent-phone.png') });
  await boardShot('houses-rent-phone');
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const payload = { to: 1, give: -1, take: -1, giveCash: 50, takeCash: 0 };
    s.propertyGame.send('a', 'offer-trade', payload);
    s.receive({
      ...s.propertyProps,
      view: s.propertyGame.view('a'),
      timer: { event: 'turn-timeout', ms: 30000, left: 30000 },
      last: { seq: 2, player: 'a', move: { event: 'offer-trade', payload } },
    });
    // The answer clock sits under the heading and the offer's lines.
    const clock = s.countdownLabel.getBounds();
    if (
      !s.countdownLabel.visible ||
      clock.top < s.heading.getBounds().bottom ||
      (s.card.visible && clock.top < s.card.getBounds().bottom)
    )
      throw new Error('Trade countdown overlaps its heading or offer text');
  });
  await page.screenshot({ path: t.shot('trade-countdown-phone.png') });
  // Each viewer receives the same authoritative rent transfer through the normal view seam.
  for (const viewer of ['a', 'b', 'c', 'spectator']) {
    await page.evaluate(
      async ({ root, viewer }) => {
        const [{ default: plugin }, { testGame }, { move }] = await Promise.all([
          import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
          import(`/@fs${root}packages/sdk/src/testing.ts`),
          import(`/@fs${root}games/co-ty-phu-classic/src/game/rules.ts`),
        ]);
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        const game = testGame(plugin, ['a', 'b', 'c', 'd']);
        game.state.properties[3] = { owner: 0, houses: 1, mortgaged: false };
        game.state.players[1].position = 3;
        const props = {
          ...s.props,
          me: viewer,
          round: s.props.round + 1,
          last: null,
          view: game.view(viewer === 'spectator' ? null : viewer),
        };
        s.receive(props);
        s.propertySounds = [];
        game.state.moneySequence++;
        move(game.state, 1, 3, false, 4);
        s.receive({ ...props, view: game.view(viewer === 'spectator' ? null : viewer) });
      },
      { root, viewer },
    );
    await page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return !s.runtime.busy('money') && s.propertySounds.length === 1;
    });
    const sounds = await page.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').propertySounds,
    );
    if (sounds[0] !== (viewer === 'a' ? 'tycoon-coin' : 'tycoon-rent'))
      throw new Error(`${viewer} heard the wrong rent sound: ${sounds}`);
  }
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const game = testGame(plugin, ['a', 'b', 'c', 'd']);
    game.state.turn = 1;
    game.state.phase = 'debt';
    game.state.players[1].cash = 1;
    game.state.players[1].jailed = true;
    game.state.debt = { amount: 100, creditor: null, reason: 'Thuế', after: 'end' };
    const props = {
      ...s.props,
      me: 'a',
      round: s.props.round + 1,
      last: null,
      timer: null,
      view: game.view('a'),
    };
    s.receive(props);
    game.send('b', 'bankrupt');
    s.receive({
      ...props,
      view: game.view('a'),
      last: { seq: 1, player: 'b', move: { event: 'bankrupt' } },
    });
    s.bankruptFixture = { game, props };
  }, root);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return !s.runtime.busy('money') && !s.runtime.busy('turn');
  });
  const clip = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    if (
      s.people[1].style.color !== '#555555' ||
      !s.moneyIcons[1].renderFilters ||
      !s.locationIcons[1].renderFilters
    )
      throw new Error('The eliminated player retained colored text or icons');
    if (s.moneyIcons[0].renderFilters || s.people[0].style.color !== '#3d2b20')
      throw new Error('An active player lost their colors');
    const { left, top, size, imageH } = s.geometry;
    const y = top + imageH * 0.19 + 44;
    const a = window.__toScreen('co-ty-phu-classic', left + size * 0.51, y - 4);
    const b = window.__toScreen('co-ty-phu-classic', left + size * 0.79, y + 40);
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  });
  await page.screenshot({ path: t.shot('bankrupt-phone.png') });
  await page.screenshot({ path: t.shot('bankrupt-card-crop.png'), clip });
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const { game, props } = s.bankruptFixture;
    game.newGame();
    s.receive({ ...props, round: s.props.round + 1, view: game.view('a') });
    if (
      s.moneyIcons[1].renderFilters ||
      s.locationIcons[1].renderFilters ||
      s.people[1].style.color !== '#3d2b20'
    )
      throw new Error('A new game did not restore the player’s colors');
  });
}
