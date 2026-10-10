import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthResponse,
  AVATARS,
  DEFAULT_FRAME,
  displayNameSchema,
  firstIssue,
  loginSchema,
  profileSchema,
  registerSchema,
  type User,
} from '@xomdao/shared';
import type { AccountsStore, Looks } from './accounts.store.js';

export class AccountError extends Error {}

export const ACCOUNTS_STORE = Symbol('ACCOUNTS_STORE');

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** The database only keeps a hash of each login token, so a leaked table can't log anyone in. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Username + password accounts. No email, no password reset: someone who forgets their
 * password just makes a new account. A login token is issued per browser and never expires.
 */
@Injectable()
export class AccountsService {
  constructor(@Inject(ACCOUNTS_STORE) private readonly store: AccountsStore) {}

  async register(input: unknown): Promise<AuthResponse> {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new AccountError(firstIssue(parsed.error));
    const { password, ...rest } = parsed.data;
    const user = await this.store.createUser({
      ...rest,
      passwordHash: await hashPassword(password),
    });
    if (!user) throw new AccountError('Tên đăng nhập này đã có người dùng');
    return this.startSession(user);
  }

  /**
   * A guest: a new account with only a display name. Its username (`khach…`) and password are
   * random and never shown, so the login token is the only way back in.
   */
  async guest(input: unknown): Promise<AuthResponse> {
    const name = displayNameSchema.safeParse(input);
    if (!name.success) throw new AccountError(firstIssue(name.error));
    for (let tries = 0; tries < 5; tries++) {
      const username = `khach${randomBytes(8).toString('hex').slice(0, 12)}`;
      const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
      const user = await this.store.createUser({
        username,
        passwordHash,
        name: name.data,
        avatar: AVATARS[randomInt(AVATARS.length)] ?? 'boy',
        frame: DEFAULT_FRAME,
      });
      if (user) return this.startSession(user);
    }
    throw new AccountError('Không tạo được tài khoản khách, thử lại sau');
  }

  async login(input: unknown): Promise<AuthResponse> {
    const parsed = loginSchema.safeParse(input);
    const found = parsed.success ? await this.store.findLogin(parsed.data.username) : null;
    if (!found || !(await checkPassword(parsed.data?.password ?? '', found.passwordHash))) {
      throw new AccountError('Sai tên đăng nhập hoặc mật khẩu');
    }
    return this.startSession(found.user);
  }

  async logout(token: string) {
    await this.store.deleteSession(hashToken(token));
  }

  /** The user a login token belongs to, or `null`. */
  async authenticate(token: unknown): Promise<User | null> {
    if (typeof token !== 'string' || !token) return null;
    return this.store.userBySession(hashToken(token));
  }

  async updateProfile(userId: string, input: unknown): Promise<User> {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new AccountError(firstIssue(parsed.error));
    const user = await this.store.updateProfile(userId, parsed.data);
    if (!user) throw new AccountError('Không tìm thấy tài khoản');
    return user;
  }

  /** An account by id, or `null`. */
  userById(userId: string): Promise<User | null> {
    return this.store.userById(userId);
  }

  /**
   * Changes how the player shows (their frame, card back). Only Túi đồ calls this, after
   * checking they own the item.
   */
  async setLooks(userId: string, looks: Looks): Promise<User> {
    const user = await this.store.setLooks(userId, looks);
    if (!user) throw new AccountError('Không tìm thấy tài khoản');
    return user;
  }

  private async startSession(user: User): Promise<AuthResponse> {
    const token = randomBytes(32).toString('base64url');
    await this.store.createSession(hashToken(token), user.id);
    return { token, user };
  }
}
