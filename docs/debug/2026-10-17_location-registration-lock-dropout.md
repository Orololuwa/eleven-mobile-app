# Bug report — Location registration drops under screen lock; unlock does not resubscribe (17 Oct 2026)

**Severity:** Critical — mid-run unsubscribe; B0 watchdog does not heal under lock or on unlock  
**Status:** Root cause identified; fixed in Amendment 02 **B0.1**  
**Device:** Vivo V2310, Android 15  
**Evidence:** [`2026-10-17_dumpsys_location`](2026-10-17_dumpsys_location), field screenshots (offline HUD; NRC continues)  
**Related:** [16 Oct dropout](2026-10-16_location-registration-dropout.md), [Amendment 02](../sys-des/M-0/0.4_4_eleven-amendment-02-fix-integrity-and-acquisition.md)

---

## 1. Summary

On a morning run with Eleven and Nike Run Club side by side, Eleven’s GMS fused→GPS registration held for ~15 minutes, then dropped at **07:33:38**. Nike’s direct GPS registration continued for ~1h17m. Eleven stayed unsubscribed for **~63 minutes**. The HUD correctly showed B0 `offline` (“Lost GPS connection — reconnecting”), but unlocking the phone did **not** automatically restore fixes.

This is the same failure class as 16 Oct, with two B0 gaps exposed under screen lock.

---

## 2. Dumpsys timeline (10-17)

| Time | Event |
|---|---|
| 07:17:32 | Eleven registers (`WorkSource{com.eleven.app}`) |
| 07:18:32 → **07:33:38** | Stable hold (~15 min) |
| **07:33:38** | Eleven `-registration`; Nike alone keeps GPS ON |
| 07:33 → 08:36 | **63 min blackout** — no Eleven re-register |
| 08:36:42 → 08:37:32 | Brief churn (four listeners), then gone |
| 07:45:34 | `location power save mode → FOREGROUND_ONLY` (**12 min after** the drop — not the cause) |

Historical aggregate: GMS fused GPS for Eleven ≈ **16m54s**; Nike GPS ≈ **1h17m**. Chip was healthy throughout.

---

## 3. Why B0 did not heal this

### 3.1 Stale feed + “task still running” skips renew (unlock no-op)

`ensureLocationRegistration` detects a stale `latestFix` and calls `startLocationTracking`. But `startLocationTrackingOnce` only called `startLocationUpdatesAsync` when `!(await isLocationTaskRunning())`.

After GMS drops the fused registration, Expo can still report the task as started. Recovery then only re-attaches `watchPositionAsync` and **never renews the fused→GPS request**. That matches the field note: screen on again, still no fixes.

### 3.2 `whenAppActive` inside `startLock` (lock blackout)

When the task was truly not running and `AppState !== 'active'`, start waited on `whenAppActive()` **while holding the start lock**. One recovery tick after dropout could freeze all further starts until unlock — consistent with a long silence then a late churn.

### 3.3 Null-session teardown still able to unsubscribe

Three consecutive null `getActiveTrackingSession()` reads could still call `stopLocationTracking`. A batched delivery during a SQLite hiccup at lock time was enough to self-unsubscribe.

---

## 4. B0.1 fixes

| Change | Behaviour |
|---|---|
| **Force renew on stale feed** | Always call `startLocationUpdatesAsync` when recovering so Expo’s `setOptions` restarts fused updates even if the task is still marked started |
| **Non-blocking recovery** | Watchdog / app-state reasons never `await whenAppActive` inside the start lock; FGS-from-background errors return and retry later |
| **No null teardown** | Stop only on explicit `ended` / `ended_at` |
| **AppState hooks** | `inactive`, `background`, and `active` all call `ensureLocationRegistration` |

---

## 5. Verify

1. Eleven + NRC; lock after ~2 km; wait 10+ minutes locked.  
2. Unlock: Metro should log `registration re-register` with `forceRenew: true` within seconds; fixes resume without ending the session.  
3. `adb shell dumpsys location` — Eleven’s fused WorkSource reappears after unlock (and ideally sooner if a non-blocking retry runs).  
4. HUD stays on `offline` during the gap, never “move into open sky”.
