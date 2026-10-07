import { DEFAULT_FRAME } from '@psc/shared';
import { avatarImage, frameImage } from '@/lib/profile';
import './AvatarPicture.css';

/**
 * A player's picture: their avatar with their frame on top. The two are picked separately, so
 * they are two stacked images (Phaser boards do the same in `GameScene.avatar`).
 */
export function AvatarPicture({
  avatar,
  frame = DEFAULT_FRAME,
  className,
}: {
  avatar: string;
  /** `null` draws the avatar alone (e.g. in the frame-less avatar picker). */
  frame?: string | null;
  className?: string;
}) {
  return (
    <span className={['avatar-picture', className].filter(Boolean).join(' ')}>
      <img src={avatarImage(avatar)} alt="" draggable={false} />
      {frame && <img src={frameImage(frame)} alt="" draggable={false} />}
    </span>
  );
}
