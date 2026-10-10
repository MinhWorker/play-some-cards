// Cờ Vua in the Godot client (#120): the sandbox (?play=chess) against the computer on a phone.
// A few moves by tapping the squares with the mouse (captures first; Phong cấp picks a queen),
// then Đầu hàng twice; the result board says how it ended, Xem bàn puts it away and Kết quả
// brings it back. Then a host on a desktop makes a room for two friends and Black sees the board
// turned round. Needs the debug web build (npm run godot:export -- --debug).

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

export const games = ['chess'];
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
  const page = await openGodot(t, await t.page(PHONE), '?play=chess');
  await onScene(page, 'chess', 60_000);
  await godotText(page, 'Status', 'Tới lượt bạn');
  await page.screenshot({ path: t.shot('1-start.png') });

  for (let turn = 0; turn < 4; turn++) {
    const { over, moves, plies } = await myMoves(page);
    if (over) break;
    const board = await page.evaluate(() => window.xomdao.state().room.view.board);
    const move =
      moves.find((m) => board[m.to] && (!m.promotion || m.promotion === 'q')) ??
      moves.find((m) => !m.promotion || m.promotion === 'q');
    await tap(page, `Square_${move.from}`);
    await page.waitForTimeout(150);
    await tap(page, `Square_${move.to}`);
    if (move.promotion) await tap(page, 'Promote_q');
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

  // Two friends: the host plays White (at the bottom); the guest, Black, sees it turned round.
  const host = await openGodot(t, await t.page(DESKTOP));
  const guest = await openGodot(t, await t.page(PHONE));
  await onScene(host, 'lobby');
  await tap(host, 'Island_co');
  await onScene(host, 'select');
  await tapCard(host, 'chess');
  await tap(host, 'Choose');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Cờ Vua');
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
  await onScene(host, 'chess');
  await onScene(guest, 'chess');
  await godotText(host, 'Status', 'Tới lượt bạn');
  await godotText(guest, 'Status', /^Lượt Trắng/);
  const bottom = (p) => p.evaluate(() => window.xomdao.rect('Square_60').y);
  const top = (p) => p.evaluate(() => window.xomdao.rect('Square_4').y);
  if (!((await bottom(host)) > (await top(host))))
    throw new Error("The host's own side is not at the bottom");
  if (!((await bottom(guest)) < (await top(guest))))
    throw new Error("The guest's board is not turned round");
  await host.screenshot({ path: t.shot('5-friends-host.png') });
  await guest.screenshot({ path: t.shot('6-friends-guest.png') });
}
