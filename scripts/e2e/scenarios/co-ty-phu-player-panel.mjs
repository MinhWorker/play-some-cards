import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/?play=co-ty-phu-classic&players=4', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
    null,
    { timeout: 60000 },
  );
  // Persistent effects must animate without canvas uploads or per-object filter passes.
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const symbols = s.specialSymbols;
    const gl = s.game.renderer.gl;
    let uploads = 0;
    const originals = ['texImage2D', 'texSubImage2D'].map((name) => [name, gl[name]]);
    for (const [name, call] of originals)
      gl[name] = (...args) => {
        uploads++;
        return call.apply(gl, args);
      };
    const frames = symbols.layers.map(() => new Set());
    try {
      for (const time of [0, 200, 400, 700, 1000, 1500]) {
        symbols.update(time);
        symbols.layers.forEach((layer, index) => {
          frames[index].add(layer.image.frame.name);
        });
      }
    } finally {
      for (const [name, call] of originals) gl[name] = call;
    }
    if (uploads) throw new Error(`Symbol animations uploaded textures ${uploads} times`);
    const atlasKeys = new Set(symbols.layers.map((layer) => layer.image.texture.key));
    if (
      atlasKeys.size !== 1 ||
      s.diceGlow.willRenderFilters() ||
      symbols.layers.some(
        (layer, index) =>
          layer.image.willRenderFilters() ||
          (layer.animations[0].duration && frames[index].size < 2),
      )
    )
      throw new Error('Persistent symbol effects stopped animating or still use live filters');
    const owners = s.ctx.state.properties.map((property) => property.owner);
    const colors = [0xdf6554, 0x5793d3, 0x60af72, 0xe6be52];
    for (let owner = 0; owner < colors.length; owner++) {
      const next = [...owners];
      for (const square of [5, 15, 25, 35]) next[square] = owner;
      symbols.setOwners(next, colors);
      symbols.update(0);
      for (const square of [5, 15, 25, 35]) {
        const layer = symbols.accents.find((accent) => accent.square === square).layer;
        const frame = layer.image.frame;
        const pixels = frame.source.image
          .getContext('2d')
          .getImageData(frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight).data;
        const color = colors[owner];
        let colored = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i] === ((color >> 16) & 255) &&
            pixels[i + 1] === ((color >> 8) & 255) &&
            pixels[i + 2] === (color & 255) &&
            pixels[i + 3] > 200
          )
            colored++;
        if (!colored) throw new Error(`Station ${square} lost owner ${owner}'s color`);
      }
    }
    symbols.setOwners(owners, colors);
    symbols.update(s.time.now);
    let redraws = 0;
    const redraw = s.countdownLabel.updateText;
    s.countdownLabel.updateText = function (...args) {
      redraws++;
      return redraw.apply(this, args);
    };
    for (let i = 0; i < 10; i++) s.drawEventCountdown({ ...s.ctx, timer: null });
    s.countdownLabel.updateText = redraw;
    if (redraws) throw new Error('A hidden countdown still regenerates its text texture');
    s.drawEventCountdown(s.ctx);
    s.playerPanel.update(s.geometry);
    const changed = [];
    const refreshes = s.playerPanel.entries
      .filter((entry) => entry.texture)
      .map((entry) => {
        const refresh = entry.texture.refresh;
        entry.texture.refresh = function (...args) {
          changed.push(entry.source);
          return refresh.apply(this, args);
        };
        return [entry.texture, refresh];
      });
    const previous = s.playerCash[0].text;
    s.setSeatCash(0, '999 ₫');
    s.playerPanel.update(s.geometry);
    for (const [texture, refresh] of refreshes) texture.refresh = refresh;
    if (
      !changed.length ||
      changed.some((source) => source !== s.playerCash[0] && source !== s.turnCash)
    )
      throw new Error('One changing balance repainted unrelated player panel content');
    s.setSeatCash(0, previous);
    s.playerPanel.update(s.geometry);
  });
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }, { decisionSeat }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
      import(`/@fs${root}games/co-ty-phu-classic/src/game/turnClock.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
    const ids = ['a', 'b', 'c', 'd'];
    let game, props, seq;
    const deliver = (last = null) => s.receive({ ...props, view: game.view('a'), last });
    s.panelFixture = (kind, after = 'end') => {
      game = testGame(plugin, ids);
      seq = 0;
      if (kind === 'street') {
        Object.assign(game.state, { turn: 1, phase: after, after });
        game.state.players[1].position = 3;
        game.state.properties[3].owner = 1;
      } else {
        // Two settled stations refund 350, then buying both leaves an off-turn debt.
        game.state.players[0].cash = 0;
        for (const [square, highest, deposit] of [
          [5, 50, 50],
          [15, 150, 300],
        ]) {
          game.state.stationAuctions[square] = {
            square,
            highest,
            leader: 0,
            passed: [1, 3],
            bids: [deposit, 0, 0, 0],
          };
        }
        Object.assign(game.state, { turn: 3, phase: 'end' });
      }
      props = {
        ...s.props,
        me: 'a',
        players: ids.map((id, seat) => ({ id, name: `Người ${seat + 1}`, connected: true })),
        hostId: 'a',
        round: s.props.round + 1,
        played: { ms: 10000, running: true },
        result: null,
        timer: null,
      };
      s.playbackSpeed = 3;
      s.runtime.setSpeed(3);
      deliver();
      if (kind === 'station') {
        game.leave('c');
        deliver();
      }
    };
    s.panelMove = (event, player, payload = {}) => {
      game.send(player, event, payload);
      deliver({ seq: ++seq, player, move: { event, payload } });
    };
    s.send = (event, payload = {}) => s.panelMove(event, 'a', payload);
    s.panelDecision = () => decisionSeat(game.state);
  }, root);
  const move = (event, player, payload = {}) =>
    page.evaluate(
      ({ event, player, payload }) => {
        window.__phaser.scene.getScene('co-ty-phu-classic').panelMove(event, player, payload);
      },
      { event, player, payload },
    );
  const assertPanel = async (turn, phase, decision = turn) => {
    const actual = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return {
        turn: s.ctx.state.turn,
        phase: s.ctx.state.phase,
        decision: s.panelDecision(),
        name: s.turnName.text,
        lit: s.playerBadges.flatMap((badge, seat) => (badge.alpha === 1 ? [seat] : [])),
      };
    });
    if (
      actual.turn !== turn ||
      actual.phase !== phase ||
      actual.decision !== decision ||
      actual.name !== `Người ${turn + 1}` ||
      JSON.stringify(actual.lit) !== `[${turn}]`
    )
      throw new Error(
        `Player panel follows a decision instead of the turn: ${JSON.stringify(actual)}`,
      );
  };
  const idle = () =>
    page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        !s.activeMoney &&
        !s.payments.length &&
        !s.runtime.busy('turn')
      );
    });

  await page.evaluate(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').panelFixture('street'),
  );
  await move('auction', 'b', { square: 3 });
  await move('bid', 'c', { amount: 50 });
  await assertPanel(1, 'auction', 3);
  await move('pass', 'd');
  await assertPanel(1, 'auction', 0);
  await page.screenshot({ path: t.shot('auction-turn-owner.png') });
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((button) => button.hit.visible && button.text.text.startsWith('+36 ')).hit,
  );
  await move('pass', 'c');
  await idle();
  await assertPanel(1, 'end');
  await move('end-turn', 'b');
  await assertPanel(2, 'roll');
  await page.screenshot({ path: t.shot('auction-next-turn.png') });

  // No sale and an extra roll must also keep the original turn owner's node.
  await page.evaluate(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').panelFixture('street', 'roll'),
  );
  await move('auction', 'b', { square: 3 });
  for (const player of ['c', 'd', 'a']) await move('pass', player);
  await assertPanel(1, 'roll');

  await page.setViewportSize(PHONE);
  await page.evaluate(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').panelFixture('station'),
  );
  await idle();
  await assertPanel(3, 'debt', 0);
  await page.screenshot({ path: t.shot('station-debt-turn-owner-phone.png') });
  // Rebuilding the scene and resizing must preserve the same indicator.
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.onResync(s.ctx);
    s.onState(s.ctx);
  });
  await assertPanel(3, 'debt', 0);
  await move('mortgage', 'a', { square: 5 });
  await idle();
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((button) => button.hit.visible && button.text.text.startsWith('Trả ')).hit,
  );
  await idle();
  await assertPanel(3, 'end');
  await move('end-turn', 'd');
  await assertPanel(0, 'roll');
  if (errors.length) throw new Error(`Player panel runtime errors: ${errors.join('; ')}`);
}
