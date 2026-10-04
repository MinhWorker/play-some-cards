import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/?play=co-ty-phu-classic&players=4', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
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
        Object.assign(game.state, { turn: 1, phase: 'buy', pending: 3, after });
        game.state.players[1].position = 3;
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
  await move('auction', 'b');
  await move('bid', 'b', { amount: 50 });
  await assertPanel(1, 'auction', 2);
  await move('pass', 'c');
  await move('pass', 'd');
  await assertPanel(1, 'auction', 0);
  await page.screenshot({ path: t.shot('auction-turn-owner.png') });
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((button) => button.hit.visible && button.text.text.startsWith('+10 ')).hit,
  );
  await move('pass', 'b');
  await idle();
  await assertPanel(1, 'end');
  await move('end-turn', 'b');
  await assertPanel(2, 'roll');
  await page.screenshot({ path: t.shot('auction-next-turn.png') });

  // No sale and an extra roll must also keep the original turn owner's node.
  await page.evaluate(() =>
    window.__phaser.scene.getScene('co-ty-phu-classic').panelFixture('street', 'roll'),
  );
  await move('auction', 'b');
  for (const player of ['b', 'c', 'd', 'a']) await move('pass', player);
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
