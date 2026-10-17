import {
  CONTINUITY_FIX_ACCURACY_M,
  LIVE_QUALITY_FIX_ACCURACY_M,
  QUALITY_FIX_ACCURACY_M,
} from './constants';

/** Tracking is alive. A device that omits accuracy still counts, so it never pauses forever. */
export const passesContinuityGate = (accuracyM: number | null) =>
  accuracyM == null || accuracyM <= CONTINUITY_FIX_ACCURACY_M;

/** Good enough for summary metrics. An unquantified fix never enters a stored metric. */
export const passesQualityGate = (accuracyM: number | null) =>
  accuracyM != null && accuracyM <= QUALITY_FIX_ACCURACY_M;

/** Good enough for the live HUD (distance / measuring-now). Requires a known accuracy. */
export const passesLiveQualityGate = (accuracyM: number | null) =>
  accuracyM != null && accuracyM <= LIVE_QUALITY_FIX_ACCURACY_M;
