// Accounts: a wrong password and a username with special characters are refused with a
// message, a new account signs up, and the profile editor changes the avatar and the name.
// Taps on the profile modal must not reach the island map underneath.
import { PASSWORD, PHONE, signUp } from '../lib.mjs';

export const games = [];

export default async function run(t) {
  const guest = await t.page(PHONE);
  // Wrong password is refused with a message; usernames with special characters too.
  await guest.goto(t.url);
  await guest.getByLabel('Tên đăng nhập').fill(t.username('nobody'));
  await guest.getByLabel('Mật khẩu', { exact: true }).fill('wrong-pass');
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByText('Sai tên đăng nhập hoặc mật khẩu').waitFor();
  await guest.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  if ((await guest.getByLabel('Mật khẩu', { exact: true }).getAttribute('type')) !== 'text')
    throw new Error('"Hiện mật khẩu" did not reveal the password');
  await guest.screenshot({ path: t.shot('0-login-phone.png') });
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
  await guest.getByLabel('Tên đăng nhập').fill('lan_ơi');
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await guest.getByText('chỉ gồm chữ không dấu và số').waitFor();

  await signUp(t, guest, 'Lan', '0-register-phone.png');
  await guest.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  await guest.getByRole('button', { name: 'Bạn nữ' }).click();
  await guest.getByRole('button', { name: 'Tên ngẫu nhiên' }).click();
  await guest.screenshot({ path: t.shot('0-profile-phone.png') });
  await guest.getByLabel('Tên', { exact: true }).fill('Lan');
  await guest.getByRole('button', { name: 'Xong' }).click();
  await guest.waitForTimeout(800);
  // Taps on the modal must not reach the islands underneath.
  if (
    (await guest.getByText('Game này sắp có').count()) ||
    (await guest.getByRole('button', { name: '+ Tạo phòng' }).count())
  )
    throw new Error('A tap on the profile modal reached an island');
  await guest.screenshot({ path: t.shot('1-hub-phone.png') });
}
