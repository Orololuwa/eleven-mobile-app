# Bug report — Vivo PEM freezes Eleven under lock and removes its GPS request; HUD restarts from zero on return (20 Oct 2026)

**Severity:** Critical — mid-session unsubscribe a few minutes after lock; nothing re-subscribes until the screen comes on  
**Status:** Root cause reproduced. Wake lock, background-owned live snapshot and pre-kickoff battery prompt landed. On this phone PEM **still freezes Eleven** about 3½–4½ min after screen-off with both battery settings granted; Nike Run Club is exempt  
**Device:** Vivo V2310, Android 15  
**Evidence:** [`2026-10-20_dumpsys_location.log`](2026-10-20_dumpsys_location.log) (12:46–13:12 session), [`2026-10-20_pem_freeze_evidence.log`](2026-10-20_pem_freeze_evidence.log) (14:44–14:48 repro)  
**Related:** [19 Oct direct GPS](2026-10-19_gms-fused-dropout-direct-gps.md), [17 Oct lock dropout](2026-10-17_location-registration-lock-dropout.md)

---

## 1. Summary

The direct GPS registration from 19 Oct holds while the screen is on. With the screen locked and the phone on battery, Vivo's power engine (`com.vivo.pem`) broadcasts `vivo.powercontrol`, removes Eleven's GPS request (the direct `gps` listener and the Play Services fused one for the foreground watch), then freezes the process: `am_app_frozen [com.eleven.app, from pem_freezer]`. It does this **with the location FGS running**: AOSP still reports `curProcState=4 fg-service`, `isFrozen=false`.

A frozen process runs nothing, so the native 5 s renew cannot fire. The process thaws on screen-on (`am_app_unfrozen … screen on`), the renew re-registers within ~100 ms, and the user sees the session "come back". That is the 3–5 minute on / minutes off pattern in the 12:46–13:12 dumpsys.

There is a second, independent hole. The renew `Handler` holds no wake lock. Once the GPS listener is gone, nothing wakes the CPU, so the loop stops even on a phone that does *not* freeze apps. In the repro the renew ran every 10 s until 14:45:44, then nothing until 14:46:45.

---

## 2. Field session (12:46–13:12)

| Window | Eleven GPS registration |
|---|---|
| 12:46:04 → 12:49:37 | on (3 m 33 s), then `-registration` with the fused watch in the same 7 ms |
| 12:50:25 → 12:54:38 | on (4 m 13 s) |
| 12:58:51 → 13:00:33 | on (1 m 42 s) |
| 13:02:33 → 13:05:55 | on (3 m 22 s) |
| 13:10:35 → 13:12:21 | on, then session end |

Each `+registration` lines up with `Looper: Slow delivery took 96474ms` / `43290ms` in pid 6415 at the same millisecond. That is a thaw draining a queued message. `exit-info` shows pid 6415 **is** `com.eleven.app` and lived until 13:44 (LOW_MEMORY, after the session). The process was frozen, not killed.

---

## 3. Repro (14:38–14:56, session `8801b881`, Training · Run)

| Condition | Result |
|---|---|
| Locked, USB charging, 4 min | FGS held, never frozen, registration intact |
| Locked, `dumpsys battery unplug` | 14:46:45.528 first real GPS fix delivered → 14:46:45.660 `-registration` → 14:46:45.676 `am_app_frozen … pem_freezer` |
| Screen on 14:48:33 | `am_app_unfrozen … screen on`; native renew re-registers at 14:48:32.958 |
| Vivo "allow high background power" set by hand, locked on battery, 4 min | **Inconclusive**: indoors, no satellite fix, so PEM had nothing to cut |

PEM only acted once the GPS chip was actually delivering fixes with the screen off. That fits field drops after minutes of real running, and none during indoor tests.

After the thaw, the first fixes were poor, `last_accepted_fix_at` was 2 min old, and a `gps_loss` auto-pause opened at thaw time. Six watch callbacks were also processed concurrently (`skip … reason: 'unknown'` from the interleaved pause read).

---

## 4. Why the clock looked reset on return

- The HUD recomputed everything in the UI every second (all points → full metrics pass) and started from `initialHud` (0:00, settling) on every mount. After a freeze or kill it showed 0:00 until that pass came back.
- On Android a remount with the task not running went through `beginTrackingAfterPermission`. That overwrote `segment_clock_origin_ms` and pushed a **0:00** indicator (notification / Live Activity).
- `latestFix` lived only in JS memory, so a fresh JS context reported no feed until the next delivery.

---

## 5. Changes

| Change | Behaviour |
|---|---|
| `plugins/with-direct-gps.js` stage 2 | `PARTIAL_WAKE_LOCK` (`eleven:session-gps`) while the session task is registered, re-armed every renew tick with a 10 min timeout, released on unregister. The renew loop now runs under lock. Applies on top of already-patched trees. |
| `live_snapshots` table + `live-snapshot.ts` | The location task computes and persists the live snapshot after each delivery (1 s with the HUD up, 5 s backgrounded). It holds the clock anchors (segment start, closed pause total, open pause start), distance, top speed, signal, latest fix and labels. Lifecycle writes (pause, resume, end activity, segment switch, auto-pause) force a refresh. |
| HUD (`use-tracking-session.ts`) | Paints the persisted snapshot on mount, then ticks the clock locally from the anchors (no I/O). It recomputes only when the snapshot is older than 2.5 s (task quiet or frozen), so `offline` still shows. |
| Indicator (`indicator.ts`) | Reads the snapshot instead of re-running the metrics pass. |
| `beginTrackingAfterPermission` | No longer resets `segment_clock_origin_ms`; seeds the indicator from the real snapshot, never 0:00. |
| `last_fix_at_ms` / `last_fix_accuracy_m` | Newest OS fix persisted on the session row. Snapshot uses the newer of memory and row. |
| `processLocationUpdate` | Deliveries (task + watch) are serialised. |
| `tracking-indicator` module + `background-power.ts` | Before kickoff on Android: asks once per install for the stock battery-optimisation exemption when Android reports it missing. A Vivo high-background-power prompt was tried and removed — Eleven is not listed on that screen. |
| `app.config.js` | `WAKE_LOCK`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. |

Requires `npm run android` (or an EAS build). A Metro reload ships the JS half only.

---

## 6. Dev-build verification (same afternoon)

| Run | Result |
|---|---|
| First dev build | `startLocationUpdatesAsync` rejected: `SecurityException … WAKE_LOCK`. The generated manifest predated the `app.config.js` change (prebuild not re-run). GPS registered, renew loop never armed. Fixed by `expo prebuild` plus stage 3 of `with-direct-gps.js` (wake lock is best-effort; the renew loop arms regardless). |
| Rebuilt, locked on battery, no exemption | Wake lock held, renew ticked every 10 s under lock. PEM froze the app at **16:06:52** (3m38s after screen-off): GPS removed, 2m44s gap until screen-on. |
| Same, user set "Unrestricted" + Vivo high background power | Frozen at **16:26:53** (3m35s), 162 s gap. Eleven still absent from `deviceidle whitelist`. |
| Side by side with Nike Run Club, 7 min locked | Eleven frozen at **16:44:24**, 145 s gap. **Nike not frozen and kept its GPS** the whole lock. Nike's FGS is also type `location` only; audio is brief TTS cues. Most likely Nike is on PEM's allow-list. |

Kickoff now requests location, notifications and (Android) the battery steps **before** creating the session, so the clock does not run while dialogs or Settings are open (`prepareTrackingForKickoff`).

### 21 Oct — Doze whitelist

New install (uid 10328), `adb shell dumpsys deviceidle whitelist +com.eleven.app`, locked on battery 08:13:29 → 08:19:48 (6m19s). **No PEM freeze**, no GPS gap (longest 7 ms, the app's own renew), renew ticked 6/min throughout. Every earlier run froze at 3½–4½ min. Indoors, so no satellite fixes; still to confirm outdoors. The whitelist is per install: a reinstall drops it. Vivo's "let app always run in background" toggle reads on without putting the app on the whitelist; the high-background-power screen does not list Eleven.

## 7. Still open

1. **Does PEM honour either exemption?** Not proven. Outdoor run on battery: allow both settings, lock after distance is moving, continue past 1 km. `adb logcat -b events | grep -E "am_app_frozen.*eleven|request_location_remove.*eleven"` should stay empty, and `dumpsys location` should show Eleven on `gps` with locations still rising.
2. If PEM still freezes the app, the wake lock does not help (a frozen process cannot run). The remaining lever is the OEM allow-list. Nike Run Club stays registered on the same phone, which suggests it is on it.
3. The thaw-time `gps_loss` auto-pause stops the clock while GPS re-acquires after a freeze. That follows the existing rule, but the frozen gap itself still counts as active time with no points.
4. Indoors, the renew still churns `-registration` / `+registration` every 10 s (from 19 Oct). With the wake lock this now also runs while locked.
