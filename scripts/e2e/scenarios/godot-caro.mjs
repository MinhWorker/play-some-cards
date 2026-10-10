// Caro in the Godot client (#113, #117): a host on a desktop makes a room (Tạo phòng) and a
// friend on a phone joins it by typing the code at Bến. They play to a win; the board grows at
// its edges. Then a rematch, and the host leaves mid-game. Meanwhile a third phone plays the
// sandbox (?play=tic-tac-toe) against the computer. Needs the debug web build at /godot/
// (npm run godot:export -- --debug).

import { caroTap, godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['tic-tac-toe'];
export { launch };

export default async function run(t) {
  const host = await openGodot(t, await t.page(DESKTOP));
  const guest = await openGodot(t, await t.page(PHONE));
  const solo = await openGodot(t, await t.page(PHONE), '?play=tic-tac-toe');

  await onScene(host, 'lobby');
  await tap(host, 'CreateRoom');
  await host.screenshot({ path: t.shot('1-create.png') });
  await tap(host, 'ConfirmCreate');
  await onScene(host, 'room');
  const code = await godotText(host, 'RoomCode', /^[A-Z0-9]{4}$/);

  await onScene(guest, 'lobby');
  await tap(guest, 'Place_ben');
  await onScene(guest, 'ben');
  await tap(guest, 'CodeInput');
  await guest.keyboard.type(code.toLowerCase());
  // Godot takes the keys on its next frames.
  await godotText(guest, 'CodeInput', code.toLowerCase());
  await tap(guest, 'Join');
  await onScene(guest, 'room');
  await host.waitForFunction(() => window.xomdao.state().room?.players.length === 2);
  await host.screenshot({ path: t.shot('2-room.png') });
  await tap(host, 'Start');

  // The pack came over the network: the web build has no game inside it.
  await onScene(host, 'tic-tac-toe');
  await onScene(guest, 'tic-tac-toe');
  const downloaded = await host.evaluate(() => window.xomdao.state().downloaded);
  if (!(downloaded > 0)) throw new Error('The Caro pack was not downloaded');

  // Host is X and plays along row 4 from the left edge (the board grows 3 columns left); the
  // guest starts on the bottom edge (3 rows more below).
  const moves = [
    [host, 0, 4],
    [guest, 4, 8],
    [host, 1, 4],
    [guest, 5, 5],
    [host, 2, 4],
    [guest, 6, 6],
    [host, 3, 4],
    [guest, 7, 7],
  ];
  for (const [page, x, y] of moves) await caroTap(page, x, y);
  const { board } = (await room(host)).view;
  if (`${board.cols}×${board.rows}` !== '12×12')
    throw new Error(`The board is ${board.cols}×${board.rows}, expected 12×12`);
  await guest.screenshot({ path: t.shot('3-grown-phone.png') });
  await caroTap(host, 4, 4);
  await godotText(host, 'ResultTitle', 'Bạn thắng!');
  await godotText(guest, 'ResultTitle', /^Khách \d+ thắng!$/);
  const { result } = await room(host);
  if (result.rewards?.[0]?.amount !== 20) throw new Error('The winner got no 20 coins');
  await host.screenshot({ path: t.shot('4-result-desktop.png') });
  await guest.screenshot({ path: t.shot('5-result-phone.png') });

  // Rematch: a fresh board, then the host leaves through the menu and the guest is the host.
  await tap(host, 'Again');
  await host.waitForFunction(() => {
    const r = window.xomdao.state().room;
    return r.status === 'playing' && r.view.board.cells.every((c) => c === null);
  });
  await tap(host, 'Menu');
  await tap(host, 'Leave');
  await tap(host, 'ConfirmLeave');
  await onScene(host, 'lobby');
  await onScene(guest, 'room');
  await godotText(guest, 'Start', 'Bắt đầu');

  // The sandbox: a real room against the computer, already started.
  await onScene(solo, 'tic-tac-toe', 60_000);
  const sandbox = await room(solo);
  if (!sandbox.players.some((p) => p.bot)) throw new Error('No computer in the sandbox room');
  await caroTap(solo, 4, 4);
  await solo.waitForFunction(
    () => window.xomdao.state().room.view.board.cells.filter(Boolean).length === 2,
  );
  await solo.screenshot({ path: t.shot('6-sandbox-phone.png') });
}
