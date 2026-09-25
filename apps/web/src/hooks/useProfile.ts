import { useCallback, useState } from 'react';
import { loadProfile, type Profile, saveProfile } from '@/lib/profile';

/** The player's nickname + avatar, saved in this browser whenever it changes. */
export function useProfile() {
  const [profile, setProfile] = useState(loadProfile);
  const change = useCallback((value: Profile) => {
    setProfile(value);
    saveProfile(value);
  }, []);
  return [profile, change] as const;
}
