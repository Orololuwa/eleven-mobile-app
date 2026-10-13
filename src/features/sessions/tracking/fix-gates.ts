import { CONTINUITY_FIX_ACCURACY_M, QUALITY_FIX_ACCURACY_M } from './constants';

/** Tracking is alive. A device that omits accuracy still counts, so it never pauses forever. */
export const passesContinuityGate = (accuracyM: number | null) =>
  accuracyM == null || accuracyM <= CONTINUITY_FIX_ACCURACY_M;

/** Good enough to measure with. An unquantified fix never enters a metric. */
export const passesQualityGate = (accuracyM: number | null) =>
  accuracyM != null && accuracyM <= QUALITY_FIX_ACCURACY_M;
