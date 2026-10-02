import { clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  page.setDefaultTimeout(60000);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  for (const timer of [false, true]) {
    await page.evaluate(
      async ({ root, timer }) => {
        const [{ default: plugin }, { testGame }, { seededRng }] = await Promise.all([
          import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
          import(`/@fs${root}packages/sdk/src/testing.ts`),
          import(`/@fs${root}packages/sdk/src/rng.ts`),
        ]);
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.playbackSpeed = 2;
        s.runtime.setSpeed(2);
        if (!s.airportReceive) s.airportReceive = s.receive.bind(s);
        s.receive = (props) => {
          if (props.players[0]?.id === 'a') s.airportReceive(props);
        };
        const game = testGame(plugin, ['a', 'b'], { seed: 1 });
        const rng = seededRng(1);
        for (let i = 0; i < 24; i++) rng();
        const sum = 2 + Math.floor(rng() * 6) + Math.floor(rng() * 6);
        game.state.turn = 1;
        game.state.players[1].position = 20 - sum;
        const props = {
          ...s.props,
          me: timer ? 'a' : 'b',
          players: [
            { id: 'a', name: 'Người 1', connected: true },
            { id: 'b', name: 'Người 2', connected: true },
          ],
          hostId: 'a',
          round: s.props.round + 1,
          last: null,
          timer: null,
          played: { ms: 10000, running: true },
        };
        let seq = 0;
        let last = null;
        const deliver = (event) => {
          if (event) last = { seq: ++seq, player: 'b', move: { event } };
          s.receive({ ...props, view: game.view(props.me), last });
        };
        s.send = (event, payload = {}) => {
          game.send('b', event, payload);
          deliver(event);
        };
        s.airportGame = game;
        s.airportDeliver = deliver;
        s.airportFrames = new Set();
        s.airportTiles = new Set();
        if (!s.airportProbe) {
          s.airportProbe = true;
          s.events.on('update', () => {
            if (s.activeRoll?.from !== 20 || !s.moving[1]) return;
            s.airportFrames.add(`${s.tokens[1].x.toFixed(2)},${s.tokens[1].y.toFixed(2)}`);
            if (s.movingTiles[1] !== null) s.airportTiles.add(s.movingTiles[1]);
          });
        }
        deliver();
        game.send('b', 'roll');
        deliver('roll');
      },
      { root, timer },
    );
    try {
      await page.waitForFunction(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return s.visualPhase === 'decision' && s.shownPositions[1] === 20;
      });
    } catch (error) {
      await page.screenshot({ path: t.shot('airport-timeout.png') });
      const state = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return {
          phase: s.visualPhase,
          positions: s.shownPositions,
          state: s.ctx.state,
          roll: s.activeRoll,
          flow: s.runtime.inspect(),
        };
      });
      throw new Error(`${error.message}\nPresentation: ${JSON.stringify(state)}`);
    }
    if (!timer) {
      const heading = await page.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').heading.text,
      );
      if (heading !== 'Sân bay') throw new Error('Airport displayed the wrong event heading');
      await page.screenshot({ path: t.shot('airport-confirm-desktop.png') });
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else {
      await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.airportGame.send('b', 'event-ready', { id: s.airportGame.state.specialEvent.id });
        s.airportGame.fireTimer();
        s.airportDeliver();
      });
    }
    await page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        !s.runtime.busy('turn') &&
        s.shownPositions[1] !== 20 &&
        s.shownPositions[1] === s.airportGame.state.players[1].position
      );
    });
    await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      if (s.airportFrames.size < 2 || s.airportTiles.size !== 1)
        throw new Error('Airport did not animate a direct flight for the player/observer');
    });
    if (timer) {
      await page.setViewportSize(PHONE);
      await page.screenshot({ path: t.shot('airport-arrival-phone.png') });
    }
  }
}
