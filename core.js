/* core.js — pure logic (no DOM). Works in browser (window.Core) and node (module.exports). */
(function (root) {
  'use strict';

  const TYPES = ['Machine', 'Smith Machine', 'Cable', 'Barbell', 'Dumbbell', 'Bodyweight', 'Other'];
  const MUSCLES = ['Chest', 'Back', 'Traps', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms',
    'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];

  // name | muscle | min-max | increment (lb)
  const SEED = `
Bench Press (Barbell)|Chest|6-10|5
Incline Bench Press (Barbell)|Chest|6-10|5
Bench Press (Dumbbell)|Chest|8-12|5
Incline Bench Press (Dumbbell)|Chest|8-12|5
Chest Press (Machine)|Chest|8-12|10
Chest Fly (Cable)|Chest|10-15|5
Chest Fly (Machine)|Chest|10-15|10
Chest Dip|Chest|8-12|5
Pull Up|Back|6-10|5
Chin Up|Back|6-10|5
Lat Pulldown (Cable)|Back|8-12|10
Bent Over Row (Barbell)|Back|6-10|5
Seated Row (Cable)|Back|8-12|10
Seated Row (Machine)|Back|8-12|10
Bent Over One Arm Row (Dumbbell)|Back|8-12|5
Chest Supported Row (Dumbbell)|Back|8-12|5
T Bar Row|Back|8-12|10
Straight Arm Pulldown (Cable)|Back|10-15|5
Deadlift (Barbell)|Back|4-8|5
Shrug (Dumbbell)|Traps|10-15|5
Shrug (Barbell)|Traps|10-15|10
Lateral Raise (Dumbbell)|Side Delts|12-20|2.5
Lateral Raise (Cable)|Side Delts|12-20|2.5
Lateral Raise (Machine)|Side Delts|12-20|5
Overhead Press (Barbell)|Side Delts|6-10|5
Shoulder Press (Dumbbell)|Side Delts|8-12|5
Shoulder Press (Machine)|Side Delts|8-12|10
Reverse Fly (Dumbbell)|Rear Delts|12-20|2.5
Reverse Fly (Cable)|Rear Delts|12-20|2.5
Reverse Fly (Machine)|Rear Delts|12-20|5
Face Pull (Cable)|Rear Delts|12-20|5
Bicep Curl (Dumbbell)|Biceps|8-12|5
Bicep Curl (Barbell)|Biceps|8-12|5
Bicep Curl (Cable)|Biceps|10-15|5
Hammer Curl (Dumbbell)|Biceps|8-12|5
Incline Bicep Curl (Dumbbell)|Biceps|10-15|2.5
Preacher Curl (Machine)|Biceps|10-15|5
Triceps Pushdown (Cable)|Triceps|10-15|5
Overhead Triceps Extension (Cable)|Triceps|10-15|5
Skullcrusher (Barbell)|Triceps|8-12|5
Triceps Extension (Dumbbell)|Triceps|10-15|5
Triceps Dip|Triceps|6-10|5
Close Grip Bench Press (Barbell)|Triceps|6-10|5
Wrist Curl (Dumbbell)|Forearms|12-20|2.5
Reverse Curl (Barbell)|Forearms|10-15|5
Squat (Barbell)|Quads|5-8|5
Squat (Smith Machine)|Quads|6-10|5
Front Squat (Barbell)|Quads|6-10|5
Hack Squat (Machine)|Quads|8-12|10
Leg Press|Quads|8-12|10
Leg Extension (Machine)|Quads|10-15|5
Bulgarian Split Squat (Dumbbell)|Quads|8-12|5
Romanian Deadlift (Barbell)|Hamstrings|6-10|5
Romanian Deadlift (Dumbbell)|Hamstrings|8-12|5
Lying Leg Curl (Machine)|Hamstrings|10-15|5
Seated Leg Curl (Machine)|Hamstrings|10-15|5
Hip Thrust (Barbell)|Glutes|8-12|10
Glute Kickback (Cable)|Glutes|10-15|5
Hip Abduction (Machine)|Glutes|12-20|10
Back Extension|Glutes|8-12|5
Standing Calf Raise (Machine)|Calves|10-15|10
Seated Calf Raise (Machine)|Calves|10-15|10
Calf Press (Machine)|Calves|10-15|10
Crunch (Cable)|Abs|10-15|5
Hanging Leg Raise|Abs|10-20|5
Crunch (Machine)|Abs|10-15|5
Ab Wheel|Abs|8-15|5`.trim().split('\n');

  const BW = ['pull up', 'chin up', 'chest dip', 'triceps dip', 'hanging leg raise', 'ab wheel', 'back extension', 'push up', 'sit up', 'bodyweight', 'nordic', 'glute bridge', 'plank', 'inverted row', 'pistol squat', 'muscle up'];
  function inferType(name) {
    const n = String(name).toLowerCase();
    if (BW.some(b => n.includes(b)) && !/\((barbell|dumbbell|cable|machine|smith)/.test(n)) return 'Bodyweight';
    if (/\(smith/.test(n)) return 'Smith Machine';
    if (/\(cable\)|cable/.test(n)) return 'Cable';
    if (/\(machine\)|^leg press|machine/.test(n)) return 'Machine';
    if (/\(barbell\)|barbell/.test(n)) return 'Barbell';
    if (/\(dumbbell\)|dumbbell/.test(n)) return 'Dumbbell';
    return 'Other';
  }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  function seedExercises() {
    return SEED.map(l => {
      const [name, muscle, rng, inc] = l.split('|'); const [min, max] = rng.split('-').map(Number);
      return { id: 'x' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24), name, muscle, type: inferType(name), min, max, inc: Number(inc) };
    });
  }

  // name lists for templates (6-day PPL built around DB/cable/machine/Smith so it is joint-friendly)
  const TEMPLATES = {
    'PPL 6-day (DB / cable / machine)': [
      ['Push A', [['Incline Bench Press (Dumbbell)', 3], ['Chest Press (Machine)', 3], ['Shoulder Press (Dumbbell)', 3], ['Lateral Raise (Cable)', 3], ['Overhead Triceps Extension (Cable)', 3], ['Triceps Pushdown (Cable)', 2]]],
      ['Pull A', [['Lat Pulldown (Cable)', 3], ['Chest Supported Row (Dumbbell)', 3], ['Reverse Fly (Cable)', 3], ['Incline Bicep Curl (Dumbbell)', 3], ['Hammer Curl (Dumbbell)', 2], ['Shrug (Dumbbell)', 2]]],
      ['Legs A', [['Squat (Smith Machine)', 3], ['Romanian Deadlift (Dumbbell)', 3], ['Leg Extension (Machine)', 3], ['Lying Leg Curl (Machine)', 3], ['Standing Calf Raise (Machine)', 4], ['Crunch (Cable)', 3]]],
      ['Push B', [['Bench Press (Dumbbell)', 3], ['Chest Fly (Cable)', 3], ['Shoulder Press (Machine)', 2], ['Lateral Raise (Dumbbell)', 4], ['Triceps Extension (Dumbbell)', 3]]],
      ['Pull B', [['Pull Up', 3], ['Seated Row (Cable)', 3], ['Straight Arm Pulldown (Cable)', 2], ['Face Pull (Cable)', 3], ['Bicep Curl (Cable)', 3], ['Preacher Curl (Machine)', 2]]],
      ['Legs B', [['Hack Squat (Machine)', 3], ['Hip Thrust (Barbell)', 3], ['Bulgarian Split Squat (Dumbbell)', 2], ['Seated Leg Curl (Machine)', 3], ['Seated Calf Raise (Machine)', 4], ['Hanging Leg Raise', 3]]],
    ],
    'Upper / Lower 4-day': [
      ['Upper A', [['Bench Press (Barbell)', 3], ['Seated Row (Cable)', 3], ['Incline Bench Press (Dumbbell)', 2], ['Lat Pulldown (Cable)', 3], ['Lateral Raise (Cable)', 3], ['Triceps Pushdown (Cable)', 3], ['Bicep Curl (Dumbbell)', 3]]],
      ['Lower A', [['Squat (Barbell)', 3], ['Romanian Deadlift (Barbell)', 3], ['Leg Extension (Machine)', 3], ['Lying Leg Curl (Machine)', 3], ['Standing Calf Raise (Machine)', 3], ['Crunch (Cable)', 3]]],
      ['Upper B', [['Overhead Press (Barbell)', 3], ['Pull Up', 3], ['Incline Bench Press (Barbell)', 3], ['Bent Over One Arm Row (Dumbbell)', 3], ['Lateral Raise (Dumbbell)', 3], ['Reverse Fly (Cable)', 3], ['Overhead Triceps Extension (Cable)', 3], ['Incline Bicep Curl (Dumbbell)', 3]]],
      ['Lower B', [['Hack Squat (Machine)', 3], ['Hip Thrust (Barbell)', 3], ['Leg Extension (Machine)', 2], ['Seated Leg Curl (Machine)', 3], ['Seated Calf Raise (Machine)', 3]]],
    ],
    'Full body 3-day': [
      ['Full A', [['Squat (Barbell)', 3], ['Bench Press (Barbell)', 3], ['Lat Pulldown (Cable)', 3], ['Lateral Raise (Cable)', 3], ['Bicep Curl (Dumbbell)', 2], ['Triceps Pushdown (Cable)', 2]]],
      ['Full B', [['Romanian Deadlift (Barbell)', 3], ['Overhead Press (Barbell)', 3], ['Seated Row (Cable)', 3], ['Leg Extension (Machine)', 3], ['Standing Calf Raise (Machine)', 3]]],
      ['Full C', [['Leg Press', 3], ['Incline Bench Press (Dumbbell)', 3], ['Pull Up', 3], ['Lying Leg Curl (Machine)', 3], ['Lateral Raise (Dumbbell)', 3], ['Crunch (Cable)', 3]]],
    ],
  };

  // ---------- math ----------
  const e1rm = (w, r) => (!(r > 0) || r > 20) ? 0 : (w > 0 ? w * (1 + r / 30) : 0);
  const roundTo = (x, inc) => inc > 0 ? Math.round(x / inc) * inc : x;
  const fix = (x) => Math.round(x * 100) / 100;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  /** Next working weight after the last set exceeded the range.
   * Solves Epley for the weight at which `min` reps would sit at `rir` reps in reserve, then
   * enforces >= +1 increment and <= +10%. */
  function bump(w, reps, min, rir, inc) {
    const step = inc > 0 ? inc : 5;
    if (!(w > 0)) return step; // bodyweight lift: start adding load
    const est = e1rm(w, reps);
    let nw = roundTo(est / (1 + (min + (rir || 0)) / 30), step);
    const cap = roundTo(w * 1.10, step);
    nw = Math.min(nw, Math.max(cap, w + step));
    return fix(Math.max(nw, w + step));
  }

  // ---------- mesocycle schedule ----------
  function isDeload(meso, week) { return !!meso.deload && week === meso.weeks; }
  function rirFor(meso, week) {
    if (isDeload(meso, week)) return 4;
    return Math.max(0, (meso.startRIR ?? 3) - (week - 1));
  }
  /** Sets are fixed for the meso (double progression only). Deload = ~half. */
  function plannedSets(base, prio, week, meso) {
    return isDeload(meso, week) ? Math.max(1, Math.round(base / 2)) : base;
  }

  // ---------- progression ----------
  /** prevSets: done sets from the last time this exercise was trained (or null).
   * item: {min,max}; ctx: {deload, rir, trigger:'exceed'|'hit', dropBelow, inc, n}
   * returns {sets:[{w,r}], mode:'new'|'up'|'hold'|'down'|'deload', from, to} */
  function suggest(item, prevSets, ctx) {
    const n = ctx.n;
    const blank = (r) => Array.from({ length: n }, () => ({ w: '', r }));
    const ps = (prevSets || []).filter(s => s.done && s.r > 0);
    if (!ps.length) return { sets: blank(item.min), mode: 'new' };
    const last = ps[ps.length - 1], w = last.w;
    const rAt = (i) => ps[Math.min(i, ps.length - 1)].r;
    if (ctx.deload) {
      return { mode: 'deload', from: w, to: w, sets: Array.from({ length: n }, (_, i) => ({ w, r: clamp(rAt(i), item.min, item.max) })) };
    }
    const exceeded = ctx.trigger === 'hit' ? last.r >= item.max : last.r > item.max;
    if (exceeded) {
      const eff = last.r + (Number.isFinite(last.rir) ? last.rir : 0); // reps in reserve count as reps you could have done
      const nw = bump(w, eff, item.min, ctx.rir == null ? 2 : ctx.rir, ctx.inc);
      return { mode: 'up', from: w, to: nw, sets: Array.from({ length: n }, () => ({ w: nw, r: item.min })) };
    }
    if (ctx.dropBelow && last.r < item.min && w > 0) {
      const nw = fix(Math.max(0, w - (ctx.inc || 5)));
      return { mode: 'down', from: w, to: nw, sets: Array.from({ length: n }, () => ({ w: nw, r: item.min })) };
    }
    return { mode: 'hold', from: w, to: w, sets: Array.from({ length: n }, (_, i) => ({ w, r: clamp(rAt(i) + 1, item.min, item.max) })) };
  }


  // ---------- volume model ----------
  /* Weekly hard sets per muscle. m = maintenance (~MEV floor), n = normal (MEV->MAV),
     p = priority (MAV). cap = most sets worth doing for it in one session.
     freq = most sessions per week that muscle recovers from. */
  const VOL = {
    'Chest': { m: 6, n: 12, p: 18, cap: 8, freq: 3 },
    'Back': { m: 8, n: 14, p: 20, cap: 9, freq: 3 },
    'Traps': { m: 4, n: 8, p: 14, cap: 6, freq: 3 },
    'Side Delts': { m: 6, n: 12, p: 18, cap: 6, freq: 4 },
    'Rear Delts': { m: 4, n: 10, p: 16, cap: 6, freq: 4 },
    'Biceps': { m: 4, n: 10, p: 14, cap: 5, freq: 3 },
    'Triceps': { m: 4, n: 10, p: 14, cap: 5, freq: 3 },
    'Forearms': { m: 2, n: 6, p: 10, cap: 4, freq: 4 },
    'Quads': { m: 6, n: 12, p: 18, cap: 7, freq: 3 },
    'Hamstrings': { m: 4, n: 10, p: 14, cap: 6, freq: 3 },
    'Glutes': { m: 4, n: 8, p: 14, cap: 6, freq: 3 },
    'Calves': { m: 6, n: 12, p: 16, cap: 5, freq: 4 },
    'Abs': { m: 4, n: 10, p: 16, cap: 6, freq: 4 },
  };
  const UPPER = ['Chest', 'Back', 'Traps', 'Side Delts', 'Rear Delts', 'Triceps', 'Biceps', 'Forearms'];
  const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];
  // order inside a session: heavy compound muscles first, then arms/calves/abs
  const DAY_ORDER = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Traps', 'Side Delts', 'Rear Delts', 'Triceps', 'Biceps', 'Forearms', 'Calves', 'Abs'];

  function weeklyTarget(muscle, prio) {
    const v = VOL[muscle]; if (!v) return prio === 'P' ? 12 : prio === 'M' ? 4 : 8;
    return prio === 'P' ? v.p : prio === 'M' ? v.m : v.n;
  }
  function pickSpread(arr, f, off) {
    f = Math.max(1, Math.min(f, arr.length));
    const step = arr.length / f, out = [];
    for (let k = 0; k < f; k++) out.push(arr[Math.round(off + k * step) % arr.length]);
    return [...new Set(out)];
  }
  /** -> {names:[], load:[{muscle:sets}]} */
  function buildSplit(days, prio, type, free) {
    const n = Math.max(1, Math.min(7, days)); let dayMuscles, names;
    if (type === 'freestyle') {
      dayMuscles = (free || []).slice(0, n).map(a => [...new Set((a || []).filter(Boolean))]);
      while (dayMuscles.length < n) dayMuscles.push([]);
      names = dayMuscles.map((a, i) => a.length ? a.slice(0, 3).join(' / ') + (a.length > 3 ? ' +' + (a.length - 3) : '') : 'Day ' + (i + 1));
    } else if (type === 'upper-lower') {
      const up = Math.ceil(n / 2); let u = up, l = n - up; const seq = [];
      while (u || l) { if (u) { seq.push('U'); u--; } if (l) { seq.push('L'); l--; } }
      dayMuscles = seq.map(s => s === 'U' ? UPPER.slice() : LOWER.slice());
      names = seq.map((s, i) => (s === 'U' ? 'Upper' : 'Lower') + ' ' + seq.slice(0, i + 1).filter(x => x === s).length);
    } else {
      dayMuscles = Array.from({ length: n }, () => [...UPPER, ...LOWER]);
      names = Array.from({ length: n }, (_, i) => 'Full Body ' + String.fromCharCode(65 + i));
    }
    const load = dayMuscles.map(() => ({}));
    const order = [...new Set(dayMuscles.flat())].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    order.forEach((mu, oi) => {
      const idxs = dayMuscles.map((a, i) => a.indexOf(mu) >= 0 ? i : -1).filter(i => i >= 0);
      const wk = weeklyTarget(mu, (prio && prio[mu]) || 'N'); if (!idxs.length || wk <= 0) return;
      const v = VOL[mu] || { cap: 6, freq: 3 };
      let f = Math.max(1, Math.ceil(wk / 6));                  // ~6 sets a session, so a muscle lands on fewer days
      f = Math.min(f, v.freq, idxs.length);                    // respect recovery + days available
      f = Math.min(idxs.length, Math.max(f, Math.ceil(wk / v.cap))); // spread out rather than exceed cap
      // stagger each muscle's days so sessions fill evenly instead of stacking on the same days
      const chosen = pickSpread(idxs, f, oi * 1.7);
      const total = Math.min(wk, v.cap * chosen.length);       // per-session cap wins over weekly target
      const base = Math.floor(total / chosen.length); let rem = total - base * chosen.length;
      chosen.forEach((di, k) => { load[di][mu] = base + (k < rem ? 1 : 0); });
    });
    // never hand back fewer days than asked for
    load.forEach((l, di) => {
      if (Object.keys(l).length) return;
      dayMuscles[di].slice().sort((a, b) => weeklyTarget(b, (prio && prio[b]) || 'N') - weeklyTarget(a, (prio && prio[a]) || 'N'))
        .slice(0, 3).forEach(mu => { l[mu] = 3; });
    });
    return { names, load };
  }
  /** split a muscle's session sets into 2-4 set exercises */
  function chunkSets(total, maxEx) {
    if (total <= 0) return [];
    let n = total >= 14 ? 4 : total >= 9 ? 3 : total >= 5 ? 2 : 1;
    n = Math.min(n, Math.max(1, maxEx), total);
    const base = Math.floor(total / n), rem = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
  }
  /** Build full day plans. exercises in library order (compound first per muscle).
   * prefer: Set of exIds used last meso. ranges: {exId:{min,max}} from last meso. */
  function generatePlan(o) {
    const { names, load } = buildSplit(o.days, o.prio, o.type, o.free);
    const byMuscle = {};
    for (const e of o.exercises) (byMuscle[e.muscle] || (byMuscle[e.muscle] = [])).push(e);
    for (const mu in byMuscle) byMuscle[mu].sort((a, b) => (o.prefer && o.prefer.has(b.id) ? 1 : 0) - (o.prefer && o.prefer.has(a.id) ? 1 : 0));
    const ptr = {}, TIER = { P: 0, N: 1, M: 2 };
    const tier = mu => TIER[(o.prio && o.prio[mu]) || 'N'];
    return load.map((l, di) => ({
      id: uid(), name: names[di],
      items: Object.keys(l).sort((a, b) => tier(a) - tier(b) || DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).flatMap(mu => {
        const cands = byMuscle[mu] || []; if (!cands.length) return [];
        const chunks = chunkSets(l[mu], cands.length), p = ptr[mu] || 0;
        ptr[mu] = (p + chunks.length) % cands.length;
        return chunks.map((sets, k) => {
          const ex = cands[(p + k) % cands.length], rg = (o.ranges && o.ranges[ex.id]) || ex;
          return { exId: ex.id, sets, min: rg.min, max: rg.max };
        });
      })
    })).filter(d => d.items.length);
  }
  /** muscle groups not picked on any freestyle day */
  function missingMuscles(free) {
    const picked = new Set((free || []).flat().filter(Boolean));
    return DAY_ORDER.filter(m => !picked.has(m));
  }
  /** weekly sets per muscle implied by a set of days */
  function planVolume(days, exById) {
    const out = {};
    for (const d of days) for (const it of d.items) {
      const mu = exById[it.exId] && exById[it.exId].muscle; if (mu) out[mu] = (out[mu] || 0) + (+it.sets || 0);
    }
    return out;
  }

  // ---------- analytics ----------
  const bestE1 = (sets) => Math.max(0, ...sets.filter(s => s.done).map(s => e1rm(s.w, s.r)));

  function hardSetsByMuscle(sessions, exById, filter) {
    const out = {};
    for (const s of sessions) {
      if (filter && !filter(s)) continue;
      for (const it of s.items) {
        const m = exById[it.exId] && exById[it.exId].muscle; if (!m) continue;
        const c = it.sets.filter(x => x.done).length;
        out[m] = (out[m] || 0) + c;
      }
    }
    return out;
  }

  /** per exercise: [{t, e1}] best e1RM per session, chronological */
  function exerciseSeries(sessions, exId) {
    return sessions.filter(s => s.items.some(i => i.exId === exId))
      .sort((a, b) => a.start - b.start)
      .map(s => ({ t: s.start, e1: Math.max(0, ...s.items.filter(i => i.exId === exId).map(i => bestE1(i.sets))), week: s.week }))
      .filter(p => p.e1 > 0);
  }

  const WEEK = 7 * 864e5;
  /** Muscle-group strength index: mean over exercises of (weekly best e1RM / first-seen e1RM) * 100. */
  function muscleIndex(sessions, exercises, muscle, t0) {
    const exs = exercises.filter(e => e.muscle === muscle);
    const per = exs.map(e => exerciseSeries(sessions, e.id)).filter(a => a.length);
    if (!per.length) return [];
    const tEnd = Math.max(...per.map(a => a[a.length - 1].t));
    const nb = Math.floor((tEnd - t0) / WEEK) + 1;
    const bins = [];
    for (let b = 0; b < nb; b++) {
      const vals = [];
      for (const a of per) {
        const base = a[0].e1;
        const inBin = a.filter(p => Math.floor((p.t - t0) / WEEK) === b);
        const upto = a.filter(p => Math.floor((p.t - t0) / WEEK) <= b);
        if (!upto.length) continue;
        const v = inBin.length ? Math.max(...inBin.map(p => p.e1)) : upto[upto.length - 1].e1;
        vals.push(v / base * 100);
      }
      if (vals.length) bins.push({ x: b, y: vals.reduce((p, c) => p + c, 0) / vals.length });
    }
    return bins;
  }

  /** true if the last 3 sessions of the exercise show no e1RM gain over the best of the earlier ones */
  function stalled(series) {
    if (series.length < 4) return false;
    const recent = series.slice(-3), prior = series.slice(0, -3);
    return Math.max(...recent.map(p => p.e1)) <= Math.max(...prior.map(p => p.e1)) * 1.0;
  }

  // ---------- CSV ----------
  function csvCell(v) { v = String(v ?? ''); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  const pad = (n) => String(n).padStart(2, '0');
  function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fmtTime(t) { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function fmtDur(ms) { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; }

  const CSV_COLS = ['Date', 'Time', 'Mesocycle', 'Week', 'Deload', 'Workout', 'Duration (min)', 'Exercise', 'Muscle',
    'Equipment', 'Rep Min', 'Rep Max', 'Set', 'Weight', 'Unit', 'Reps', 'RIR', 'Est 1RM', 'Volume', 'Exercise Note', 'Workout Note'];

  /** Every logged field, one row per completed set. */
  function toCSV(sessions, exById, mesoById, unit) {
    const rows = [CSV_COLS.join(',')];
    for (const s of [...sessions].sort((a, b) => a.start - b.start)) {
      const meso = (mesoById && mesoById[s.mesoId]) || null;
      const dl = meso && s.week ? isDeload(meso, s.week) : false;
      const mins = Math.max(0, Math.round(((s.end || s.start) - s.start) / 60000));
      for (const it of s.items) {
        const ex = exById[it.exId]; if (!ex) continue;
        let k = 0;
        for (const st of it.sets) {
          if (!st.done) continue; k++;
          rows.push([fmtDate(s.start), fmtTime(s.start), meso ? meso.name : '', s.week || '', dl ? 'yes' : '',
            s.name, mins, ex.name, ex.muscle, ex.type || '', it.min || '', it.max || '', k,
            st.w || 0, unit || 'lb', st.r || 0, Number.isFinite(st.rir) ? st.rir : '',
            Math.round(e1rm(st.w, st.r)) || '', Math.round((st.w || 0) * (st.r || 0)),
            k === 1 ? (it.note || '') : '', k === 1 && it === s.items[0] ? (s.note || '') : ''].map(csvCell).join(','));
        }
      }
    }
    return rows.join('\n') + '\n';
  }

  const api = { TYPES, inferType, MUSCLES, VOL, UPPER, LOWER, DAY_ORDER, weeklyTarget, buildSplit, chunkSets, generatePlan, planVolume, missingMuscles, TEMPLATES, uid, seedExercises, e1rm, roundTo, bump, isDeload, rirFor, plannedSets, suggest, bestE1, hardSetsByMuscle, exerciseSeries, muscleIndex, stalled, toCSV, CSV_COLS, fmtDate, fmtDur, WEEK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
