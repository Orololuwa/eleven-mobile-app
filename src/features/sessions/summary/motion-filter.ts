/**
 * Amendment 03 C1 — constant-velocity Kalman filter over the local tangent plane, fusing position
 * fixes with Doppler speed. State `[x, y, vx, vy]` (metres east / north of the session origin, m/s).
 *
 * Pure: no React Native, no SQLite — the summary, the live snapshot and the replay tests all run
 * the same code. The summary adds the backward RTS pass (`smoothRun`); live uses the forward pass.
 */

type Vec = number[];
type Mat = number[][];

export type FilterTuning = {
  /** Unmodelled acceleration between fixes (m/s²). Low is safe once speed is fused (spec §3.0). */
  accelSigmaMps2: number;
  /** Floor on position noise — no chip is better than this, whatever it reports. */
  positionSigmaFloorM: number;
  /** Floor on Doppler speed noise. */
  speedSigmaFloorMps: number;
  /** Used when a fix has speed but no speed accuracy. */
  speedSigmaDefaultMps: number;
  /** Fused / network fixes report confident accuracy they do not have (C4). */
  fusedPositionSigmaFloorM: number;
  /** Play Services reports a flat 1.5 m/s speed accuracy indoors — not a measurement. */
  fusedSpeedSigmaFloorMps: number;
  /** Mahalanobis² beyond which a position fix is an outlier (2 dof, 99.9 %) — F3's job now. */
  positionInnovationGate: number;
  /** Updates before the innovation gate applies — the filter has no opinion yet. */
  gateWarmupUpdates: number;
  /**
   * Consecutive gated-out fixes after which the next is accepted anyway. A filter that has drifted
   * (wrong heading) would otherwise reject every true fix from then on.
   */
  gateLockoutFixes: number;
  /** Below this estimated speed the velocity has no usable direction (m/s). */
  directionMinSpeedMps: number;
  /** Heading is trusted once estimated speed ≥ this × its spread (≈ angular confidence). */
  headingConfidenceRatio: number;
  /**
   * A Doppler reading at or below this is "not moving" and observes v = (0, 0). The chip pins
   * speed to exactly 0 when it decides the receiver is static (21 Oct trace).
   */
  stationarySpeedMps: number;
};

export type FilterFix = {
  tMs: number;
  /** Metres east / north of the session origin. */
  x: number;
  y: number;
  horizontalAccuracyM: number;
  /** Doppler speed (m/s); null when the fix carries none. */
  speedMps: number | null;
  speedAccuracyMps: number | null;
  provider: 'gps' | 'fused' | null;
};

export type FilterStep = {
  tMs: number;
  /** Seconds since the previous step in the run; 0 for the first. */
  dt: number;
  /** State and covariance after the predict step (before this fix). Equal to filtered at a run start. */
  xPred: Vec;
  pPred: Mat;
  xFilt: Vec;
  pFilt: Mat;
  positionAccepted: boolean;
  speedUsed: boolean;
};

const zeros = (rows: number, cols: number): Mat =>
  Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

const transpose = (a: Mat): Mat => a[0]!.map((_, c) => a.map((row) => row[c]!));

const mul = (a: Mat, b: Mat): Mat => {
  const out = zeros(a.length, b[0]!.length);
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      const aik = a[i]![k]!;
      if (aik === 0) continue;
      for (let j = 0; j < b[0]!.length; j += 1) out[i]![j]! += aik * b[k]![j]!;
    }
  }
  return out;
};

const add = (a: Mat, b: Mat): Mat => a.map((row, i) => row.map((v, j) => v + b[i]![j]!));
const sub = (a: Mat, b: Mat): Mat => a.map((row, i) => row.map((v, j) => v - b[i]![j]!));
const mulVec = (a: Mat, v: Vec): Vec => a.map((row) => row.reduce((s, x, j) => s + x * v[j]!, 0));
const addVec = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]!);
const subVec = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]!);
const symmetrize = (a: Mat): Mat => a.map((row, i) => row.map((v, j) => (v + a[j]![i]!) / 2));

/** Gauss–Jordan inverse; matrices here are small and positive definite. */
const invert = (a: Mat): Mat => {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const p = m[col]![col]!;
    if (Math.abs(p) < 1e-12) throw new Error('motion-filter: singular matrix');
    for (let j = 0; j < 2 * n; j += 1) m[col]![j]! /= p;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = m[r]![col]!;
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) m[r]![j]! -= f * m[col]![j]!;
    }
  }
  return m.map((row) => row.slice(n));
};

const identity4 = (): Mat => [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const transition = (dt: number): Mat => [
  [1, 0, dt, 0],
  [0, 1, 0, dt],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

/** Discrete white-acceleration process noise. */
const processNoise = (dt: number, sigma: number): Mat => {
  const q = sigma * sigma;
  const a = (dt ** 4 / 4) * q;
  const b = (dt ** 3 / 2) * q;
  const c = dt ** 2 * q;
  return [
    [a, 0, b, 0],
    [0, a, 0, b],
    [b, 0, c, 0],
    [0, b, 0, c],
  ];
};

/** Generic measurement update. Returns null when the innovation fails `gate` (Mahalanobis²). */
const update = ({
  x,
  p,
  h,
  z,
  r,
  gate,
}: {
  x: Vec;
  p: Mat;
  h: Mat;
  z: Vec;
  r: Mat;
  gate: number | null;
}): { x: Vec; p: Mat } | null => {
  const ht = transpose(h);
  const innovation = subVec(z, mulVec(h, x));
  const s = add(mul(mul(h, p), ht), r);
  const sInv = invert(s);
  if (gate != null) {
    const weighted = mulVec(sInv, innovation);
    const d2 = innovation.reduce((sum, v, i) => sum + v * weighted[i]!, 0);
    if (d2 > gate) return null;
  }
  const k = mul(mul(p, ht), sInv);
  const nextX = addVec(x, mulVec(k, innovation));
  // Joseph form keeps P symmetric positive-definite.
  const ikh = sub(identity4(), mul(k, h));
  const nextP = symmetrize(add(mul(mul(ikh, p), transpose(ikh)), mul(mul(k, r), transpose(k))));
  return { x: nextX, p: nextP };
};

const positionSigma = (fix: FilterFix, tuning: FilterTuning) =>
  Math.max(
    fix.horizontalAccuracyM,
    fix.provider === 'fused' ? tuning.fusedPositionSigmaFloorM : tuning.positionSigmaFloorM,
  );

const speedSigma = (fix: FilterFix, tuning: FilterTuning) =>
  Math.max(
    fix.speedAccuracyMps ?? tuning.speedSigmaDefaultMps,
    fix.provider === 'fused' ? tuning.fusedSpeedSigmaFloorMps : tuning.speedSigmaFloorMps,
  );

/**
 * Doppler gives speed, not direction. Linearise around the estimated heading only when the filter
 * is confident in it: the speed estimate clears both the floor and twice its own spread.
 */
const knownHeading = (x: Vec, p: Mat, tuning: FilterTuning): [number, number] | null => {
  const speed = Math.hypot(x[2]!, x[3]!);
  const spread = Math.sqrt(Math.max(0, (p[2]![2]! + p[3]![3]!) / 2));
  if (speed < tuning.directionMinSpeedMps || speed < tuning.headingConfidenceRatio * spread) {
    return null;
  }
  return [x[2]! / speed, x[3]! / speed];
};

const applyFix = ({
  x,
  p,
  fix,
  updates,
  forceAccept,
  tuning,
}: {
  x: Vec;
  p: Mat;
  fix: FilterFix;
  updates: number;
  forceAccept: boolean;
  tuning: FilterTuning;
}) => {
  let state = { x, p };
  const sp = positionSigma(fix, tuning);
  if (forceAccept) {
    // Re-anchor: the prediction has lost the player; widen position belief to the miss.
    const dx = fix.x - x[0]!;
    const dy = fix.y - x[1]!;
    state = {
      x,
      p: p.map((row, i) =>
        row.map((v, j) => v + (i === j && i === 0 ? dx * dx : i === j && i === 1 ? dy * dy : 0)),
      ),
    };
  }
  const positioned = update({
    x: state.x,
    p: state.p,
    h: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ],
    z: [fix.x, fix.y],
    r: [
      [sp * sp, 0],
      [0, sp * sp],
    ],
    gate:
      !forceAccept && updates >= tuning.gateWarmupUpdates ? tuning.positionInnovationGate : null,
  });
  if (positioned) state = positioned;

  let speedUsed = false;
  if (fix.speedMps != null && fix.speedMps >= 0) {
    const ss = speedSigma(fix, tuning);
    if (fix.speedMps <= tuning.stationarySpeedMps) {
      // "Not moving" carries no heading, so it constrains both velocity components.
      state = update({
        x: state.x,
        p: state.p,
        h: [
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
        z: [0, 0],
        r: [
          [ss * ss, 0],
          [0, ss * ss],
        ],
        gate: null,
      })!;
      speedUsed = true;
    } else {
      const direction = knownHeading(state.x, state.p, tuning);
      if (direction) {
        state = update({
          x: state.x,
          p: state.p,
          h: [[0, 0, direction[0], direction[1]]],
          z: [fix.speedMps],
          r: [[ss * ss]],
          gate: null,
        })!;
        speedUsed = true;
      }
      // Heading unknown (just started moving): the next position fixes set it — the maneuver
      // inflation in filterRun has already made room for the change of speed.
    }
  }
  return { ...state, positionAccepted: positioned != null, speedUsed };
};

/**
 * Maneuver detection: when Doppler disagrees with the predicted speed by more than 3σ, the
 * constant-velocity model has been broken (a start, a stop, a cut) — widen the prediction for this
 * interval so the filter, and the smoother after it, place the change where it happened.
 */
const inflateForManeuver = ({
  xPred,
  pPred,
  fix,
  dt,
  tuning,
}: {
  xPred: Vec;
  pPred: Mat;
  fix: FilterFix;
  dt: number;
  tuning: FilterTuning;
}): Mat => {
  if (fix.speedMps == null) return pPred;
  const predicted = Math.hypot(xPred[2]!, xPred[3]!);
  const ss = speedSigma(fix, tuning);
  const spread = Math.sqrt(Math.max(0, (pPred[2]![2]! + pPred[3]![3]!) / 2));
  const miss = fix.speedMps - predicted;
  if (Math.abs(miss) <= 3 * Math.hypot(ss, spread)) return pPred;
  const velocityVar = (miss * miss) / 2;
  const positionVar = ((miss * dt) / 2) ** 2 / 2;
  return pPred.map((row, i) =>
    row.map((v, j) => (i !== j ? v : v + (i >= 2 ? velocityVar : positionVar))),
  );
};

const initialState = (fix: FilterFix, tuning: FilterTuning) => {
  const sp = positionSigma(fix, tuning);
  const speed = fix.speedMps ?? 0;
  const velocityVar = speed * speed + speedSigma(fix, tuning) ** 2;
  return {
    x: [fix.x, fix.y, 0, 0],
    p: [
      [sp * sp, 0, 0, 0],
      [0, sp * sp, 0, 0],
      [0, 0, velocityVar, 0],
      [0, 0, 0, velocityVar],
    ],
  };
};

/**
 * Forward pass over one continuous run of fixes (one segment, no reset gap inside). Fixes must be
 * in time order; duplicates (same timestamp) are skipped.
 */
export const filterRun = (fixes: FilterFix[], tuning: FilterTuning): FilterStep[] => {
  const steps: FilterStep[] = [];
  let x: Vec = [];
  let p: Mat = [];
  let updates = 0;
  let rejectedInARow = 0;
  for (const fix of fixes) {
    const previous = steps[steps.length - 1];
    if (!previous) {
      const init = initialState(fix, tuning);
      x = init.x;
      p = init.p;
      steps.push({
        tMs: fix.tMs,
        dt: 0,
        xPred: x,
        pPred: p,
        xFilt: x,
        pFilt: p,
        positionAccepted: true,
        speedUsed: false,
      });
      updates = 1;
      continue;
    }
    const dt = (fix.tMs - previous.tMs) / 1000;
    if (dt <= 0) continue;
    const f = transition(dt);
    const xPred = mulVec(f, x);
    const pPred = inflateForManeuver({
      xPred,
      pPred: symmetrize(add(mul(mul(f, p), transpose(f)), processNoise(dt, tuning.accelSigmaMps2))),
      fix,
      dt,
      tuning,
    });
    const next = applyFix({
      x: xPred,
      p: pPred,
      fix,
      updates,
      forceAccept: rejectedInARow >= tuning.gateLockoutFixes,
      tuning,
    });
    x = next.x;
    p = next.p;
    if (next.positionAccepted) {
      updates += 1;
      rejectedInARow = 0;
    } else {
      rejectedInARow += 1;
    }
    steps.push({
      tMs: fix.tMs,
      dt,
      xPred,
      pPred,
      xFilt: x,
      pFilt: p,
      positionAccepted: next.positionAccepted,
      speedUsed: next.speedUsed,
    });
  }
  return steps;
};

export type SmoothedState = { x: Vec; p: Mat };

/** Rauch–Tung–Striebel backward pass: each state also sees every fix that came after it. */
export const smoothRun = (steps: FilterStep[]): SmoothedState[] => {
  const n = steps.length;
  if (n === 0) return [];
  const out: SmoothedState[] = new Array(n);
  out[n - 1] = { x: steps[n - 1]!.xFilt, p: steps[n - 1]!.pFilt };
  for (let k = n - 2; k >= 0; k -= 1) {
    const current = steps[k]!;
    const next = steps[k + 1]!;
    const f = transition(next.dt);
    const c = mul(mul(current.pFilt, transpose(f)), invert(next.pPred));
    const later = out[k + 1]!;
    out[k] = {
      x: addVec(current.xFilt, mulVec(c, subVec(later.x, next.xPred))),
      p: symmetrize(add(current.pFilt, mul(mul(c, sub(later.p, next.pPred)), transpose(c)))),
    };
  }
  return out;
};

/** RMS position standard deviation (m). */
export const positionSigmaOf = (p: Mat) => Math.sqrt(Math.max(0, (p[0]![0]! + p[1]![1]!) / 2));

export const speedOf = (x: Vec) => Math.hypot(x[2]!, x[3]!);

/** Standard deviation of the speed estimate along its heading (isotropic when standing). */
export const speedSigmaOf = (x: Vec, p: Mat) => {
  const speed = speedOf(x);
  if (speed < 1e-6) return Math.sqrt(Math.max(0, (p[2]![2]! + p[3]![3]!) / 2));
  const ux = x[2]! / speed;
  const uy = x[3]! / speed;
  const variance = ux * ux * p[2]![2]! + 2 * ux * uy * p[2]![3]! + uy * uy * p[3]![3]!;
  return Math.sqrt(Math.max(0, variance));
};
