import { create } from 'zustand';
import type { ActivityKind, AttackDirection } from '../types';
import type { LiveMetrics, TrackingPhase } from './types';

type TrackingHudStore = {
  phase: TrackingPhase;
  elapsedSeconds: number;
  extraSeconds: number;
  metrics: LiveMetrics;
  gpsAccuracyM: number | null;
  segmentIndex: number;
  segmentLabel: string;
  activityKind: ActivityKind | null;
  attackDirection: AttackDirection | null;
  pendingAttackDirection: AttackDirection | null;
  closedSegmentElapsed: number;
  /** Null when the summary would suppress distance. */
  closedSegmentDistanceKm: number | null;
  closedSegmentIndex: number;
  closedSegmentLabel: string;
  gpsSearchSeconds: number;
  setPhase: (phase: TrackingPhase) => void;
  setHud: (patch: Partial<Omit<TrackingHudStore, 'setPhase' | 'setHud' | 'reset'>>) => void;
  reset: () => void;
};

const initialHud = {
  phase: 'permission' as TrackingPhase,
  elapsedSeconds: 0,
  extraSeconds: 0,
  metrics: { distanceKm: null, topSpeedKmh: null, signal: 'settling' } as LiveMetrics,
  gpsAccuracyM: null as number | null,
  segmentIndex: 1,
  segmentLabel: 'SESSION',
  activityKind: null as ActivityKind | null,
  attackDirection: null as AttackDirection | null,
  pendingAttackDirection: null as AttackDirection | null,
  closedSegmentElapsed: 0,
  closedSegmentDistanceKm: null as number | null,
  closedSegmentIndex: 1,
  closedSegmentLabel: '',
  gpsSearchSeconds: 0,
};

export const useTrackingHudStore = create<TrackingHudStore>((set) => ({
  ...initialHud,
  setPhase: (phase) => set({ phase }),
  setHud: (patch) => set(patch),
  reset: () => set(initialHud),
}));

// HUD being Heads-Up Display
