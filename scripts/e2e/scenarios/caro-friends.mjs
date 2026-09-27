// A room between people: three people create accounts, two (desktop + phone) pick
// Caro on the island map, create/join a room from the room list and play to a win while the
// third watches. Mid-game the phone player closes the browser and logs in again on a new one:
// they must land back in their seat. Then a 6×6 rematch, the host leaves, the room disbands.
import {
  caroPlay,
  caroSetup,
  clickCanvas,
  DESKTOP,
  leaveRoom,
  openRooms,
  PASSWORD,
  PHONE,
  signUp,
} from '../lib.mjs';

export const games = ['tic-tac-toe'];

export default async function run(t) {
  const host = await t.page(DESKTOP);
  let guest = await t.page(PHONE);
  const fan = await t.page(PHONE);

  await signUp(t, guest, 'Lan');
  await signUp(t, host, 'Minh');
  await openRooms(host, 'tic-tac-toe');
  await host.getByRole('button', { name: 'Về đảo' }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: t.shot('1-hub.png') });
  await openRooms(host, 'tic-tac-toe');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  // Caro has its own setup screen: "Bạn bè" creates a room for people.
  await caroSetup(host, 'opponents[0]');
  await caroSetup(host, 'sizes[0]');
  await host.getByText('Phòng của Minh').waitFor();

  // The guest finds Minh's room in the live list and takes the free seat.
  await openRooms(guest, 'tic-tac-toe');
  const row = guest.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await row.waitFor();
  await guest.screenshot({ path: t.shot('2-room-list-phone.png') });
  await row.getByRole('button', { name: 'Vào chơi' }).click();
  await host.getByText('Lan').waitFor();

  // Full room: the fan can't take a seat, only watch.
  await signUp(t, fan, 'Hoa');
  await openRooms(fan, 'tic-tac-toe');
  const fanRow = fan.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await fanRow.getByText('👤 2/2').waitFor();
  if (await fanRow.getByRole('button', { name: 'Vào chơi' }).isEnabled())
    throw new Error('Full room still offers "Vào chơi"');
  await fanRow.getByRole('button', { name: 'Xem' }).click();
  await host.getByText('👀 1 đang xem').waitFor();
  await host.screenshot({ path: t.shot('3-lobby.png') });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();

  // Host is X. X takes the top row.
  await caroPlay(host, 0);
  await caroPlay(guest, 4);

  // Lan closes her browser without leaving, then logs in on a fresh one: back in her seat.
  await guest.context().close();
  guest = await t.page(PHONE);
  await guest.goto(t.url);
  await guest.getByLabel('Tên đăng nhập').fill(t.username('Lan').toUpperCase());
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByRole('button', { name: '← Rời phòng' }).waitFor();
  await guest.waitForTimeout(800);
  await guest.screenshot({ path: t.shot('3b-back-in-seat-phone.png') });

  const moves = [
    [host, 1],
    [guest, 8],
    [host, 2],
  ];
  for (const [page, cell] of moves) await caroPlay(page, cell);
  await host.getByText('Bạn thắng!').waitFor();
  await guest.getByText('Minh thắng!').waitFor();
  await fan.getByText('Minh thắng!').waitFor();
  await host.screenshot({ path: t.shot('4-result-desktop.png') });
  await guest.screenshot({ path: t.shot('5-result-phone.png') });
  await fan.screenshot({ path: t.shot('6-result-spectator.png') });
  const score = await host.evaluate(() =>
    window.__phaser.scene.getScene('tic-tac-toe').score.numbers.text.replace(/\s+/g, ' '),
  );
  if (score !== '1 – 0') throw new Error(`Scoreboard shows "${score}", expected "1 – 0"`);

  // Between games the host picks a 6×6 board (4 in a row) and swaps colors: Lan is red X now.
  await clickCanvas(host, 'tic-tac-toe', (s) => s.next.sizes[1]);
  await host.waitForTimeout(300);
  await clickCanvas(host, 'tic-tac-toe', (s) => s.next.swap);
  await host.waitForTimeout(300);
  await host.screenshot({ path: t.shot('6b-next-game-options.png') });
  await host.getByRole('button', { name: 'Chơi ván mới' }).click();
  await guest.waitForFunction(() => {
    const { state, me } = window.__phaser.scene.getScene('tic-tac-toe').ctx;
    return (
      state.board.length === 36 &&
      state.win === 4 &&
      state.players[0] === me.id &&
      state.turn === me.id
    );
  });
  await caroPlay(guest, 14);
  await guest.screenshot({ path: t.shot('6c-6x6-phone.png') });

  // Host quits: Lan becomes host. Then Lan quits: no players left, the room is disbanded
  // and the spectator is sent back to the room list.
  await leaveRoom(host);
  await guest.getByText('👑 Lan').waitFor();
  await guest.getByRole('button', { name: 'Bắt đầu' }).waitFor();
  await guest.getByRole('button', { name: '← Rời phòng' }).click();
  await fan.getByText('Phòng đã giải tán').waitFor();
  await fan.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  await fan.screenshot({ path: t.shot('7-disbanded-spectator.png') });
}
