import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(new URL('/?play=co-ty-phu-classic&players=2', t.url).toString());
  await page.waitForFunction(() => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx);
  const root = new URL('../../../', import.meta.url).pathname;
  await page.evaluate(async (root) => {
    const [{ default: plugin }, { testGame }] = await Promise.all([
      import(`/@fs${root}games/co-ty-phu-classic/src/index.ts`),
      import(`/@fs${root}packages/sdk/src/testing.ts`),
    ]);
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const game = testGame(plugin, ['a', 'b']);
    game.state.phase = 'end';
    s.receive({
      ...s.props,
      round: s.props.round + 1,
      me: 'a',
      hostId: 'a',
      players: ['a', 'b'].map((id, seat) => ({ id, name: `Người ${seat + 1}`, connected: true })),
      view: game.view('a'),
      result: null,
      timer: null,
      last: null,
      played: { ms: 10000, running: true },
    });
    // Isolate the renderer from the sandbox's own turn timer during the motion captures.
    s.receive = () => {};
  }, root);
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return (
      s.visualPhase === 'decision' &&
      !s.runtime.busy('turn') &&
      !s.runtime.busy('money') &&
      !s.activeMoney
    );
  });
  const names = ['tumble', 'arc', 'skipping', 'spiral'];
  for (const viewport of [DESKTOP, PHONE]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    let finalDrawing;
    const paths = new Set();
    for (const [index, name] of names.entries()) {
      const selected = await page.evaluate((index) => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.rollHint.setVisible(false);
        s.diceGlow.setVisible(false);
        const original = Math.random;
        try {
          Math.random = () => (index + 0.5) / 4;
          s.dice.roll(2, 5);
        } finally {
          Math.random = original;
        }
        s.dice.update(380);
        return { motion: s.dice.motion, drawing: JSON.stringify(s.dice.graphics.commandBuffer) };
      }, index);
      if (selected.motion !== name)
        throw new Error(`Random roll selected ${selected.motion}, expected ${name}`);
      paths.add(selected.drawing);
      const device = viewport === DESKTOP ? 'desktop' : 'phone';
      await page.screenshot({ path: t.shot(`${name}-${device}.png`) });
      const landed = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        s.dice.update(700);
        return {
          settled: s.dice.settled,
          values: s.dice.values,
          drawing: JSON.stringify(s.dice.graphics.commandBuffer),
        };
      });
      if (!landed.settled || landed.values.join() !== '2,5')
        throw new Error(`${name} did not settle on the authoritative dice values`);
      if (finalDrawing !== undefined && landed.drawing !== finalDrawing)
        throw new Error(`${name} settled at a different die orientation or position`);
      finalDrawing = landed.drawing;
    }
    if (paths.size !== 4)
      throw new Error('The four roll animations rendered identical motion frames');
    await page.screenshot({
      path: t.shot(`settled-${viewport === DESKTOP ? 'desktop' : 'phone'}.png`),
    });
  }

  // Exercise the real roll presentation, including native sound playback. Contacts must
  // follow the animation clock rather than drifting when the user switches to 2x.
  await page.mouse.click(4, 4);
  await page.evaluate(async () => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    const prepared = await s.runtime.audio.prepare([
      'tycoon-dice',
      'tycoon-dice-arc',
      'tycoon-dice-skipping',
      'tycoon-dice-spiral',
      'tycoon-dice-land',
    ]);
    if (prepared.some((sound) => sound.status !== 'ready'))
      throw new Error(`Dice sounds failed to decode: ${JSON.stringify(prepared)}`);
    const play = s.runtime.audio.playIn;
    s.diceSounds = [];
    s.runtime.audio.playIn = function (scope, name, ...args) {
      const voice = play.call(this, scope, name, ...args);
      if (name.startsWith('tycoon-dice')) {
        const cue = { name, elapsed: s.dice.elapsed, started: null, finished: null };
        s.diceSounds.push(cue);
        void voice.started.then((result) => {
          cue.started = result.status;
          if (result.status === 'started' && s.cancelDiceWhenStarted) {
            s.cancelDiceWhenStarted = false;
            s.runtime.cancelLane('turn');
            s.dice.hide();
          }
        });
        void voice.finished.then((result) => {
          cue.finished = result.status;
        });
      }
      return voice;
    };
    const roll = s.dice.roll.bind(s.dice);
    s.dice.roll = (a, b) => {
      roll(a, b);
      s.dice.motion = s.forcedDiceMotion;
    };
  });
  const expected = {
    tumble: [['tycoon-dice', 0]],
    arc: [
      ['tycoon-dice-arc', 0],
      ['tycoon-dice-land', 1080],
    ],
    skipping: [
      ['tycoon-dice-skipping', 216],
      ['tycoon-dice-skipping', 432],
      ['tycoon-dice-skipping', 648],
      ['tycoon-dice-skipping', 864],
      ['tycoon-dice-land', 1080],
    ],
    spiral: [
      ['tycoon-dice-spiral', 0],
      ['tycoon-dice-spiral', 129.6],
      ['tycoon-dice-spiral', 313.2],
      ['tycoon-dice-spiral', 550.8],
      ['tycoon-dice-spiral', 864],
      ['tycoon-dice-land', 1080],
    ],
  };
  for (const speed of [1, 2]) {
    for (const name of names) {
      await page.evaluate(
        ({ name, speed }) => {
          const s = window.__phaser.scene.getScene('co-ty-phu-classic');
          s.runtime.cancelLane('turn');
          s.diceSounds = [];
          s.forcedDiceMotion = name;
          s.playbackSpeed = speed;
          s.runtime.setSpeed(speed);
          s.visualPhase = 'decision';
          s.enqueueRoll({
            id: ++s.rollSequence,
            seat: 0,
            from: 0,
            to: 0,
            jailed: false,
            jailing: false,
            releasing: false,
            dice: [2, 5],
            notice: '',
            card: null,
            deck: null,
          });
        },
        { name, speed },
      );
      await page.waitForFunction(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'result',
      );
      const cues = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        if (!s.dice.settled || s.dice.values.join() !== '2,5')
          throw new Error('Audio changed the authoritative roll result');
        return s.diceSounds;
      });
      if (cues.length !== expected[name].length)
        throw new Error(`${name} at ${speed}x played unexpected cues: ${JSON.stringify(cues)}`);
      for (const [index, [sound, time]] of expected[name].entries()) {
        const cue = cues[index];
        // Each onset can occur just before the dice update in the same bounded frame.
        if (
          cue.name !== sound ||
          Math.abs(cue.elapsed - time) > 100 * speed + 1 ||
          cue.started !== 'started' ||
          cue.finished !== 'ended'
        )
          throw new Error(`${name} at ${speed}x missed a contact: ${JSON.stringify(cue)}`);
      }
    }
  }
  await page.evaluate(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    s.runtime.cancelLane('turn');
    s.diceSounds = [];
    s.forcedDiceMotion = 'spiral';
    s.playbackSpeed = 1;
    s.runtime.setSpeed(1);
    s.cancelDiceWhenStarted = true;
    s.visualPhase = 'decision';
    s.enqueueRoll({
      id: ++s.rollSequence,
      seat: 0,
      from: 0,
      to: 0,
      jailed: false,
      jailing: false,
      releasing: false,
      dice: [2, 5],
      notice: '',
      card: null,
      deck: null,
    });
  });
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').diceSounds[0]?.started === 'started',
  );
  await page.waitForTimeout(750);
  const cancelled = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').diceSounds,
  );
  if (cancelled.length !== 1 || cancelled[0].finished !== 'stopped')
    throw new Error(`Cancelled dice still played audio: ${JSON.stringify(cancelled)}`);
}
