import { z } from 'zod';

/**
 * Accounts: a username + password that identifies a player across devices. The username is
 * unique and fixed; the display name (shown in games) can repeat and change at any time.
 * Server and web both validate with these schemas so the error messages match.
 */

export const AVATARS = ['boy', 'girl', 'long'] as const;
export type Avatar = (typeof AVATARS)[number];

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

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: displayNameSchema,
  avatar: avatarSchema,
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase(),
  password: z.string(),
});

export const profileSchema = z.object({ name: displayNameSchema, avatar: avatarSchema });

export type RegisterRequest = z.input<typeof registerSchema>;
export type LoginRequest = z.input<typeof loginSchema>;
export type ProfileUpdate = z.input<typeof profileSchema>;

/** The logged-in player, as the server sends it to themselves. */
export interface User {
  id: string;
  username: string;
  name: string;
  avatar: Avatar;
}

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
