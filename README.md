# Lift Bible

A private, offline-first hypertrophy tracker. Installs to the iPhone home screen as a PWA, runs with no account, no server and no network, and keeps every set you log on the device.

Built as an RP-style mesocycle planner with the logging ergonomics of Strong, plus the two things neither does well: automatic double progression against a rep range you set up front, and a dashboard that reports progress by muscle group and priority.

---

## Goal

Three problems drove the build.

1. **Progression should be automatic, not remembered.** You set a rep range per exercise at the start of a mesocycle. When the last set of a lift exceeds that range, the app raises the weight next session and resets reps to the bottom of the range. No arithmetic in the gym.
2. **Volume should be planned, not accumulated.** Weekly set counts come from published volume landmarks and the priority you assign each muscle, and then stay flat for the whole block. Progression comes from load and reps, not from piling on sets.
3. **The data is yours.** Everything is local. Full CSV export for spreadsheet work, JSON backup and restore for moving devices.

Non-goals: accounts, sync, social features, a server of any kind.

---

## Structure

Five source files, no build step, no dependencies.

```
index.html              shell, all styles, app mount point
core.js                 pure logic, no DOM — unit-testable in node
app.js                  state, rendering, actions, localStorage
sw.js                   service worker, network-first with offline fallback
manifest.webmanifest    PWA metadata
icon-180/192/512.png    home screen icons
```

### `core.js`

Exports a single `Core` object (also `module.exports` under node, which is how the test suite drives it).

| Area | What's in it |
|---|---|
| Exercise library | ~67 seeded exercises with muscle, equipment type, default rep range, weight increment |
| Volume model | `VOL` landmark table, `weeklyTarget()`, per-session and frequency caps |
| Split generation | `buildSplit()`, `chunkSets()`, `generatePlan()`, `planVolume()`, `missingMuscles()` |
| Progression | `suggest()`, `bump()`, `e1rm()`, `plannedSets()`, `rirFor()`, `isDeload()` |
| Analytics | `exerciseSeries()`, `muscleIndex()`, `hardSetsByMuscle()`, `stalled()` |
| Export | `toCSV()`, `CSV_COLS` |

### `app.js`

Holds all state in one object persisted to `localStorage` under `hypertrophy.v1`.

```js
{
  settings:   { unit, trigger, dropBelow, rest },
  exercises:  [ { id, name, muscle, type, min, max, inc } ],
  mesos:      [ { id, name, start, weeks, deload, week, prio, days, ended } ],
  sessions:   [ { id, mesoId, week, dayId, name, start, end, note, items } ],
  active:     session in progress, or null,
  lastBackup: timestamp
}
```

- `mesos[].days[].items[]` is the **plan**: `{ exId, sets, min, max }`
- `sessions[].items[].sets[]` is the **log**: `{ w, r, rir, done }`
- `prio` maps muscle to `'P'` priority, `'N'` normal, `'M'` maintain

Rendering is a single `render()` that rebuilds the active tab's HTML string and preserves scroll. All interaction goes through the global `A.*` action object. No framework.

Four tabs: **Train**, **Meso**, **Progress**, **Data**.

---

## Features

### Mesocycle builder

Two entry paths:

- **Custom** — straight to the exercise builder, blank, or seeded from a template.
- **Guided** — four screens:
  1. **Days per week** (1–7)
  2. **Muscle priority** — Priority / Normal / Maintain per muscle, with the resulting weekly set count shown live
  3. **Split type** — Full Body, Upper/Lower (odd day goes to upper), or Freestyle (pick muscle groups per day; chosen groups are filtered out of that day's remaining dropdowns, and anything left untrained triggers a prompt before you continue)
  4. **Exercise selection** — the generated plan, fully editable, with a weekly-sets panel flagging any muscle the day layout has capped

Generated days bundle muscles so that priority groups come first, then normal, then maintenance. Exercises for a muscle are contiguous (Chest A, Chest B, Back A, Back B — never alternating).

### Volume model

Weekly sets per muscle, from the MEV-to-MAV landmarks popularized by Renaissance Periodization. Published ranges put chest at roughly 6–8 MEV and 12–18 MAV, back at 8–10 and 14–20, quads at 6–8 and 12–18, hamstrings/biceps/triceps at 4–6 and 10–14, calves at 6–8 and 12–16. These are population averages — tune them against your own logs.

| Priority | Weekly sets |
|---|---|
| Maintain | near the MEV floor |
| Normal | between MEV and MAV |
| Priority | top of MAV |

Each muscle also carries a **per-session cap** and a **weekly frequency cap**, so volume is distributed rather than dumped. A muscle targeting ~6 sets per session lands on fewer days than one targeting 3.

**Set counts stay flat for the entire mesocycle.** Only the deload changes them, to about half.

### Set splitting

Per muscle, per day:

| Sets that day | Movements |
|---|---|
| 1–4 | 1 |
| 5–8 | 2 |
| 9–13 | 3 |
| 14+ | 4 |

### Progression — double progression

Keyed to the **exercise**, not the mesocycle. The app finds the most recent completed session containing that lift, preferring one inside the current block and otherwise falling back to the most recent anywhere. **Progression therefore carries across workouts and across mesocycle boundaries.**

| Last set vs. range | Next session |
|---|---|
| Exceeds max | ↑ weight, reps reset to range minimum |
| Inside range | Hold weight, beat last session's reps |
| Below min | Hold, or ↓ one increment (optional setting) |
| Deload week | Hold weight, ~half the sets |

The weight jump is solved from estimated 1RM (Epley) for the weight at which the range minimum would sit at your target RIR, then clamped to at least one increment and at most one increment above +10%, and rounded to that exercise's step. Logged RIR on the triggering set feeds the estimate, so an easier set produces a slightly larger jump.

Worked example: `185×8, 8, 11` on a 6–10 range → next session `200×6, 6, 6`. Log `200×8, 8, 9` → next session holds 200 and asks for `9, 9, 10`.

### Logging

Set-by-set check-off with weight, reps and optional RIR per set. Rest timer, add/remove set, per-exercise and per-workout notes, previous performance shown inline. Screen stays awake during a session. Swapping an exercise mid-workout asks whether to apply the change to the rest of the mesocycle or just that session.

### Dashboard

- **Strength index by muscle** — estimated 1RM indexed to the first session at 100
- **Sets this week** — logged vs. target per muscle, scrubable by week
- **Muscle summary** — percentage change and stalled-lift flags
- **Per-exercise** — e1RM trend plus recent sessions

Filterable by priority tier and by current mesocycle vs. all time.

### Data

- **Export CSV** — one row per completed set, 21 columns: date, time, mesocycle, week, deload flag, workout, duration, exercise, muscle, equipment, rep min/max, set number, weight, unit, reps, RIR, estimated 1RM, volume, exercise note, workout note
- **Backup (JSON)** — complete state
- **Restore from backup** — validates the file, confirms the workout count, then replaces everything on the device
- Exercise library is editable: name, muscle, equipment type, default rep range, weight increment

Equipment types: Machine, Smith Machine, Cable, Barbell, Dumbbell, Bodyweight, Other.

---

## Deploying

Static files — any HTTPS host works.

1. Upload the files loose to the repo root (not zipped, not in a subfolder).
2. Settings → Pages → Deploy from a branch → `main` / `root`.
3. Open the Pages URL in Safari → Share → **Add to Home Screen**.
4. Launch once while online so the service worker caches it.

### Updating

`sw.js` is network-first and its cache name is bumped each release, so a fresh launch while online pulls the new build. If it looks stale, fully close the app from the app switcher and reopen. The build stamp at the bottom of the Data tab confirms which version is live.

**Before deleting the home-screen icon, export a backup.** Removing an installed PWA clears its storage, and the log lives there.

---

## Development

No toolchain. Edit the files and reload.

```bash
python3 -m http.server 8000     # service workers need http, not file://
```

`core.js` is DOM-free and runs under node, which is how the logic is tested:

```js
const C = require('./core.js');
C.suggest({min:6,max:10}, prevSets, { n:3, rir:2, trigger:'exceed', inc:5 });
```

---

## Changelog

### v5 — 2026-11-17
- Renamed **Hypertrophy → Lift Bible**
- Restore from JSON backup, with validation and confirmation
- Plain CSV export covering every logged field (21 columns), replacing the Strong-format export
- Build stamp in the Data tab

### v4
- **Bodyweight** equipment type
- Day bundling: not every muscle is trained every day; within a day, priority groups come first, then normal, then maintenance
- Set-splitting thresholds (5 / 9 / 14 sets → 2 / 3 / 4 movements)
- Freestyle: selecting a muscle group removes it from that day's remaining dropdowns
- Freestyle: prompt listing any muscle group left untrained, with proceed or go-back
- Removed Strong CSV and all import paths

### v3
- **Dumbbell** equipment type
- Removed automatic weekly set progression — double progression only
- Rep ranges default to whatever the previous mesocycle used
- Four-screen guided mesocycle wizard with Full Body, Upper/Lower and Freestyle generation
- Volume baselines derived from MEV/MAV landmarks and per-muscle recovery caps

### v2
- Exercise swap mid-workout, with the option to apply it to the rest of the mesocycle
- Exercise swap in the mesocycle builder
- Per-set RIR, replacing the mesocycle-wide starting RIR; logged RIR feeds the weight jump
- Equipment type classification: Machine, Smith Machine, Cable, Barbell, Other

### v1
- Offline PWA shell, home-screen install, service worker cache
- Mesocycle builder with templates, rep ranges set per exercise up front
- Automatic weight progression when the last set exceeds the range
- Set logging with rest timer and wake lock
- Progress dashboard by muscle group and priority
- Strong-format CSV export and import

---

## Notes and limits

- Data lives in `localStorage` on one device. There is no sync. Back up periodically; the Train tab nags after 14 days without an export.
- Volume landmarks are population averages, not prescriptions.
- Estimated 1RM uses Epley and gets unreliable above ~15 reps.
- The dashboard's strength index is relative to your first logged session for each lift, so it is a trend, not a comparison between muscles.
