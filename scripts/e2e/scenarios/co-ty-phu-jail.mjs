// A fast player confirms and ends their turn while another viewer still shows the roll.
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  page.setDefaultTimeout(90000);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  // Isolate the injected rule snapshots from the sandbox's own real-time AFK timer.
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const receive = s.receive.bind(s);
    s.receive = (props) => {
      if (props.players[0]?.id === 'a') receive(props);
    };
  });
  const root = new URL('../../../', import.meta.url).pathname;
  const cases = [
    { name: 'go-jail-manual', target: 30 },
    { name: 'go-jail-owner', target: 30, own: true },
    { name: 'go-jail-owner-phone', target: 30, own: true, phone: true },
    { name: 'go-jail-owner-resync', target: 30, own: true, cancel: true },
    { name: 'go-jail-timer', target: 30, timer: true },
    { name: 'chance-jail', target: 7, deck: 'chance' },
    { name: 'chest-jail', target: 17, deck: 'chest', timer: true, own: true },
    { name: 'three-doubles', target: 10, doubles: true, bot: true },
    { name: 'still-in-jail', target: 10, jailed: true },
    { name: 'still-in-jail-owner', target: 10, jailed: true, own: true },
    { name: 'visiting-jail-owner', target: 10, visit: true, own: true },
    { name: 'receive-jail-ticket', target: 7, deck: 'chance', item: true },
  ];
  for (const fixture of cases) {
    await page.setViewportSize(fixture.phone ? PHONE : DESKTOP);
    await page.evaluate(
      async ({ root, fixture }) => {
        const [{ default: plugin }, { testGame }, { seededRng }] = await Promise.all([
          import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
          import(`/@fs${root}packages/sdk/src/testing.ts`),
          import(`/@fs${root}packages/sdk/src/rng.ts`),
        ]);
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.playbackSpeed = fixture.own ? 1 : 2;
        s.runtime.setSpeed(s.playbackSpeed);
        const doubleSeed = Array.from({ length: 100 }, (_, i) => i + 1).find((seed) => {
          const rng = seededRng(seed);
          for (let i = 0; i < 24; i++) rng();
          const first = Math.floor(rng() * 6);
          const second = Math.floor(rng() * 6);
          return first === second;
        });
        const seed = fixture.doubles ? doubleSeed : 1;
        const game = testGame(plugin, ['a', 'b'], { seed, bots: fixture.bot ? ['b'] : [] });
        const rng = seededRng(seed);
        for (let i = 0; i < 24; i++) rng();
        const sum = 2 + Math.floor(rng() * 6) + Math.floor(rng() * 6);
        game.state.turn = 1;
        game.state.players[1].position =
          fixture.doubles || fixture.jailed ? fixture.target : (fixture.target - sum + 40) % 40;
        game.state.players[1].jailed = !!fixture.jailed;
        if (fixture.doubles) game.state.doubles = 2;
        if (fixture.deck) game.state[fixture.deck] = [fixture.item ? 10 : 9];
        const props = {
          ...s.props,
          me: fixture.own ? 'b' : 'a',
          players: [
            { id: 'a', name: 'Người 1', connected: true },
            { id: 'b', name: 'Người 2', connected: true, bot: !!fixture.bot },
          ],
          hostId: 'a',
          round: s.props.round + 1,
          last: null,
          timer: null,
          played: { ms: 10000, running: true },
        };
        let seq = 0;
        let last = null;
        const deliver = (event, player = 'b') => {
          if (event) last = { seq: ++seq, player, move: { event } };
          s.receive({
            ...props,
            view: game.view(props.me),
            last,
          });
        };
        deliver();
        // Reuse one observer across fixtures, with one audio and frame probe.
        if (!s.jailProbe) {
          s.jailProbe = true;
          const play = s.runtime.audio.playIn;
          s.runtime.audio.playIn = function (scope, name, ...args) {
            if (name === 'tycoon-item-receive') s.itemSounds.push(name);
            if (name === 'tycoon-jail')
              s.jailSounds.push({
                seat: s.activeRoll?.seat,
                phase: s.visualPhase,
                moving: s.moving[1],
              });
            return play.call(this, scope, name, ...args);
          };
          s.events.on('update', () => {
            if (s.jailGate.visible)
              s.gateFrames.push({
                stage: s.jailGate.stage,
                closure: s.jailGate.closure,
                alpha: s.jailGate.doors[0].alpha,
                moving: s.moving[1],
              });
            if (
              s.freezeJailGate &&
              !s.jailGateFrozen &&
              s.jailGate.visible &&
              s.jailGate.closure > 0.999 &&
              s.moving[1]
            ) {
              s.jailGateFrozen = true;
              s.scene.pause();
            }
            if (s.activeRoll?.jailing && s.moving[1])
              s.jailFlight.add(`${s.tokens[1].x.toFixed(2)},${s.tokens[1].y.toFixed(2)}`);
          });
        }
        s.jailSounds = [];
        s.itemSounds = [];
        s.jailFlight = new Set();
        s.gateFrames = [];
        s.freezeJailGate = !!fixture.own;
        s.jailGateFrozen = false;
        game.send('b', 'roll');
        deliver('roll');
        if (game.state.players[1].position !== fixture.target)
          throw new Error('Fixture did not reach the expected event square');
        if (!fixture.jailed && !fixture.visit) {
          if (fixture.timer) {
            game.send('b', 'event-ready', { id: game.state.specialEvent.id });
            deliver('event-ready');
            game.fireTimer();
            // Server timers update state without adding a player-move event.
            deliver();
          } else {
            game.send('b', 'confirm-event');
            deliver('confirm-event');
          }
        }
        game.send('b', 'end-turn');
        deliver('end-turn');
        if (fixture.item && (s.inventory[1].freeCards.length || s.itemSounds.length))
          throw new Error('The jail ticket appeared before its card draw finished');
        if (s.ctx.state.turn !== 0 || !s.runtime.busy('turn'))
          throw new Error('Fixture did not overlap the previous player’s presentation');
      },
      { root, fixture },
    );
    if (!fixture.jailed && !fixture.item && !fixture.visit) {
      await page
        .waitForFunction(() => {
          const s = window.__phaser.scene.getScene('co-ty-phu-classic');
          return s.jailSounds.length === 1 && s.moving[1];
        })
        .catch(async () => {
          const details = await page.evaluate(() => {
            const s = window.__phaser.scene.getScene('co-ty-phu-classic');
            return {
              phase: s.visualPhase,
              sounds: s.jailSounds,
              projected: s.projectedPositions,
              shown: s.shownPositions,
              moving: s.moving,
              active: s.activeRoll,
              passedStart: s.passedStart,
              completedRoll: s.completedRoll,
              payments: s.payments,
              money: s.activeMoney,
              runtime: s.runtime.inspect(),
            };
          });
          throw new Error(`${fixture.name}: jail flight did not start: ${JSON.stringify(details)}`);
        });
      if (fixture.own) {
        await page.waitForFunction(() => {
          const s = window.__phaser.scene.getScene('co-ty-phu-classic');
          return s.jailGateFrozen;
        });
        await page.evaluate(() => {
          const s = window.__phaser.scene.getScene('co-ty-phu-classic');
          const gate = s.jailGate;
          const camera = s.cameras.main;
          const height = camera.height / camera.zoom;
          const width = camera.width / camera.zoom;
          if (!s.moving[1] || s.ctx.me.seat !== 1)
            throw new Error('Private jail doors did not coincide with the owner’s pawn journey');
          // The static door frame, including bleed, spans the viewport vertically.
          if (
            gate.doors.some((door) => Math.abs(door.y - camera.scrollY) > 0.1) ||
            Math.abs(gate.halfWidth * 2 - width) > 0.1 ||
            !gate.doors.every((door) => door.commandBuffer.includes(height))
          )
            throw new Error('Jail doors did not cover the full camera viewport');
        });
        await page.screenshot({ path: t.shot(`${fixture.name}-closed.png`) });
        await page.evaluate(() => {
          window.__phaser.scene.getScene('co-ty-phu-classic').scene.resume();
        });
        if (fixture.cancel) {
          await page.evaluate(() => {
            const s = window.__phaser.scene.getScene('co-ty-phu-classic');
            s.onResync(s.ctx);
            s.onState(s.ctx);
            if (s.jailGate.visible || s.jailGate.doors.some((door) => door.visible))
              throw new Error('Resync left private jail doors on screen');
          });
        }
      }
      await page.screenshot({ path: t.shot(`${fixture.name}-flight.png`) });
    }
    await page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' && !s.runtime.busy('turn') && !s.runtime.busy('inventory')
      );
    });
    const result = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      s.onState(s.ctx);
      return {
        position: s.shownPositions[1],
        sounds: s.jailSounds,
        flightFrames: s.jailFlight.size,
        turn: s.ctx.state.turn,
        items: s.inventory[1].freeCards,
        itemSounds: s.itemSounds,
        gateFrames: s.gateFrames,
        gateVisible: s.jailGate.visible,
      };
    });
    if (fixture.item) {
      if (
        result.items.join() !== 'chance' ||
        result.itemSounds.length !== 1 ||
        result.position !== 7
      )
        throw new Error(`Ticket receipt did not show its item/sound: ${JSON.stringify(result)}`);
      await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.onResync(s.ctx);
        s.onState(s.ctx);
        if (s.itemSounds.length !== 1) throw new Error('Resync repeated the item receipt sound');
      });
      await page.screenshot({ path: t.shot('jail-ticket.png') });
      continue;
    }
    if (result.gateVisible) throw new Error('Jail doors remained after their scoped journey');
    const privateGate = fixture.own && !fixture.jailed && !fixture.visit && !fixture.item;
    if (privateGate) {
      const closing = result.gateFrames.filter((frame) => frame.stage === 'closing');
      const recoil = result.gateFrames.filter((frame) => frame.stage === 'recoil');
      const settled = result.gateFrames.filter((frame) => frame.stage === 'settling');
      const faded = result.gateFrames.filter((frame) => frame.stage === 'fading');
      if (
        !closing.length ||
        !closing[0].moving ||
        (!fixture.cancel &&
          (!recoil.some((frame) => frame.closure < 0.995) ||
            !settled.some((frame) => frame.closure > 0.999) ||
            !faded.some((frame) => frame.alpha < 0.5)))
      )
        throw new Error(
          `${fixture.name}: missing slam/recoil/settle/fade: ${JSON.stringify(result)}`,
        );
    } else if (result.gateFrames.length) {
      throw new Error(`${fixture.name}: jail doors replayed or leaked to another viewer`);
    }
    const expectedSounds = fixture.jailed || fixture.visit ? 0 : 1;
    if (
      result.position !== 10 ||
      result.turn !== 0 ||
      result.sounds.length !== expectedSounds ||
      (!fixture.jailed &&
        !fixture.visit &&
        (result.sounds[0].seat !== 1 ||
          !result.sounds[0].moving ||
          result.sounds[0].phase !== 'moving' ||
          result.flightFrames < 2))
    )
      throw new Error(
        `${fixture.name}: missing or repeated jail flight/sound: ${JSON.stringify(result)}`,
      );
    await page.screenshot({ path: t.shot(`${fixture.name}-landed.png`) });
  }
  // The auction frame changes between two beats, without moving the controls or text.
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const game = testGame(plugin, ['a', 'b']);
    game.state.phase = 'end';
    game.state.properties[3].owner = 0;
    game.state.players[0].position = 3;
    const props = {
      ...s.props,
      me: 'a',
      round: s.props.round + 1,
      last: null,
      timer: null,
      view: game.view('a'),
    };
    s.receive(props);
    game.send('a', 'auction', { square: 3 });
    s.receive({
      ...props,
      view: game.view('a'),
      last: { seq: 1, player: 'a', move: { event: 'auction', payload: { square: 3 } } },
    });
  }, root);
  await page.waitForFunction(
    () =>
      window.__phaser.scene.getScene('co-ty-phu-classic').auctionAttention.commandBuffer.length > 0,
  );
  const pulse = await page.evaluate(() =>
    JSON.stringify(
      window.__phaser.scene.getScene('co-ty-phu-classic').auctionAttention.commandBuffer,
    ),
  );
  await page.waitForTimeout(350);
  const changed = await page.evaluate(
    (pulse) =>
      JSON.stringify(
        window.__phaser.scene.getScene('co-ty-phu-classic').auctionAttention.commandBuffer,
      ) !== pulse,
    pulse,
  );
  if (!changed) throw new Error('Auction attention did not pulse');
  await page.screenshot({ path: t.shot('auction-pulse.png') });
}
