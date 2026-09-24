import { useEffect, useState } from 'react';
import { type Avatar, avatarImage, type Profile, randomSillyName } from './profile';

const AVATARS: { id: Avatar; label: string }[] = [
  { id: 'boy', label: 'Bạn nam' },
  { id: 'girl', label: 'Bạn nữ' },
  { id: 'long', label: 'Long' },
];

/** Avatar + nickname in the top-left corner; the pencil opens a modal to change both. */
export function ProfileBadge({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="profile">
        <img className="profile-avatar" src={avatarImage(profile.avatar)} alt="" />
        <span className="profile-name">{profile.name}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Sửa hồ sơ"
          onClick={() => setEditing(true)}
        >
          <img src="/images/icon-edit.webp" alt="" />
        </button>
      </div>
      {editing && (
        <ProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            onChange(p);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function ProfileModal({
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
        className="panel modal"
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
            <img src="/images/icon-dice.webp" alt="" />
          </button>
        </div>
        <button type="submit" className="btn" disabled={!name.trim()}>
          Xong
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          Đóng
        </button>
      </form>
    </div>
  );
}
