import { z } from 'zod';
import type { User } from './protocol.js';

/**
 * Accounts: a username + password that identifies a player across devices. The username is
 * unique and fixed; the display name (shown in games) can repeat and change at any time.
 * Server and web both validate with these schemas so the error messages match.
 */

/**
 * Round, frameless pictures (`avatar-<id>.webp`); the app draws the player's frame over them.
 * Append new ones at the end: the order is the order of the picker.
 */
export const AVATARS = [
  'boy',
  'girl',
  'long',
  'cat',
  'dog',
  'fox',
  'panda',
  'frog',
  'tiger',
  'rabbit',
  'bear',
  'koala',
  'monkey',
  'pig',
  'hamster',
  'lion',
  'unicorn',
  'penguin',
  'owl',
  'chick',
  'octopus',
  'alien',
  'ghost',
] as const;
export type Avatar = (typeof AVATARS)[number];

/** Rings drawn around any avatar (`frame-<id>.webp`), picked separately from it. */
export const FRAMES = [
  'gold',
  'silver',
  'bronze',
  'jade',
  'sapphire',
  'ruby',
  'amethyst',
  'rose',
] as const;
export type Frame = (typeof FRAMES)[number];
export const DEFAULT_FRAME: Frame = 'gold';

/** Letters and digits only. Stored lowercase, so "Minh" and "minh" are the same account. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Tên đăng nhập cần ít nhất 3 ký tự')
  .max(20, 'Tên đăng nhập tối đa 20 ký tự')
  .regex(/^[A-Za-z0-9]+$/, 'Tên đăng nhập chỉ gồm chữ không dấu và số')
  .transform((s) => s.toLowerCase());

export const passwordSchema = z
  .string()
  .min(6, 'Mật khẩu cần ít nhất 6 ký tự')
  .max(100, 'Mật khẩu tối đa 100 ký tự');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Bạn cần nhập tên')
  .max(20, 'Tên tối đa 20 ký tự');

export const avatarSchema = z.enum(AVATARS);
export const frameSchema = z.enum(FRAMES);

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: displayNameSchema,
  avatar: avatarSchema,
  frame: frameSchema.default(DEFAULT_FRAME),
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase(),
  password: z.string(),
});

/** `frame` is optional so an older page that doesn't know frames keeps the player's frame. */
export const profileSchema = z.object({
  name: displayNameSchema,
  avatar: avatarSchema,
  frame: frameSchema.optional(),
});

export type RegisterRequest = z.input<typeof registerSchema>;
export type LoginRequest = z.input<typeof loginSchema>;
export type ProfileUpdate = z.input<typeof profileSchema>;

/** Reply of POST /api/auth/register and /api/auth/login. */
export interface AuthResponse {
  /** Send as `auth: { token }` when connecting the socket. Kept in the browser. */
  token: string;
  user: User;
}

/** First message of a zod error, for showing to the player. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Dữ liệu không hợp lệ';
}
