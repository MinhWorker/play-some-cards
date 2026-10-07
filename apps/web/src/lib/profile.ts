import { AVATARS, type Avatar, DEFAULT_FRAME, type Frame } from '@psc/shared';
import { imageUrl } from '@/lib/assetUrl';

/** Display name, avatar and its frame (kept on the account, see `User` in @psc/shared). */
export interface Profile {
  name: string;
  avatar: Avatar;
  frame: Frame;
}

/** Given to players who haven't picked a nickname yet (and by the dice in the profile modal). */
const SILLY_NAMES = [
  'Gà Bông',
  'Mèo Lười',
  'Cá Mắm',
  'Khoai Lang Nướng',
  'Bánh Bao Chiều',
  'Heo Con Ú',
  'Vịt Bầu',
  'Cún Mít Ướt',
  'Trà Sữa Full Topping',
  'Bắp Rang Bơ',
  'Sâu Róm',
  'Ếch Ộp',
  'Ốc Sên Tốc Độ',
  'Gấu Mập',
  'Thỏ Ngủ Gật',
  'Tôm Hùm Đất',
  'Nấm Lùn',
  'Dưa Hấu Đỏ',
  'Bí Đỏ Lăn',
  'Cánh Cụt Béo',
  'Rùa Ninja',
  'Hạt Tiêu',
  'Mì Tôm Trứng',
  'Cá Viên Chiên',
  'Kẹo Kéo',
  'Xôi Xéo',
  'Bánh Tráng Trộn',
  'Khủng Long Con',
  'Chuột Nhắt Liều',
  'Sóc Nâu Hóng Hớt',
];

export function randomSillyName(current = '') {
  const choices = SILLY_NAMES.filter((n) => n !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? 'Gà Bông';
}

/**
 * Defaults for a new account: the nickname and avatar this browser used before accounts
 * existed (kept in localStorage), else a silly name and a random avatar.
 */
export function startingProfile(): Profile {
  let name = '';
  let avatar: Avatar = Math.random() < 0.5 ? 'boy' : 'girl';
  try {
    name = localStorage.getItem('psc:name')?.trim().slice(0, 20) ?? '';
    const saved = localStorage.getItem('psc:avatar');
    if ((AVATARS as readonly (string | null)[]).includes(saved)) avatar = saved as Avatar;
  } catch {}
  return { name: name || randomSillyName(), avatar, frame: DEFAULT_FRAME };
}

/** A round, frameless picture; `frameImage` is the ring drawn over it (see `AvatarPicture`). */
export const avatarImage = (avatar: string) => imageUrl(`avatar-${avatar}`);
export const frameImage = (frame: string) => imageUrl(`frame-${frame}`);
