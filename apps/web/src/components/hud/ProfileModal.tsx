import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { type Avatar, avatarImage, type Profile, randomSillyName } from '@/lib/profile';
import './ProfileBadge.css';
import { imageUrl } from '@/lib/assetUrl';

const AVATARS: { id: Avatar; label: string }[] = [
  { id: 'boy', label: 'Bạn nam' },
  { id: 'girl', label: 'Bạn nữ' },
  { id: 'long', label: 'Long' },
];

/** Pick an avatar and a nickname (the dice suggests a silly one). Opened from ProfileBadge. */
export function ProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);

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
          if (name.trim()) onSave({ name: name.trim(), avatar });
        }}
      >
        <h2>Hồ sơ</h2>
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
        <Button type="submit" disabled={!name.trim()}>
          Xong
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </form>
    </div>
  );
}
