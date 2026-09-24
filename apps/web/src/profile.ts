/** The player's nickname and avatar, remembered in this browser. */
export type Avatar = 'boy' | 'girl' | 'long';
const AVATAR_IDS: readonly string[] = ['boy', 'girl', 'long'];

export interface Profile {
  name: string;
  avatar: Avatar;
}

const NAME_KEY = 'psc:name';
const AVATAR_KEY = 'psc:avatar';

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

export function loadProfile(): Profile {
  let name = '';
  let avatar: Avatar = Math.random() < 0.5 ? 'boy' : 'girl';
  try {
    name = localStorage.getItem(NAME_KEY)?.trim() ?? '';
    const saved = localStorage.getItem(AVATAR_KEY);
    if (saved && AVATAR_IDS.includes(saved)) avatar = saved as Avatar;
  } catch {}
  const profile = { name: name || randomSillyName(), avatar };
  saveProfile(profile);
  return profile;
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(NAME_KEY, profile.name);
    localStorage.setItem(AVATAR_KEY, profile.avatar);
  } catch {}
}

export const avatarImage = (avatar: Avatar) => `/images/avatar-${avatar}.webp`;
