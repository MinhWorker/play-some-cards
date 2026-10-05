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
}
