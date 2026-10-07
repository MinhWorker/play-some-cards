import type { User } from '@psc/shared';
import { useState } from 'react';
import { AvatarPicture } from '@/components/ui/AvatarPicture';
import type { Profile } from '@/lib/profile';
import { ProfileModal } from './ProfileModal';
import './ProfileBadge.css';
import { imageUrl } from '@/lib/assetUrl';

/**
 * Avatar + nickname in the top-left corner; the pencil opens a modal to change them and the
 * avatar's frame (saved on the account) or log out.
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
        <AvatarPicture className="profile-avatar" avatar={profile.avatar} frame={profile.frame} />
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
