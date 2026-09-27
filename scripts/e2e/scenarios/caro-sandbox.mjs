// The sandbox (?play=<game>, no server room): a win, then "Ván mới" on the same board size
// leaves a clean board (no pieces, no gold tiles from the old winning line).
import { caroPlay, PHONE } from '../lib.mjs';

export const games = ['tic-tac-toe'];

export default async function run(t) {
  const sandbox = await t.page(PHONE);
  await sandbox.goto(`${t.url}/?play=tic-tac-toe`);
  for (const [seat, cell] of [
    ['Người 1', 0],
    ['Người 2', 3],
    ['Người 1', 1],
    ['Người 2', 4],
    ['Người 1', 2],
  ]) {
    await sandbox.getByRole('button', { name: seat, exact: true }).click();
    await caroPlay(sandbox, cell);
  }
  await sandbox.getByRole('button', { name: 'Ván mới' }).click();
  await sandbox.waitForTimeout(400);
  const leftovers = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('tic-tac-toe');
    return {
      pieces: s.pieces.filter(Boolean).length,
      tinted: s.tiles.filter((t) => t.isTinted).length,
    };
  });
  if (leftovers.pieces || leftovers.tinted)
    throw new Error(`"Ván mới" left ${JSON.stringify(leftovers)} on the board`);
}
