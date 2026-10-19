# Bug report — Play Services drops Eleven's fused GPS request; Nike's direct GPS stays (19 Oct 2026)

**Severity:** Critical — mid-run unsubscribe after ~5 minutes; B0.1 does not re-subscribe while the screen is locked  
**Status:** Fixed by registering `LocationManager.GPS_PROVIDER` from the app. Short outdoor check passed; a locked run past 1 km is still the confirmation  
**Device:** Vivo V2310, Android 15  
**Evidence:** [`2026-10-19_dumpsys_location.log`](2026-10-19_dumpsys_location.log) (morning run); afternoon `adb dumpsys location` / logcat after the direct-GPS build  
**Related:** [17 Oct lock dropout](2026-10-17_location-registration-lock-dropout.md), [16 Oct dropout](2026-10-16_location-registration-dropout.md)

---

## 1. Summary

Morning run, Eleven beside Nike Run Club. Eleven's GPS request is held by Google Play Services (fused). Nike registers with the GPS provider itself. At **06:31:03** Play Services removed Eleven's listener. Nike's direct registration kept receiving fixes until **07:01**. Eleven never re-registered. That matches signal lost around 1 km.

B0.1 only retries from JavaScript. Once the fused listener is gone and the screen is locked, nothing wakes JavaScript, so the watchdog never runs. Calling `startLocationUpdatesAsync` again is also a no-op while Expo still thinks the task is started.

---

## 2. Morning dumpsys (10-19)

| Time | Event |
|---|---|
| **06:25:54** | Eleven registers via `gms[fused_location_provider]`, `WorkSource{com.eleven.app}` |
| 06:26:04 | Nike joins; both are in the GPS WorkSource |
| **06:31:03** | Eleven `-registration`. GPS request becomes Nike-only |
| 06:31 → 07:01 | Nike keeps GPS. No later `+registration` for `com.eleven.app` |

Power save was already `NO_CHANGE` (left `FOREGROUND_ONLY` at 05:19). The chip was fine. The listener Play Services owned for Eleven was not.

---

## 3. Why B0.1 could not heal this

`expo-location`'s background task calls `FusedLocationProviderClient.requestLocationUpdates`. The dumpsys line is always `gms[fused_location_provider]` with Eleven only as the `WorkSource`. Nike's line is `gps provider +registration …/com.nike.plusgps`.

Recovery lived in a JavaScript `setInterval` (10 s, stale after 15 s). No fixes means no task wakeup, so the timer does not run under lock. Force-renew only called `startLocationUpdatesAsync` again and did not stop the task first.

The first native build also did not contain the patch. `expo-location` ships a prebuilt AAR (`local-maven-repo`), so editing `LocationTaskConsumer.kt` in `node_modules` never reached the APK. Logcat had no `direct-gps` line, and dumpsys was still fused-only.

---

## 4. Fix

| Change | Behaviour |
|---|---|
| `plugins/with-direct-gps.js` | Session task requests `LocationManager.GPS_PROVIDER` with the existing task `PendingIntent`. Broadcasts read `LocationManager.KEY_LOCATION_CHANGED`. |
| Native renew | Every **5 s**, if no fix arrived within **10 s**, request GPS again. Runs in the location task, not in JavaScript. |
| `package.json` `expo.autolinking.android.buildFromSource: ["expo-location"]` | Gradle compiles the patched source instead of the prebuilt AAR. |
| Pitch marking and the foreground `watchPositionAsync` | Still fused. iOS unchanged. |

Requires `npm run android` (or an EAS build). A Metro reload does not apply it.

---

## 5. Afternoon check (same phone, new build)

Indoors, stationary: direct registration `10325/com.eleven.app` was present and had **0** GPS locations. Logcat repeated `direct-gps renew — no fix within 10s`. The fused watch still stored points. HUD distance stayed **0.00 km** because the jitter was about a metre and the display is kilometres to two decimals.

Outdoors, phone unplugged: the same direct registration later had **127** locations over **15m17s**. From **11:16:07** to session end at **11:16:18** the GPS provider delivered a fix to `com.eleven.app` every second. Summary: **≈ 0.1 km**, **2 min** active, top speed **4.1 km/h**.

---

## 6. Still open

The outdoor session was two minutes, not a locked pocket run past 1 km. The renew also `-registration` / `+registration` churns the direct listener whenever it believes no fix has arrived. That is what we want indoors. On a long locked run it must not be the thing that drops a healthy registration.

Next check: lock after distance is moving, continue past 1 km, then `dumpsys location`. `com.eleven.app` should still be on the GPS provider at the end, with locations still increasing.
