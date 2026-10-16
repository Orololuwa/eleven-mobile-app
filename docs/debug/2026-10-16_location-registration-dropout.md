# Bug report — Eleven silently loses its location registration mid-session (16 Oct 2026)

**Severity:** Critical — the app stops receiving GPS entirely and reports it as weak signal
**Status:** Root cause located in the dumpsys event log; the code path that drops the registration is not yet identified
**Device:** Vivo V2310, Android 15, MediaTek GNSS (`MTK_MNLD_6_0_0`)
**Session:** Friday morning run, 16 Oct 2026, Eleven and Nike Run Club tracking simultaneously
**Evidence:** `adb shell dumpsys location`, captured after the run
**Related:** [Amendment 02 §B0](../sys-des/M-0/0.4_4_eleven-amendment-02-fix-integrity-and-acquisition.md), [Amendment 01](../sys-des/M-0/0.4_3_eleven-amendment-01-tracking-accuracy.md)

---

## 1. Summary

During a 53-minute run tracked by both apps on one phone, Eleven's GPS registration dropped after nine minutes, came back only as three registrations lasting under two seconds each, and was then **absent for the final 35 minutes**. Nike's registration was continuous throughout and the chip delivered clean 1 Hz fixes the whole time.

The HUD displayed **"Poor signal — not tracking accurately"**, a frozen distance of 1.34 km, and a 0:00 clock. None of that was a signal problem. The app was reporting on a fix stream it was no longer subscribed to.

**This supersedes the working assumption of the previous two days.** The apparent under-reading was not the quality gate or the 5 s bridge discarding weak fixes. There were no fixes to discard.

---

## 2. Evidence

### 2.1 Registration timeline (10-16, gps provider)

| Registration | Window | Held |
|---|---|---|
| `F5B3E74A` | 05:57:11 → 05:57:14 | 3.2 s |
| `C13221B0` | 05:57:15 → 05:57:23 | 8.1 s |
| **`DB373CAC`** | **05:57:44 → 06:06:49** | **545.7 s** |
| `2C0D411C` | 06:15:06 → 06:15:08 | 1.6 s |
| `2A865D7A` | 06:15:11 → 06:15:13 | 1.6 s |
| `BBEA50ED` | 06:15:13 → 06:15:14 | 0.4 s |

- **Blackout:** 06:06:50 → 06:15:06, **8.3 minutes** with no registration at all.
- **After 06:15:14 Eleven never re-registers.** Nike's run continued to 06:50 — **35.2 further minutes** with Eleven unsubscribed.
- The opening is also unstable: two registrations lasting 3.2 s and 8.1 s before one finally holds at 05:57:44.

### 2.2 The chip was healthy throughout

At 06:50, while the HUD was showing poor signal, the provider was delivering once per second:

```
06:50:14.573: gps provider received location[1]
06:50:14.576: gps provider delivered location[1] to 10282/com.nike.plusgps/32D1BB2A
06:50:15.627: gps provider received location[1]
06:50:15.635: gps provider delivered location[1] to 10282/com.nike.plusgps/32D1BB2A
```

Clean 1 Hz GNSS, delivered to Nike. Eleven is not in the delivery list because it is not registered.

No `location power save mode` change occurs on 10-16 during the run, so Doze and battery saver are ruled out for this session. Location services stayed enabled from 05:53:05 until 06:50:47.

### 2.3 Both apps shared one fix stream

```
10-16 05:57:11.704: gps provider request =
  ProviderRequest[@+10ms, HIGH_ACCURACY,
  WorkSource{10282 com.nike.plusgps, 10321 com.eleven.app}]
```

A single merged request, both packages in one `WorkSource`. While Eleven was registered it received the same fixes Nike did. This closes the long-running question of whether the two apps see different data: they do not.

### 2.4 Measurement was fine while subscribed

Over the 9.1 minutes Eleven held registration `DB373CAC`:

| | |
|---|---|
| NRC pace (7.20 km / 53:02 = 8.15 km/h) over 9.1 min | 1.23 km |
| Eleven HUD at 06:14 | 1.34 km |
| Ratio | **1.09x** |

A slight **over**-read, consistent with the residual position-scatter inflation already measured (Amendment 01 §5). The gates and the bridge were working as designed.

An earlier analysis of these screenshots reported Eleven at 58% of expected distance at 17 minutes. That figure assumed continuous tracking and is **void** — the clock had kept running while the fix stream had not.

---

## 3. Why this looked like a signal problem

Amendment 01 §4 made the HUD derive its signal state from the live computation. `isMeasuringNow` asks whether the latest two quality fixes are fresh and within the bridge window. With no fixes arriving at all, that is false, so the HUD reports `poor` — *"Poor signal — not tracking accurately. Move into open sky."*

The logic is correct for its intended input. It cannot distinguish **"fixes are arriving and they're bad"** from **"no fixes are arriving because we aren't subscribed"**, and those need opposite responses: one asks the player to move, the other needs the app to re-register. Telling a player in open sky to move into open sky is the visible symptom of that gap.

`getLatestFix()` has the same blind spot — it records the newest fix the OS delivered, and when nothing is delivered it simply goes stale, which the GPS label renders as `…`.

---

## 4. Suspected causes, not yet confirmed

Two things register for location in `location-task.ts`: `Location.startLocationUpdatesAsync` for the background task, and `Location.watchPositionAsync` in `ensureForegroundWatch`. Either can go away independently.

Candidates, in the order worth checking:

1. **`processFix` tearing down its own tracking.** When `getActiveTrackingSession()` returns null, or the session reads `ended`, the function calls `void stopLocationTracking()` and returns false. `stopLocationTracking` removes the foreground watch, resets `lastProcessedAt`, and calls `stopLocationUpdatesAsync`. If that query ever misses a live session — a transient DB read, or a session row momentarily inconsistent during a segment switch — the app unsubscribes itself mid-run and nothing re-subscribes.
2. **`handleAppBackgrounded` and the foreground watch.** The watch is a foreground subscription; the task is meant to survive backgrounding. Worth confirming the task registration actually persists when the app backgrounds, rather than both disappearing together.
3. **Foreground service death and a silent restart failure.** `startLocationTrackingOnce` catches the Android "cannot start FGS from background" error and retries via `whenAppActive()`. If the service is killed while the app is backgrounded, that retry waits for the app to become active — which, with the phone in a pocket, may be the rest of the run.
4. **The sub-two-second churn at 06:15.** Three registrations dying almost immediately looks like start and stop racing each other. `startLock` serialises starts, but `stopInFlight` and `startLock` are independent, so a stop can land between a start acquiring its lock and completing.

The 06:15 burst and the 05:57 opening instability are probably the same mechanism as the 06:06 drop, caught at a different moment.

---

## 5. Nothing detects this today

No code path notices that location updates have stopped. There is no watchdog comparing "a session is live" against "a registration exists", and `isLocationTaskRunning()` is only consulted on mount. The app can be fully unsubscribed for 35 minutes and the only outward sign is a signal warning that blames the sky.

---

## 6. Recommended fixes

Specified as **B0** in Amendment 02, ahead of everything else in that document.

1. **Watchdog.** While a session is live, periodically assert that a registration exists and that a fix has arrived recently; re-register when it hasn't. This is the fix that makes the failure survivable whatever its cause.
2. **Distinguish the two silences.** A new signal state for "not receiving" — the app is at fault, do not tell the player to move. `poor` keeps its current meaning: fixes arriving, quality too low.
3. **Never self-terminate on a single failed read.** `processFix` should not call `stopLocationTracking()` on one null session lookup. Require repeated confirmation, or restrict teardown to an explicit `ended` status.
4. **Log every registration transition** with reason, so the next occurrence names its own cause instead of needing a dumpsys.

---

## 7. What this reorders

Amendment 02 was drafted around fix integrity (durable dedupe), provider discrimination, cold-start acquisition and sensor fallback. All remain valid. None of them matter while the app is not subscribed to location, so B0 goes first.

It also partially explains 13 October. That session showed clear signal for 444 s of 2,437 s — an 82% gap originally attributed entirely to the storm. Some of that gap may have been this bug. The 13 Oct trace should still be on the device (it never synced); if its fixes stop and resume in blocks rather than degrading in accuracy, the same failure was present then.
