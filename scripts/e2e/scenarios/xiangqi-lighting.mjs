// Lit ivory discs, shadows under every piece, and cleanup through capture/resync/restart.
import { clickCanvas, DESKTOP } from '../lib.mjs';

export const games = ['xiangqi'];

async function assertPieces(page, count) {
  const valid = await page.evaluate((expected) => {
    const s = window.__phaser.scene.getScene('xiangqi');
    const atlas = s.textures.get('xiangqi/pieces');
    return (
      atlas.getFrameNames().length === 14 &&
      atlas.dataSource[0]?.width === atlas.source[0]?.width &&
      atlas.dataSource[0]?.height === atlas.source[0]?.height &&
      s.shadowLayer.depth < s.pieceLayer.layer.depth &&
      s.shadowLayer.list.length === expected &&
      s.pieceLayer.layer.list.length === expected &&
      [...s.pieces.values()].every(
        (obj) =>
          obj.image.lighting &&
          obj.image.frame.name !== '__BASE' &&
          obj.image.tintTopLeft === 0xffffff &&
          obj.container.displayList === s.pieceLayer.layer &&
          obj.shadowRoot.displayList === s.shadowLayer &&
          obj.shadow.parentContainer === obj.shadowRoot &&
          obj.container.list.length === 1,
      )
    );
  }, count);
  if (!valid) throw new Error(`xiangqi: lit ivory atlas or separate shadows failed (${count})`);
}

async function move(page, from, to) {
  for (const sq of [from, to]) {
    const at = await page.evaluate((square) => {
      const s = window.__phaser.scene.getScene('xiangqi');
      const { x, y } = s.pointXY(square);
      return window.__toScreen('xiangqi', x, y);
    }, sq);
    await page.mouse.click(at.x, at.y);
  }
  await page.mouse.move(0, 0);
  try {
    await page.waitForFunction((destination) => {
      const s = window.__phaser.scene.getScene('xiangqi');
      const obj = s.pieces.get(destination);
      const at = s.piecePos(destination);
      return (
        !s.runtime.busy('turn') &&
        !s.leaving.size &&
        obj?.container.x === at.x &&
        obj.container.y === at.y &&
        obj.image.y === 0
      );
    }, to);
  } catch (error) {
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('xiangqi');
      return { plies: s.ctx.state.plies, selected: s.selected, runtime: s.runtime.inspect() };
    });
    throw new Error(`Move ${from}-${to} did not settle: ${JSON.stringify(state)}: ${error}`);
  }
}

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=xiangqi&players=2`);
  await page.waitForFunction(() => window.__phaser?.scene.getScene('xiangqi')?.pieces?.size === 32);
  await assertPieces(page, 32);
  await page.screenshot({ path: t.shot('ivory-start.png') });

  await move(page, 54, 45);
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await move(page, 27, 36);
  await page.getByRole('button', { name: 'Người 1', exact: true }).click();
  await move(page, 45, 36);
  await assertPieces(page, 31);
  await page.screenshot({ path: t.shot('after-capture.png') });

  await clickCanvas(page, 'xiangqi', (s) => s.buttons.effects.container);
  await page.getByRole('button', { name: 'Người 2', exact: true }).click();
  await assertPieces(page, 31);
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await page.waitForFunction(() => window.__phaser.scene.getScene('xiangqi').pieces.size === 32);
  await assertPieces(page, 32);
  await page.screenshot({ path: t.shot('new-round.png') });
}
