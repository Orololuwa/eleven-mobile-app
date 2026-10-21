import type { LatestFix } from './types';

let latestFix: LatestFix | null = null;

/** Newest fix delivered by the OS in this JS context, stored or not. */
export const getLatestFix = () => latestFix;

export const setLatestFix = (fix: LatestFix | null) => {
  latestFix = fix;
};
