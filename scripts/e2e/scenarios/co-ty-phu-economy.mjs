import { clickCanvas, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(PHONE);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=4', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }, { move }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
      import(`/@fs${root}games/co-ty-phu-classic/src/game/rules.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
    const ids = ['a', 'b', 'c', 'd'];
    const game = testGame(plugin, ids);
    move(game.state, 0, 5, false, 7);
    const props = {
      ...s.props,
      players: ids.map((id, seat) => ({ id, name: `Người ${seat + 1}`, connected: true })),
      hostId: 'a',
      round: s.props.round + 1,
      result: null,
      timer: null,
      played: { ms: 10000, running: true },
    };
    let seq = 0;
    const deliver = (last = null) => {
      const me = ids[game.state.auction?.bidder ?? game.state.turn];
      s.receive({ ...props, me, view: game.view(me), last });
    };
    s.send = (event, payload = {}) => {
      const player = ids[game.state.auction?.bidder ?? game.state.turn];
      game.send(player, event, payload);
      deliver({ seq: ++seq, player, move: { event, payload } });
    };
    s.playbackSpeed = 2;
    s.runtime.setSpeed(2);
    const clear = s.board.clear.bind(s.board);
    const circle = s.board.fillCircle.bind(s.board);
    s.board.clear = () => {
      s.bidDots = [];
      return clear();
    };
    s.board.fillCircle = (x, y, radius) => {
      if (Math.abs(radius - s.geometry.tile * 0.09) < 0.001) s.bidDots.push({ x, y });
      return circle(x, y, radius);
    };
    s.economyGame = game;
    deliver();
  }, root);
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
  const bid = async () => {
    await idle();
    await clickCanvas(
      page,
      'co-ty-phu-classic',
      (s) => s.main.find((b) => b.hit.visible && b.text.text.startsWith('+10')).hit,
    );
    await idle();
  };
  const pass = async () => {
    await idle();
    await clickCanvas(
      page,
      'co-ty-phu-classic',
      (s) => s.main.find((b) => b.hit.visible && b.text.text.includes('Bỏ')).hit,
    );
    await idle();
  };
  await bid();
  await bid();
  await bid();
  const preview = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      dots: s.bidDots.length,
      cash: s.ctx.state.players.map((p) => p.cash),
      bids: s.ctx.state.auction.bids,
    };
  });
  if (preview.dots !== 3 || JSON.stringify(preview.cash) !== '[1490,1480,1470,1500]')
    throw new Error(`Station deposits or dots are incorrect: ${JSON.stringify(preview)}`);
  await page.screenshot({ path: t.shot('station-deposits-phone.png') });
  await pass();
  await bid();
  await pass();
  await pass();
  const result = await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      owner: s.ctx.state.properties[5].owner,
      cash: s.ctx.state.players.map((p) => p.cash),
      auction: s.ctx.state.auction,
      dots: s.bidDots.length,
    };
  });
  if (
    result.owner !== 0 ||
    result.auction ||
    result.dots ||
    JSON.stringify(result.cash) !== '[1300,1500,1500,1500]'
  )
    throw new Error(`Station settlement is incorrect: ${JSON.stringify(result)}`);
  await page.screenshot({ path: t.shot('station-settled-phone.png') });
}
