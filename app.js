/* app.js — UI. State lives in localStorage under KEY. */
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'hypertrophy.v1';
  const BUILD = 'v8 · 2026-11-22';
  // First-run tutorial. Bump to re-show it to everyone after a major feature (and update tourSteps).
  const TUTORIAL_V = 1;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fw = (x) => (x === '' || x == null) ? '' : String(Math.round(x * 100) / 100);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? '' : n; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const PALETTE = ['#9d86d1', '#c48cb3', '#7c9bc4', '#6bbf9b', '#d9b464', '#9e9db0', '#d97a82', '#6bb0b8', '#b8a8e0', '#b59d8a'];

  const ICONS = {
    train: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
    meso: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2.5v3M16 2.5v3M3 9.5h18M8 14h3M13 14h3M8 17.5h5"/></svg>',
    prog: '<svg viewBox="0 0 24 24"><path d="M4 19h16M5 15l4.5-4.5 3.5 3 6-7"/><path d="M15.5 6.5H19V10"/></svg>',
    data: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6"/><path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l4 4-4 4"/><path d="M20 7H8"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h12"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
    fire: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3 2-4.9 3.5-6.5.3 1.6 1.2 2.6 2.3 3C10.4 8 12 5 15 3c-.4 2.6.6 4.4 2 6 1.2 1.4 2 3 2 5.3C19 18.2 15.9 21 12 21z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  };
  const brandBar = (right) => `<div class="topbar"><span class="brand"><i class="brand-dot"></i><span>open<b>GAINS</b></span></span>${right || ''}</div>`;

  // ---------- state ----------
  function fresh() {
    return { v: 1, settings: { unit: 'lb', trigger: 'exceed', dropBelow: false, rest: 120, warm: 'std' }, exercises: C.seedExercises(), mesos: [], activeMesoId: null, sessions: [], active: null, lastBackup: null,
      bw: [], // bodyweight log [{t, w}] in settings.unit
      seedV: C.SEED_V, tutorialSeen: 0 };
  }
  /** Normalize any stored or restored state to the current schema. */
  function migrate(j) {
    const m = Object.assign(fresh(), j);
    m.settings = Object.assign(fresh().settings, j.settings || {});
    m.bw = Array.isArray(j.bw) ? j.bw : [];
    (m.exercises || []).forEach(e => { if (!e.type) e.type = C.inferType(e.name); if (!e.load) e.load = C.inferLoad(e.name, e.type); });
    // library additions from later builds, merged once so deleting one later sticks
    const have = new Set(m.exercises.map(e => e.name)), seeds = C.seedExercises();
    for (let v = (j.seedV || 1) + 1; v <= C.SEED_V; v++) (C.SEED_ADDED[v] || []).forEach(n => { const e = seeds.find(x => x.name === n); if (e && !have.has(n)) m.exercises.push(e); });
    m.seedV = C.SEED_V;
    // existing users upgrading (or restoring a pre-tutorial backup) with real data skip the first-run tour
    if (j.tutorialSeen == null) m.tutorialSeen = ((j.sessions || []).length || (j.mesos || []).length) ? TUTORIAL_V : 0;
    return m;
  }
  function load() {
    try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v) return migrate(j); } catch (e) { }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage full or blocked'); } }
  const ui = { tab: 'train', wiz: null, draft: null, modal: null, scope: 'meso', pf: 'all', pw: null, exSel: '', openSess: null, histAll: false, tipHidden: false };
  let EX = {}; function reindex() { EX = Object.fromEntries(S.exercises.map(e => [e.id, e])); } reindex();
  const activeMeso = () => S.mesos.find(m => m.id === S.activeMesoId && !m.ended) || null;
  const prioOf = (m, muscle) => (m && m.prio && m.prio[muscle]) || 'N';
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }

  // ---------- helpers ----------
  const newest = () => [...S.sessions].sort((a, b) => b.start - a.start);
  const hasDone = (i) => i.sets.some(x => x.done);
  /** Last time this movement was done in THIS workout (same meso + same day slot). Drives up/hold/down. */
  function sameDayPrev(exId, mesoId, dayId, pid) {
    for (const s of newest()) {
      if (s.mesoId !== mesoId || s.dayId !== dayId) continue;
      const it = (pid && s.items.find(i => i.exId === exId && i.pid === pid && hasDone(i))) || s.items.find(i => i.exId === exId && hasDone(i));
      if (it) return { it, s };
    }
    return null;
  }
  /** Most recent instance of the movement anywhere (for the "Last:" line when this workout has none). */
  function lastAny(exId) {
    for (const s of newest()) { const it = s.items.find(i => i.exId === exId && hasDone(i)); if (it) return { it, s }; }
    return null;
  }
  /** Newest-first, one entry per session the movement appears in, any workout / any meso. */
  function instances(exId, max) {
    const out = [];
    for (const s of newest()) {
      const sets = s.items.filter(i => i.exId === exId).flatMap(i => i.sets.filter(x => x.done));
      if (sets.length) out.push({ sets, s }); if (out.length >= max) break;
    }
    return out;
  }
  /** Bodyweight in effect at time t: latest entry on/before t, else the earliest entry, else 0. */
  function bwAt(t) {
    const l = S.bw; if (!l.length) return 0;
    let best = null; for (const e of l) if (e.t <= t && (!best || e.t > best.t)) best = e;
    return (best || l.reduce((a, b) => (b.t < a.t ? b : a))).w;
  }
  const curBW = () => bwAt(Date.now());
  const loadOf = (ex) => (ex && ex.load) || 'ext';
  const TLBL = { W: 'W', D: 'D', M: 'M', F: 'F' };
  const setStr = (sets) => sets.filter(x => x.done && x.t !== 'W').map(x => (x.t ? x.t + ' ' : '') + fw(x.w) + '×' + x.r + (Number.isFinite(x.rir) ? ' (' + x.rir + ')' : '')).join(', ');
  const restOf = (ex) => (ex && Number.isFinite(ex.rest)) ? ex.rest : S.settings.rest;
  const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  function lastMeso() { return [...S.mesos].sort((x, y) => y.start - x.start)[0] || null; }
  function lastRanges() {
    const out = {}; const m = lastMeso(); if (!m) return out;
    m.days.forEach(d => d.items.forEach(it => { out[it.exId] = { min: it.min, max: it.max }; }));
    return out;
  }
  function buildItem(m, week, exId, tmpl, dayId) {
    const ex = EX[exId], n = C.plannedSets(tmpl.sets, prioOf(m, ex.muscle), week, m);
    const L = loadOf(ex), bw = curBW();
    const prev = sameDayPrev(exId, m.id, dayId, tmpl.pid);
    // recommendation runs on load actually moved (bodyweight at the time of each session), then converts back
    const hist = instances(exId, 50).map(x => ({ sets: x.sets.map(st => Object.assign({}, st, { w: C.effW(st.w, L, bwAt(x.s.start)) })) }));
    let rec = (L === 'ext' || bw > 0) ? C.recommend(hist, { min: tmpl.min, max: tmpl.max }, { rir: 2, inc: ex.inc }) : null;
    if (rec && L !== 'ext') rec = Object.assign({}, rec, { w: C.fromEff(rec.w, L, bw, ex.inc) });
    const sg = C.suggest({ min: tmpl.min, max: tmpl.max }, prev && prev.it.sets, { n, rir: 2, deload: C.isDeload(m, week), trigger: S.settings.trigger, dropBelow: S.settings.dropBelow, inc: ex.inc, rec, load: L, bw });
    const other = prev ? null : lastAny(exId);
    // carry set types forward by position (e.g. last set as a drop set); drop/myo sets keep last week's numbers
    const pw = prev ? prev.it.sets.filter(x => x.done && x.t !== 'W') : [];
    return { exId, pid: tmpl.pid || null, min: tmpl.min, max: tmpl.max, mode: sg.mode, from: sg.from, to: sg.to, base: tmpl.sets, note: '',
      rec: rec ? { w: rec.w, reps: rec.reps, n: rec.n } : null,
      prev: prev ? setStr(prev.it.sets) : other ? setStr(other.it.sets) : '',
      prevFrom: !prev && other ? other.s.name : '',
      sets: sg.sets.map((st, j) => {
        const t = (pw[j] && pw[j].t) || '', keep = (t === 'D' || t === 'M') && sg.mode !== 'deload';
        return { w: keep ? pw[j].w : st.w, r: keep ? pw[j].r : st.r, rir: '', done: false, t };
      }) };
  }
  /** Give each plan slot a stable id so a session item can find its slot even after swaps/reorders. */
  function ensurePids(m) { let ch = false; m.days.forEach(d => d.items.forEach(it => { if (!it.pid) { it.pid = C.uid(); ch = true; } })); return ch; }
  function shareOrDownload(name, text, mime) {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => { });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    }
    S.lastBackup = Date.now(); save();
  }
  const dstr = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const tstr = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // ---------- rest timer / wake lock ----------
  let timerEnd = 0, timerIv = null, wake = null;
  function startTimer(sec) { document.body.classList.add('has-timer'); timerBeeped = false; timerEnd = Date.now() + sec * 1000; clearInterval(timerIv); timerIv = setInterval(tickTimer, 250); tickTimer(); }
  function stopTimer() { clearInterval(timerIv); timerEnd = 0; $('#timer').innerHTML = ''; document.body.classList.remove('has-timer'); }
  function tickTimer() {
    const left = Math.ceil((timerEnd - Date.now()) / 1000), el = $('#timer');
    if (!timerEnd) return;
    const mm = Math.floor(Math.abs(left) / 60), ss = String(Math.abs(left) % 60).padStart(2, '0');
    el.innerHTML = `<div class="timer ${left <= 0 ? 'zero' : ''}"><span class="mut xs" style="text-transform:uppercase;letter-spacing:.08em">Rest</span><b>${left < 0 ? '+' : ''}${mm}:${ss}</b><span class="sp"></span><button class="sm" onclick="A.tAdd(30)">+30s</button><button class="sm ghost" onclick="A.tStop()">✕</button></div>`;
    if (left <= 0 && !timerBeeped) { timerBeeped = true; beep(); }
    if (left < -60) stopTimer();
  }
  // short chime when rest is up (only audible while the app is open; iOS web apps can't vibrate)
  let actx = null, timerBeeped = false;
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach(dt => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, actx.currentTime + dt); g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dt + 0.15); o.connect(g).connect(actx.destination); o.start(actx.currentTime + dt); o.stop(actx.currentTime + dt + 0.16); });
    } catch (e) { }
  }
  async function lock() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active) lock(); });

  // ---------- charts ----------
  let chartSeq = 0;
  function lineChart(series, o) {
    o = o || {}; const W = 340, H = 192, L = 36, R = 10, T = 10, B = 24;
    const pts = series.flatMap(s => s.pts); if (!pts.length) return '<div class="mut sm" style="padding:24px 0;text-align:center">No data yet</div>';
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    if (x1 === x0) { x0 -= 0.5; x1 += 0.5; } const pad = Math.max((y1 - y0) * 0.14, y1 * 0.01 || 1); y0 -= pad; y1 += pad;
    const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    const gid = 'og_g_' + (++chartSeq);
    let defs = '';
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = y0 + (y1 - y0) * i / 4, y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#262531" stroke-width="1" ${i ? 'stroke-dasharray="3 3"' : ''}/><text x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${(o.yFmt || (v => Math.round(v)))(v)}</text>`;
    }
    const xs = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b); const step = Math.ceil(xs.length / 6);
    xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) g += `<text x="${X(x).toFixed(1)}" y="${H - 6}" text-anchor="middle">${o.xLab ? o.xLab(x) : x}</text>`; });
    series.forEach((s, si) => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      if (series.length === 1 && s.pts.length > 1) {
        defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".26"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
        const first = s.pts[0], last = s.pts[s.pts.length - 1], baseY = (H - B).toFixed(1);
        g += `<path d="${d} L${X(last.x).toFixed(1)} ${baseY} L${X(first.x).toFixed(1)} ${baseY} Z" fill="url(#${gid})"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
        + s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${s.color}" stroke="#18181d" stroke-width="1.5"/>`).join('');
    });
    const leg = series.length > 1 ? `<div class="chips" style="margin-top:8px">${series.map(s => `<span class="chip"><i style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${s.color};margin-right:5px"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${defs}${g}</svg>${leg}`;
  }

  // ---------- views ----------
  function viewTrain() {
    if (S.active) return viewSession();
    const m = activeMeso();
    let h = brandBar() + '<h1>Train</h1>';
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !ui.tipHidden) h += `<div class="card notice sm row"><div class="sp"><b>Install openGAINS:</b> tap Share → <b>Add to Home Screen</b> for full-screen offline use.</div><button class="sm ghost" onclick="ui_hideTip()">✕</button></div>`;
    const old = !S.lastBackup || Date.now() - S.lastBackup > 14 * 864e5;
    if (S.sessions.length >= 3 && old) h += `<div class="card notice sm row"><span class="sp">No backup in 14+ days.</span><a href="#" onclick="A.go('data');return false">Export now →</a></div>`;
    if (!m) return h + `<div class="card hero"><p style="margin-bottom:14px">No active mesocycle yet. Build a guided or custom training block to start logging.</p><div class="g2"><button class="pri" onclick="A.newMeso()">Create mesocycle</button><button onclick="A.go('data')">Restore backup</button></div></div>`;
    const dl = C.isDeload(m, m.week);
    const wkSessions = S.sessions.filter(s => s.mesoId === m.id && s.week === m.week);
    const doneDays = new Set(wkSessions.map(s => s.dayId));
    const pct = Math.round(doneDays.size / m.days.length * 100);
    h += `<div class="card hero"><div class="row"><div class="sp"><div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Active block</div><b style="font-size:17px">${esc(m.name)}</b></div><span class="chip ${dl ? '' : 'sel'} num">${dl ? 'Deload' : 'Week ' + m.week + ' / ' + m.weeks}</span></div>
      <div class="prog" style="margin:13px 0 9px"><i style="width:${pct}%"></i></div>
      <div class="row xs mut num"><span class="sp">${doneDays.size} of ${m.days.length} sessions completed${dl ? ' · deload (~half volume)' : ''}</span><span>${pct}%</span></div></div>`;
    h += bwCard();
    h += '<h2>Sessions</h2>';
    m.days.forEach(d => {
      const done = doneDays.has(d.id), sets = d.items.reduce((a, it) => a + C.plannedSets(it.sets, prioOf(m, EX[it.exId] && EX[it.exId].muscle), m.week, m), 0);
      h += `<div class="card row"><div class="sp"><b style="font-size:15px">${esc(d.name)}</b><div class="mut xs num" style="margin-top:3px">${d.items.length} exercises · ${sets} sets</div></div>${done ? '<span class="chip ok-chip">✓ Done</span>' : ''}<button class="${done ? 'sm' : 'pri sm'}" onclick="A.start('${d.id}')">${done ? 'Redo' : 'Start'}</button></div>`;
    });
    if (doneDays.size >= m.days.length) h += m.week < m.weeks ? `<button class="pri" style="width:100%;margin-top:6px" onclick="A.nextWeek()">Advance to Week ${m.week + 1} →</button>` : `<button class="pri" style="width:100%;margin-top:6px" onclick="A.endMeso()">Complete &amp; archive mesocycle</button>`;
    else if (m.week < m.weeks) h += `<button class="ghost" style="width:100%;margin-top:4px" onclick="A.nextWeek()">Skip to Week ${m.week + 1}</button>`;
    return h;
  }

  function bwCard() {
    const last = S.bw[S.bw.length - 1], today = last && C.fmtDate(last.t) === C.fmtDate(Date.now());
    return `<div class="card row" style="padding:11px 14px"><div class="sp"><div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em">Bodyweight</div>${last ? `<b class="num">${fw(last.w)} ${S.settings.unit}</b> <span class="xs dim">${today ? 'today' : dstr(last.t)}</span>` : '<span class="sm mut">Not logged</span>'}</div>
      <input id="bw_in" type="number" inputmode="decimal" step="any" placeholder="${S.settings.unit}" style="width:84px;min-height:38px;padding:6px 8px"><button class="sm" onclick="A.logBW('bw_in')">${today ? 'Update' : 'Log'}</button></div>`;
  }

  function viewSession() {
    const a = S.active, m = S.mesos.find(x => x.id === a.mesoId);
    const dl = m && C.isDeload(m, a.week);
    const cnt = (f) => a.items.reduce((c, it) => c + it.sets.filter(st => st.t !== 'W' && f(st)).length, 0);
    const doneSets = cnt(st => st.done), totalSets = cnt(() => true);
    let h = brandBar(`<button class="sm ghost bad" onclick="A.discard()">Discard</button>`)
      + `<div class="row" style="margin-bottom:4px"><h1 class="sp" style="margin-bottom:0">${esc(a.name)}</h1><span class="chip sel num">${doneSets}/${totalSets} sets</span></div>`
      + `<div class="mut xs num" style="margin:0 2px 14px">Week ${a.week}${dl ? ' · Deload' : ''} · Started ${tstr(a.start)}</div>`;
    // feedback goes on the last card for each muscle in this workout
    const lastRun = {}; a.items.forEach((it, i) => { const ex = EX[it.exId]; if (ex) lastRun[ex.muscle] = i; });
    // consecutive movements for the same muscle share one card; each keeps its own controls
    let curMu = null, lastI = -1;
    const close = () => { if (curMu === null) return; if (lastRun[curMu] === lastI) h += feedbackHTML(curMu); h += '</div>'; curMu = null; };
    const bw = curBW();
    a.items.forEach((it, i) => {
      const ex = EX[it.exId]; if (!ex) return;
      if (ex.muscle !== curMu) { close(); curMu = ex.muscle; h += `<div class="card grp"><span class="grp-lbl">${esc(ex.muscle)}</span>`; }
      else h += '<div class="mv-sep"></div>';
      lastI = i;
      const L = loadOf(ex), asst = L === 'assist';
      const ar = (from, to) => asst ? `Assist ${fw(from)} → ${fw(to)}` : `${fw(from)} → ${fw(to)}`;
      const badge = { new: '<span class="badge hd">New — enter weight</span>', rec: `<span class="badge rc num">2 RIR rec · ${asst ? 'assist ' : L === 'bw' ? '+' : ''}${fw(it.to)} × ${it.rec ? it.rec.reps : it.min}</span>`, up: `<span class="badge up num">↑ ${ar(it.from, it.to)} · range exceeded</span>`, hold: '<span class="badge hd">Beat last week</span>', down: `<span class="badge dn num">↓ ${ar(it.from, it.to)}</span>`, deload: '<span class="badge dl">Deload</span>' }[it.mode] || '';
      const recLine = it.rec && it.mode !== 'rec' ? `<span class="xs mut num">2 RIR rec: ${asst ? 'assist ' : L === 'bw' ? '+' : ''}${fw(it.rec.w)} × ${it.rec.reps}</span>` : '';
      const recSrc = it.rec ? `<span class="xs dim num">from last ${it.rec.n} session${it.rec.n === 1 ? '' : 's'}</span>` : '';
      const chips = `<span class="chip">${esc(ex.type || 'Other')}</span><span class="chip num">${it.min}–${it.max} reps</span>`
        + (L !== 'ext' && bw > 0 ? `<span class="chip num">BW ${fw(bw)}</span>` : '')
        + (Number.isFinite(ex.rest) ? `<span class="chip num">Rest ${mmss(ex.rest)}</span>` : '');
      h += `<div class="mv"><div class="row" style="align-items:flex-start"><div class="sp"><b style="font-size:15px">${esc(ex.name)}</b><div class="chips" style="margin-top:5px">${chips}</div></div><button class="ico ghost" title="Swap exercise" onclick="A.swap(${i})">${ICONS.swap}</button><button class="ico ghost" title="More" aria-label="More options" onclick="A.more(${i})">${ICONS.more}</button></div>
        <div class="row sm mut" style="margin:8px 0 2px;flex-wrap:wrap;gap:6px">${badge}${recLine}${recSrc}</div>
        ${L !== 'ext' && !(bw > 0) ? `<div class="card notice xs" style="margin:8px 0;padding:9px 11px"><div class="row" style="gap:6px"><span class="sp">Log bodyweight to track 1RM and get recommendations on ${asst ? 'assisted' : 'bodyweight'} lifts.</span><input id="bw_s_${i}" type="number" inputmode="decimal" step="any" placeholder="${S.settings.unit}" style="width:74px;min-height:34px;padding:4px 8px"><button class="sm" onclick="A.logBW('bw_s_${i}')">Save</button></div></div>` : ''}
        ${it.prev ? `<div class="xs dim num" style="margin:4px 0 8px">Last${it.prevFrom ? ' (' + esc(it.prevFrom) + ')' : ''}: ${esc(it.prev)}</div>` : '<div style="height:6px"></div>'}
        <div class="lbl"><span>Set</span><span>${asst ? 'Assist' : L === 'bw' ? '+' + S.settings.unit : S.settings.unit}</span><span>Reps</span><span>RIR</span><span>Done</span></div>`;
      let wn = 0;
      it.sets.forEach((st, j) => {
        const lab = st.t ? TLBL[st.t] : String(++wn);
        h += `<div class="setrow ${st.done ? 'done' : ''} ${st.t ? 't-' + st.t : ''}"><button class="n" title="Set type" onclick="A.stAsk(${i},${j})">${lab}</button>
          <input id="w_${i}_${j}" type="number" inputmode="decimal" step="any" value="${fw(st.w)}" placeholder="0" oninput="A.sv(${i},${j},'w',this.value)">
          <input id="r_${i}_${j}" type="number" inputmode="numeric" value="${st.r === '' ? '' : st.r}" oninput="A.sv(${i},${j},'r',this.value)">
          <input id="i_${i}_${j}" type="number" inputmode="numeric" min="0" max="10" value="${st.rir === '' || st.rir == null ? '' : st.rir}" placeholder="${st.t === 'W' ? '' : '–'}" oninput="A.sv(${i},${j},'rir',this.value)">
          <button class="chk" onclick="A.chk(${i},${j})">${st.done ? '✓' : '○'}</button></div>`;
      });
      h += `<div class="row" style="margin-top:10px;gap:6px"><button class="sm" onclick="A.addSet(${i})">+ Set</button><button class="sm ghost" onclick="A.rmSet(${i})">− Set</button><input style="min-height:34px;padding:6px 10px;font-size:13px" placeholder="Exercise note…" value="${esc(it.note)}" oninput="A.note(${i},this.value)"></div></div>`;
    });
    close();
    h += `<textarea rows="2" placeholder="Workout notes…" oninput="A.wnote(this.value)">${esc(a.note || '')}</textarea><div style="height:12px"></div><button class="pri" style="width:100%" onclick="A.finish()">Finish workout</button>`;
    return h;
  }

  /** Plan items for one muscle in today's workout (what feedback adjusts). */
  function fbTargets(mu) {
    const a = S.active, m = S.mesos.find(x => x.id === a.mesoId), day = m && m.days.find(d => d.id === a.dayId);
    return { m, day, items: day ? day.items.filter(it => EX[it.exId] && EX[it.exId].muscle === mu) : [] };
  }
  /** Preview of what the answers do next week: {delta, changes:[{name, from, to}], capped} */
  function fbPreview(mu) {
    const a = S.active, f = (a.fb || {})[mu], { m, items } = fbTargets(mu);
    if (!m || !C.fbComplete(f)) return null;
    const delta = C.volumeDelta(f, prioOf(m, mu)), copy = items.map(it => ({ sets: it.sets }));
    const ch = C.distributeSets(copy, delta, (C.VOL[mu] || {}).cap);
    return { delta, changes: ch.map(c => ({ name: EX[items[c.i].exId].name, from: c.from, to: c.to })), capped: delta > 0 && !ch.length };
  }
  function feedbackHTML(mu) {
    const a = S.active, m = S.mesos.find(x => x.id === a.mesoId);
    if (!m || C.isDeload(m, a.week) || !fbTargets(mu).items.length) return '';
    const f = (a.fb || {})[mu];
    if (f && f.skip) return `<div class="fb fb-min"><span class="xs dim sp">Feedback skipped</span><button class="sm ghost" onclick="A.fbSkip('${esc(mu)}',false)">Rate ${esc(mu)}</button></div>`;
    // appears once every working set for this muscle is checked off
    const sets = a.items.filter(it => EX[it.exId] && EX[it.exId].muscle === mu).flatMap(it => it.sets.filter(st => st.t !== 'W'));
    if (!f && !(sets.length && sets.every(st => st.done))) return '';
    const cur = f || {};
    let h = `<div class="fb"><div class="row" style="margin-bottom:4px"><b class="sm sp">How did ${esc(mu)} feel?</b><button class="sm ghost" onclick="A.fbSkip('${esc(mu)}',true)">Skip</button></div>`;
    Object.entries(C.FB_Q).forEach(([k, q]) => {
      h += `<div class="fb-q"><div class="xs mut">${q.label}</div><div class="fb-opts">${q.opts.map(([v, l]) => `<button class="chip ${cur[k] === v ? 'sel' : ''}" onclick="A.fb('${esc(mu)}','${k}','${v}')">${l}</button>`).join('')}</div></div>`;
    });
    const pv = fbPreview(mu);
    if (pv) {
      const txt = pv.capped ? `Already at the per-session cap for ${esc(mu)} — holding sets.`
        : pv.delta === 0 || !pv.changes.length ? (pv.delta < 0 ? 'Every movement is already at 1 set — holding.' : `Holding ${esc(mu)} sets next week.`)
        : pv.changes.map(c => `${esc(c.name)} ${c.from} → ${c.to}`).join(' · ');
      const cls = pv.delta > 0 && pv.changes.length ? 'up' : pv.delta < 0 && pv.changes.length ? 'dn' : 'hd';
      const net = pv.changes.reduce((x, c) => x + c.to - c.from, 0);
      h += `<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><span class="badge ${cls} num">${net > 0 ? '+' + net : net < 0 ? net : '±0'} set${Math.abs(net) === 1 ? '' : 's'} next week</span><span class="xs mut num">${txt}</span></div>`
        + `<div class="xs dim" style="margin-top:4px">Applies to this workout's plan when you finish.</div>`;
    }
    return h + '</div>';
  }

  // --- mesocycle tab
  function viewMeso() {
    if (ui.wiz) return viewWiz();
    if (ui.draft) return viewDraft();
    const m = activeMeso();
    let h = brandBar() + '<h1>Mesocycle</h1>';
    if (!m) h += `<div class="card"><p style="margin-bottom:0">No active mesocycle.</p></div>`;
    else {
      h += `<div class="card hero"><div class="row"><b class="sp" style="font-size:17px">${esc(m.name)}</b><span class="chip sel num">Week ${m.week}/${m.weeks}</span></div>
        <div class="mut xs" style="margin:5px 0 11px">Started ${dstr(m.start)}${m.deload ? ' · Deload final week' : ''}</div>
        <div class="chips">${[...new Set(m.days.flatMap(d => d.items.map(i => EX[i.exId] && EX[i.exId].muscle)))].filter(Boolean).map(mu => `<span class="chip ${prioOf(m, mu)}">${esc(mu)} · ${{ P: 'Priority', N: 'Normal', M: 'Maintain' }[prioOf(m, mu)]}</span>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button class="sm" onclick="A.editMeso()">Edit plan</button><button class="sm" onclick="A.nextWeek()">Next week</button><span class="sp"></span><button class="sm ghost bad" onclick="A.endMeso()">End</button></div></div>`;
      h += '<h2>Training days</h2>';
      m.days.forEach(d => {
        h += `<div class="card"><div class="row" style="margin-bottom:8px"><b class="sp">${esc(d.name)}</b><span class="xs dim num">${d.items.length} lifts</span></div>`
          + d.items.map(it => `<div class="row sm" style="padding:6px 0;border-top:1px solid var(--line)"><span class="sp" style="color:var(--tx2)">${esc(EX[it.exId] ? EX[it.exId].name : '?')}</span><span class="mut xs num">${it.sets} × ${it.min}–${it.max}</span></div>`).join('') + '</div>';
      });
    }
    h += `<button class="pri" style="width:100%;margin-top:6px" onclick="A.newMeso()">+ New mesocycle</button>`;
    const old = S.mesos.filter(x => x.ended);
    if (old.length) {
      h += '<h2>Archived</h2>';
      old.slice().reverse().forEach(x => { h += `<div class="card sm row"><b class="sp">${esc(x.name)}</b><span class="mut xs num">${dstr(x.start)} · ${S.sessions.filter(s => s.mesoId === x.id).length} sessions</span></div>`; });
    }
    return h;
  }

  function viewDraft() {
    const d = ui.draft, muscles = [...new Set(d.days.flatMap(x => x.items.map(i => EX[i.exId] && EX[i.exId].muscle)))].filter(Boolean);
    const vol = C.planVolume(d.days, EX);
    let h = brandBar()
      + (d.fromWiz && !d.editing ? `<div class="row" style="margin:2px 0 4px"><button class="sm ghost" style="padding-left:4px" onclick="A.wizStep('${d.fromWiz === 'freestyle' ? 'free' : 'split'}')">‹ Back</button><span class="sp"></span><span class="mut xs">Step 4 of 4</span></div>` : '')
      + `<h1>${d.editing ? 'Edit mesocycle' : d.fromWiz ? 'Exercises' : 'New mesocycle'}</h1>`;
    h += `<div class="card"><input value="${esc(d.name)}" placeholder="Mesocycle name" oninput="ui_d('name',this.value)">
      <div class="g2" style="margin-top:10px"><label class="xs mut">Weeks<select onchange="ui_d('weeks',+this.value)">${[3, 4, 5, 6, 7, 8].map(n => `<option ${n === d.weeks ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="xs mut">Deload final week<div class="row" style="min-height:44px;margin-top:4px"><input type="checkbox" ${d.deload ? 'checked' : ''} onchange="ui_d('deload',this.checked)"><span class="sm" style="color:var(--tx2)">Half volume</span></div></label></div></div>`;
    if (!d.editing && !d.fromWiz) h += `<div class="card"><label class="xs mut">Load template<select onchange="A.tmpl(this.value);this.selectedIndex=0"><option value="">Choose a preset…</option>${Object.keys(C.TEMPLATES).map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div>`;
    h += '<h2>Weekly sets</h2>';
    h += muscles.length ? `<div class="card">${muscles.slice().sort((x, y) => C.DAY_ORDER.indexOf(x) - C.DAY_ORDER.indexOf(y)).map(mu => {
      const p = d.prio[mu] || 'N', t = C.weeklyTarget(mu, p), v = vol[mu] || 0, off = v - t;
      return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="sp sm">${esc(mu)}</span>
        <span class="sm num" style="width:64px;text-align:right;color:${Math.abs(off) <= 2 ? 'var(--mut)' : off < 0 ? 'var(--warn)' : 'var(--acc-hi)'}">${v} / ${t}</span>
        <button class="chip ${p}" style="min-height:30px;width:88px" onclick="A.cyc('${esc(mu)}')">${{ P: 'Priority', N: 'Normal', M: 'Maintain' }[p]}</button></div>`;
    }).join('')}<div class="xs mut" style="margin-top:10px">Planned sets vs. weekly target. Amber means the day layout caps that muscle — spread it across another day to hit target. Set counts stay flat; progression comes from reps and load.</div></div>` : '<div class="card mut sm">Add exercises below to calculate weekly volume.</div>';
    h += '<h2>Days</h2>';
    d.days.forEach((day, di) => {
      h += `<div class="card"><div class="row"><input value="${esc(day.name)}" oninput="ui_day(${di},this.value)"><button class="ico" title="Duplicate day" onclick="A.dupDay(${di})">⧉</button><button class="ico ghost bad" title="Delete day" onclick="A.delDay(${di})">✕</button></div>`;
      day.items.forEach((it, ii) => {
        const ex = EX[it.exId];
        h += `<div style="padding:10px 0;border-top:1px solid var(--line);margin-top:10px"><div class="row"><b class="sp sm">${esc(ex ? ex.name : '?')}</b><span class="chip">${esc(ex ? ex.muscle : '')}</span><button class="ico ghost" onclick="A.swapD(${di},${ii})">${ICONS.swap}</button><button class="ico ghost" onclick="A.up(${di},${ii})">↑</button><button class="ico ghost bad" onclick="A.delItem(${di},${ii})">✕</button></div>
          <div class="g3" style="margin-top:8px"><label class="xs mut">Sets<input type="number" inputmode="numeric" value="${it.sets}" oninput="A.it(${di},${ii},'sets',this.value)"></label><label class="xs mut">Min reps<input type="number" inputmode="numeric" value="${it.min}" oninput="A.it(${di},${ii},'min',this.value)"></label><label class="xs mut">Max reps<input type="number" inputmode="numeric" value="${it.max}" oninput="A.it(${di},${ii},'max',this.value)"></label></div></div>`;
      });
      h += `<button class="sm" style="margin-top:10px" onclick="A.addEx(${di})">+ Exercise</button></div>`;
    });
    h += `<button onclick="A.addDay()" style="width:100%">+ Add day</button><div class="g2" style="margin-top:12px"><button onclick="A.cancelDraft()">Cancel</button><button class="pri" onclick="A.saveDraft()">${d.editing ? 'Save changes' : 'Start mesocycle'}</button></div>`;
    return h;
  }

  // ---------- new mesocycle wizard ----------
  const SPLITS = { full: 'Full Body', 'upper-lower': 'Upper / Lower', freestyle: 'Freestyle' };
  function wizHead(title, sub, back) {
    return brandBar() + `<div class="row" style="margin:2px 0 4px"><button class="sm ghost" style="padding-left:4px" onclick="A.wizStep('${back}')">‹ Back</button><span class="sp"></span><span class="mut xs">${esc(sub)}</span></div><h1>${esc(title)}</h1>`;
  }
  function viewWiz() {
    const w = ui.wiz;
    if (w.step === 'mode') return brandBar() + `<h1>New mesocycle</h1>
      <div class="card tap hero" onclick="A.wizMode('guided')"><div class="row"><div class="sp"><b style="font-size:16px">Guided setup</b><div class="mut sm" style="margin-top:3px">Days → priorities → split type. Builds the plan and set counts for you, then you fine-tune exercises.</div></div><span class="chev">›</span></div></div>
      <div class="card tap" onclick="A.wizMode('custom')"><div class="row"><div class="sp"><b style="font-size:16px">Custom builder</b><div class="mut sm" style="margin-top:3px">Jump straight to the exercise builder or start from a preset template.</div></div><span class="chev">›</span></div></div>
      <button class="ghost" style="width:100%;margin-top:4px" onclick="A.cancelDraft()">Cancel</button>`;

    if (w.step === 'days') return wizHead('Training days per week', 'Step 1 of 4', 'mode')
      + `<div class="card"><div class="chips" style="gap:8px">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="chip ${w.days === n ? 'sel' : ''} num" style="min-height:52px;min-width:54px;font-size:17px;font-weight:600" onclick="A.wizDays(${n})">${n}</button>`).join('')}</div>
      <div class="xs mut" style="margin-top:12px">Choose how many sessions you want each week. You can rename or reorder days later.</div></div>
      <button class="pri" style="width:100%" onclick="A.wizStep('prio')">Next: priorities ›</button>`;

    if (w.step === 'prio') {
      const rows = C.DAY_ORDER.map(mu => {
        const p = w.prio[mu] || 'N';
        return `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)"><span class="sp sm">${esc(mu)}</span>
          <span class="mut xs num" style="width:58px;text-align:right">${C.weeklyTarget(mu, p)} sets</span>
          <button class="chip ${p}" style="min-height:32px;width:94px" onclick="A.wizPrio('${esc(mu)}')">${{ P: 'Priority', N: 'Normal', M: 'Maintain' }[p]}</button></div>`;
      }).join('');
      return wizHead('Muscle priority', 'Step 2 of 4', 'days')
        + `<div class="card">${rows}<div class="xs mut" style="margin-top:12px">Weekly sets per muscle. Maintain holds near minimum effective volume, Normal sits in the productive middle, Priority pushes to the top of MAV.</div></div>
        <button class="pri" style="width:100%" onclick="A.wizStep('split')">Next: split type ›</button>`;
    }

    if (w.step === 'split') return wizHead('Split type', 'Step 3 of 4', 'prio')
      + `<div class="card tap" onclick="A.wizSplit('full')"><div class="row"><div class="sp"><b>Full Body</b><div class="mut sm" style="margin-top:3px">Upper and lower every session, volume spread across your ${w.days} days in contiguous muscle clusters.</div></div><span class="chev">›</span></div></div>
      <div class="card tap" onclick="A.wizSplit('upper-lower')"><div class="row"><div class="sp"><b>Upper / Lower</b><div class="mut sm" style="margin-top:3px">${w.days % 2 ? `${Math.ceil(w.days / 2)} upper, ${w.days - Math.ceil(w.days / 2)} lower — odd day goes to upper.` : `${w.days / 2} upper, ${w.days / 2} lower.`}</div></div><span class="chev">›</span></div></div>
      <div class="card tap" onclick="A.wizSplit('freestyle')"><div class="row"><div class="sp"><b>Freestyle</b><div class="mut sm" style="margin-top:3px">Pick which muscle groups you want to train on each day.</div></div><span class="chev">›</span></div></div>`;

    if (w.step === 'free') {
      const rows = w.free.map((day, di) => `<div class="card"><div class="row"><b class="sp">Day ${di + 1}</b><span class="mut xs num">${day.filter(Boolean).length} groups</span></div>
        ${day.map((mu, si) => `<div class="row" style="margin-top:8px"><select onchange="A.freeSet(${di},${si},this.value)"><option value="">— none —</option>${C.DAY_ORDER.filter(x => x === mu || !day.some((o, k) => k !== si && o === x)).map(x => `<option ${x === mu ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>${day.length > 1 ? `<button class="ico ghost bad" onclick="A.freeDel(${di},${si})">✕</button>` : ''}</div>`).join('')}
        ${day.length < 5 ? `<button class="sm" style="margin-top:10px" onclick="A.freeAdd(${di})">+ Muscle group</button>` : '<div class="xs mut" style="margin-top:8px">Max 5 per day</div>'}</div>`).join('');
      const empty = w.free.some(d => !d.filter(Boolean).length);
      return wizHead('Muscle groups per day', 'Step 3 of 4', 'split') + rows
        + (empty ? '<div class="card sm" style="color:var(--warn);border-color:rgba(217,180,100,.35)">Every day needs at least one muscle group.</div>' : '')
        + `<button class="pri" style="width:100%" ${empty ? 'disabled' : ''} onclick="A.wizGen()">Build plan ›</button>`;
    }
    return '';
  }

  // --- progress tab
  function viewProg() {
    const m = activeMeso();
    let h = brandBar() + '<h1>Progress</h1>';
    const scope = m ? ui.scope : 'all';
    const sess = scope === 'meso' ? S.sessions.filter(s => s.mesoId === m.id) : S.sessions;
    if (m) h += `<div class="seg"><button class="${scope === 'meso' ? 'on' : ''}" onclick="ui_set('scope','meso')">This meso</button><button class="${scope === 'all' ? 'on' : ''}" onclick="ui_set('scope','all')">All time</button></div>`;
    h += `<div class="seg">${[['all', 'All'], ['P', 'Priority'], ['N', 'Normal'], ['M', 'Maintain']].map(([k, l]) => `<button class="${ui.pf === k ? 'on' : ''}" onclick="ui_set('pf','${k}')">${l}</button>`).join('')}</div>`;
    if (!sess.length) return h + '<div class="card mut sm">Log a workout to see progress, or restore a JSON backup in Data.</div>';
    const t0 = scope === 'meso' ? Math.min(m.start, ...sess.map(s => s.start)) : Math.min(...sess.map(s => s.start));
    const have = [...C.MUSCLES, 'Other'].filter(mu => S.exercises.some(e => e.muscle === mu && sess.some(s => s.items.some(i => i.exId === e.id))));
    const muscles = have.filter(mu => ui.pf === 'all' || (m && prioOf(m, mu) === ui.pf));
    // chart: strength index
    const series = muscles.map((mu, i) => ({ name: mu, color: PALETTE[i % PALETTE.length], pts: C.muscleIndex(sess, S.exercises, mu, t0, bwAt) })).filter(s => s.pts.length);
    h += `<h2>Strength index <span class="xs dim" style="text-transform:none;letter-spacing:0">(est. 1RM · start = 100)</span></h2><div class="card">${lineChart(series, { yFmt: v => Math.round(v), xLab: x => scope === 'meso' ? 'W' + (x + 1) : dstr(t0 + x * C.WEEK) })}</div>`;
    // weekly sets
    if (m) {
      const wk = ui.pw || m.week;
      const done = C.hardSetsByMuscle(S.sessions, EX, s => s.mesoId === m.id && s.week === wk);
      const tgt = {}; m.days.forEach(d => d.items.forEach(it => { const mu = EX[it.exId] && EX[it.exId].muscle; if (mu) tgt[mu] = (tgt[mu] || 0) + C.plannedSets(it.sets, prioOf(m, mu), wk, m); }));
      const ms = Object.keys(tgt).filter(mu => ui.pf === 'all' || prioOf(m, mu) === ui.pf).sort((a, b) => C.MUSCLES.indexOf(a) - C.MUSCLES.indexOf(b));
      h += `<h2>Sets this week</h2><div class="card"><div class="row" style="margin-bottom:10px"><button class="ico" onclick="ui_pw(-1)">‹</button><b class="sp num" style="text-align:center">Week ${wk}${C.isDeload(m, wk) ? ' · Deload' : ''}</b><button class="ico" onclick="ui_pw(1)">›</button></div>`;
      ms.forEach(mu => { const d = done[mu] || 0, t = tgt[mu]; h += `<div class="row" style="padding:6px 0"><span style="width:94px" class="sm">${esc(mu)}</span><span class="chip ${prioOf(m, mu)}" style="width:24px;text-align:center;padding:2px 0">${prioOf(m, mu)}</span><div class="bar sp"><i style="width:${Math.min(100, d / t * 100)}%;background:${d >= t ? 'var(--ok)' : 'var(--acc)'}"></i></div><span class="sm num mut" style="width:46px;text-align:right">${d}/${t}</span></div>`; });
      h += '</div>';
    }
    // table
    h += '<h2>Muscle summary</h2><div class="card"><table><tr><th>Muscle</th><th>Tier</th><th>Index</th><th>Status</th></tr>';
    muscles.forEach(mu => {
      const pts = C.muscleIndex(sess, S.exercises, mu, t0, bwAt); if (!pts.length) return;
      const ch = pts[pts.length - 1].y - 100;
      const exs = S.exercises.filter(e => e.muscle === mu).map(e => C.exerciseSeries(sess, e.id, { mode: e.load, bwAt })).filter(a => a.length);
      const st = exs.filter(C.stalled).length;
      h += `<tr><td>${esc(mu)}</td><td><span class="chip ${m ? prioOf(m, mu) : ''}">${m ? prioOf(m, mu) : '–'}</span></td><td class="num" style="font-weight:600;color:${ch >= 0 ? 'var(--ok)' : 'var(--bad)'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%</td><td class="xs ${st ? '' : 'mut'}" style="${st ? 'color:var(--warn)' : ''}">${st ? '⚠ ' + st + ' stalled' : exs.length + (exs.length === 1 ? ' lift' : ' lifts')}</td></tr>`;
    });
    h += '</table></div>';
    // exercise detail
    const exWith = S.exercises.filter(e => C.exerciseSeries(sess, e.id, { mode: e.load, bwAt }).length).sort((a, b) => a.name.localeCompare(b.name));
    const sel = ui.exSel && exWith.find(e => e.id === ui.exSel) ? ui.exSel : (exWith[0] && exWith[0].id);
    if (sel) {
      const ser = C.exerciseSeries(sess, sel, { mode: EX[sel].load, bwAt });
      h += `<h2>Exercise trend</h2><div class="card"><select onchange="ui_set('exSel',this.value)">${exWith.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select><div style="height:10px"></div>`
        + lineChart([{ name: 'e1RM', color: PALETTE[0], pts: ser.map((p, i) => ({ x: i, y: p.e1 })) }], { xLab: x => dstr(ser[x] ? ser[x].t : 0), yFmt: v => Math.round(v) });
      const rows = sess.filter(s => s.items.some(i => i.exId === sel)).sort((a, b) => b.start - a.start).slice(0, 6);
      h += '<table style="margin-top:10px">' + rows.map(s => `<tr><td class="mut xs" style="width:68px">${dstr(s.start)}</td><td class="sm num">${esc(setStr(s.items.filter(i => i.exId === sel).flatMap(i => i.sets)))}</td></tr>`).join('') + '</table>'
        + (loadOf(EX[sel]) !== 'ext' ? `<div class="xs dim" style="margin-top:8px">1RM uses bodyweight ${loadOf(EX[sel]) === 'assist' ? '− assistance' : '+ added load'}.</div>` : '') + '</div>';
    }
    if (S.bw.length) {
      const pts = S.bw.map((e, k) => ({ x: k, y: e.w }));
      h += `<h2>Bodyweight</h2><div class="card">${S.bw.length > 1 ? lineChart([{ name: 'Bodyweight', color: PALETTE[3], pts }], { xLab: x => dstr(S.bw[x] ? S.bw[x].t : 0), yFmt: v => Math.round(v) }) : ''}`
        + '<table style="margin-top:8px">' + S.bw.slice(-5).reverse().map(e => `<tr><td class="mut xs" style="width:68px">${dstr(e.t)}</td><td class="sm num">${fw(e.w)} ${S.settings.unit}</td><td style="text-align:right"><button class="ico ghost bad" style="min-height:30px" onclick="A.delBW(${e.t})">✕</button></td></tr>`).join('') + '</table></div>';
    }
    return h;
  }

  // --- data tab
  function viewData() {
    let h = brandBar() + '<h1>Data</h1>';
    h += `<div class="card hero"><b>Export &amp; backup</b><div class="mut xs num" style="margin:4px 0 12px">${S.sessions.length} workout${S.sessions.length === 1 ? '' : 's'} logged${S.lastBackup ? ' · Last export ' + dstr(S.lastBackup) : ''}</div>
      <div class="g2"><button class="pri" onclick="A.expCSV()">Export CSV</button><button onclick="A.expJSON()">Backup JSON</button></div>
      <label class="btn" style="text-align:center;display:flex;margin-top:8px">Restore from backup<input type="file" accept=".json,application/json" style="display:none" onchange="A.restore(this)"></label>
      <div class="xs mut" style="margin-top:9px">CSV exports every logged set for spreadsheets. JSON saves your full device state for restoring or migrating.</div></div>`;
    h += `<h2>Settings</h2><div class="card">
      <div class="g2"><label class="xs mut">Unit<select onchange="A.setting('unit',this.value)"><option ${S.settings.unit === 'lb' ? 'selected' : ''}>lb</option><option ${S.settings.unit === 'kg' ? 'selected' : ''}>kg</option></select></label>
      <label class="xs mut">Rest timer (s)<input type="number" inputmode="numeric" value="${S.settings.rest}" onchange="A.setting('rest',+this.value||0)"></label></div>
      <label class="xs mut" style="display:block;margin-top:10px">Increase weight when last set…<select onchange="A.setting('trigger',this.value)"><option value="exceed" ${S.settings.trigger === 'exceed' ? 'selected' : ''}>exceeds max reps (e.g. 13 on 8–12)</option><option value="hit" ${S.settings.trigger === 'hit' ? 'selected' : ''}>reaches max reps (12 on 8–12)</option></select></label>
      <label class="row" style="margin-top:12px;cursor:pointer"><input type="checkbox" ${S.settings.dropBelow ? 'checked' : ''} onchange="A.setting('dropBelow',this.checked)"><span class="sm" style="color:var(--tx2)">Drop one increment if last set falls below min reps</span></label>
      <label class="xs mut" style="display:block;margin-top:10px">Warm-up ramp<select onchange="A.setting('warm',this.value)">${Object.entries(C.WARMUP_SCHEMES).map(([k, v]) => `<option value="${k}" ${S.settings.warm === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <button style="width:100%;margin-top:12px" onclick="A.startTour()">Replay tutorial</button></div>`;
    h += `<h2>History</h2>`;
    const list = [...S.sessions].sort((a, b) => b.start - a.start); const shown = ui.histAll ? list : list.slice(0, 15);
    h += '<div class="card" style="padding:4px 15px">' + (shown.map(s => {
      const open = ui.openSess === s.id, n = s.items.reduce((a, i) => a + i.sets.filter(x => x.done && x.t !== 'W').length, 0);
      return `<div class="li" style="display:block"><div class="row" onclick="A.openS('${s.id}')"><div class="sp"><b>${esc(s.name)}</b><div class="mut xs num">${dstr(s.start)}${s.week ? ' · W' + s.week : ''} · ${n} sets</div></div><span class="chev">${open ? '▾' : '▸'}</span></div>
        ${open ? s.items.map(i => `<div class="sm" style="margin-top:8px"><b>${esc(EX[i.exId] ? EX[i.exId].name : '?')}</b><div class="mut xs num" style="margin-top:2px">${esc(setStr(i.sets))}${i.sets.some(x => x.t === 'W' && x.done) ? ` <span class="dim">+ ${i.sets.filter(x => x.t === 'W' && x.done).length} warm-up</span>` : ''}</div></div>`).join('')
          + (s.fb ? `<div class="xs mut" style="margin-top:8px">Feedback: ${Object.entries(s.fb).filter(([, f]) => !f.skip).map(([mu, f]) => esc(mu) + (f.delta ? ' ' + (f.delta > 0 ? '+' : '') + f.delta + ' sets' : ' held')).join(' · ') || 'skipped'}</div>` : '') + `<button class="sm bad" style="margin-top:10px" onclick="A.delSess('${s.id}')">Delete workout</button>` : ''}</div>`;
    }).join('') || '<div class="mut sm" style="padding:12px 0">No workouts logged yet.</div>') + '</div>';
    if (list.length > 15 && !ui.histAll) h += `<button class="ghost" style="width:100%" onclick="ui_set('histAll',true)">Show all ${list.length}</button>`;
    h += `<h2>Exercise library</h2><div class="card"><button class="sm pri" onclick="A.exEdit(null)">+ New exercise</button><div style="margin-top:8px">${[...C.MUSCLES, 'Other'].map(mu => { const l = S.exercises.filter(e => e.muscle === mu); return l.length ? `<div class="xs dim" style="margin-top:14px;text-transform:uppercase;letter-spacing:.08em;font-weight:600">${mu}</div>` + l.map(e => `<div class="li" onclick="A.exEdit('${e.id}')"><span class="sp sm">${esc(e.name)}</span><span class="mut xs num">${esc(e.type || 'Other')}${e.load === 'bw' ? ' · BW+' : e.load === 'assist' ? ' · Assist' : ''} · ${e.min}–${e.max} · +${e.inc}${Number.isFinite(e.rest) ? ' · ' + mmss(e.rest) : ''}</span></div>`).join('') : ''; }).join('')}</div></div>`;
    h += `<div style="height:10px"></div><button class="bad ghost" style="width:100%" onclick="A.reset()">Erase all data</button>
      <div class="xs dim num" style="text-align:center;margin:16px 0 6px">openGAINS · build ${BUILD}</div>`;
    return h;
  }

  // --- modals
  function modalHTML() {
    const q = ui.modal;
    if (q.type === 'tour') return tourHTML(q);
    if (q.type === 'stype') {
      const it = S.active && S.active.items[q.i], st = it && it.sets[q.j]; if (!st) return '';
      const sub = { '': 'Counts toward volume and drives progression', W: 'Not counted in volume, progression or 1RM', D: 'Counts toward volume; no rest timer; no progression', M: 'Counts toward volume; short rest; no progression', F: 'Taken to failure (0 RIR); drives progression' };
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em;margin:0 2px 8px">${esc(EX[it.exId].name)} · set ${q.j + 1}</div>
        <div class="menu">${Object.entries(C.SET_TYPES).map(([k, l]) => `<button class="mi ${(st.t || '') === k ? 'on' : ''}" onclick="A.stSet(${q.i},${q.j},'${k}')"><span class="mi-ic st-ic t-${k || 'N'}">${k || '#'}</span><span class="sp" style="text-align:left">${l}<span class="xs mut" style="display:block;font-weight:400;margin-top:1px">${sub[k]}</span></span></button>`).join('')}</div>
        <button class="ghost" style="width:100%;margin-top:8px" onclick="A.closeModal()">Cancel</button></div></div>`;
    }
    if (q.type === 'rest') {
      const it = S.active && S.active.items[q.i], ex = it && EX[it.exId]; if (!ex) return '';
      const cur = Number.isFinite(ex.rest) ? ex.rest : null;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><h1 style="font-size:20px;margin-bottom:4px">Rest timer</h1><div class="sm mut" style="margin-bottom:12px">${esc(ex.name)} · saved for this exercise everywhere</div>
        <div class="chips" style="gap:8px">${[45, 60, 90, 120, 150, 180, 240, 300].map(sec => `<button class="chip num ${cur === sec ? 'sel' : ''}" style="min-height:42px;min-width:64px" onclick="A.restSet(${q.i},${sec})">${mmss(sec)}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><input id="rest_c" type="number" inputmode="numeric" placeholder="Custom seconds" value="${cur != null && ![45, 60, 90, 120, 150, 180, 240, 300].includes(cur) ? cur : ''}"><button onclick="A.restSet(${q.i},+document.getElementById('rest_c').value)">Set</button></div>
        <div class="g2" style="margin-top:12px"><button onclick="A.restSet(${q.i},null)" ${cur == null ? 'disabled' : ''}>Use default (${mmss(S.settings.rest)})</button><button class="ghost" onclick="A.closeModal()">Close</button></div></div></div>`;
    }
    if (q.type === 'pick') {
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet pick"><div class="pick-hd"><div class="row"><input id="pq" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Search exercises…" value="${esc(q.q)}" oninput="A.pq(this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="flex:1"><button class="pri" onclick="A.exEdit(null,true)">＋</button></div>
        <div class="chips hscroll" id="pmc" style="margin-top:10px">${pickChips('m')}</div><div class="chips hscroll" id="ptc" style="margin-top:6px">${pickChips('t')}</div></div><div id="pl" class="pick-list">${pickList()}</div></div></div>`;
    }
    if (q.type === 'menu') {
      const it = S.active && S.active.items[q.i], ex = it && EX[it.exId]; if (!ex) return '';
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em;margin:0 2px 8px">${esc(ex.name)}</div>
        <div class="menu">${ITEM_MENU.map(o => { const sub = typeof o.sub === 'function' ? o.sub(it, ex) : o.sub, off = o.off && o.off(it, ex); return `<button class="mi ${o.cls || ''}" ${off ? 'disabled' : ''} onclick="${o.act}(${q.i})"><span class="mi-ic">${o.icon}</span><span class="sp" style="text-align:left">${esc(o.label)}<span class="xs mut" style="display:block;font-weight:400;margin-top:1px">${esc(off || sub)}</span></span></button>`; }).join('')}</div>
        <button class="ghost" style="width:100%;margin-top:8px" onclick="A.closeModal()">Cancel</button></div></div>`;
    }
    if (q.type === 'remove') {
      const a = S.active, it = a && a.items[q.i], ex = it && EX[it.exId]; if (!ex) return '';
      const m = S.mesos.find(x => x.id === a.mesoId), day = m && m.days.find(d => d.id === a.dayId), slot = planSlot(day, it);
      const done = it.sets.filter(s => s.done).length, only = day && day.items.length <= 1;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><h1 style="font-size:20px;margin-bottom:6px">Remove ${esc(ex.name)}?</h1>
        ${done ? `<div class="card sm" style="color:var(--warn);border-color:rgba(217,180,100,.35);background:var(--warn-bg);margin:8px 0">${done} logged set${done === 1 ? '' : 's'} on this movement will be discarded.</div>` : ''}
        <div class="menu" style="margin-top:10px">
          <button class="mi" onclick="A.rmDo(${q.i},false)"><span class="sp" style="text-align:left">This workout only<span class="xs mut" style="display:block;font-weight:400;margin-top:1px">Skip it today. It stays in the plan for next week.</span></span></button>
          <button class="mi bad" ${slot && !only ? '' : 'disabled'} onclick="A.rmDo(${q.i},true)"><span class="sp" style="text-align:left">Remove from mesocycle<span class="xs mut" style="display:block;font-weight:400;margin-top:1px">${!slot ? 'Not part of this workout’s plan.' : only ? 'It’s the only movement in this workout.' : `Deletes it from ${esc(day.name)} for the rest of ${esc(m.name)} (−${slot.sets} ${esc(ex.muscle)} sets/week).`}</span></span></button>
        </div>
        <button class="ghost" style="width:100%;margin-top:8px" onclick="A.closeModal()">Cancel</button></div></div>`;
    }
    if (q.type === 'missing') {
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><h1 style="font-size:20px;margin-bottom:8px">Untrained muscle groups</h1>
        <p class="sm mut">These groups aren't assigned to any day yet:</p>
        <div class="chips" style="margin:10px 0">${q.list.map(m => `<span class="chip" style="color:var(--warn);border-color:rgba(217,180,100,.4);background:var(--warn-bg)">${esc(m)}</span>`).join('')}</div>
        <p class="sm mut">That's fine if intentional. Otherwise go back and add them to a day.</p>
        <div class="g2" style="margin-top:14px"><button class="pri" onclick="A.closeModal()">Go back</button><button onclick="A.wizGen(true)">Proceed anyway</button></div></div></div>`;
    }
    if (q.type === 'ex') {
      const e = q.ex;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><h1 style="font-size:20px;margin-bottom:12px">${q.id ? 'Edit' : 'New'} exercise</h1>
        <input id="e_name" value="${esc(e.name)}" placeholder="Name e.g. Cable Row (Cable)" style="margin-bottom:10px">
        <div class="g2" style="margin-bottom:10px"><label class="xs mut">Muscle<select id="e_mu">${[...C.MUSCLES, 'Other'].map(mu => `<option ${mu === e.muscle ? 'selected' : ''}>${mu}</option>`).join('')}</select></label>
        <label class="xs mut">Equipment<select id="e_type">${C.TYPES.map(t => `<option ${t === (e.type || 'Other') ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="g3"><label class="xs mut">Min reps<input id="e_min" type="number" value="${e.min}"></label><label class="xs mut">Max reps<input id="e_max" type="number" value="${e.max}"></label><label class="xs mut">Step<input id="e_inc" type="number" step="any" value="${e.inc}"></label></div>
        <div class="g2" style="margin-top:10px"><label class="xs mut">Load<select id="e_load">${Object.entries(C.LOADS).map(([k, l]) => `<option value="${k}" ${k === (e.load || C.inferLoad(e.name, e.type)) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="xs mut">Rest (s)<input id="e_rest" type="number" inputmode="numeric" placeholder="Default ${S.settings.rest}" value="${Number.isFinite(e.rest) ? e.rest : ''}"></label></div>
        <div class="g2" style="margin-top:14px">${q.id ? '<button class="bad" onclick="A.exDel()">Delete</button>' : '<button onclick="A.closeModal()">Cancel</button>'}<button class="pri" onclick="A.exSave()">Save</button></div></div></div>`;
    }
    return '';
  }
  function pickChips(k) {
    const q = ui.modal;
    return k === 'm' ? C.MUSCLES.map(mu => `<button class="chip ${q.muscle === mu ? 'sel' : ''}" onmousedown="event.preventDefault()" onclick="A.pm('${mu}')">${mu}</button>`).join('')
      : C.TYPES.map(t => `<button class="chip ${q.tf === t ? 'sel' : ''}" onmousedown="event.preventDefault()" onclick="A.pt('${t}')">${t}</button>`).join('');
  }
  /** Per-movement ⋯ menu. Add future actions here: {icon,label,sub,cls,act} where act(i) is a global handler. */
  const ITEM_MENU = [
    { icon: ICONS.fire, label: 'Add warm-up sets', act: 'A.warm',
      sub: () => (C.WARMUP_SCHEMES[S.settings.warm] || C.WARMUP_SCHEMES.std).label + ' of first working set',
      off: (it, ex) => loadOf(ex) !== 'ext' ? 'Not used on bodyweight or assisted lifts' : null },
    { icon: ICONS.clock, label: 'Rest timer', act: 'A.restAsk',
      sub: (it, ex) => Number.isFinite(ex.rest) ? mmss(ex.rest) + ' for this exercise' : mmss(S.settings.rest) + ' (default)' },
    { icon: ICONS.trash, label: 'Skip / remove movement', sub: 'Drop it from today, or from the mesocycle', cls: 'bad', act: 'A.rmAsk' },
  ];
  /** The mesocycle plan slot a session item came from. */
  function planSlot(day, it) {
    if (!day) return null;
    return (it.pid && day.items.find(x => x.pid === it.pid)) || day.items.find(x => x.exId === it.exId) || null;
  }
  function pickList() {
    const q = ui.modal, s = (q.q || '').toLowerCase();
    return S.exercises.filter(e => (!q.muscle || e.muscle === q.muscle) && (!q.tf || (e.type || 'Other') === q.tf) && e.name.toLowerCase().includes(s)).map(e => `<div class="li" onclick="A.pick('${e.id}')"><span class="sp sm">${esc(e.name)}</span><span class="chip">${esc(e.type || 'Other')}</span><span class="chip">${esc(e.muscle)}</span></div>`).join('') || '<div class="mut sm" style="padding:14px 2px">No match — tap ＋ to create it.</div>';
  }

  // ---------- First-run tutorial ----------
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  const TI = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  function tourSteps() {
    const steps = [];
    // iPhone Safari: storage is separate from the home-screen app, so install before logging anything
    if (isIOS && !isStandalone()) steps.push({
      tab: 'train', icon: TI('<path d="M12 3v12M8 7l4-4 4 4"/><rect x="4" y="11" width="16" height="10" rx="2.5"/>'),
      title: 'Install it first',
      body: 'Tap <b>Share</b> → <b>Add to Home Screen</b>, then open openGAINS from your home screen.',
      points: ['Runs full-screen, keeps the screen awake mid-workout, and works offline', 'Safari and the home-screen app keep <b>separate data</b>. Anything logged here won’t carry over'],
      next: 'Continue in Safari',
    });
    steps.push({
      tab: 'train', icon: TI('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
      title: 'Welcome to openGAINS',
      body: 'Hypertrophy training in blocks. You set the plan once; the app works out each week’s weights and volume from what you log.',
      demo: `<div class="g3 tour-loop"><div class="kpi"><div class="xs dim">1 · Once</div><b class="sm">Build a block</b></div><div class="kpi"><div class="xs dim">2 · Each set</div><b class="sm">Log it</b></div><div class="kpi"><div class="xs dim">3 · Weekly</div><b class="sm">It adjusts</b></div></div>`,
      points: ['A block (mesocycle) is 3–8 weeks, usually ending in a deload week', 'Every lift keeps its own rep range for the whole block'],
    });
    steps.push({
      tab: 'meso', icon: TI('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2.5v3M16 2.5v3M3 9.5h18M8 14h3M13 14h3M8 17.5h5"/>'),
      title: 'Build your mesocycle',
      body: '<b>Guided setup</b> picks days, muscle priorities and split, then builds exercises and set counts. <b>Custom</b> starts from a template or a blank plan.',
      demo: `<div class="card" style="margin:0;padding:10px 12px"><div class="row" style="padding:3px 0"><span class="sp sm">Back</span><span class="sm num mut">14 / 14</span><span class="chip P" style="margin-left:8px">Priority</span></div><div class="row" style="padding:3px 0"><span class="sp sm">Biceps</span><span class="sm num mut">10 / 10</span><span class="chip N" style="margin-left:8px">Normal</span></div></div>`,
      points: ['Priority muscles get the most weekly sets, Maintain the fewest', 'Edit, swap or reorder anything later from the Meso tab'],
    });
    steps.push({
      tab: 'train', icon: TI('<path d="M4 6h16M4 12h16M4 18h10"/><path d="M17 16.5l1.8 1.8 3.2-3.6"/>'),
      title: 'Logging a workout',
      body: 'Weights and reps come pre-filled. Adjust if needed, add RIR (reps in reserve) if you track it, then tap <b>○</b> to check the set off and start the rest timer.',
      demo: `<div class="card" style="margin:0;padding:10px 12px"><div class="setrow t-W"><span class="n">W</span><span class="kpi num sm" style="text-align:center;padding:8px 0">95</span><span class="kpi num sm" style="text-align:center;padding:8px 0">8</span><span class="kpi sm dim" style="text-align:center;padding:8px 0">–</span><span class="kpi sm" style="text-align:center;padding:8px 0">○</span></div><div class="setrow done"><span class="n">1</span><span class="kpi num sm" style="text-align:center;padding:8px 0">185</span><span class="kpi num sm" style="text-align:center;padding:8px 0">9</span><span class="kpi num sm" style="text-align:center;padding:8px 0">2</span><span class="kpi sm" style="text-align:center;padding:8px 0;color:var(--ok)">✓</span></div></div>`,
      points: ['Tap a <b>set number</b> to mark it warm-up, drop, myo-reps or failure. Warm-ups don’t count as volume', '<b>⋯</b> on a movement: warm-up ramp, its own rest timer, or skip/remove it', 'Movements for the same muscle share a card'],
    });
    steps.push({
      tab: 'train', icon: TI('<path d="M4 19h16M5 15l4.5-4.5 3.5 3 6-7"/><path d="M15.5 6.5H19V10"/>'),
      title: 'How weights move',
      body: 'Beat the top of the rep range on your last set and next week’s weight goes up for that lift in that workout. Otherwise, add reps at the same weight.',
      demo: `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge up num">↑ 185 → 200 · range exceeded</span><span class="badge rc num">2 RIR rec · 160 × 14</span></div>`,
      points: ['First time in a workout? You get a 2 RIR recommendation from your last 6 sessions of that lift', 'Log your <b>bodyweight</b> on the Train tab so pull-ups, dips and assisted machines track properly'],
    });
    steps.push({
      tab: 'train', icon: TI('<path d="M12 3v18M5 9l7-6 7 6"/><path d="M5 15l7 6 7-6"/>'),
      title: 'Volume adjusts per muscle',
      body: 'When you finish a muscle’s last set, rate pump, soreness, joint pain and workload. Next week’s sets for that muscle in that workout go up, hold, or come down.',
      demo: `<div class="fb" style="margin:0"><b class="sm">How did Back feel?</b><div class="fb-opts" style="margin-top:6px"><span class="chip">Low</span><span class="chip sel">Moderate</span><span class="chip">Great</span></div><div style="margin-top:8px"><span class="badge up num">+1 set next week</span></div></div>`,
      points: ['Joint pain or still being sore always backs off', 'Maintain-priority muscles never go up', 'Changes apply when you tap <b>Finish workout</b>'],
    });
    steps.push({
      tab: 'data', icon: TI('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6"/><path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3"/>'),
      title: 'Your data lives on this phone',
      body: 'No account, no cloud. Back up from the <b>Data</b> tab so a reset or a new phone doesn’t cost you your history.',
      points: ['<b>Backup JSON</b> restores everything; CSV is for spreadsheets', 'You’ll get a reminder if it’s been 14+ days', 'Replay this tour anytime from Data → Settings'],
    });
    return steps;
  }
  function tourHTML(m) {
    const steps = tourSteps();
    const i = C.clamp(m.i || 0, 0, steps.length - 1), st = steps[i], last = i === steps.length - 1;
    const cta = last ? (activeMeso() ? 'Start training' : 'Build my first block') : (st.next || 'Next');
    return `<div class="modal"><div class="sheet tour" ontouchstart="ui_tourT(event,0)" ontouchend="ui_tourT(event,1)">
      <div class="row" style="margin-bottom:4px"><span class="xs dim num sp">${i + 1} of ${steps.length}</span><button class="sm ghost" onclick="A.endTour(false)">Skip</button></div>
      <div class="tour-step" key="${i}">
        <div class="tour-ic">${st.icon}</div>
        <b class="tour-h">${st.title}</b>
        <p class="sm mut tour-p">${st.body}</p>
        ${st.demo ? `<div class="tour-demo" aria-hidden="true">${st.demo}</div>` : ''}
        ${st.points ? `<ul class="tour-pts">${st.points.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="tour-dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="g2"><button ${i === 0 ? 'disabled' : ''} onclick="A.tourStep(-1)">Back</button><button class="pri" onclick="${last ? 'A.endTour(true)' : 'A.tourStep(1)'}">${cta}</button></div>
    </div></div>`;
  }
  let tourX = null, tourY = null;
  window.ui_tourT = (e, end) => { // horizontal swipe between tour steps
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    if (!end) { tourX = t.clientX; tourY = t.clientY; return; }
    if (tourX == null) return;
    const dx = t.clientX - tourX, dy = t.clientY - tourY; tourX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) A.tourStep(dx < 0 ? 1 : -1);
  };

  // ---------- render ----------
  const TABS = [['train', ICONS.train, 'Train'], ['meso', ICONS.meso, 'Meso'], ['prog', ICONS.prog, 'Progress'], ['data', ICONS.data, 'Data']];
  function render() {
    const y = window.scrollY; reindex();
    const v = { train: viewTrain, meso: viewMeso, prog: viewProg, data: viewData }[ui.tab]();
    $('#app').innerHTML = v + (ui.modal ? modalHTML() : '');
    $('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" onclick="A.go('${k}')"><span class="ti">${i}</span>${l}</button>`).join('');
    window.scrollTo(0, y);
  }

  // ---------- actions ----------
  window.ui_set = (k, v) => { ui[k] = v; render(); };
  window.ui_hideTip = () => { ui.tipHidden = true; render(); };
  window.ui_pw = (d) => { const m = activeMeso(); const w = (ui.pw || m.week) + d; ui.pw = Math.min(m.weeks, Math.max(1, w)); render(); };
  window.ui_d = (k, v) => { ui.draft[k] = v; if (k === 'weeks' || k === 'deload') { } };
  window.ui_day = (di, v) => { ui.draft.days[di].name = v; };

  function newDraft() { return { id: C.uid(), name: 'Meso ' + (S.mesos.length + 1), start: Date.now(), weeks: 5, deload: true, startRIR: 3, week: 1, prio: {}, days: [{ id: C.uid(), name: 'Day 1', items: [] }] }; }
  const A = window.A = {
    go(t) { ui.tab = t; ui.modal = null; render(); window.scrollTo(0, 0); },
    // --- session
    start(dayId) {
      const m = activeMeso(), d = m.days.find(x => x.id === dayId);
      ensurePids(m);
      S.active = { id: C.uid(), mesoId: m.id, week: m.week, dayId, name: d.name, start: Date.now(), note: '', items: d.items.filter(it => EX[it.exId]).map(it => buildItem(m, m.week, it.exId, it, dayId)) };
      save(); lock(); render(); window.scrollTo(0, 0);
    },
    sv(i, j, f, v) {
      const set = S.active.items[i].sets[j], old = set[f]; set[f] = num(v);
      if (f === 'w') S.active.items[i].sets.forEach((s, k) => { if (k > j && !s.done && (s.w === '' || s.w === old)) { s.w = set.w; const el = document.getElementById(`w_${i}_${k}`); if (el) el.value = fw(set.w); } });
      save();
    },
    chk(i, j) {
      const it = S.active.items[i], s = it.sets[j]; s.done = !s.done;
      if (s.done) {
        unlockAudio();
        if (s.w === '') s.w = 0; if (s.r === '') s.r = 0;
        // warm-ups rest short, drop sets go straight on, myo-rep clusters rest briefly
        const base = restOf(EX[it.exId]), sec = s.t === 'W' ? Math.min(60, base) : s.t === 'D' ? 0 : s.t === 'M' ? 20 : base;
        if (sec > 0) startTimer(sec); else stopTimer();
        const work = it.sets.map((x, k) => C.isWork(x) ? k : -1).filter(k => k >= 0), lastW = work[work.length - 1];
        if (j === lastW && C.isWork(s) && !C.isDeload(S.mesos.find(m => m.id === S.active.mesoId), S.active.week)) {
          const exceeded = S.settings.trigger === 'hit' ? s.r >= it.max : s.r > it.max;
          if (exceeded) toast(loadOf(EX[it.exId]) === 'assist' ? '↑ Less assistance next week in this workout' : '↑ Weight goes up next week in this workout');
        }
      }
      save(); render();
    },
    addSet(i) { const it = S.active.items[i], l = [...it.sets].reverse().find(x => x.t !== 'W') || it.sets[it.sets.length - 1] || { w: '', r: it.min }; it.sets.push({ w: l.w, r: l.r, rir: '', done: false, t: '' }); save(); render(); },
    // --- set types
    stAsk(i, j) { ui.modal = { type: 'stype', i, j }; render(); },
    stSet(i, j, t) { const st = S.active.items[i].sets[j]; st.t = t; if (t === 'F' && st.rir === '') st.rir = 0; ui.modal = null; save(); render(); },
    // --- warm-ups: replaces any unchecked warm-up sets with a fresh ramp to the first working set
    warm(i) {
      const it = S.active.items[i], ex = EX[it.exId];
      const first = it.sets.find(x => x.t !== 'W'), w = first ? +first.w || 0 : 0;
      ui.modal = null;
      if (!(w > 0)) { render(); toast('Enter a working weight first'); return; }
      const bar = ex.type === 'Barbell' ? (S.settings.unit === 'kg' ? 20 : 45) : 0;
      const ramp = C.warmups(w, { inc: ex.inc, scheme: S.settings.warm, bar });
      if (!ramp.length) { render(); toast('Too light for a warm-up ramp'); return; }
      it.sets = ramp.map(x => ({ w: x.w, r: x.r, rir: '', done: false, t: 'W' })).concat(it.sets.filter(x => x.t !== 'W' || x.done));
      save(); render(); toast(`Added ${ramp.length} warm-up set${ramp.length === 1 ? '' : 's'}`);
    },
    // --- per-exercise rest
    restAsk(i) { ui.modal = { type: 'rest', i }; render(); },
    restSet(i, sec) {
      const ex = EX[S.active.items[i].exId];
      if (sec == null) delete ex.rest; else if (sec > 0) ex.rest = Math.round(sec); else { toast('Enter seconds'); return; }
      ui.modal = null; save(); render(); toast(sec == null ? 'Using default rest' : 'Rest set to ' + mmss(ex.rest));
    },
    // --- per-muscle feedback
    fb(mu, k, v) { const a = S.active; a.fb = a.fb || {}; const f = a.fb[mu] = Object.assign({}, a.fb[mu], { [k]: v }); delete f.skip; save(); render(); },
    fbSkip(mu, on) { const a = S.active; a.fb = a.fb || {}; if (on) a.fb[mu] = { skip: true }; else delete a.fb[mu]; save(); render(); },
    // --- bodyweight (one entry per day; re-logging the same day replaces it)
    logBW(id) {
      const el = document.getElementById(id), w = parseFloat(el && el.value);
      if (!(w > 0)) { toast('Enter your bodyweight'); return; }
      const d = C.fmtDate(Date.now()); S.bw = S.bw.filter(e => C.fmtDate(e.t) !== d); S.bw.push({ t: Date.now(), w: Math.round(w * 10) / 10 });
      S.bw.sort((x, y) => x.t - y.t);
      if (S.active) S.active.items.forEach((it, k) => { if (loadOf(EX[it.exId]) !== 'ext' && !it.sets.some(x => x.done)) { const m = S.mesos.find(x => x.id === S.active.mesoId); const nu = buildItem(m, S.active.week, it.exId, { sets: it.base, min: it.min, max: it.max, pid: it.pid }, S.active.dayId); nu.note = it.note; S.active.items[k] = nu; } });
      save(); render(); toast('Bodyweight logged');
    },
    delBW(t) { S.bw = S.bw.filter(e => e.t !== t); save(); render(); },
    rmSet(i) { const it = S.active.items[i]; if (it.sets.length > 1 && !it.sets[it.sets.length - 1].done) it.sets.pop(); save(); render(); },
    note(i, v) { S.active.items[i].note = v; save(); }, wnote(v) { S.active.note = v; save(); },
    swap(i) { ui.modal = { type: 'pick', mode: 'swap', i, q: '', muscle: EX[S.active.items[i].exId].muscle }; render(); },
    more(i) { ui.modal = { type: 'menu', i }; render(); },
    rmAsk(i) { ui.modal = { type: 'remove', i }; render(); },
    rmDo(i, perm) {
      const a = S.active, it = a.items[i]; if (!it) return;
      const name = EX[it.exId] ? EX[it.exId].name : 'Movement';
      if (perm) {
        const m = S.mesos.find(x => x.id === a.mesoId), day = m && m.days.find(d => d.id === a.dayId), slot = planSlot(day, it);
        if (slot && day.items.length > 1) day.items.splice(day.items.indexOf(slot), 1);
      }
      a.items.splice(i, 1); ui.modal = null; save(); render();
      toast(perm ? name + ' removed from mesocycle' : name + ' skipped');
    },
    finish() {
      const a = S.active, n = a.items.reduce((c, it) => c + it.sets.filter(s => s.done).length, 0);
      if (!n) { if (confirm('No completed sets. Discard this workout?')) A.discard(true); return; }
      const open = a.items.some(it => it.sets.some(s => !s.done)); if (open && !confirm('Some sets are unchecked and will be dropped. Finish?')) return;
      // apply per-muscle feedback to this workout's plan for next week
      const fbMsg = [];
      if (a.fb) Object.keys(a.fb).forEach(mu => {
        const pv = fbPreview(mu); if (!pv || !pv.changes.length) return;
        const { items } = fbTargets(mu), ch = C.distributeSets(items, pv.delta, (C.VOL[mu] || {}).cap);
        const net = ch.reduce((x, c) => x + c.to - c.from, 0); if (net) fbMsg.push(mu + ' ' + (net > 0 ? '+' : '') + net);
        a.fb[mu].delta = net;
      });
      a.bw = curBW() || undefined;
      a.items.forEach(it => { it.sets = it.sets.filter(s => s.done); });
      a.items = a.items.filter(it => it.sets.length); a.end = Date.now();
      S.sessions.push(a); S.active = null; stopTimer(); try { wake && wake.release(); } catch (e) { }
      save(); toast(fbMsg.length ? 'Saved · sets next week: ' + fbMsg.join(', ') : 'Workout saved'); render(); window.scrollTo(0, 0);
    },
    discard(skip) { if (skip || confirm('Discard this workout?')) { S.active = null; stopTimer(); save(); render(); } },
    tAdd(s) { timerEnd += s * 1000; tickTimer(); }, tStop: stopTimer,
    nextWeek() { const m = activeMeso(); if (m.week >= m.weeks) { A.endMeso(); return; } if (confirm('Advance to week ' + (m.week + 1) + '?')) { m.week++; ui.pw = null; save(); render(); } },
    endMeso() { const m = activeMeso(); if (m && confirm('Archive "' + m.name + '"? Your logged data stays.')) { m.ended = Date.now(); S.activeMesoId = null; save(); render(); } },
    // --- builder
    newMeso() { ui.draft = null; ui.wizSaved = null; ui.wiz = { step: 'mode', days: 4, prio: {}, type: null, free: [] }; ui.tab = 'meso'; render(); window.scrollTo(0, 0); },
    wizMode(m) {
      if (m === 'custom') { ui.wiz = null; ui.draft = newDraft(); }
      else ui.wiz.step = 'days';
      render(); window.scrollTo(0, 0);
    },
    wizDays(n) { ui.wiz.days = n; render(); },
    wizStep(s) {
      if (s === 'mode' && ui.wiz && ui.wiz.step === 'mode') { A.cancelDraft(); return; }
      if (!ui.wiz) ui.wiz = ui.wizSaved ? Object.assign(clone(ui.wizSaved), { step: s }) : { step: s, days: (ui.draft && ui.draft.days.length) || 4, prio: (ui.draft && ui.draft.prio) || {}, type: null, free: [] };
      else ui.wiz.step = s;
      ui.draft = null; render(); window.scrollTo(0, 0);
    },
    wizPrio(mu) { const w = ui.wiz; w.prio[mu] = { N: 'P', P: 'M', M: 'N' }[w.prio[mu] || 'N']; render(); },
    wizSplit(t) {
      const w = ui.wiz; w.type = t;
      if (t === 'freestyle') { w.free = Array.from({ length: w.days }, (_, i) => (w.free[i] && w.free[i].length) ? w.free[i] : ['', '', '']); w.step = 'free'; render(); window.scrollTo(0, 0); }
      else A.wizGen();
    },
    freeSet(di, si, v) { ui.wiz.free[di][si] = v; render(); },
    freeAdd(di) { const d = ui.wiz.free[di]; if (d.length < 5) d.push(''); render(); },
    freeDel(di, si) { const d = ui.wiz.free[di]; if (d.length > 1) d.splice(si, 1); render(); },
    wizGen(force) {
      const w = ui.wiz, prev = lastMeso();
      if (w.type === 'freestyle' && !force) {
        const miss = C.missingMuscles(w.free);
        if (miss.length) { ui.modal = { type: 'missing', list: miss }; render(); return; }
      }
      ui.modal = null;
      const prefer = new Set(prev ? prev.days.flatMap(d => d.items.map(i => i.exId)) : []);
      const days = C.generatePlan({ days: w.days, prio: w.prio, type: w.type, free: w.free, exercises: S.exercises, prefer, ranges: lastRanges() });
      const d = newDraft();
      d.days = days; d.prio = clone(w.prio); d.fromWiz = w.type;
      d.name = SPLITS[w.type] + ' ' + w.days + 'd';
      ui.wizSaved = clone(w); ui.draft = d; ui.wiz = null; save(); render(); window.scrollTo(0, 0);
    },
    editMeso() { ui.draft = Object.assign(clone(activeMeso()), { editing: true }); render(); window.scrollTo(0, 0); },
    cancelDraft() { ui.draft = null; ui.wiz = null; render(); },
    cyc(mu) { const d = ui.draft, c = d.prio[mu] || 'N'; d.prio[mu] = { N: 'P', P: 'M', M: 'N' }[c]; render(); },
    tmpl(name) {
      if (!name) return; const d = ui.draft, T = C.TEMPLATES[name]; const byName = Object.fromEntries(S.exercises.map(e => [e.name, e]));
      d.days = T.map(([dn, items]) => ({ id: C.uid(), name: dn, items: items.filter(([n]) => byName[n]).map(([n, s]) => ({ exId: byName[n].id, sets: s, min: byName[n].min, max: byName[n].max })) }));
      render();
    },
    addDay() { ui.draft.days.push({ id: C.uid(), name: 'Day ' + (ui.draft.days.length + 1), items: [] }); render(); },
    dupDay(di) { const d = clone(ui.draft.days[di]); d.id = C.uid(); d.name += ' (2)'; ui.draft.days.splice(di + 1, 0, d); render(); },
    delDay(di) { if (confirm('Remove this day?')) { ui.draft.days.splice(di, 1); render(); } },
    delItem(di, ii) { ui.draft.days[di].items.splice(ii, 1); render(); },
    up(di, ii) { const l = ui.draft.days[di].items; if (ii > 0) { [l[ii - 1], l[ii]] = [l[ii], l[ii - 1]]; render(); } },
    it(di, ii, f, v) { ui.draft.days[di].items[ii][f] = Math.max(1, parseInt(v) || 1); },
    addEx(di) { ui.modal = { type: 'pick', mode: 'add', di, q: '', muscle: '' }; render(); },
    saveDraft() {
      const d = ui.draft; if (!d) return;
      if (!d.days.some(x => x.items.length)) { toast('Add at least one exercise'); return; }
      d.days = d.days.filter(x => x.items.length);
      const bad = d.days.flatMap(x => x.items).find(i => i.min > i.max); if (bad) { toast('Min reps must be ≤ max reps'); return; }
      const wasEditing = d.editing; delete d.editing; delete d.fromWiz;
      if (wasEditing) { const k = S.mesos.findIndex(m => m.id === d.id); S.mesos[k] = d; if (d.week > d.weeks) d.week = d.weeks; }
      else { const old = activeMeso(); if (old) old.ended = Date.now(); d.start = Date.now(); S.mesos.push(d); S.activeMesoId = d.id; }
      ui.draft = null; ui.tab = wasEditing ? 'meso' : 'train'; save(); render(); window.scrollTo(0, 0);
    },
    // --- picker / exercise editor
    pq(v) { ui.modal.q = v; $('#pl').innerHTML = pickList(); },
    // filter chips refresh in place so the search field keeps focus (and the keyboard stays up)
    pm(mu) { ui.modal.muscle = ui.modal.muscle === mu ? '' : mu; $('#pmc').innerHTML = pickChips('m'); $('#pl').innerHTML = pickList(); $('#pl').scrollTop = 0; },
    pt(t) { ui.modal.tf = ui.modal.tf === t ? '' : t; $('#ptc').innerHTML = pickChips('t'); $('#pl').innerHTML = pickList(); $('#pl').scrollTop = 0; },
    swapD(di, ii) { ui.modal = { type: 'pick', mode: 'dswap', di, ii, q: '', muscle: EX[ui.draft.days[di].items[ii].exId].muscle }; render(); },
    pick(exId) {
      const q = ui.modal, ex = EX[exId];
      if (q.mode === 'add') ui.draft.days[q.di].items.push({ exId, sets: 3, min: ex.min, max: ex.max });
      else if (q.mode === 'dswap') ui.draft.days[q.di].items[q.ii].exId = exId; // keeps sets + rep range you set
      else {
        const a = S.active, m = S.mesos.find(x => x.id === a.mesoId), old = a.items[q.i], oldId = old.exId;
        if (oldId !== exId) {
          a.items[q.i] = buildItem(m, a.week, exId, { sets: old.base || old.sets.length, min: old.min, max: old.max, pid: old.pid }, a.dayId);
          const day = m.days.find(d => d.id === a.dayId), t = planSlot(day, old);
          if (t && confirm('Also replace it in the mesocycle for future sessions?\n\nOK = permanent swap\nCancel = this workout only')) t.exId = exId;
          save();
        }
      }
      ui.modal = null; render();
    },
    closeModal() { ui.modal = null; render(); },
    exEdit(id, fromPick) {
      const ex = id ? clone(EX[id]) : { name: '', muscle: (ui.modal && ui.modal.muscle) || 'Chest', type: (ui.modal && ui.modal.tf) || 'Other', min: 8, max: 12, inc: S.settings.unit === 'kg' ? 2.5 : 5 };
      ui.modal = { type: 'ex', id, ex, fromPick: !!fromPick, back: fromPick ? ui.modal : null }; render();
    },
    exSave() {
      const q = ui.modal, rest = parseInt($('#e_rest').value);
      const e = { name: $('#e_name').value.trim(), muscle: $('#e_mu').value, type: $('#e_type').value, min: +$('#e_min').value || 1, max: +$('#e_max').value || 1, inc: +$('#e_inc').value || 5, load: $('#e_load').value };
      if (rest > 0) e.rest = rest; else if (q.id) delete EX[q.id].rest;
      if (!e.name) { toast('Name required'); return; } if (e.min > e.max) { toast('Min reps must be ≤ max'); return; }
      if (q.id) Object.assign(EX[q.id], e); else S.exercises.push(Object.assign(e, { id: 'u' + C.uid() }));
      save(); reindex(); ui.modal = q.back || null; if (q.back) q.back.q = e.name; render();
    },
    exDel() {
      const id = ui.modal.id; if (S.sessions.some(s => s.items.some(i => i.exId === id)) && !confirm('This exercise has logged history. Delete it anyway? (History rows will show "?")')) return;
      S.exercises = S.exercises.filter(e => e.id !== id); save(); ui.modal = null; render();
    },
    // --- data
    expCSV() { shareOrDownload('opengains-' + new Date().toISOString().slice(0, 10) + '.csv', C.toCSV(S.sessions, EX, Object.fromEntries(S.mesos.map(m => [m.id, m])), S.settings.unit, bwAt), 'text/csv'); render(); },
    expJSON() { shareOrDownload('opengains-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S), 'application/json'); render(); },
    restore(inp) {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result);
          if (!j || !j.v || !Array.isArray(j.exercises) || !Array.isArray(j.sessions)) throw new Error('Not an openGAINS backup');
          const n = j.sessions.length;
          if (!confirm(`Restore ${n} workout${n === 1 ? '' : 's'} from this backup?\n\nEverything currently on this device will be replaced.`)) return;
          S = migrate(j); S.active = null; save(); reindex(); ui.tab = 'train'; render();
          toast('Restored ' + n + ' workout' + (n === 1 ? '' : 's'));
        } catch (e) { alert('Restore failed: ' + e.message); }
      };
      rd.readAsText(f);
    },
    setting(k, v) { S.settings[k] = v; save(); render(); },
    openS(id) { ui.openSess = ui.openSess === id ? null : id; render(); },
    delSess(id) { if (confirm('Delete this workout?')) { S.sessions = S.sessions.filter(s => s.id !== id); save(); render(); } },
    reset() { if (confirm('Erase ALL data on this device? Export first if unsure.') && confirm('Really erase everything?')) { S = fresh(); save(); reindex(); A.startTour(); } },
    // --- tutorial
    startTour() { ui.wiz = null; ui.draft = null; ui.modal = { type: 'tour', i: 0 }; ui.tab = tourSteps()[0].tab; render(); window.scrollTo(0, 0); },
    tourStep(d) {
      if (!ui.modal || ui.modal.type !== 'tour') return;
      const steps = tourSteps(), i = C.clamp((ui.modal.i || 0) + d, 0, steps.length - 1);
      if (i === ui.modal.i) return;
      ui.modal.i = i; ui.tab = steps[i].tab; render(); window.scrollTo(0, 0);
    },
    endTour(cta) { // Skip and finish both count as seen
      S.tutorialSeen = TUTORIAL_V; save(); ui.modal = null;
      if (cta && !activeMeso()) { A.newMeso(); return; }
      ui.tab = 'train'; render(); window.scrollTo(0, 0);
    },
  };

  // iOS keyboard overlays fixed elements instead of resizing them. Track the visible viewport so
  // bottom sheets shrink to the space above the keyboard rather than sliding underneath it.
  const vv = window.visualViewport;
  function fitVV() {
    if (!vv) return; const r = document.documentElement.style;
    r.setProperty('--vvh', vv.height + 'px'); r.setProperty('--vvt', vv.offsetTop + 'px');
  }
  if (vv) { vv.addEventListener('resize', fitVV); vv.addEventListener('scroll', fitVV); fitVV(); }

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (S.active) lock();
  // First open on this device (or after Erase all data) -> tutorial
  if ((+S.tutorialSeen || 0) < TUTORIAL_V && !S.active) { ui.modal = { type: 'tour', i: 0 }; ui.tab = tourSteps()[0].tab; }
  render();
  window.__S = () => S; // debug hook for tests
})();
