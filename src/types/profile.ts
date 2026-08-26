export type DistanceUnit = 'km' | 'mi';
export type MassUnit = 'kg' | 'lb';

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
