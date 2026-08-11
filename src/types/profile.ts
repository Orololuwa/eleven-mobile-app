export type Position = 'GK' | 'DEF' | 'MID' | 'WING' | 'FWD';
export type PreferredFoot = 'LEFT' | 'RIGHT' | 'BOTH';
export type DistanceUnit = 'km' | 'mi';
export type MassUnit = 'kg' | 'lb';

export type ProfileData = {
  firstName: string;
  fullName?: string;
  position: string;
  preferredFoot: string;
  heightCm?: number;
  weightKg?: number;
  club?: string;
};

export type SignInMethodId = 'google' | 'email' | 'apple';

export type SignInMethod = {
  id: SignInMethodId;
  label: string;
  connected: boolean;
  email?: string;
  since?: string;
};

export type UnitsPreference = {
  distance: DistanceUnit;
  mass: MassUnit;
};

export type SavedPitch = {
  id: string;
  name: string;
  size: string;
  sessions: number;
};

export const POSITIONS = ['GK', 'DEF', 'MID', 'WING', 'FWD'] as const;
export const FOOT_OPTIONS = ['LEFT', 'RIGHT', 'BOTH'] as const;

export const displayName = (user: ProfileData | null | undefined) => {
  if (!user) return 'Player';
  return user.fullName?.trim() || user.firstName?.trim() || 'Player';
};

export const profileMetaLine = (user: ProfileData | null | undefined) => {
  if (!user) return 'MID · LEFT';
  const parts = [user.position || 'MID', user.preferredFoot || 'LEFT'];
  if (user.heightCm) parts.push(`${user.heightCm} CM`);
  return parts.join(' · ');
};
