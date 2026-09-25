import type { AuthResponse } from '@psc/shared';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { imageUrl } from '@/lib/assetUrl';
import { login, register } from '@/lib/auth';
import { randomSillyName, startingProfile } from '@/lib/profile';
import { buttonSounds } from '@/lib/sound';
import './Login.css';

type Mode = 'login' | 'register';

/**
 * Log in or create an account (username + password). The in-game name is separate from the
 * username: it can repeat and can be changed later from the profile badge.
 */
export function Login({ onSignIn }: { onSignIn: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [start] = useState(startingProfile);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState(start.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();

  const switchTo = (next: Mode) => {
    setMode(next);
    setError('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignIn(
        mode === 'login'
          ? await login({ username, password })
          : await register({ username, password, name, avatar: start.avatar }),
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const ready = username.trim() && password && (mode === 'login' || name.trim());

  return (
    // Quiet form: only the submit button clicks (no hover sound).
    <form
      className="hud panel login"
      onSubmit={submit}
      aria-label="Tài khoản"
      {...buttonSounds({ click: 'none', hover: 'none' })}
    >
      <div className="login-tabs">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => switchTo('login')}>
          Đăng nhập
        </button>
        <button
          type="button"
          aria-pressed={mode === 'register'}
          onClick={() => switchTo('register')}
        >
          Tạo tài khoản
        </button>
      </div>

      <div className="field">
        <label htmlFor={`${id}-username`}>Tên đăng nhập</label>
        <input
          id={`${id}-username`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-password`}>Mật khẩu</label>
        <span className="input-row">
          <input
            id={`${id}-password`}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={100}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            <img src={imageUrl(showPassword ? 'icon-eye-off' : 'icon-eye')} alt="" />
          </button>
        </span>
      </div>
      {mode === 'register' && (
        <div className="field">
          <label htmlFor={`${id}-name`}>Tên trong game</label>
          <span className="input-row">
            <input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />
            <button
              type="button"
              className="icon-btn dice"
              aria-label="Tên ngẫu nhiên"
              onClick={() => setName((n) => randomSillyName(n))}
            >
              <img src={imageUrl('icon-dice')} alt="" />
            </button>
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <Button type="submit" disabled={!ready || busy} clickSound="button-click">
        {mode === 'login' ? 'Vào chơi' : 'Tạo tài khoản'}
      </Button>
    </form>
  );
}
