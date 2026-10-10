// The Godot hub (#117): from the island ring lobby, open Caro's card in the game select, choose
// it, press CHƠI and play the computer that quick match seats after a wait; win, and the coins
// fly into the balance. Then make a room and a friend opens its invite link. Needs the debug
// web build at /godot/ (npm run godot:export -- --debug).

import {
  caroPlayToEnd,
  coins,
  godotText,
  launch,
  onScene,
  openGodot,
  room,
  tap,
  tapCard,
} from '../godot.mjs';
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['tic-tac-toe'];
export { launch };

export default async function run(t) {
  const host = await openGodot(t, await t.page(DESKTOP));

  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', /./);
  const before = await host.evaluate(() => window.xomdao.state().balances['core:coin'] ?? 0);
  await godotText(host, 'Coins', coins(before));
  await host.screenshot({ path: t.shot('1-lobby.png') });

  // The card opens the game select on Cờ; Luật shows the game's RULES.md.
  await tap(host, 'SelectedGame');
  await onScene(host, 'select');
  // Bắn Tàu comes first in Cờ by name, so pick Caro.
  await tapCard(host, 'tic-tac-toe');
  await host.screenshot({ path: t.shot('2-select.png') });
  await tap(host, 'GameRules');
  await godotText(host, 'RulesText', /5 quân/);
  await host.screenshot({ path: t.shot('3-rules.png') });
  await host.mouse.click(10, 400); // the shade around the board closes it
  await tap(host, 'Choose');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Caro');

  // CHƠI: nobody else is looking, so the computer takes the other seat and the game starts.
  await tap(host, 'Play');
  await onScene(host, 'room');
  await godotText(host, 'RoomStatus', 'Đang tìm người chơi');
  await onScene(host, 'tic-tac-toe', 30_000);
  const quick = await room(host);
  if (!quick.players.some((p) => p.bot)) throw new Error('Quick match seated no computer');
  await caroPlayToEnd(host);
  await godotText(host, 'ResultTitle', 'Bạn thắng!');
  // 20 for the win, then 20 + 20 for the first game's achievements (Ván đầu tiên, Trận thắng đầu).
  const after = before + 20 + 40;
  await godotText(host, 'Coins', coins(after));
  await host.screenshot({ path: t.shot('4-result.png') });

  // Back in the lobby with Caro still on CHƠI; Tạo phòng, then a friend opens the link.
  await tap(host, 'Home');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Caro');
  await godotText(host, 'Coins', coins(after));
  await tap(host, 'CreateRoom');
  await tap(host, 'ConfirmCreate');
  await onScene(host, 'room');
  const code = await godotText(host, 'RoomCode', /^[A-Z0-9]{4}$/);
  const friend = await openGodot(t, await t.page(PHONE), `?room=${code}`);
  await onScene(friend, 'room');
  await host.waitForFunction(() => window.xomdao.state().room?.players.length === 2);
  await godotText(friend, 'RoomStatus', 'Chờ chủ phòng bắt đầu');
  await host.screenshot({ path: t.shot('5-room-desktop.png') });
  await friend.screenshot({ path: t.shot('6-room-phone.png') });
}
