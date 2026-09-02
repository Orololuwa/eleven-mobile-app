import type { AttackDirection } from '../types';
import type { StoredPitchCorners } from './types';

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const toDegrees = (rad: number) => (rad * 180) / Math.PI;

const midpoint = ({ lat, lng }: { lat: number; lng: number }, b: { lat: number; lng: number }) => ({
  lat: (lat + b.lat) / 2,
  lng: (lng + b.lng) / 2,
});

/** Bearing from `from` to `to` in degrees [0, 360). */
export const bearingDegrees = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) => {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const angularDifference = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

export const resolveAttackDirection = ({
  headingDegrees,
  corners,
  position,
}: {
  headingDegrees: number;
  corners: StoredPitchCorners;
  position: { lat: number; lng: number };
}): AttackDirection => {
  const endA = midpoint(corners.end_a_corner_1, corners.end_a_corner_2);
  const endB = midpoint(corners.end_b_corner_1, corners.end_b_corner_2);
  const bearingToA = bearingDegrees(position, endA);
  const bearingToB = bearingDegrees(position, endB);
  const diffA = angularDifference(headingDegrees, bearingToA);
  const diffB = angularDifference(headingDegrees, bearingToB);
  return diffA <= diffB ? 'end_a' : 'end_b';
};

type TrackingSessionRowLike = {
  end_a_corner_1_lat: number | null;
  end_a_corner_1_lng: number | null;
  end_a_corner_2_lat: number | null;
  end_a_corner_2_lng: number | null;
  end_b_corner_1_lat: number | null;
  end_b_corner_1_lng: number | null;
  end_b_corner_2_lat: number | null;
  end_b_corner_2_lng: number | null;
};

export const cornersFromSessionRow = (
  row: Pick<
    TrackingSessionRowLike,
    | 'end_a_corner_1_lat'
    | 'end_a_corner_1_lng'
    | 'end_a_corner_2_lat'
    | 'end_a_corner_2_lng'
    | 'end_b_corner_1_lat'
    | 'end_b_corner_1_lng'
    | 'end_b_corner_2_lat'
    | 'end_b_corner_2_lng'
  >,
): StoredPitchCorners | null => {
  const {
    end_a_corner_1_lat,
    end_a_corner_1_lng,
    end_a_corner_2_lat,
    end_a_corner_2_lng,
    end_b_corner_1_lat,
    end_b_corner_1_lng,
    end_b_corner_2_lat,
    end_b_corner_2_lng,
  } = row;
  if (
    end_a_corner_1_lat == null ||
    end_a_corner_1_lng == null ||
    end_a_corner_2_lat == null ||
    end_a_corner_2_lng == null ||
    end_b_corner_1_lat == null ||
    end_b_corner_1_lng == null ||
    end_b_corner_2_lat == null ||
    end_b_corner_2_lng == null
  ) {
    return null;
  }
  return {
    end_a_corner_1: { lat: end_a_corner_1_lat, lng: end_a_corner_1_lng },
    end_a_corner_2: { lat: end_a_corner_2_lat, lng: end_a_corner_2_lng },
    end_b_corner_1: { lat: end_b_corner_1_lat, lng: end_b_corner_1_lng },
    end_b_corner_2: { lat: end_b_corner_2_lat, lng: end_b_corner_2_lng },
  };
};
