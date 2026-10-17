# Bug report — Live HUD signal misclassification (17 Oct 2026, evening)

**Severity:** High — player-facing copy contradicted the GPS label and moving distance  
**Status:** Fixed in live metrics / quality-gate split (same day)  
**Device:** Vivo V2310, Android 15 (dev client over USB)  
**Evidence:** Metro `[location-task] point` logs; HUD screenshots / field notes  
**Related:** [lock dropout / B0.1](2026-10-17_location-registration-lock-dropout.md), [Amendment 01](../sys-des/M-0/0.4_3_eleven-amendment-01-tracking-accuracy.md), [Amendment 02 B0](../sys-des/M-0/0.4_4_eleven-amendment-02-fix-integrity-and-acquisition.md)

---

## 1. Summary

During evening field runs after B0.1, the location feed was often healthy (fixes every ~1 s at ±3–5 m, distance climbing) while the HUD showed the wrong signal notice:

| What the player saw | What was actually true |
|---|---|
| **Poor signal — move into open sky** | GPS label ±3.5 m; distance still increasing |
| **SIGNAL WEAK · NUMBERS ARE ESTIMATES** | Continuous ±3–5 m `watch` fixes in Metro |
| **MEASURING · EARLY NUMBERS ARE ESTIMATES** for **3+ minutes** | Cold-start settle is only **60 s**; summary floors are 2 min / 120 fixes |

Root cause: the live HUD reused **session-summary** quality classification and floors for **moment-to-moment** copy, and live distance used the **strict ≤10 m** gate even though continuity-stored fixes (≤50 m) were already on disk.

---

## 2. Observed symptoms

### 2.1 Distance moving under “poor / move into open sky”

Copy said distance pauses until signal clears. Distance kept climbing. GPS strength showed a few metres.

### 2.2 “Signal weak” on ±3–5 m fixes

Metro showed a steady stream of stored points, e.g.:

```
accuracy ≈ 3.0–4.9 m, intervalMs ≈ 924–1130, source: "watch"
```

HUD still showed `SIGNAL WEAK · NUMBERS ARE ESTIMATES` (`estimated`).

### 2.3 “Early numbers are estimates” past three minutes

`settling` is supposed to cover cold GPS lock (~30–60 s). It stayed up for 3+ minutes into an otherwise clean run.

### 2.4 Continuity-grade fixes ignored for live distance

Fixes at **11–25 m** were logged as `point` (passed continuity ≤50 m) but did not feed live distance until ≤10 m — so the HUD under-read while the phone was clearly tracking.

### 2.5 Lock / FGS (context only)

On lock, Metro showed `re-register deferred — FGS not allowed in background`. Fixes often resumed via `source: "watch"` after unlock (B0.1 path). That is a separate registration issue; this report is about **signal wording vs live metrics**.

---

## 3. Root causes

### 3.1 Live distance used the summary quality gate (≤10 m)

`computeLiveReadout` called `computeSessionMetrics` with the default `passesQualityGate` (≤10 m). Continuity (≤50 m) decides **storage**; summary quality decides **final metrics**. The HUD was wired to the summary gate, so 11–25 m stored fixes contributed nothing live.

### 3.2 Session `estimated` / `insufficient` drove the live banner

```ts
signal:
  computed.dataQuality === 'insufficient'
    ? insufficientSignal(...)
    : computed.dataQuality; // 'good' | 'estimated' passed through
```

- **`estimated`** = cumulative gap between 5% and 25% over the **whole session**. A clean ±4 m feed late in the run still showed SIGNAL WEAK if earlier gaps left the session in that band.
- **`insufficient`** is forced until **120 s active** and **120 accepted fixes** (`QUALITY_MIN_ACTIVE_SECONDS` / `QUALITY_MIN_FIXES`). While measuring under that floor, the HUD fell through to **`settling`** (“early estimates”) — so “early” lasted ~2 minutes by design, and longer when active time / fix count lagged.

### 3.3 `isMeasuringNow` ignored a fresh OS fix

Measuring-now only looked at **stored** quality-gated points. `getLatestFix()` (GPS label) updates on every OS delivery. A fresh ±3.5 m label could coexist with `poor` if the DB/bridge view briefly disagreed — and the poor copy falsely claimed distance had paused.

### 3.4 Misleading poor subcopy

`MOVE INTO OPEN SKY · DISTANCE PAUSES UNTIL IT CLEARS` was wrong whenever distance was still accumulating.

---

## 4. Fixes applied

| Change | Behaviour |
|---|---|
| **`LIVE_QUALITY_FIX_ACCURACY_M`** (= continuity, 50 m) | Live distance / measuring-now use `passesLiveQualityGate`. Summary stays on ≤10 m. |
| **`computeSessionMetrics(..., { passesQuality })`** | Live readout passes the live gate; end-of-session metrics unchanged. |
| **Fresh summary-quality `latestFix` → `good`** | Do not show SIGNAL WEAK while ±≤10 m is arriving, even if session `dataQuality` is `estimated`. |
| **`insufficient` + measuring after settle → not `settling`** | After cold-start lock-on (~60 s), measuring with a clean feed → `good` (or `estimated` only for continuity-grade 10–50 m). Summary 2 min / 120-fix floors no longer pin the HUD on “early estimates”. |
| **`isMeasuringNow` + fresh live-quality `latestFix`** | OS feed counts as measuring so poor does not fight the GPS label. |
| **Poor subcopy** | `LIVE NUMBERS MAY FREEZE` instead of claiming distance always pauses. |

Constants (tracking):

- `QUALITY_FIX_ACCURACY_M = 10` — summary only  
- `LIVE_QUALITY_FIX_ACCURACY_M = 50` — live HUD (aligned with continuity)  
- `LIVE_SIGNAL_SETTLE_SECONDS = 60` — only window for “early numbers” / locking-on  

---

## 5. Signal matrix (after fix)

| Live condition | HUD signal | Notice |
|---|---|---|
| No / stale OS feed (past settle) | `offline` | Lost GPS connection — reconnecting |
| Cold start, locking on | `settling` | MEASURING · EARLY NUMBERS ARE ESTIMATES |
| Measuring, latest fix ≤10 m | `good` | (none) |
| Measuring, latest fix 10–50 m | `estimated` | SIGNAL WEAK · NUMBERS ARE ESTIMATES |
| Measuring, large earlier gap | `recovering` | SIGNAL BACK · EARLIER GAPS · … |
| Feed alive, not measuring | `poor` | Poor signal — … LIVE NUMBERS MAY FREEZE |

---

## 6. Verify

1. Start a run outdoors; within ~60 s of ±≤10 m fixes, **no** “early numbers” banner.  
2. With steady ±3–5 m fixes, **no** SIGNAL WEAK from session-level `estimated`.  
3. 11–25 m stretches: live distance should move (stored + live gate); summary at end still prefers ≤10 m.  
4. Poor / offline only when the feed is actually bad or gone — never “move into open sky” while ±3 m and distance climbing.

---

## 7. Residual risk

Live distance at the continuity gate can still inflate vs Nike on noisy mid-accuracy stretches (Amendment 01 §5). That is accepted for HUD honesty (“we are tracking”) until smoothing (Amendment 02 follow-ons). Summary metrics remain on the 10 m gate.
