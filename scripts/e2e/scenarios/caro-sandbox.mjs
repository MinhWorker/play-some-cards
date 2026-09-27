// The sandbox (?play=<game>, no server room): a mark on the top edge grows the board by three
// rows, then a win; "Ván mới" leaves a clean 9×9 board (no pieces, no gold tiles from the old
// winning line).
import { caroPlay, PHONE } from '../lib.mjs';

export const games = ['tic-tac-toe'];

export default async function run(t) {
  const sandbox = await t.page(PHONE);
  await sandbox.goto(`${t.url}/?play=tic-tac-toe`);
  for (let x = 2; x <= 6; x++) {
    await sandbox.getByRole('button', { name: 'Người 1', exact: true }).click();
    await caroPlay(sandbox, x, 0);
    if (x === 2) await sandbox.screenshot({ path: t.shot('1-grown-top.png') });
    if (x === 6) break;
    await sandbox.getByRole('button', { name: 'Người 2', exact: true }).click();
    await caroPlay(sandbox, x, 2);
  }
  const grown = await sandbox.evaluate(() => {
    const { board } = window.__phaser.scene.getScene('tic-tac-toe').ctx.state;
    return `${board.cols}×${board.rows} from ${board.left},${board.top}`;
  });
  if (grown !== '9×12 from 0,-3') throw new Error(`The board is ${grown}, expected 9×12 from 0,-3`);
  await sandbox.waitForTimeout(1200);
  await sandbox.screenshot({ path: t.shot('2-win.png') });
  await sandbox.getByRole('button', { name: 'Ván mới' }).click();
  await sandbox.waitForTimeout(1000);
  const leftovers = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('tic-tac-toe');
    return {
      pieces: s.pieces.size,
      tinted: [...s.tiles.values()].filter((t) => t.isTinted).length,
      tiles: s.tiles.size,
    };
  });
  if (leftovers.pieces || leftovers.tinted || leftovers.tiles !== 81)
    throw new Error(`"Ván mới" left ${JSON.stringify(leftovers)} on the board`);
  await sandbox.screenshot({ path: t.shot('3-new-game.png') });
}
