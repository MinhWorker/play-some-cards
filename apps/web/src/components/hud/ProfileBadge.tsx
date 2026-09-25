import type { User } from '@psc/shared';
import { useState } from 'react';
import { avatarImage, type Profile } from '@/lib/profile';
import { ProfileModal } from './ProfileModal';
import './ProfileBadge.css';
import { imageUrl } from '@/lib/assetUrl';

/**
 * Avatar + nickname in the top-left corner; the pencil opens a modal to change both (saved on
 * the account) or log out.
 */
export function ProfileBadge({
  user: profile,
  onChange,
  onSignOut,
}: {
  user: User;
  /** Saves the profile; rejects with a message to show. */
  onChange: (profile: Profile) => Promise<void>;
  onSignOut: () => void;
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
          username={profile.username}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            await onChange(p);
            setEditing(false);
          }}
          onSignOut={onSignOut}
        />
      )}
    </>
  );
}
