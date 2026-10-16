# Bug report — Eleven's distance far larger than Nike Run Club's (13 Oct 2026)

**Session:** open training, Ikeja, 13 Oct 2026, heavy thunderstorms, about 40 minutes.
**Device:** Vivo V2310 (Android 15). Eleven and Nike Run Club ran side by side on the same phone.
**Build:** the code before commit `16e5e52` (the Amendment 01 implementation).
**Related:** [Amendment 01](../sys-des/M-0/0.4_3_eleven-amendment-01-tracking-accuracy.md), [0.5 §3.3 / §3.9](../sys-des/M-0/0.5_eleven-session-summary-system-design-spec.md), [poor-signal debug report](2026-10-14_live-tracking-poor-signal.md).

## Summary

| Source | Distance | Duration | Implied average |
|---|---|---|---|
| **Eleven (live HUD)** | **27.69 km** | 40:37 | **40.9 km/h** |
| Nike Run Club | 5.94 km | 41:55 | 8.5 km/h |
| StepUp (step counter, no GPS) | ~5.63 km | — | — |

Eleven reported **4.66 times** the real distance, adding about 21.75 km that wasn't covered. Its average speed (40.9 km/h) was higher than its own reported top speed (38.3 km/h), which is impossible for a real measurement.

**Root cause:** the live HUD added up the straight-line distance between **every stored GPS point**, with no accuracy check, no limit on the time between points and no speed limit. Storage also had no accuracy check. In a storm, every fix lands somewhere random within an error cloud tens of metres wide, so summing consecutive fixes counts the random scatter as running. Nike Run Club smooths the track before measuring; Eleven summed raw positions.

The distance formula was **not** at fault. `planeMetres` (`tracking/geodesic.ts`) projects onto a local plane scaled by the WGS‑84 radii of curvature at the session's latitude. Over the metre-scale hops between fixes, its error is negligible next to GPS error.

---

## 1. What the code did on 13 Oct

### 1.1 The live HUD added up every point (the 27.69 km)

`src/features/sessions/tracking/live-metrics.ts` before `16e5e52`:

```ts
export const computeLiveMetrics = ({ points, pausedRanges }) => {
  // ...
  const activePoints = points.filter((p) => !isPausedAt(p.recorded_at));

  const scale = scaleAtLatitude(activePoints[0]?.lat ?? 0);
  const distanceM = activePoints.reduce((sum, point, index) => {
    if (index === 0) return sum;
    const prev = activePoints[index - 1];
    if (!prev) return sum;
    return sum + planeMetres(prev, point, scale);   // every consecutive pair, unconditionally
  }, 0);

  return { distanceKm: distanceM / 1000, topSpeedKmh: determineTopSpeedKmh(activePoints) };
};
```

The HUD tick (`use-tracking-session.ts`) and the lock-screen notification (`indicator.ts`) both called this with **every stored point** in the segment. Nothing checked:
- **accuracy:** a 45 m fix counted the same as a 3 m fix;
- **time between fixes:** a jump across a 30 s signal gap was summed as if it were run;
- **implied speed:** a 15 m jump in one second (54 km/h) was summed as real movement.

### 1.2 Storage had no accuracy check

`location-task.ts` before `16e5e52`:

```ts
const isAccurate = accuracy == null || accuracy < ACCEPTED_FIX_ACCURACY_M;   // 40 m

if (hasCoords && isAccurate) {
  await updateSessionFields(session.id, { last_accepted_fix_at: /* ... */ });  // lost-GPS timer only
}

const canInsert =
  hasCoords &&
  inActivity &&
  session.current_segment_id != null &&
  !inManualPause &&
  !(await getOpenPause(session.id));       // ← no accuracy condition
```

`isAccurate` only reset the lost-GPS timer. **Every fix with coordinates was stored**, whatever its accuracy, and the HUD summed whatever was stored.

### 1.3 The real threshold was 40 m, not the 20 m the spec said

Amendment 01 assumed a 20 m gate (from spec 0.4 §5). The code had `ACCEPTED_FIX_ACCURACY_M = 40`, unchanged since `a0a7f09` (3 Sep). That threshold was used only by the summary and the lost-GPS timer, never by the HUD distance.

### 1.4 The summary was stricter, and correctly refused

The summary (`compute-session-metrics.ts`) already did more:
- it only used fixes under 40 m;
- it only added distance for pairs no more than 5 s apart (`GAP_BRIDGE_MAX_SECONDS`) with an implied speed under 40 km/h.

It found clear signal for only **444 s of 2,437 s, an 82% gap**, rated the session `insufficient`, and withheld the numbers. So the summary behaved correctly. The HUD had shown 27.69 km for forty minutes and was then contradicted by the summary.

---

## 2. Why summing raw positions inflates distance

Each GPS fix is the true position plus an error. A player standing still with a ±20 m fix doesn't produce the same point every second: each fix lands somewhere in a 20 m cloud. The straight line between two consecutive fixes is mostly that error, not movement:

```
true path:     A ──────────── B          (player walks 8 m)
reported:      A' ↘    ↗ x2 ↘    ↗ B'    (each fix scattered by ±20 m)
                    x1         x3
summed:        |A'x1| + |x1x2| + |x2x3| + |x3B'|  ≫  |AB|
```

The effect grows with error size and with sampling rate: more fixes means more random hops summed.

**Consistency check against the 13 Oct numbers:** 27,690 m ÷ 2,437 s = **11.4 m added per second**. At one fix per second, that's an average hop of 11.4 m between consecutive fixes. That fits the error clouds of roughly ±20 m expected in a thunderstorm, and doesn't fit a player averaging 8.5 km/h (2.4 m/s).

Amendment 01 §5 modelled how far thresholds alone can reduce this (true distance 5.75 km):

| Quality threshold | Measured at 1 Hz | Measured at 2 Hz |
|---|---|---|
| 20 m | 24.85 km (4.32x) | 48.98 km (8.52x) |
| 10 m (current) | 13.18 km (2.29x) | 24.88 km (4.33x) |
| 5 m | 8.03 km (1.40x) | 13.21 km (2.30x) |
| 3 m | 6.55 km (1.14x) | 8.97 km (1.56x) |

The 20 m, 1 Hz row (4.32x) is close to the 4.66x observed. Because the real code stored and summed everything, including fixes over 20 m, the observed figure was a little worse than that row.

---

## 3. Why Nike Run Club reported 5.94 km

Nike Run Club doesn't publish its algorithm. These are standard techniques in running apps, **not verified for Nike specifically**:

- **Track smoothing (a Kalman filter or similar):** each new fix is blended with a prediction from the previous position and velocity, weighted by the fix's reported accuracy. A 20 m fix barely moves the smoothed position; scatter cancels out instead of adding up.
- **Stationary detection:** when speed and the motion sensors say the phone isn't moving, distance doesn't accumulate.
- **Step-count cross-check:** StepUp landed within 5% of Nike using no GPS at all, so a cadence-based check is a strong independent signal.

### Ruled out: "Nike uses fused location, Eleven uses raw GPS"

Amendment 01 §5 suggested Eleven might be using raw GPS while Nike used Google Play Services' fused location provider. **Eleven already uses the fused provider.** expo-location 19 on Android requests updates through `FusedLocationProviderClient`, both in the foreground (`LocationModule.kt`, `LocationHelpers.kt`) and in the background task Eleven tracks with (`taskConsumers/LocationTaskConsumer.kt`). The indoor fixes in the [poor-signal report](2026-10-14_live-tracking-poor-signal.md), Wi‑Fi positions every ~7 s reporting 6–7 m accuracy, are typical fused-provider behaviour.

The difference from Nike is **what each app does with the fixes**, not where the fixes come from.

---

## 4. What has been fixed (Amendment 01, `16e5e52` onwards)

| Problem | Before | Now |
|---|---|---|
| HUD distance source | Sum of every stored point | Same calculation as the summary (`computeSessionMetrics`) |
| Accuracy for distance | None in HUD; < 40 m in summary | Quality check ≤ 10 m for both |
| Storage | Every fix | Fixes ≤ 50 m (continuity check), with accuracy kept on each point |
| Time between fixes | None in HUD | Pairs counted only if ≤ 5 s apart, implied speed < 40 km/h, no manual pause between |
| Gap | Only continuity failures | Also time covered only by sub-10 m-quality fixes, i.e. any unmeasured time |
| Top speed | Took F3's word for it | F1 also checks horizontal accuracy; F3 rejects both < 50% and > 200% |
| HUD vs summary | Could contradict each other | Same calculation; HUD shows a signal notice |
| Batched fixes | Only newest processed | Every new fix processed in order |

Re-running the 13 Oct shape through the current rules: most of that session's fixes fail the 10 m check or the 5 s bridge. They count as unmeasured time instead of being summed, so the phantom 21.75 km can no longer accumulate.

---

## 5. What is **not** fixed: leftover inflation in good conditions

The current rules stop *bad* fixes from inflating distance. They don't stop *good* fixes from adding small hops while the player moves slowly, because distance is still the sum of raw positions.

**Measured on 14 Oct (outdoors, slow walking, fixes 3–8 m, one per second):**

| Session | Fixes | Old method (sum every point) | Current method (quality-gated, bridged) | Implied by phone's own speed readings* | Current ÷ speed readings |
|---|---|---|---|---|---|
| `8cfcf24f` | 181 | 101 m | 92 m | 61 m | **1.51x** |
| `72b8cea0` | 217 | 128 m | 116 m | 63 m | **1.85x** |

\* Σ (OS Doppler speed × time between fixes) over the same bridged pairs. Doppler speed measures velocity directly and doesn't scatter like position, so it's a reasonable proxy for true distance. It may under-read slightly at walking pace.

So even in clean conditions, the current method reads about **1.5–1.9 times** the true distance at walking pace. The quality check only removed about 10% compared with the old method, because these fixes were already accurate. The leftover inflation is position scatter of a few metres per fix, which is large relative to how far a slowly walking player moves in a second. At running pace the effect shrinks in proportion, but it doesn't disappear.

This matches Amendment 01 §5's conclusion: **thresholds make the app honest about bad data; they don't make good data accurate.**

---

## 6. Recommended next steps

1. **Smooth the track before measuring distance (Amendment 02).** A constant-velocity Kalman filter over local x/y position, with fix accuracy as measurement noise, would replace the raw pair sum in `compute-session-metrics.ts`, and therefore in the live HUD too. Validate it against Nike Run Club and a step counter on the same phone, in both clean and storm conditions.
2. **Cross-check against Doppler speed.** When Σ(speed × dt) and the position sum disagree by more than some ratio (for example 1.3x) over a window, prefer the speed-based distance or shrink the position sum. This needs no new sensors and works today.
3. **Stationary gate.** Treat stretches where the OS speed is below about 1 km/h for several seconds as zero distance, instead of summing scatter.
4. **Step count as an independent check.** StepUp's 5.63 km against Nike's 5.94 km shows a pedometer is trustworthy without GPS. Record steps per segment and flag sessions where GPS distance and step-implied distance diverge.
5. **Keep the spec and code in sync.** The real 40 m gate against the documented 20 m went unnoticed for six weeks. Constants that encode spec values should cite their spec section, and spec tables should be checked when constants change.

---

## Evidence index

| Claim | Source |
|---|---|
| 27.69 km vs 5.94 km vs 5.63 km; 82% gap; 38.3 km/h top speed | Amendment 01 §1 (field session data) |
| HUD summed every stored point | `git show 16e5e52^:src/features/sessions/tracking/live-metrics.ts` |
| Storage had no accuracy check; real gate 40 m | `git show 16e5e52^:src/features/sessions/tracking/location-task.ts`, `…/constants.ts` |
| Summary bridged at 5 s / 40 km/h and withheld numbers | `git show 16e5e52^:src/features/sessions/summary/compute-session-metrics.ts` |
| Eleven already uses the fused provider | `node_modules/expo-location/android/.../LocationTaskConsumer.kt` (`FusedLocationProviderClient`) |
| 1.51x / 1.85x leftover inflation in clean conditions | On-device SQLite, sessions `8cfcf24f` and `72b8cea0`, 14 Oct |
