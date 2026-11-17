/* core.js — pure logic (no DOM). Works in browser (window.Core) and node (module.exports). */
(function (root) {
  'use strict';

  const TYPES = ['Machine', 'Smith Machine', 'Cable', 'Barbell', 'Other'];
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

  function inferType(name) {
    const n = String(name).toLowerCase();
    if (/\(smith/.test(n)) return 'Smith Machine';
    if (/\(cable\)|cable/.test(n)) return 'Cable';
    if (/\(machine\)|^leg press|machine/.test(n)) return 'Machine';
    if (/\(barbell\)|barbell/.test(n)) return 'Barbell';
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
  /** priority: 'P' +1 set/wk, 'N' +1 set every 2 wks, 'M' flat. Deload = ~half. */
  function plannedSets(base, prio, week, meso) {
    if (isDeload(meso, week)) return Math.max(1, Math.round(base / 2));
    const add = prio === 'P' ? week - 1 : prio === 'M' ? 0 : Math.floor((week - 1) / 2);
    return base + Math.min(add, 5);
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
  function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
  function fmtDur(ms) { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; }

  /** Strong-compatible export */
  function toStrongCSV(sessions, exById) {
    const head = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
    const rows = [head];
    for (const s of [...sessions].sort((a, b) => a.start - b.start)) {
      const dur = fmtDur((s.end || s.start) - s.start);
      for (const it of s.items) {
        const ex = exById[it.exId]; if (!ex) continue;
        let k = 0;
        for (const st of it.sets) {
          if (!st.done) continue; k++;
          rows.push([fmtDate(s.start), s.name, dur, ex.name, k, st.w || 0, st.r || 0, 0, 0, k === 1 ? (it.note || '') : '', k === 1 && it === s.items[0] ? (s.note || '') : '', Number.isFinite(st.rir) ? 10 - st.rir : ''].map(csvCell).join(','));
        }
      }
    }
    return rows.join('\n') + '\n';
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function parseDur(s) {
    s = String(s || '').trim(); if (!s) return 0;
    if (/^\d+$/.test(s)) return Number(s) * 1000;
    const h = /(\d+)\s*h/.exec(s), m = /(\d+)\s*m/.exec(s), sec = /(\d+)\s*s/.exec(s);
    return ((h ? +h[1] : 0) * 3600 + (m ? +m[1] : 0) * 60 + (sec ? +sec[1] : 0)) * 1000;
  }

  /** Import Strong CSV -> {sessions, newExercises}. exercises: existing list (matched by lowercase name). */
  function fromStrongCSV(text, exercises) {
    const rows = parseCSV(text); if (rows.length < 2) throw new Error('Empty CSV');
    const H = rows[0].map(h => h.trim().toLowerCase());
    const col = (re) => H.findIndex(h => re.test(h));
    const ci = { date: col(/^date/), wn: col(/^workout name/), dur: col(/^duration/), ex: col(/^exercise name/), so: col(/^set order/), w: col(/^weight/), r: col(/^reps/), n: col(/^notes$/), wnote: col(/^workout notes/), rpe: col(/^rpe/) };
    if (ci.date < 0 || ci.ex < 0 || ci.r < 0) throw new Error('Not a Strong CSV (need Date, Exercise Name, Reps)');
    const byName = {}; exercises.forEach(e => byName[e.name.toLowerCase()] = e);
    const created = [], sessions = {};
    for (const r of rows.slice(1)) {
      const exName = (r[ci.ex] || '').trim(); const reps = parseFloat(r[ci.r]);
      if (!exName || String(r[ci.so]).toLowerCase().includes('rest')) continue;
      let ex = byName[exName.toLowerCase()];
      if (!ex) { ex = { id: 'i' + uid(), name: exName, muscle: 'Other', type: inferType(exName), min: 8, max: 12, inc: 5 }; byName[exName.toLowerCase()] = ex; created.push(ex); }
      const key = r[ci.date] + '|' + (r[ci.wn] || '');
      const start = new Date(String(r[ci.date]).replace(' ', 'T')).getTime();
      if (!isFinite(start)) continue;
      const s = sessions[key] || (sessions[key] = { id: 'i' + uid(), mesoId: null, week: null, dayId: null, name: r[ci.wn] || 'Workout', start, end: start + (ci.dur >= 0 ? parseDur(r[ci.dur]) : 0), note: ci.wnote >= 0 ? (r[ci.wnote] || '') : '', items: [] });
      let it = s.items.find(i => i.exId === ex.id); if (!it) { it = { exId: ex.id, min: 0, max: 0, rir: null, sets: [], note: '' }; s.items.push(it); }
      const rpe = ci.rpe >= 0 ? parseFloat(r[ci.rpe]) : NaN;
      it.sets.push({ w: parseFloat(r[ci.w]) || 0, r: isFinite(reps) ? reps : 0, rir: isFinite(rpe) ? Math.max(0, 10 - rpe) : '', done: true });
      if (ci.n >= 0 && r[ci.n] && !it.note) it.note = r[ci.n];
    }
    return { sessions: Object.values(sessions), created };
  }

  const api = { TYPES, inferType, MUSCLES, TEMPLATES, uid, seedExercises, e1rm, roundTo, bump, isDeload, rirFor, plannedSets, suggest, bestE1, hardSetsByMuscle, exerciseSeries, muscleIndex, stalled, toStrongCSV, fromStrongCSV, parseCSV, fmtDate, fmtDur, WEEK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
