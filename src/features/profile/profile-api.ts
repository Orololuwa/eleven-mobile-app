import { apiRequest } from '@/lib/api-client';
import type {
  AvatarConfirmIn,
  AvatarSignatureOut,
  PositionOut,
  PositionSetIn,
  ProfileRead,
  ProfileReadPublic,
  ProfileUpdate,
} from './types';

export const fetchMyProfile = () => apiRequest<ProfileRead>({ path: '/profiles/me' });

export const fetchProfileByUserId = (userId: string) =>
  apiRequest<ProfileRead | ProfileReadPublic>({ path: `/profiles/${userId}` });

export const updateMyProfile = (body: ProfileUpdate) =>
  apiRequest<ProfileRead>({ path: '/profiles/me', method: 'PATCH', body });

export const replaceMyPositions = (body: PositionSetIn) =>
  apiRequest<PositionOut[]>({ path: '/profiles/me/positions', method: 'PUT', body });

export const fetchAvatarSignature = () =>
  apiRequest<AvatarSignatureOut>({
    path: '/profiles/me/avatar/signature',
    method: 'POST',
  });

export const confirmAvatar = (body: AvatarConfirmIn) =>
  apiRequest<ProfileRead>({ path: '/profiles/me/avatar', method: 'PATCH', body });

export const deleteAvatar = () =>
  apiRequest<void>({ path: '/profiles/me/avatar', method: 'DELETE' });
