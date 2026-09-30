const SEMI_MAJOR_AXIS_M = 6_378_137;
const FIRST_ECCENTRICITY_SQ = 0.00669437999014;

export type LatLng = { lat: number; lng: number };

export type DegreeScale = {
  mPerDegLat: number;
  mPerDegLng: number;
};

/** WGS84 local-tangent scale at one latitude. Compute once per session, not per fix. */
export const scaleAtLatitude = (latitudeDeg: number): DegreeScale => {
  const phi = (latitudeDeg * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const w = 1 - FIRST_ECCENTRICITY_SQ * sinPhi * sinPhi;
  const n = SEMI_MAJOR_AXIS_M / Math.sqrt(w);
  const m = (SEMI_MAJOR_AXIS_M * (1 - FIRST_ECCENTRICITY_SQ)) / w ** 1.5;
  const radians = Math.PI / 180;
  return {
    mPerDegLat: m * radians,
    mPerDegLng: n * Math.cos(phi) * radians,
  };
};

export const planeMetres = (from: LatLng, to: LatLng, scale: DegreeScale) => {
  const north = (to.lat - from.lat) * scale.mPerDegLat;
  const east = (to.lng - from.lng) * scale.mPerDegLng;
  return Math.hypot(north, east);
};

export const centroidLatitude = (points: LatLng[]) => {
  if (points.length === 0) return 0;
  const sum = points.reduce((total, point) => total + point.lat, 0);
  return sum / points.length;
};
