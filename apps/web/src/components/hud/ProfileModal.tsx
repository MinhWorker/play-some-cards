import type { Avatar } from '@psc/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { avatarImage, type Profile, randomSillyName } from '@/lib/profile';
import './ProfileBadge.css';
import { imageUrl } from '@/lib/assetUrl';

const AVATARS: { id: Avatar; label: string }[] = [
  { id: 'boy', label: 'Bạn nam' },
  { id: 'girl', label: 'Bạn nữ' },
  { id: 'long', label: 'Long' },
];

/**
 * Pick an avatar and a nickname (the dice suggests a silly one), or log out.
 * Opened from ProfileBadge.
 */
export function ProfileModal({
  profile,
  username,
  onClose,
  onSave,
  onSignOut,
}: {
  profile: Profile;
  username: string;
  onClose: () => void;
  /** Rejects with a message to show (e.g. the server refused the name). */
  onSave: (profile: Profile) => Promise<void>;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <form
        className="hud panel modal"
        aria-label="Hồ sơ"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError('');
          onSave({ name: name.trim(), avatar }).catch((err: Error) => {
            setError(err.message);
            setBusy(false);
          });
        }}
      >
        <h2>Hồ sơ</h2>
        <p className="muted">Tài khoản: {username}</p>
        <div className="avatar-pick">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.label}
              aria-pressed={avatar === a.id}
              className={avatar === a.id ? 'selected' : ''}
              onClick={() => setAvatar(a.id)}
            >
              <img src={avatarImage(a.id)} alt="" />
            </button>
          ))}
        </div>
        <div className="name-row">
          <input
            aria-label="Tên"
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
        </div>
        {error && <p className="error">{error}</p>}
        <Button type="submit" disabled={!name.trim() || busy}>
          Xong
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        <Button variant="secondary" size="small" className="sign-out" onClick={onSignOut}>
          Đăng xuất
        </Button>
      </form>
    </div>
  );
}
