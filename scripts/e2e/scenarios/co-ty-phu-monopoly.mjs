// Render the new rules through the real view and controls, backed by the authoritative game.
import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }, rules] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
      import(`/@fs${root}games/co-ty-phu-classic/src/game/rules.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
    const game = testGame(plugin, ['a', 'b']);
    let props = {
      ...s.props,
      round: s.props.round + 1,
      result: null,
      timer: null,
      me: 'a',
      hostId: 'a',
      last: null,
      played: { ms: 10000, running: true },
      players: ['a', 'b'].map((id, seat) => ({ id, name: `Người ${seat + 1}`, connected: true })),
    };
    let seq = 0;
    s.monopolyDeliver = (last) => {
      if (last !== undefined) props.last = last;
      s.receive({ ...props, view: game.view(props.me), result: game.result });
    };
    s.monopolySeat = (seat) => {
      props.me = seat === 0 ? 'a' : 'b';
      s.monopolyDeliver();
    };
    s.monopolyRestart = () => {
      game.newGame();
      props = { ...props, round: props.round + 1, me: 'a', last: null };
      seq = 0;
      s.monopolyDeliver();
    };
    s.send = (event, payload = {}) => {
      game.send(props.me, event, payload);
      s.monopolyDeliver({ seq: ++seq, player: props.me, move: { event, payload } });
    };
    s.monopolyGame = game;
    s.monopolyRules = rules;
    game.state.phase = 'end';
    game.state.properties[1].owner = 0;
    game.state.properties[2].owner = 0;
    game.state.players[0].freeCards = ['chance'];
    s.playbackSpeed = 2;
    s.monopolyDeliver();
  }, root);
  const idle = () =>
    page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        !s.runtime.busy('turn') &&
        !s.runtime.busy('money') &&
        !s.activeMoney
      );
    });
  await idle();
  const double = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.monopolyBorders.frames[0].count === 2 &&
      s.tileEffects.every((effect) => !effect.occupants.length)
    );
  });
  if (!double)
    throw new Error('Two owned streets did not merge, or pawn occupancy was still colored');
  await page.screenshot({ path: t.shot('two-street-frame-desktop.png') });
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const g = s.monopolyGame;
    g.state.properties[3].owner = 0;
    g.state.properties[1].houses = 2;
    g.state.properties[2].houses = 5;
    g.state.properties[14].owner = 0;
    g.state.properties[29].owner = 0;
    s.monopolyDeliver();
    s.onResync(s.ctx);
    s.onState(s.ctx);
  });
  const triple = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      count: s.monopolyBorders.frames[0].count,
      amounts: s.boardPrices.amounts.slice(1, 4),
      utility: s.boardPrices.amounts[14],
    };
  });
  if (
    triple.count !== 3 ||
    triple.amounts.join() !== '220x3,750x3,18x3' ||
    triple.utility !== '🎲x10'
  )
    throw new Error(`Monopoly or utility prices are wrong: ${JSON.stringify(triple)}`);
  await page.screenshot({ path: t.shot('monopoly-buildings-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('monopoly-buildings-phone.png') });
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.tradeOpen = true;
    s.onState(s.ctx);
  });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[1].hit);
  const offer = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.tradeGive === -2 && s.takeCash === 200 && s.main[1].text.text.includes('Vé ra tù');
  });
  if (!offer) throw new Error('Exchange picker did not offer a ticket at its fixed 200 price');
  await page.screenshot({ path: t.shot('ticket-offer-phone.png') });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[7].hit);
  await page.evaluate(() => window.__phaser.scene.getScene('co-ty-phu-classic').monopolySeat(1));
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((b) => b.hit.visible && b.text.text === 'Chấp nhận').hit,
  );
  await idle();
  const accepted = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.ctx.state.players[1].cash === 800 &&
      s.ctx.state.players[1].freeCards.join() === 'chance' &&
      !s.ctx.state.players[0].freeCards.length
    );
  });
  if (!accepted) throw new Error('Accepting the ticket did not transfer the card and 200');
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const g = s.monopolyGame;
    g.state.turn = 1;
    g.state.phase = 'roll';
    g.state.players[1].jailed = true;
    g.state.players[1].position = 10;
    s.monopolyDeliver();
    s.onResync(s.ctx);
    s.onState(s.ctx);
    s.releaseFrames = [];
    s.events.on('update', () => {
      if (s.jailGate.stage === 'opening') s.releaseFrames.push(s.jailGate.closure);
    });
  });
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((b) => b.hit.visible && b.text.text.includes('thẻ ra tù')).hit,
  );
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').jailGate.stage === 'opening',
  );
  await page.screenshot({ path: t.shot('jail-opening-phone.png') });
  await idle();
  const opened = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      !s.ctx.state.players[1].jailed &&
      s.releaseFrames.some((x) => x > 0.9) &&
      s.releaseFrames.some((x) => x < 0.2) &&
      !s.jailGate.visible
    );
  });
  if (!opened)
    throw new Error('Jail release did not animate closed doors opening and then hide them');
  await page.setViewportSize(DESKTOP);
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const g = s.monopolyGame;
    g.state.players[1].cash = 1;
    s.monopolyRules.move(g.state, 1, 1, false, 7);
    s.monopolyDeliver();
    s.send('bankrupt');
  });
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').victory.shown,
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: t.shot('victory-fireworks-desktop.png') });
  await page.waitForFunction(
    () => !window.__phaser.scene.getScene('co-ty-phu-classic').runtime.busy('victory'),
  );
  const result = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const total = s.monopolyRules.assetValue(s.ctx.state, 0);
    const texts = s.victory.objects
      .filter((object) => object.type === 'Text')
      .map((object) => object.text);
    return (
      s.ctx.state.winner === 0 &&
      s.victory.objects.some(
        (object) => object.type === 'Image' && object.texture.key.endsWith('pawn-front-red'),
      ) &&
      texts.some((text) => text.includes('chiến thắng')) &&
      texts.some((text) => text.includes(Math.round(total).toLocaleString('vi-VN')))
    );
  });
  if (!result) throw new Error('Victory count-up did not finish at the authoritative asset total');
  await page.screenshot({ path: t.shot('victory-assets-desktop.png') });
  await page.evaluate(() => window.__phaser.scene.getScene('co-ty-phu-classic').monopolyRestart());
  const cleared = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return !s.victory.shown && !s.victory.objects.length && !s.runtime.busy('victory');
  });
  if (!cleared) throw new Error('Victory objects remained over the next game');
}
