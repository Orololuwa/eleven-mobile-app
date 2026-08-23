export type PositionCode =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'SS'
  | 'ST';

export type PreferredFoot = 'left' | 'right' | 'both';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export type ProfileVisibility = 'public' | 'private';

export type LocationIn = {
  lat: number;
  lng: number;
};

export type LocationOut = {
  lat: number;
  lng: number;
};

export type PositionIn = {
  position: PositionCode;
  is_preferred?: boolean;
};

export type PositionOut = {
  position: PositionCode;
  is_preferred: boolean;
};

export type PositionSetIn = PositionIn[];

export type ProfileRead = {
  id: string;
  user_id: string;
  display_name: string;
  date_of_birth: string | null;
  preferred_foot: PreferredFoot | null;
  height_cm: number | null;
  skill_level: SkillLevel | null;
  bio: string | null;
  location: LocationOut | null;
  visibility: ProfileVisibility;
  avatar_public_id: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
  onboarding_completed: boolean;
  positions: PositionOut[];
  created_at: string;
  updated_at: string;
};

export type ProfileReadPublic = {
  user_id: string;
  display_name: string;
  preferred_foot: PreferredFoot | null;
  height_cm: number | null;
  skill_level: SkillLevel | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
  positions: PositionOut[];
};

export type ProfileUpdate = {
  display_name?: string | null;
  date_of_birth?: string | null;
  preferred_foot?: PreferredFoot | null;
  height_cm?: number | null;
  skill_level?: SkillLevel | null;
  bio?: string | null;
  location?: LocationIn | null;
  visibility?: ProfileVisibility | null;
  onboarding_completed?: boolean | null;
};

export type AvatarSignatureOut = {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
};

export type AvatarConfirmIn = {
  public_id: string;
  secure_url: string;
};

export const POSITION_CODES: PositionCode[] = [
  'GK',
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'SS',
  'ST',
];

export const PREFERRED_FOOT_OPTIONS: PreferredFoot[] = ['left', 'right', 'both'];

export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro'];

export const PROFILE_VISIBILITY_OPTIONS: ProfileVisibility[] = ['public', 'private'];
