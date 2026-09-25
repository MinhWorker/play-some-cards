import { describe, expect, it } from 'vitest';
import { AccountsService } from './accounts.service.js';
import { MemoryAccountsStore } from './accounts.store.js';

const newService = () => new AccountsService(new MemoryAccountsStore());
const minh = { username: 'Minh99', password: 'secret1', name: 'Gà Bông', avatar: 'boy' };

describe('AccountsService', () => {
  it('registers, then logs in with any letter case of the username', async () => {
    const accounts = newService();
    const { token, user } = await accounts.register(minh);
    expect(user).toMatchObject({ username: 'minh99', name: 'Gà Bông', avatar: 'boy' });
    expect(await accounts.authenticate(token)).toEqual(user);
    const again = await accounts.login({ username: 'MINH99', password: 'secret1' });
    expect(again.user.id).toBe(user.id);
    expect(again.token).not.toBe(token);
  });

  it('keeps usernames unique but lets display names repeat', async () => {
    const accounts = newService();
    await accounts.register(minh);
    await expect(accounts.register({ ...minh, username: 'minh99' })).rejects.toThrow(
      'đã có người dùng',
    );
    await expect(accounts.register({ ...minh, username: 'lan' })).resolves.toBeTruthy();
  });

  it('rejects usernames with special characters and short passwords', async () => {
    const accounts = newService();
    await expect(accounts.register({ ...minh, username: 'minh_99' })).rejects.toThrow(
      'chữ không dấu và số',
    );
    await expect(accounts.register({ ...minh, username: 'mình' })).rejects.toThrow(
      'chữ không dấu và số',
    );
    await expect(accounts.register({ ...minh, password: '123' })).rejects.toThrow('ít nhất 6');
  });

  it('refuses a wrong password or unknown user with the same message', async () => {
    const accounts = newService();
    await accounts.register(minh);
    await expect(accounts.login({ username: 'minh99', password: 'nope123' })).rejects.toThrow(
      'Sai tên đăng nhập hoặc mật khẩu',
    );
    await expect(accounts.login({ username: 'ghost', password: 'secret1' })).rejects.toThrow(
      'Sai tên đăng nhập hoặc mật khẩu',
    );
  });

  it('forgets a token on logout', async () => {
    const accounts = newService();
    const { token } = await accounts.register(minh);
    await accounts.logout(token);
    expect(await accounts.authenticate(token)).toBeNull();
    expect(await accounts.authenticate(undefined)).toBeNull();
  });

  it('changes the display name and avatar', async () => {
    const accounts = newService();
    const { user } = await accounts.register(minh);
    const updated = await accounts.updateProfile(user.id, { name: '  Mèo Lười ', avatar: 'girl' });
    expect(updated).toMatchObject({ username: 'minh99', name: 'Mèo Lười', avatar: 'girl' });
    await expect(accounts.updateProfile(user.id, { name: ' ', avatar: 'girl' })).rejects.toThrow(
      'Bạn cần nhập tên',
    );
  });
});
