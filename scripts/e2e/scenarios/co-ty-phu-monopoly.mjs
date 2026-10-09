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
    const lit = s.monopolySymbols.marks.filter((mark) => mark.lit);
    return (
      lit.length === 2 &&
      lit[0].square === 1 &&
      lit[0].kind === 'sun' &&
      lit[1].square === 2 &&
      lit[1].kind === 'moon' &&
      s.tileEffects.every((effect) => !effect.occupants.length)
    );
  });
  if (!double) throw new Error('Two owned streets did not light their moon/sun pair');
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    for (const square of [6, 8]) s.monopolyGame.state.properties[square].owner = 0;
    s.monopolyDeliver();
    s.onResync(s.ctx);
    s.onState(s.ctx);
    const lit = s.monopolySymbols.marks.filter(
      (mark) => mark.lit && [6, 8, 9].includes(mark.square),
    );
    if (lit.length !== 2 || lit[0].square !== 6 || lit[1].square !== 8)
      throw new Error('Separated streets did not light a corresponding seal pair');
  });
  await page.screenshot({ path: t.shot('two-street-seals-desktop.png') });
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const g = s.monopolyGame;
    g.state.properties[3].owner = 0;
    g.state.properties[9].owner = 0;
    g.state.properties[1].houses = 2;
    g.state.properties[2].houses = 5;
    g.state.properties[12].owner = 0;
    g.state.properties[28].owner = 0;
    s.monopolyDeliver();
    s.onResync(s.ctx);
    s.onState(s.ctx);
  });
  const triple = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      lit: s.monopolySymbols.marks.filter((mark) => mark.lit),
      amounts: s.boardPrices.amounts.slice(1, 4),
      utility: s.boardPrices.amounts[12],
      scatteredAmounts: [6, 8, 9].map((i) => s.boardPrices.amounts[i]),
    };
  });
  if (
    triple.lit.length !== 8 ||
    triple.amounts.join() !== '220x3,750x3,18x3' ||
    triple.utility !== '🎲x10' ||
    triple.scatteredAmounts.join() !== '28x3,32x3,35x3'
  )
    throw new Error(`Monopoly seals or prices are wrong: ${JSON.stringify(triple)}`);
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
  // Expiry is free even at zero cash; the private doors finish before the next dice motion.
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const g = s.monopolyGame;
    g.state.phase = 'roll';
    g.state.turn = 1;
    g.state.players[1].position = 10;
    g.state.players[1].jailed = true;
    g.state.players[1].jailRolls = 2;
    g.state.players[1].cash = 0;
    g.state.devDice = [2, 3];
    s.monopolyDeliver();
    s.onResync(s.ctx);
    s.onState(s.ctx);
    s.releaseOrder = [];
    const play = s.runtime.audio.playIn;
    s.runtime.audio.playIn = function (scope, name, ...args) {
      if (name === 'tycoon-release' || name === 'tycoon-dice') s.releaseOrder.push(name);
      return play.call(this, scope, name, ...args);
    };
    const roll = s.dice.roll.bind(s.dice);
    s.dice.roll = (...values) => {
      s.diceBeforeRelease = s.jailGate.visible;
      return roll(...values);
    };
    const bail = s.main.find((button) => button.hit.visible && button.text.text === 'Ko đủ');
    if (
      !bail ||
      bail.enabled ||
      bail.hit.input.enabled ||
      !bail.icon.visible ||
      !bail.icon.texture.key.endsWith('/hud-money')
    )
      throw new Error('Unaffordable early bail is not visibly disabled with its money icon');
  });
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((b) => b.hit.visible && b.text.text === 'Ko đủ').hit,
  );
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    if (!s.ctx.state.players[1].jailed || s.ctx.state.players[1].cash !== 0)
      throw new Error('Disabled early bail sent a game move');
  });
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.diceHit);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').jailGate.stage === 'opening',
  );
  await page.screenshot({ path: t.shot('expired-jail-opening-phone.png') });
  await idle();
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const p = s.ctx.state.players[1];
    if (
      p.jailed ||
      p.jailRolls !== 0 ||
      p.cash !== 0 ||
      p.position !== 15 ||
      s.diceBeforeRelease ||
      s.releaseOrder.join() !== 'tycoon-release,tycoon-dice'
    )
      throw new Error('Jail expiry charged money or rolled before the doors finished opening');
  });
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
    return (
      !s.victory.shown &&
      !s.victory.objects.length &&
      !s.runtime.busy('victory') &&
      s.monopolySymbols.marks.every((mark) => !mark.lit) &&
      [...s.deedLayers.badges.values()].every((badge) => !badge.visible)
    );
  });
  if (!cleared) throw new Error('Victory objects remained over the next game');
}
