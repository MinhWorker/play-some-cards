import type { AuthResponse, LoginRequest, RegisterRequest } from '@psc/shared';

/**
 * Where the game server lives. Empty = same origin (dev via Vite proxy, or when the Nest
 * server serves the built web app). Set VITE_SERVER_URL when the web app is hosted
 * separately, e.g. on Vercel.
 */
export const serverUrl: string | undefined = import.meta.env.VITE_SERVER_URL || undefined;

const TOKEN_KEY = 'psc:token';

/** The login token of this browser (from register/login), sent when the socket connects. */
export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode): you stay logged in until the tab closes.
  }
}

/** POSTs JSON to the server; throws with the server's (Vietnamese) message on failure. */
async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl ?? ''}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được server, thử lại sau');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Server gặp lỗi, thử lại sau',
    );
  }
  return data as T;
}

export const register = (req: RegisterRequest) => post<AuthResponse>('/api/auth/register', req);
export const login = (req: LoginRequest) => post<AuthResponse>('/api/auth/login', req);
export const logout = (token: string) => post('/api/auth/logout', {}, token).catch(() => {});
