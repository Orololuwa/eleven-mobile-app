export type LocationIn = {
  lat: number;
  lng: number;
};

export type LocationOut = {
  lat: number;
  lng: number;
};

export type PitchVisibility = 'private' | 'public';

export type PitchCorners = {
  end_a_corner_1: LocationIn;
  end_a_corner_2: LocationIn;
  end_b_corner_1: LocationIn;
  end_b_corner_2: LocationIn;
};

export type PitchCreate = PitchCorners & {
  name: string;
};

export type PitchRead = {
  id: string;
  name: string;
  created_by_user_id: string | null;
  visibility: PitchVisibility;
  verified: boolean;
  end_a_corner_1: LocationOut;
  end_a_corner_2: LocationOut;
  end_b_corner_1: LocationOut;
  end_b_corner_2: LocationOut;
  created_at: string;
};

export type PitchNearby = PitchRead & {
  distance_meters: number;
};
