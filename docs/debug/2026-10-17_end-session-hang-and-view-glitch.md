# Bug report — Hold-to-end hang + view glitch (17 Oct 2026)

**Severity:** High — UI freezes after hold-to-end; then active ↔ summary (or segment-switch) flicker  
**Status:** Fixed same day  
**Evidence:** Metro flood of `skip fix — no live session` with `nullCount` climbing past 100+ after end  
**Related:** [B0.1 lock dropout](2026-10-17_location-registration-lock-dropout.md)

---

## 1. Summary

After holding to end a session (or switching segment), the app froze for seconds, then jumped between screens. Metro kept logging null-session skips long after the session was ended.

---

## 2. Root causes

### 2.1 Orphaned location callbacks after end (session hang)

B0.1 made null `getActiveTrackingSession()` **never** tear down (avoid false dropout). After end, `ended_at` is set so the active query returns **null** — so leftover watch/task fixes only **skipped**, forever, while still waking JS every second and spamming warns.

`nextTeardownAction`’s `ended` → stop path was effectively unreachable for that query.

### 2.2 End raced navigation (view glitch)

`endSession` reloaded the session (status `ended`) into the live HUD, then navigated to summary — so the active screen re-rendered as “ended” and fought `router.replace`.

### 2.3 Segment switch blocked on compass + full recompute

`beginSegmentSwitch` awaited `getHeadingAsync` + `getCurrentPositionAsync` with no timeout while still on the tracking phase, and re-ran `readLiveReadout` (full point load) instead of using the last HUD snapshot. Hold/segment CTAs also did not set `busy`.

---

## 3. Fixes

| Change | Behaviour |
|---|---|
| **`trackingDesired`** | Cleared on stop; null session + not desired → stop (cleanup). Mid-run null + desired → skip (B0.1). |
| **Rate-limit null warns** | At most one warn / 5 s |
| **End order** | Mark `ended` → stop → notify UI → compute metrics → invalidate history + sync |
| **Navigate on stop** | `onStopped` fires before metrics so summary can mount without waiting on compute |
| **No post-end `loadSession`** | Avoid ended-status flash on the live HUD |
| **Segment switch** | Phase flips to segment-switch before compass; compass capped at 2.5 s; closed stats from HUD snapshot; busy on CTAs |

---

## 4. Verify

1. End a multi-minute outdoor session via HOLD TO END — no multi-second freeze; Metro must not flood null-session warns.  
2. Land on summary once (no bounce back to live HUD).  
3. HALF TIME / START NEW SET — switch UI appears promptly; compass timeout leaves direction blank rather than hanging.  
4. Training HOLD TO END CURRENT ACTIVITY — returns to idle without freeze.
