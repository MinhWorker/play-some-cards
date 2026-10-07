// Dragging ships previews the drop without changing the authoritative fleet until release.
import { canvasPoint, clickCanvas, DESKTOP, PHONE } from '../lib.mjs';

export const games = ['battleship'];

const fleet = [
  [0, 1, 2, 3, 4],
  [20, 21, 22, 23],
  [40, 41, 42],
  [60, 70, 80],
  [86, 87],
];
const point = (page, cell) =>
  page.evaluate((cell) => {
    const s = window.__phaser.scene.getScene('battleship');
    const p = s.pointXY(cell);
    return window.__toScreen('battleship', p.x, p.y);
  }, cell);

const state = (page) =>
  page.evaluate(() => {
    const s = window.__phaser.scene.getScene('battleship');
    return {
      ships: s.ctx.state.waters[s.mySeat(s.ctx)].ships.map((ship) => ship.cells),
      ghost: s.ghost.length,
      alpha: s.ghost.first?.alpha,
      valid: s.press?.target?.valid,
      target: s.press?.target?.ship?.cells,
      dragging: Boolean(s.press?.moved),
    };
  });

function equal(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
}

async function waitShip(page, index, cells) {
  await page.waitForFunction(
    ({ index, cells }) => {
      const s = window.__phaser.scene.getScene('battleship');
      return JSON.stringify(s.ctx.state.waters[0].ships[index].cells) === JSON.stringify(cells);
    },
    { index, cells },
  );
}

async function dragTo(page, from, to) {
  const start = await point(page, from);
  const end = await point(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.waitForFunction(() => window.__phaser.scene.getScene('battleship').press?.moved);
}

export default async function run(t) {
  for (const [name, viewport] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ]) {
    const page = await t.page(viewport);
    const cdp = name === 'phone' ? await page.context().newCDPSession(page) : null;
    if (cdp)
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await page.goto(`${t.url}/?play=battleship&players=2`);
    await page.waitForFunction(() => window.__phaser?.scene.isActive('battleship'));
    await page.evaluate((cells) => {
      window.__phaser.scene.getScene('battleship').send('arrange', {
        ships: cells.map((cells) => ({ cells })),
      });
    }, fleet);
    await waitShip(page, 0, fleet[0]);

    // Grab the third cell: it must stay under the pointer, with no move sent before drop.
    await dragTo(page, 2, 7);
    const preview = await state(page);
    equal(preview.ships, fleet, 'Dragging changed the fleet before release');
    equal(preview.target, [5, 6, 7, 8, 9], 'The grabbed cell offset was lost');
    if (!preview.valid || preview.ghost !== 1 || !(preview.alpha > 0 && preview.alpha < 1))
      throw new Error('A valid drop has no translucent preview');
    await page.screenshot({ path: t.shot(`valid-${name}.png`) });
    await page.mouse.up();
    await waitShip(page, 0, [5, 6, 7, 8, 9]);
    const placed = (await state(page)).ships;
    if ((await state(page)).ghost) throw new Error('The ghost survived the drop');

    // Collision, forbidden adjacency and a ship crossing the edge all reject the drop.
    for (const [label, cell] of [
      ['collision', 22],
      ['spacing', 12],
      ['edge', 0],
    ]) {
      await dragTo(page, 7, cell);
      const invalid = await state(page);
      if (invalid.valid !== false || invalid.ghost !== 1)
        throw new Error(`${label}: invalid placement was not previewed`);
      await page.screenshot({ path: t.shot(`${label}-${name}.png`) });
      await page.mouse.up();
      equal((await state(page)).ships, placed, `${label}: invalid drop moved a ship`);
    }

    await dragTo(page, 7, 8);
    const outside = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('battleship');
      return window.__toScreen('battleship', s.bigSea.x0 - s.bigSea.cell / 2, s.bigSea.y0);
    });
    await page.mouse.move(outside.x, outside.y);
    await page.mouse.up();
    equal((await state(page)).ships, placed, 'Dropping outside the sea moved a ship');
    if ((await state(page)).ghost) throw new Error('An outside drop left a ghost');

    // Dropping onto a placement button must not trigger its action.
    for (const button of ['shuffle', 'ready']) {
      await dragTo(page, 7, 8);
      const target = await canvasPoint(page, 'battleship', (s) => s.buttons.ready.container);
      if (button === 'shuffle') {
        const shuffle = await canvasPoint(page, 'battleship', (s) => s.buttons.shuffle.container);
        target.x = shuffle.x;
        target.y = shuffle.y;
      }
      await page.mouse.move(target.x, target.y, { steps: 8 });
      await page.mouse.up();
      equal((await state(page)).ships, placed, `Dropping onto ${button} changed the fleet`);
      const ready = await page.evaluate(
        () => window.__phaser.scene.getScene('battleship').ctx.state.ready[0],
      );
      if (ready) throw new Error(`Dropping onto ${button} readied the player`);
    }

    await dragTo(page, 70, 74);
    equal((await state(page)).target, [64, 74, 84], 'Vertical grab offset was lost');
    await page.mouse.up();
    await waitShip(page, 3, [64, 74, 84]);

    // Viewer changes use resync and must clear a drag without leaking another fleet.
    await dragTo(page, 7, 8);
    await page.getByRole('button', { name: 'Khán giả', exact: true }).click();
    await page.mouse.up();
    const clean = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('battleship');
      return !s.press && s.ghost.length === 0 && s.bigFleet.length === 0;
    });
    if (!clean) throw new Error('Resync kept the drag or exposed ships to a spectator');
    await page.getByRole('button', { name: 'Người 1', exact: true }).click();

    // Existing tap-to-select and tap-to-rotate still work after dragging.
    const smallest = await point(page, 86);
    await page.mouse.click(smallest.x, smallest.y);
    await page.mouse.click(smallest.x, smallest.y);
    await waitShip(page, 4, [86, 96]);

    if (cdp) {
      const start = await point(page, 7);
      const end = await point(page, 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
      await page.waitForFunction(() => window.__phaser.scene.getScene('battleship').press?.moved);
      await page.screenshot({ path: t.shot('touch-phone.png') });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await waitShip(page, 0, fleet[0]);
      const beforeCancel = (await state(page)).ships;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [end] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [start] });
      await page.waitForFunction(() => window.__phaser.scene.getScene('battleship').press?.moved);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      equal((await state(page)).ships, beforeCancel, 'Touch cancellation committed a drop');
      if ((await state(page)).ghost) throw new Error('Touch cancellation kept the ghost');
      await cdp.detach();
    }

    await clickCanvas(page, 'battleship', (s) => s.buttons.ready.container);
    const readyFleet = (await state(page)).ships;
    await dragToReady(page);
    equal((await state(page)).ships, readyFleet, 'A ready player could move ships');
    await page.screenshot({ path: t.shot(`ready-${name}.png`) });
    await page.close();
  }
}

async function dragToReady(page) {
  const ship = (await state(page)).ships[0];
  const start = await point(page, ship[0]);
  const end = await point(page, 55);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  if ((await state(page)).ghost) throw new Error('A ready player saw a placement ghost');
  await page.mouse.up();
}
