# Debug report — "Poor signal" while GPS shows ±3 m (14 Oct 2026)

**Device:** Vivo V2310, Android 15, MediaTek GNSS (`MTK_MNLD_6_0_0`), development build over USB.
**Scope:** live HUD signal state, GPS label, fix delivery, hold-to-confirm, session finalize sync.
**Related specs:** [0.4_3 Amendment 01](../sys-des/M-0/0.4_3_eleven-amendment-01-tracking-accuracy.md), [0.5 §3.3 / §3.9 / §5.1](../sys-des/M-0/0.5_eleven-session-summary-system-design-spec.md).

## Summary

The live HUD said **"Poor signal — not tracking accurately"** while the GPS label read `▮▮▮ ±3 M`. There was no single cause. The investigation found seven separate issues: some in the app, one in the environment, and one product decision.

| # | Issue | Kind | Fix |
|---|---|---|---|
| 1 | "Poor signal" came from the session's whole history, not the current signal | App logic | The signal state now looks at the last few seconds |
| 2 | The GPS label showed the last *stored* fix, however old | App logic | The label now uses the newest fix the phone delivered, if under 5 s old |
| 3 | Only the newest fix in each delivered batch was processed | App logic | Every new fix in a batch is processed, oldest first |
| 4 | Indoors, fixes came every ~7 s (Wi‑Fi estimates), so time went unmeasured | Environment | No code change; explained below |
| 5 | GPS cold start (about 30 s at more than 10 m) showed "Poor signal" | App logic / UX | "Measuring" until the first two good fixes, for up to 60 s |
| 6 | "Signal back · earlier gaps" appeared when the session was just short of the 120-fix minimum | App logic | "Signal back" now needs the unmeasured share to be over 25% |
| 7 | Distance and top speed were hidden for the first 2 minutes | Product decision | Always shown live; the summary still applies its rules |
| 8 | Holding to end a segment or session made the screen flicker or hang | Bug | `onConfirm` no longer runs inside a React state update function |
| 9 | Finalize upload was rejected: `segment_metrics and sprint_efforts require metrics` | Contract mismatch | The app sends `metrics`, the key the backend expects, instead of `session_metrics` |

---

## Background: how a session gets measured

Amendment 01 defines two accuracy checks and one rule for joining fixes:

- **Continuity check (≤ 50 m):** the fix is stored, and it resets the lost-GPS timer.
- **Quality check (≤ 10 m):** the only fixes that count toward distance and speed.
- **Bridge:** two quality fixes count as measured time only if they are **no more than 5 s apart** (`GAP_BRIDGE_MAX_SECONDS`), with no manual pause between them and an implied speed under 40 km/h.
- **Gap** = active time minus measured time. The summary rates a session `insufficient` if the gap is over 25%, it has fewer than 120 quality fixes, or it is under 2 minutes long.

So a fix can be very accurate and still measure nothing, if the next one comes more than 5 s later. That was behind most of this session.

---

## 1. "Poor signal" came from cumulative gap, not the current signal

**Symptom:** "Poor signal" stayed on screen after the signal had recovered.

**Cause:** the state came straight from the cumulative classification. Once early gaps took the session over 25%, it kept saying "move into open sky", even with clean fixes arriving every second.

**Fix (`live-metrics.ts`):** `isMeasuringNow` checks the **latest two quality fixes**. Both must be no more than 5 s from each other and from now. The message for an `insufficient` session now depends on that check:

| Condition | State shown |
|---|---|
| Fewer than 2 quality fixes and under 60 s active (cold start) | `settling` → "MEASURING" |
| Not measuring now | `poor` → "Poor signal — not tracking accurately." |
| Measuring now, under 2 min or gap ≤ 25% | `settling` → "MEASURING" |
| Measuring now, at least 2 min and gap > 25% | `recovering` → "SIGNAL BACK" |

---

## 2. The GPS label could be stale

**Symptom:** the label showed `±3 M` with no new fixes coming in. Later, after the first fix, it showed `GPS ▮ …` (1 bar, no ±m) while the phone had a 3 m fix.

**Cause:**
- **Originally:** the label read the accuracy of the last *stored* point, however old.
- **After the first fix:** the label read stored points but rejected stale ones. Fixes are not stored before an activity starts, between activities, or while paused, so the label went blank while the GPS was fine.

The Metro log shows good fixes arriving while nothing was being stored:

```
LOG  [location-task] skip {"accuracy": 3, "reason": "no-activity", "source": "watch", "trackingStatus": "live"}
LOG  [location-task] skip {"accuracy": 3.9149999618530273, "reason": "no-activity", "source": "watch", "trackingStatus": "live"}
```

**Fix:** `location-task.ts` records the newest fix the OS delivered (`getLatestFix()`), whether stored or not. The HUD uses `currentFixAccuracyM({ fix: getLatestFix() })`, which shows the accuracy only if that fix is no more than 5 s old, and `…` otherwise.

**Verified on device:** the label showed ±m for the whole run, from a fix never more than 1.3 s old (20 m, then 10 m, 8.9 m, down to 3 m).

---

## 3. Batched fixes were dropped

**Cause:** `processLocationUpdate` kept only `locations[locations.length - 1]`. If Android delivered several fixes at once, the rest were thrown away, which could leave gaps over 5 s even with an accurate signal.

**Fix:** sort the delivery by time, keep only fixes newer than `lastProcessedAt`, and process each one in order through `processFix`. `lastProcessedAt` is updated before any `await`, so overlapping deliveries from the foreground watcher and the background task can't insert the same fix twice.

**Note:** on this device, fixes arrived one at a time (`batchSize: 1`), so this wasn't the main cause here. It still matters on phones that batch aggressively.

---

## 4. Indoors: 7-second Wi‑Fi fixes (environment, no code change)

**Symptom:** "Poor signal" with fixes at 6–7 m accuracy.

**Evidence: fix spacing from the app log.** Accuracy improved, but the gap between fixes stayed at about 7.1 s:

```
LOG  [location-task] point {"accuracy": 25.597, "intervalMs": null, ...}
LOG  [location-task] point {"accuracy": 42.237, "intervalMs": 7123, ...}
LOG  [location-task] point {"accuracy": 12.652, "intervalMs": 7102, ...}
LOG  [location-task] point {"accuracy": 8.856,  "intervalMs": 7151, ...}
LOG  [location-task] point {"accuracy": 6.956,  "intervalMs": 7116, ...}
LOG  [location-task] point {"accuracy": 6.428,  "intervalMs": 7101, ...}
```

The native batch timestamps show the same 7 s spacing (offsets from the first fix, in ms):

```
[0, 7035, 14098, 21300, 28419, 35499, 42599, 49715, 56798, 63895, ...]
```

**Evidence: what Android reported (`adb shell dumpsys location`).** The app's 1 Hz request reached the GPS chip:

```
gps provider request = ProviderRequest[@+1s0ms, HIGH_ACCURACY, WorkSource{10318 com.eleven.app}]
mFixInterval=1000
```

The chip delivered once a second for about 7 s, then stopped while the request was still active. From then on, the app's fixes came from Wi‑Fi/cell location:

```
09:34:10.452: gps provider received location[1]
09:34:11.395: gps provider received location[1]      ← last GNSS fix
09:34:12.642: fused provider received location[1]
09:34:12.665: network provider received location[1]
09:34:20.425: fused provider received location[1]
09:34:20.543: network provider received location[1]
09:34:27.501: fused provider received location[1]
09:34:27.946: network provider received location[1]
```

The chip's last GNSS fix showed a very poor sky view:

```
Location[gps ... hAcc=286.9 ... {satellites=4, maxCn0=33, meanCn0=28}]
```

**Outdoors, the same phone gave 1 Hz GNSS fixes:**

```
LOG  [location-task] point {"accuracy": 13.692, "intervalMs": 1028, ...}
LOG  [location-task] point {"accuracy": 6.334,  "intervalMs": 1028, ...}
LOG  [location-task] point {"accuracy": 4.026,  "intervalMs": 1029, ...}
LOG  [location-task] point {"accuracy": 3,      "intervalMs": 1028, ...}
```

**Conclusion:** indoors, the GPS chip loses lock. Android's location service quietly switches to Wi‑Fi estimates every ~7 s and reports them as accurate to 6–7 m. They pass the 10 m check but fail the 5 s bridge, so that time counts as unmeasured. That's intended: distance from Wi‑Fi positions 7 s apart would be largely made up. The 5 s bridge was deliberately left unchanged.

**What was ruled out with logs:**

| Hypothesis | Result | Evidence |
|---|---|---|
| Android or the OEM throttles the fix rate | Confirmed in part: the GPS chip lost lock and Android fell back to Wi‑Fi | dumpsys event log above |
| Our duplicate filter drops batched fixes | Rejected | every delivery kept exactly one new fix (`fresh: 1`) |
| The background task never fires | Rejected | 56 deliveries, no errors |
| Fixes dropped silently elsewhere | Rejected | every native fix reached `processLocationUpdate` |

---

## 5. Cold start read as "Poor signal"

**Symptom:** about 26 s of "Poor signal" right after starting a run outdoors.

**Evidence: the first fixes of session `72b8cea0` from the phone's database.** The first fix came 8 s after the start; accuracy reached 10 m only at 33 s:

```
09:02:44 17.7 m   09:02:54 29.4 m   09:02:56 26.1 m   09:02:57 24.3 m
09:02:58 21.0 m   09:03:00 18.5 m   09:03:02 14.4 m   09:03:04 11.5 m
09:03:06 10.8 m   09:03:08 10.2 m   09:03:09  9.9 m   ← first quality fix
```

Live readout log over the same window:

```
10:02:41 settling
10:02:45 poor          ← warm-up, accuracy 17–29 m
10:03:11 settling
```

**First fix:** "Measuring" until the first quality fix, for at most 60 s (`LIVE_SIGNAL_SETTLE_SECONDS = 60`).

**Follow-up:** the next run still showed a single one-second "Poor signal" flash, exactly when the first sub-10 m fix arrived. One quality fix isn't enough for "measuring now", which needs two:

```
10:21:27 settling  acc 10.0
10:21:29 poor      acc 8.9     ← first quality fix, no pair yet
10:21:30 settling  acc 8.0
```

**Final fix:** locking on lasts until there are **at least two** quality fixes (still capped at 60 s), so a start that never gets a good fix still ends in "Poor signal".

---

## 6. "Signal back" shown when only the fix count was short

**Evidence:** replaying session `8cfcf24f` from the phone's database through `computeLiveReadout`:

```
offset  signal      active  gap  quality fixes
115 s   settling    115     15   100
125 s   recovering  125     15   110   ← gap only 12%, but < 120 fixes
150 s   estimated   150     15   135
```

"Signal back · earlier gaps" was shown because the session was `insufficient`, but only because of the 120-fix minimum; the gap was fine.

**Fix:** `recovering` now requires the unmeasured share to be over 25%. A shortfall in fix count alone reads as `settling`. The same replay afterwards: `125 s settling`.

---

## 7. Distance and top speed hidden for 2 minutes (product decision)

**Decision (user, 14 Oct 2026):** show distance and top speed live from the first second.

**Rationale:** they only ever add up quality-gated, bridged fixes. Bad data makes them read **low**, never inflated, so showing them early is honest as long as a message says how far to trust them.

**Change:**
- `computeLiveReadout` always returns distance and top speed. The live message copy changed to:

| State | Message |
|---|---|
| `settling` | "MEASURING · EARLY NUMBERS ARE ESTIMATES" |
| `recovering` | "SIGNAL BACK · EARLIER GAPS · NUMBERS READ LOW" |
| `poor` | "Poor signal — not tracking accurately." / "MOVE INTO OPEN SKY · DISTANCE PAUSES UNTIL IT CLEARS" |

- The summary screen still applies all of §3.9's rules, including the 2-minute and 120-fix minimums.
- Spec 0.5 §5.1 and `.cursor/rules/jsx-and-tsx.mdc` were updated.

---

## 8. Hold-to-confirm made the end screen flicker or hang

**Symptom:** holding to end a segment or session flickered between screens and sometimes hung.

**Evidence:**

```
ERROR  Cannot update a component (`ActiveSessionScreen`) while rendering a different component (`HoldToConfirmButton`).
  handleEnd (src/screens/session/active-session.tsx:349:12)
  HoldToConfirmButton.props.onConfirm (src/screens/session/active-session.tsx:620:48)
  setHoldProgress$argument_0 (src/components/hold-to-confirm-button.tsx:55:20)
```

**Cause:** `onConfirm()` was called inside the `setHoldProgress(prev => …)` updater. React can run updater functions more than once (it does in development), so `endSession` and `stopCurrentActivity` could run twice and update the parent mid-render.

**Fix (`hold-to-confirm-button.tsx`):** progress is tracked in a ref. The interval callback checks it and calls `onConfirm()` once, outside any state updater.

---

## 9. Finalize sync rejected: "segment_metrics and sprint_efforts require metrics"

**Evidence:**

```
ERROR  [sync] c4634dc9-d96d-4f1f-b219-b6125a7b1895 [ApiError: Segment_metrics and sprint_efforts require metrics]
```

**Cause:** the app sent the session totals as `session_metrics`. The backend's `SessionFinalizeIn` (`backend/app/schemas/session.py`) expects `metrics`. Pydantic ignores unknown keys, so the backend saw `metrics = None` alongside a non-empty `segment_metrics`, and its validator rejected the request. This mismatch has existed since the 0.5 summary feature, so every session with metrics failed to finalize.

**Fix:** `SessionFinalizeBody.metrics` (`types.ts`) and `metrics: toSessionMetricsPayload(...)` (`sync.ts`), matching the deployed backend. The other `SessionMetricsIn` fields were checked against the payload and match. Sessions that failed earlier retry automatically with the corrected body.

---

## Separate finding (not fixed): the native layer keeps resending earlier fixes

Each background-task delivery contained **every fix since tracking started**, not just new ones (delivery sizes 3, 4, 5 … 57). Our duplicate filter handles it (only one new fix per delivery), but the payload grows with session length. In a 90-minute session at 1 Hz, that's thousands of fixes resent and re-sorted on every delivery. Worth investigating in `expo-task-manager`'s job scheduling.

---

## Debugging techniques that worked

- **`intervalMs` / `batchSize` on the `[location-task] point` log.** These stay in the code; they showed the 7 s spacing immediately.
- **`adb shell dumpsys location`.** Showed what Android asked the GPS chip for and which provider (GPS, Wi‑Fi/network, fused) produced each fix.
- **Pulling the phone's SQLite database (debug builds only):**

  ```bash
  adb exec-out run-as com.eleven.app cat files/SQLite/eleven-tracking.db > eleven-tracking.db
  adb exec-out run-as com.eleven.app cat files/SQLite/eleven-tracking.db-wal > eleven-tracking.db-wal
  sqlite3 eleven-tracking.db "select recorded_at, horizontal_accuracy_m from tracking_points where session_id='…' order by recorded_at"
  ```

- **Replaying real sessions** through `toComputationInput` and `computeLiveReadout` in a temporary vitest file, at chosen times into the run. This reproduced exactly what the HUD would show, with no field test needed.
- **USB port forwarding** for Metro (`npm run start:usb`) and for the debug log endpoint (`adb reverse tcp:<port> tcp:<port>`).

## Files changed

| File | Change |
|---|---|
| `src/features/sessions/tracking/live-metrics.ts` | `isMeasuringNow`, `currentFixAccuracyM`, signal states, numbers always returned |
| `src/features/sessions/tracking/location-task.ts` | Process every fix in a batch; `getLatestFix()`; `intervalMs` / `batchSize` logging |
| `src/features/sessions/tracking/use-tracking-session.ts` | GPS label from the latest delivered fix |
| `src/features/sessions/tracking/constants.ts` | `LIVE_SIGNAL_SETTLE_SECONDS = 60` |
| `src/features/sessions/tracking/types.ts` | `recovering` signal; finalize body field `metrics` |
| `src/features/sessions/tracking/indicator.ts` | Notification labels for each signal state |
| `src/features/sessions/tracking/sync.ts` | Sends `metrics` |
| `src/components/hold-to-confirm-button.tsx` | `onConfirm` moved out of the state updater |
| `src/screens/session/active-session.tsx` | Signal message copy |
| `src/features/sessions/tracking/live-metrics.test.ts` | Cold start, first quality fix, sparse fixes, recovering, lost-now cases |
| `docs/sys-des/M-0/0.5_eleven-session-summary-system-design-spec.md` | §5.1 live HUD behaviour |
| `.cursor/rules/jsx-and-tsx.mdc` | Live readout and GPS label guidance |
| `package.json` | `start:usb` script |
