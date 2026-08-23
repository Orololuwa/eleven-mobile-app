import type { PositionOut, PreferredFoot, ProfileRead, ProfileReadPublic } from './types';
import { footLabel } from './validation';

type ProfileLike = ProfileRead | ProfileReadPublic | null | undefined;

export const preferredPosition = (positions: PositionOut[] = []) =>
  positions.find((entry) => entry.is_preferred)?.position ?? positions[0]?.position ?? null;

export const displayName = (profile: ProfileLike) => profile?.display_name?.trim() || 'Player';

export const profileMetaLine = (profile: ProfileLike) => {
  if (!profile) return 'CM · LEFT';
  const parts: string[] = [];
  const position = preferredPosition(profile.positions);
  if (position) parts.push(position);
  if (profile.preferred_foot) parts.push(footLabel(profile.preferred_foot));
  if (profile.height_cm) parts.push(`${profile.height_cm} CM`);
  return parts.join(' · ') || 'CM · LEFT';
};

export const avatarUrlWithCacheBust = ({
  avatar_url,
  avatar_updated_at,
}: {
  avatar_url?: string | null;
  avatar_updated_at?: string | null;
}) => {
  if (!avatar_url) return null;
  if (!avatar_updated_at) return avatar_url;
  const separator = avatar_url.includes('?') ? '&' : '?';
  return `${avatar_url}${separator}t=${encodeURIComponent(avatar_updated_at)}`;
};

export const preferredFootIndex = (foot: PreferredFoot | null | undefined) => {
  const options: PreferredFoot[] = ['left', 'right', 'both'];
  const index = options.indexOf(foot ?? 'left');
  return index >= 0 ? index : 0;
};
