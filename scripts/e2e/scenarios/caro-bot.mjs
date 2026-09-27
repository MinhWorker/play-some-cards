// A room against the computer: Tuan picks "Máy", then "Khó" on the setup screen. "Tuỳ chỉnh"
// swaps the computer out and back without leaving the room, the computer answers a move, and
// leaving mid-game asks first. This is the shortest walk through the whole app (account, island
// map, room list, setup, a game, leaving), so it runs for every change that runs e2e at all.
import { caroPlay, caroSetup, DESKTOP, leaveRoom, openRooms, signUp } from '../lib.mjs';

export const games = ['tic-tac-toe'];
export const always = true;

export default async function run(t) {
  const host = await t.page(DESKTOP);
  await signUp(t, host, 'Tuan');
  await openRooms(host, 'tic-tac-toe');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await caroSetup(host, 'opponents[1]');
  await host.waitForTimeout(300);
  await host.screenshot({ path: t.shot('8-create-bot-room.png') });
  await caroSetup(host, 'levels[2]');
  await caroSetup(host, 'sizes[0]');
  await host.getByText('🤖 Máy').waitFor();

  // "Tuỳ chỉnh" reopens the settings screen inside the room: switching to "Bạn bè" sends the
  // computer away (a seat opens), and back to "Máy" brings it back. No new room.
  const roomCode = await host.evaluate(() => new URLSearchParams(location.search).toString());
  await host.getByRole('button', { name: 'Tuỳ chỉnh' }).click();
  await host.waitForTimeout(300);
  await host.screenshot({ path: t.shot('8b-customize-in-room.png') });
  await caroSetup(host, 'opponents[0]');
  await caroSetup(host, 'sizes[1]');
  await host.getByText('👤 1/2').waitFor();
  if (await host.getByText('🤖 Máy').count()) throw new Error('The computer stayed in the room');
  await host.getByRole('button', { name: 'Tuỳ chỉnh' }).click();
  await caroSetup(host, 'opponents[1]');
  await caroSetup(host, 'levels[2]');
  await caroSetup(host, 'sizes[0]');
  await host.getByText('🤖 Máy').waitFor();
  if ((await host.evaluate(() => new URLSearchParams(location.search).toString())) !== roomCode)
    throw new Error('Customizing left the room');
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  await caroPlay(host, 4);
  await host.waitForFunction(
    () =>
      window.__phaser.scene.getScene('tic-tac-toe').ctx.state.board.filter(Boolean).length === 2,
  );
  await host.screenshot({ path: t.shot('9-bot-game.png') });

  // Leaving mid-game asks first; "Ở lại chơi tiếp" keeps the game going.
  await host.getByRole('button', { name: '← Rời phòng' }).click();
  await host.getByRole('alertdialog').waitFor();
  await host.screenshot({ path: t.shot('9b-leave-confirm.png') });
  await host.getByRole('button', { name: 'Ở lại chơi tiếp' }).click();
  if (await host.getByRole('alertdialog').count()) throw new Error('"Ở lại" kept the dialog open');
  if (!(await host.evaluate(() => window.__phaser.scene.isActive('tic-tac-toe'))))
    throw new Error('"Ở lại" left the game');
  await leaveRoom(host);
  await host.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  if (await host.locator('.room-row', { hasText: 'Phòng của Tuan' }).count())
    throw new Error('The computer room stayed open after Tuan left');
}
