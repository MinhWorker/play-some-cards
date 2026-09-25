import { useState } from 'react';
import { avatarImage, type Profile } from '@/lib/profile';
import { ProfileModal } from './ProfileModal';
import './ProfileBadge.css';
import { imageUrl } from '@/lib/assetUrl';

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
      <div className="hud profile">
        <img className="profile-avatar" src={avatarImage(profile.avatar)} alt="" />
        <span className="profile-name">{profile.name}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Sửa hồ sơ"
          onClick={() => setEditing(true)}
        >
          <img src={imageUrl('icon-edit')} alt="" />
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
