import { AVATARS, type Avatar, FRAMES, type Frame } from '@xomdao/shared';
import { useEffect, useState } from 'react';
import { AvatarPicture } from '@/components/ui/AvatarPicture';
import { Button } from '@/components/ui/Button';
import { imageUrl } from '@/lib/assetUrl';
import { type Profile, randomSillyName } from '@/lib/profile';
import { MatchHistory } from './MatchHistory';
import './ProfileBadge.css';

const AVATAR_LABELS: Record<Avatar, string> = {
  boy: 'Bạn nam',
  girl: 'Bạn nữ',
  long: 'Long',
  cat: 'Mèo',
  dog: 'Cún',
  fox: 'Cáo',
  panda: 'Gấu trúc',
  frog: 'Ếch',
  tiger: 'Hổ',
  rabbit: 'Thỏ',
  bear: 'Gấu',
  koala: 'Gấu túi',
  monkey: 'Khỉ',
  pig: 'Heo',
  hamster: 'Chuột hamster',
  lion: 'Sư tử',
  unicorn: 'Kỳ lân',
  penguin: 'Cánh cụt',
  owl: 'Cú',
  chick: 'Gà con',
  octopus: 'Bạch tuộc',
  alien: 'Người ngoài hành tinh',
  ghost: 'Ma nhỏ',
};

const FRAME_LABELS: Record<Frame, string> = {
  gold: 'Vàng',
  silver: 'Bạc',
  bronze: 'Đồng',
  jade: 'Ngọc bích',
  sapphire: 'Lam ngọc',
  ruby: 'Hồng ngọc',
  amethyst: 'Thạch anh tím',
  rose: 'Hồng phấn',
};

type Tab = 'avatar' | 'frame' | 'history';

/**
 * The player's profile: a big preview with the nickname (the dice suggests a silly one) on the
 * left; on the right, a grid of avatars or frames to pick from, or their recent games.
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
  const [frame, setFrame] = useState(profile.frame);
  const [tab, setTab] = useState<Tab>('avatar');
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
        className="hud panel modal profile-modal"
        aria-label="Hồ sơ"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError('');
          onSave({ name: name.trim(), avatar, frame }).catch((err: Error) => {
            setError(err.message);
            setBusy(false);
          });
        }}
      >
        <section className="profile-card">
          <div className="profile-preview">
            <div className="profile-medal">
              <div className="profile-medal-glow" />
              <AvatarPicture avatar={avatar} frame={frame} />
            </div>
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
          <p className="muted profile-username">@{username}</p>
          {error && <p className="error">{error}</p>}
          <div className="profile-actions">
            <Button type="submit" disabled={!name.trim() || busy}>
              Xong
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </div>
          <Button variant="secondary" size="small" className="sign-out" onClick={onSignOut}>
            Đăng xuất
          </Button>
        </section>

        <section className="profile-shelf">
          <div className="profile-tabs" role="tablist">
            <TabButton tab="avatar" current={tab} onPick={setTab}>
              Ảnh đại diện
            </TabButton>
            <TabButton tab="frame" current={tab} onPick={setTab}>
              Khung
            </TabButton>
            <TabButton tab="history" current={tab} onPick={setTab}>
              Lịch sử
            </TabButton>
          </div>
          <div
            className={tab === 'history' ? 'profile-tray' : 'profile-tray profile-grid'}
            role="tabpanel"
          >
            {tab === 'history' ? (
              <MatchHistory />
            ) : tab === 'avatar' ? (
              AVATARS.map((id) => (
                <PickButton
                  key={id}
                  label={AVATAR_LABELS[id]}
                  selected={avatar === id}
                  onPick={() => setAvatar(id)}
                >
                  <AvatarPicture avatar={id} frame={frame} />
                </PickButton>
              ))
            ) : (
              FRAMES.map((id) => (
                <PickButton
                  key={id}
                  label={FRAME_LABELS[id]}
                  selected={frame === id}
                  onPick={() => setFrame(id)}
                >
                  <AvatarPicture avatar={avatar} frame={id} />
                </PickButton>
              ))
            )}
          </div>
        </section>
      </form>
    </div>
  );
}

function TabButton({
  tab,
  current,
  onPick,
  children,
}: {
  tab: Tab;
  current: Tab;
  onPick: (tab: Tab) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={tab === current}
      className="profile-tab"
      onClick={() => onPick(tab)}
    >
      {children}
    </button>
  );
}

function PickButton({
  label,
  selected,
  onPick,
  children,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="pick"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onPick}
    >
      {children}
    </button>
  );
}
