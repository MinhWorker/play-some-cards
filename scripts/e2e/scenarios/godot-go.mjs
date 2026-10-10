// Cờ Vây in the Godot client (#120): the sandbox (?play=go) against the computer on a phone. A
// few stones by tapping the points with the mouse, a pass, then Đầu hàng through its dialog; the
// result board says how it ended, Xem bàn puts it away and Kết quả brings it back. Then a host on
// a desktop makes a room for two friends: the host plays Black and White waits. Needs the debug
// web build at /godot/ (npm run godot:export -- --debug).

import { godotText, launch, onScene, openGodot, tap, tapCard, typeInto } from '../godot.mjs';
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['go'];
export { launch };

/** The view once it is your turn and nothing is pending. */
async function myTurn(page) {
  const handle = await page.waitForFunction(() => {
    const { room } = window.xomdao.state();
    if (room?.status !== 'playing' || room.view?.end) return { over: true };
    const moves = room.view?.moves ?? [];
    return moves.length ? { moves, plies: room.view.plies } : null;
  });
  return handle.jsonValue();
}

/** Waits for your move and the computer's reply. */
async function replied(page, plies) {
  await page.waitForFunction(
    (before) => (window.xomdao.state().room?.view?.plies ?? 0) >= before + 2,
    plies,
  );
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(PHONE), '?play=go');
  await onScene(page, 'go', 60_000);
  await godotText(page, 'Status', 'Lượt bạn');
  await page.screenshot({ path: t.shot('1-start.png') });

  // Star points first, then the 3-3 points: all empty early on unless the computer took them.
  for (const point of [72, 288, 60, 300, 180]) {
    const { over, moves, plies } = await myTurn(page);
    if (over) break;
    const p = moves.includes(point) ? point : moves[0];
    await tap(page, `Point_${p}`);
    await replied(page, plies);
  }
  await page.screenshot({ path: t.shot('2-playing.png') });

  const { plies } = await myTurn(page);
  await tap(page, 'Pass');
  await replied(page, plies);

  await tap(page, 'Resign');
  await page.waitForFunction(() => window.xomdao.rect('ResignDialog') !== null);
  await page.screenshot({ path: t.shot('3-resign.png') });
  await tap(page, 'ConfirmResign');
  await godotText(page, 'ResultTitle', 'Máy thắng!');
  await godotText(page, 'ResultReason', 'Bạn đầu hàng');
  await page.screenshot({ path: t.shot('4-result.png') });
  await tap(page, 'ViewBoard');
  // Hidden nodes are not found, so the put-away result board has no rect.
  await page.waitForFunction(() => window.xomdao.rect('ResultBoard') === null);
  await page.screenshot({ path: t.shot('5-board.png') });
  await tap(page, 'ShowResult');
  await godotText(page, 'ResultTitle', 'Máy thắng!');

  // Two friends: the host plays Black and moves first; White waits and can't pass.
  const host = await openGodot(t, await t.page(DESKTOP));
  const guest = await openGodot(t, await t.page(PHONE));
  await onScene(host, 'lobby');
  await tap(host, 'Island_co');
  await onScene(host, 'select');
  await tapCard(host, 'go');
  await tap(host, 'Choose');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Cờ Vây');
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
  await onScene(host, 'go');
  await onScene(guest, 'go');
  await godotText(host, 'Status', 'Lượt bạn');
  await godotText(guest, 'Status', 'Lượt Đen');
  await tap(host, 'Point_72');
  await guest.waitForFunction(() => window.xomdao.state().room?.view?.board[72] === 'b');
  await godotText(guest, 'Status', 'Lượt bạn');
  await host.screenshot({ path: t.shot('6-friends-host.png') });
  await guest.screenshot({ path: t.shot('7-friends-guest.png') });
}
