// Cờ Đam in the Godot client (#120): the sandbox (?play=checkers) against the computer on a
// phone. A few moves by tapping the squares with the mouse (captures first, landing square by
// landing square), then Đầu hàng twice; the result board says how it ended, Xem bàn puts it away
// and Kết quả brings it back. Then a host on a desktop makes a room for two friends and the
// second player sees the board turned round. Needs the debug web build
// (npm run godot:export -- --debug).

import {
  DESKTOP,
  godotText,
  launch,
  onScene,
  openGodot,
  PHONE,
  tap,
  tapCard,
  typeInto,
} from '../godot.mjs';

export const games = ['checkers'];
export { launch };

/** Your moves now (the view's `moves`), once it is your turn and nothing is moving. */
async function myMoves(page) {
  const handle = await page.waitForFunction(() => {
    const { room } = window.xomdao.state();
    if (room?.status !== 'playing' || room.view?.end) return { over: true };
    const moves = room.view?.moves ?? [];
    return moves.length ? { moves, plies: room.view.plies } : null;
  });
  return handle.jsonValue();
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(PHONE), '?play=checkers');
  await onScene(page, 'checkers', 60_000);
  await godotText(page, 'Status', 'Tới lượt bạn');
  await page.screenshot({ path: t.shot('1-start.png') });

  for (let turn = 0; turn < 4; turn++) {
    const { over, moves, plies } = await myMoves(page);
    if (over) break;
    const move = moves.find((m) => m.captures.length) ?? moves[0];
    for (const sq of move.path) {
      await page.waitForTimeout(150);
      await tap(page, `Square_${sq}`);
    }
    // Your move and the computer's reply.
    await page.waitForFunction(
      (before) => (window.xomdao.state().room?.view?.plies ?? 0) > before,
      plies,
    );
    if (turn === 1) await page.screenshot({ path: t.shot('2-playing.png') });
  }

  await tap(page, 'Resign');
  await godotText(page, 'Resign', 'Chắc chưa?');
  await tap(page, 'Resign');
  await godotText(page, 'ResultTitle', 'Máy thắng!');
  await godotText(page, 'ResultReason', 'Máy thắng · Bạn đầu hàng');
  await page.screenshot({ path: t.shot('3-result.png') });
  await tap(page, 'ViewBoard');
  // Hidden nodes are not found, so the put-away result board has no rect.
  await page.waitForFunction(() => window.xomdao.rect('ResultBoard') === null);
  await page.screenshot({ path: t.shot('4-board.png') });
  await tap(page, 'ShowResult');
  await godotText(page, 'ResultTitle', 'Máy thắng!');

  // Two friends: the host moves first (Đen, at the bottom); the guest sees it turned round.
  const host = await openGodot(t, await t.page(DESKTOP));
  const guest = await openGodot(t, await t.page(PHONE));
  await onScene(host, 'lobby');
  await tap(host, 'Island_co');
  await onScene(host, 'select');
  await tapCard(host, 'checkers');
  await tap(host, 'Choose');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Cờ Đam');
  await tap(host, 'CreateRoom');
  await tap(host, 'ConfirmCreate');
  await onScene(host, 'room');
  const code = await godotText(host, 'RoomCode', /^[A-Z0-9]{4}$/);
  await onScene(guest, 'lobby');
  await tap(guest, 'Place_ben');
  await onScene(guest, 'ben');
  await typeInto(guest, 'CodeInput', code.toLowerCase());
  await tap(guest, 'Join');
  await onScene(guest, 'room');
  await host.waitForFunction(() => window.xomdao.state().room?.players.length === 2);
  await tap(host, 'Start');
  await onScene(host, 'checkers');
  await onScene(guest, 'checkers');
  await godotText(host, 'Status', 'Tới lượt bạn');
  await godotText(guest, 'Status', /^Lượt Đen/);
  const bottom = (p) => p.evaluate(() => window.xomdao.rect('Square_62').y);
  const top = (p) => p.evaluate(() => window.xomdao.rect('Square_1').y);
  if (!((await bottom(host)) > (await top(host))))
    throw new Error("The host's own side is not at the bottom");
  if (!((await bottom(guest)) < (await top(guest))))
    throw new Error("The guest's board is not turned round");
  await host.screenshot({ path: t.shot('5-friends-host.png') });
  await guest.screenshot({ path: t.shot('6-friends-guest.png') });
}
