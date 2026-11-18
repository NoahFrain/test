/* app.js — UI. State lives in localStorage under KEY. */
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'hypertrophy.v1';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fw = (x) => (x === '' || x == null) ? '' : String(Math.round(x * 100) / 100);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? '' : n; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const PALETTE = ['#4ea1ff', '#ff7a59', '#3ddc97', '#f5c542', '#b58cff', '#ff6fb1', '#2ed3e6', '#a3e635', '#fb923c', '#94a3b8'];

  // ---------- state ----------
  function fresh() {
    return { v: 1, settings: { unit: 'lb', trigger: 'exceed', dropBelow: false, rest: 120 }, exercises: C.seedExercises(), mesos: [], activeMesoId: null, sessions: [], active: null, lastBackup: null };
  }
  function load() {
    try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v) { (j.exercises || []).forEach(e => { if (!e.type) e.type = C.inferType(e.name); }); return j; } } catch (e) { }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('⚠ Could not save — storage full or blocked'); } }
  const ui = { tab: 'train', wiz: null, draft: null, modal: null, scope: 'meso', pf: 'all', pw: null, exSel: '', openSess: null, histAll: false, tipHidden: false };
  let EX = {}; function reindex() { EX = Object.fromEntries(S.exercises.map(e => [e.id, e])); } reindex();
  const activeMeso = () => S.mesos.find(m => m.id === S.activeMesoId && !m.ended) || null;
  const prioOf = (m, muscle) => (m && m.prio && m.prio[muscle]) || 'N';
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }

  // ---------- helpers ----------
  function lastEntry(exId, mesoId) {
    const list = [...S.sessions].sort((a, b) => b.start - a.start); let any = null;
    for (const s of list) {
      const it = s.items.find(i => i.exId === exId && i.sets.some(x => x.done)); if (!it) continue;
      if (s.mesoId === mesoId) return { it, s }; if (!any) any = { it, s };
    }
    return any;
  }
  function lastMeso() { return [...S.mesos].sort((x, y) => y.start - x.start)[0] || null; }
  function lastRanges() {
    const out = {}; const m = lastMeso(); if (!m) return out;
    m.days.forEach(d => d.items.forEach(it => { out[it.exId] = { min: it.min, max: it.max }; }));
    return out;
  }
  function buildItem(m, week, exId, tmpl) {
    const ex = EX[exId], n = C.plannedSets(tmpl.sets, prioOf(m, ex.muscle), week, m);
    const prev = lastEntry(exId, m.id);
    const sg = C.suggest({ min: tmpl.min, max: tmpl.max }, prev && prev.it.sets, { n, rir: 2, deload: C.isDeload(m, week), trigger: S.settings.trigger, dropBelow: S.settings.dropBelow, inc: ex.inc });
    return { exId, min: tmpl.min, max: tmpl.max, mode: sg.mode, from: sg.from, to: sg.to, base: tmpl.sets, note: '',
      prev: prev ? prev.it.sets.filter(x => x.done).map(x => fw(x.w) + '×' + x.r + (Number.isFinite(x.rir) ? ' (' + x.rir + ')' : '')).join(', ') : '',
      sets: sg.sets.map(s => ({ w: s.w, r: s.r, rir: '', done: false })) };
  }
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
  function startTimer(sec) { timerEnd = Date.now() + sec * 1000; clearInterval(timerIv); timerIv = setInterval(tickTimer, 250); tickTimer(); }
  function stopTimer() { clearInterval(timerIv); timerEnd = 0; $('#timer').innerHTML = ''; }
  function tickTimer() {
    const left = Math.ceil((timerEnd - Date.now()) / 1000), el = $('#timer');
    if (!timerEnd) return;
    const mm = Math.floor(Math.abs(left) / 60), ss = String(Math.abs(left) % 60).padStart(2, '0');
    el.innerHTML = `<div class="timer ${left <= 0 ? 'zero' : ''}"><span class="mut sm">Rest</span><b>${left < 0 ? '+' : ''}${mm}:${ss}</b><span class="sp"></span><button class="sm" onclick="A.tAdd(30)">+30s</button><button class="sm" onclick="A.tStop()">✕</button></div>`;
    if (left < -60) stopTimer();
  }
  async function lock() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active) lock(); });

  // ---------- charts ----------
  function lineChart(series, o) {
    o = o || {}; const W = 340, H = 190, L = 36, R = 8, T = 8, B = 22;
    const pts = series.flatMap(s => s.pts); if (!pts.length) return '<div class="mut sm" style="padding:20px 0;text-align:center">No data yet</div>';
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    if (x1 === x0) { x0 -= 0.5; x1 += 0.5; } const pad = Math.max((y1 - y0) * 0.12, y1 * 0.01 || 1); y0 -= pad; y1 += pad;
    const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#262e38" stroke-width="1"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${(o.yFmt || (v => Math.round(v)))(v)}</text>`; }
    const xs = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b); const step = Math.ceil(xs.length / 6);
    xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) g += `<text x="${X(x)}" y="${H - 6}" text-anchor="middle">${o.xLab ? o.xLab(x) : x}</text>`; });
    series.forEach(s => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>` + s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('');
    });
    const leg = series.length > 1 ? `<div class="chips" style="margin-top:6px">${series.map(s => `<span class="chip"><i style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${s.color};margin-right:5px"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>${leg}`;
  }

  // ---------- views ----------
  function viewTrain() {
    if (S.active) return viewSession();
    const m = activeMeso();
    let h = '<h1>Train</h1>';
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !ui.tipHidden) h += `<div class="card sm"><b>Install it:</b> tap Share → <b>Add to Home Screen</b>. Opens full-screen and works offline. <button class="sm ghost" onclick="ui_hideTip()">Dismiss</button></div>`;
    const old = !S.lastBackup || Date.now() - S.lastBackup > 14 * 864e5;
    if (S.sessions.length >= 3 && old) h += `<div class="card sm">No backup in 14+ days. <a href="#" onclick="A.go('data');return false">Export now →</a></div>`;
    if (!m) return h + `<div class="card"><p>No active mesocycle.</p><button class="pri" onclick="A.newMeso()">Create mesocycle</button> <button onclick="A.go('data')">Import Strong CSV</button></div>`;
    const dl = C.isDeload(m, m.week);
    const wkSessions = S.sessions.filter(s => s.mesoId === m.id && s.week === m.week);
    const doneDays = new Set(wkSessions.map(s => s.dayId));
    h += `<div class="card"><div class="row"><b class="sp">${esc(m.name)}</b><span class="chip ${dl ? '' : 'sel'}">${dl ? 'Deload' : 'Week ' + m.week + '/' + m.weeks}</span></div>
      <div class="prog" style="margin:10px 0"><i style="width:${Math.round(doneDays.size / m.days.length * 100)}%"></i></div>
      <div class="mut sm">${doneDays.size}/${m.days.length} sessions this week${dl ? ' · deload, ~half volume' : ''}</div></div>`;
    m.days.forEach(d => {
      const done = doneDays.has(d.id), sets = d.items.reduce((a, it) => a + C.plannedSets(it.sets, prioOf(m, EX[it.exId] && EX[it.exId].muscle), m.week, m), 0);
      h += `<div class="card row"><div class="sp"><b>${esc(d.name)}</b><div class="mut sm">${d.items.length} exercises · ${sets} sets</div></div>${done ? '<span class="chip" style="color:var(--ok)">✓ done</span>' : ''}<button class="${done ? '' : 'pri'}" onclick="A.start('${d.id}')">${done ? 'Redo' : 'Start'}</button></div>`;
    });
    if (doneDays.size >= m.days.length) h += m.week < m.weeks ? `<button class="pri" style="width:100%" onclick="A.nextWeek()">Advance to week ${m.week + 1} →</button>` : `<button class="pri" style="width:100%" onclick="A.endMeso()">Mesocycle complete — archive it</button>`;
    else if (m.week < m.weeks) h += `<button class="ghost" style="width:100%" onclick="A.nextWeek()">Skip to week ${m.week + 1}</button>`;
    return h;
  }

  function viewSession() {
    const a = S.active, m = S.mesos.find(x => x.id === a.mesoId);
    const dl = m && C.isDeload(m, a.week);
    let h = `<div class="row"><h1 class="sp">${esc(a.name)}</h1><button class="sm ghost bad" onclick="A.discard()">Discard</button></div><div class="mut sm" style="margin:-6px 2px 10px">Week ${a.week}${dl ? ' · Deload' : ''} · ${tstr(a.start)}</div>`;
    a.items.forEach((it, i) => {
      const ex = EX[it.exId]; if (!ex) return;
      const badge = { new: '<span class="badge hd">New — enter weight</span>', up: `<span class="badge up">↑ ${fw(it.from)} → ${fw(it.to)} · last set exceeded range</span>`, hold: '<span class="badge hd">Beat last time</span>', down: `<span class="badge dn">↓ ${fw(it.from)} → ${fw(it.to)}</span>`, deload: '<span class="badge dl">Deload</span>' }[it.mode] || '';
      h += `<div class="card"><div class="row"><b class="sp">${esc(ex.name)}</b><span class="chip">${esc(ex.muscle)}</span><span class="chip">${esc(ex.type || 'Other')}</span><button class="sm ghost" onclick="A.swap(${i})">⇄</button></div>
        <div class="row sm mut" style="margin:4px 0 8px;flex-wrap:wrap"><span>${it.min}–${it.max} reps</span>${badge}</div>
        ${it.prev ? `<div class="xs mut" style="margin-bottom:6px">Last: ${esc(it.prev)}</div>` : ''}
        <div class="lbl"><span>#</span><span>${S.settings.unit}</span><span>reps</span><span>RIR</span><span></span></div>`;
      it.sets.forEach((s, j) => {
        h += `<div class="setrow ${s.done ? 'done' : ''}"><span class="n">${j + 1}</span>
          <input id="w_${i}_${j}" type="number" inputmode="decimal" step="any" value="${fw(s.w)}" placeholder="0" oninput="A.sv(${i},${j},'w',this.value)">
          <input id="r_${i}_${j}" type="number" inputmode="numeric" value="${s.r === '' ? '' : s.r}" oninput="A.sv(${i},${j},'r',this.value)">
          <input id="i_${i}_${j}" type="number" inputmode="numeric" min="0" max="10" value="${s.rir === '' || s.rir == null ? '' : s.rir}" placeholder="–" oninput="A.sv(${i},${j},'rir',this.value)">
          <button class="chk" onclick="A.chk(${i},${j})">${s.done ? '✓' : '○'}</button></div>`;
      });
      h += `<div class="row" style="margin-top:6px"><button class="sm" onclick="A.addSet(${i})">+ Set</button><button class="sm" onclick="A.rmSet(${i})">− Set</button><input style="min-height:34px;padding:5px 8px;font-size:14px" placeholder="Note" value="${esc(it.note)}" oninput="A.note(${i},this.value)"></div></div>`;
    });
    h += `<textarea rows="2" placeholder="Workout notes" oninput="A.wnote(this.value)">${esc(a.note || '')}</textarea><div style="height:10px"></div><button class="ok" style="width:100%" onclick="A.finish()">Finish workout</button>`;
    return h;
  }

  // --- mesocycle tab
  function viewMeso() {
    if (ui.wiz) return viewWiz();
    if (ui.draft) return viewDraft();
    const m = activeMeso();
    let h = '<h1>Mesocycle</h1>';
    if (!m) h += `<div class="card"><p>No active mesocycle.</p></div>`;
    else {
      h += `<div class="card"><div class="row"><b class="sp">${esc(m.name)}</b><span class="chip sel">Week ${m.week}/${m.weeks}</span></div>
        <div class="mut sm" style="margin:6px 0">Started ${dstr(m.start)} ${m.deload ? ' · deload last week' : ''}</div>
        <div class="chips">${[...new Set(m.days.flatMap(d => d.items.map(i => EX[i.exId] && EX[i.exId].muscle)))].filter(Boolean).map(mu => `<span class="chip ${prioOf(m, mu)}">${esc(mu)} · ${{ P: 'priority', N: 'normal', M: 'maintain' }[prioOf(m, mu)]}</span>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="sm" onclick="A.editMeso()">Edit</button><button class="sm" onclick="A.nextWeek()">Next week</button><button class="sm bad" onclick="A.endMeso()">End</button></div></div>`;
      m.days.forEach(d => { h += `<div class="card"><b>${esc(d.name)}</b>${d.items.map(it => `<div class="row sm" style="padding:4px 0"><span class="sp">${esc(EX[it.exId] ? EX[it.exId].name : '?')}</span><span class="mut">${it.sets}×${it.min}–${it.max}</span></div>`).join('')}</div>`; });
    }
    h += `<button class="pri" style="width:100%;margin-top:6px" onclick="A.newMeso()">+ New mesocycle</button>`;
    const old = S.mesos.filter(x => x.ended);
    if (old.length) { h += '<h2>Archived</h2>'; old.slice().reverse().forEach(x => { h += `<div class="card sm row"><span class="sp">${esc(x.name)}</span><span class="mut">${dstr(x.start)} · ${S.sessions.filter(s => s.mesoId === x.id).length} sessions</span></div>`; }); }
    return h;
  }

  function viewDraft() {
    const d = ui.draft, muscles = [...new Set(d.days.flatMap(x => x.items.map(i => EX[i.exId] && EX[i.exId].muscle)))].filter(Boolean);
    const vol = C.planVolume(d.days, EX);
    let h = (d.fromWiz && !d.editing ? `<div class="row" style="margin:4px 2px 2px"><button class="sm ghost" onclick="A.wizStep('${d.fromWiz === 'freestyle' ? 'free' : 'split'}')">‹ Back</button><span class="sp"></span><span class="mut xs">Step 4 of 4</span></div>` : '')
      + `<h1>${d.editing ? 'Edit' : d.fromWiz ? 'Exercises' : 'New mesocycle'}</h1>`;
    h += `
    <div class="card"><input value="${esc(d.name)}" placeholder="Name" oninput="ui_d('name',this.value)">
      <div class="g2" style="margin-top:8px"><label class="xs mut">Weeks<select onchange="ui_d('weeks',+this.value)">${[3, 4, 5, 6, 7, 8].map(n => `<option ${n === d.weeks ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="xs mut">Deload last<br><input type="checkbox" ${d.deload ? 'checked' : ''} onchange="ui_d('deload',this.checked)"></label></div></div>`;
    if (!d.editing && !d.fromWiz) h += `<div class="card"><label class="xs mut">Load template<select onchange="A.tmpl(this.value);this.selectedIndex=0"><option value="">Choose…</option>${Object.keys(C.TEMPLATES).map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div>`;
    h += '<h2>Weekly sets</h2>';
    h += muscles.length ? `<div class="card">${muscles.slice().sort((x, y) => C.DAY_ORDER.indexOf(x) - C.DAY_ORDER.indexOf(y)).map(mu => {
      const p = d.prio[mu] || 'N', t = C.weeklyTarget(mu, p), v = vol[mu] || 0, off = v - t;
      return `<div class="row" style="padding:5px 0"><span class="sp sm">${esc(mu)}</span>
        <span class="sm" style="width:64px;text-align:right;color:${Math.abs(off) <= 2 ? 'var(--mut)' : off < 0 ? 'var(--warn)' : 'var(--acc)'}">${v} / ${t}</span>
        <button class="chip ${p}" style="min-height:30px;width:86px" onclick="A.cyc('${esc(mu)}')">${{ P: 'Priority', N: 'Normal', M: 'Maintain' }[p]}</button></div>`;
    }).join('')}<div class="xs mut" style="margin-top:8px">Sets in this plan vs. the weekly target for that priority. Amber means the day layout caps that muscle — spread it over another day to reach the target. Set counts stay flat all meso; progression comes from reps and weight. Deload ≈ half sets.</div></div>` : '<div class="card mut sm">Add exercises first.</div>';
    h += '<h2>Days</h2>';
    d.days.forEach((day, di) => {
      h += `<div class="card"><div class="row"><input value="${esc(day.name)}" oninput="ui_day(${di},this.value)"><button class="sm" onclick="A.dupDay(${di})">⧉</button><button class="sm bad" onclick="A.delDay(${di})">✕</button></div>`;
      day.items.forEach((it, ii) => {
        const ex = EX[it.exId];
        h += `<div style="padding:8px 0;border-top:1px solid var(--line);margin-top:8px"><div class="row"><b class="sp sm">${esc(ex ? ex.name : '?')}</b><span class="chip">${esc(ex ? ex.muscle : '')}</span><span class="chip">${esc(ex ? ex.type || 'Other' : '')}</span><button class="sm ghost" onclick="A.swapD(${di},${ii})">⇄</button><button class="sm ghost" onclick="A.up(${di},${ii})">↑</button><button class="sm ghost bad" onclick="A.delItem(${di},${ii})">✕</button></div>
          <div class="g3" style="margin-top:6px"><label class="xs mut">Sets<input type="number" inputmode="numeric" value="${it.sets}" oninput="A.it(${di},${ii},'sets',this.value)"></label><label class="xs mut">Min reps<input type="number" inputmode="numeric" value="${it.min}" oninput="A.it(${di},${ii},'min',this.value)"></label><label class="xs mut">Max reps<input type="number" inputmode="numeric" value="${it.max}" oninput="A.it(${di},${ii},'max',this.value)"></label></div></div>`;
      });
      h += `<button class="sm" style="margin-top:8px" onclick="A.addEx(${di})">+ Exercise</button></div>`;
    });
    h += `<button onclick="A.addDay()" style="width:100%">+ Add day</button><div class="g2" style="margin-top:12px"><button onclick="A.cancelDraft()">Cancel</button><button class="pri" onclick="A.saveDraft()">${d.editing ? 'Save changes' : 'Start mesocycle'}</button></div>`;
    return h;
  }


  // ---------- new mesocycle wizard ----------
  const SPLITS = { full: 'Full Body', 'upper-lower': 'Upper / Lower', freestyle: 'Freestyle' };
  function wizHead(title, sub, back) {
    return `<div class="row" style="margin:4px 2px 2px"><button class="sm ghost" onclick="A.wizStep('${back}')">‹ Back</button><span class="sp"></span><span class="mut xs">${esc(sub)}</span></div><h1>${esc(title)}</h1>`;
  }
  function viewWiz() {
    const w = ui.wiz;
    if (w.step === 'mode') return `<h1>New mesocycle</h1>
      <div class="card" onclick="A.wizMode('guided')"><div class="row"><div class="sp"><b>Guided setup</b><div class="mut sm">Days → priorities → split type. Builds the plan and set counts for you, then you adjust the exercises.</div></div><span class="mut">›</span></div></div>
      <div class="card" onclick="A.wizMode('custom')"><div class="row"><div class="sp"><b>Custom</b><div class="mut sm">Go straight to the exercise builder and add days and exercises yourself.</div></div><span class="mut">›</span></div></div>
      <button class="ghost" style="width:100%" onclick="A.cancelDraft()">Cancel</button>`;

    if (w.step === 'days') return wizHead('How many days a week?', 'Step 1 of 4', 'mode')
      + `<div class="card"><div class="chips">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="chip ${w.days === n ? 'sel' : ''}" style="min-height:52px;min-width:52px;font-size:17px" onclick="A.wizDays(${n})">${n}</button>`).join('')}</div>
      <div class="xs mut" style="margin-top:10px">Training days per week. You can rename or reorder them later.</div></div>
      <button class="pri" style="width:100%" onclick="A.wizStep('prio')">Next: priorities ›</button>`;

    if (w.step === 'prio') {
      const rows = C.DAY_ORDER.map(mu => {
        const p = w.prio[mu] || 'N', v = C.VOL[mu];
        return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="sp sm">${esc(mu)}</span>
          <span class="mut xs" style="width:52px;text-align:right">${C.weeklyTarget(mu, p)} sets</span>
          <button class="chip ${p}" style="min-height:34px;width:96px" onclick="A.wizPrio('${esc(mu)}')">${{ P: 'Priority', N: 'Normal', M: 'Maintain' }[p]}</button></div>`;
      }).join('');
      return wizHead('Muscle priority', 'Step 2 of 4', 'days')
        + `<div class="card">${rows}<div class="xs mut" style="margin-top:10px">Sets a week per muscle. Maintain holds near minimum effective volume, Normal sits between that and the productive range, Priority pushes to the top of it. Set counts stay flat all meso — progression comes from reps and weight.</div></div>`
        + `<button class="pri" style="width:100%" onclick="A.wizStep('split')">Next: split type ›</button>`;
    }

    if (w.step === 'split') return wizHead('Split type', 'Step 3 of 4', 'prio')
      + `<div class="card" onclick="A.wizSplit('full')"><div class="row"><div class="sp"><b>Full Body</b><div class="mut sm">Upper and lower every session, volume spread across your ${w.days} days in clusters of like movements.</div></div><span class="mut">›</span></div></div>
      <div class="card" onclick="A.wizSplit('upper-lower')"><div class="row"><div class="sp"><b>Upper / Lower</b><div class="mut sm">${w.days % 2 ? `${Math.ceil(w.days / 2)} upper, ${w.days - Math.ceil(w.days / 2)} lower — odd day goes to upper.` : `${w.days / 2} upper, ${w.days / 2} lower.`}</div></div><span class="mut">›</span></div></div>
      <div class="card" onclick="A.wizSplit('freestyle')"><div class="row"><div class="sp"><b>Freestyle</b><div class="mut sm">Pick which muscle groups you train on each day.</div></div><span class="mut">›</span></div></div>`;

    if (w.step === 'free') {
      const rows = w.free.map((day, di) => `<div class="card"><div class="row"><b class="sp">Day ${di + 1}</b><span class="mut xs">${day.filter(Boolean).length} groups</span></div>
        ${day.map((mu, si) => `<div class="row" style="margin-top:6px"><select onchange="A.freeSet(${di},${si},this.value)"><option value="">— none —</option>${C.DAY_ORDER.map(x => `<option ${x === mu ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>${day.length > 1 ? `<button class="sm ghost bad" onclick="A.freeDel(${di},${si})">✕</button>` : ''}</div>`).join('')}
        ${day.length < 5 ? `<button class="sm" style="margin-top:8px" onclick="A.freeAdd(${di})">+ Muscle group</button>` : '<div class="xs mut" style="margin-top:8px">Max 5 per day</div>'}</div>`).join('');
      const empty = w.free.some(d => !d.filter(Boolean).length);
      return wizHead('Pick muscle groups per day', 'Step 3 of 4', 'split') + rows
        + (empty ? '<div class="card sm" style="color:var(--warn)">Every day needs at least one muscle group.</div>' : '')
        + `<button class="pri" style="width:100%${empty ? ';opacity:.45' : ''}" ${empty ? 'disabled' : ''} onclick="A.wizGen()">Done — build the plan ›</button>`;
    }
    return '';
  }

  // --- progress tab
  function viewProg() {
    const m = activeMeso();
    let h = '<h1>Progress</h1>';
    const scope = m ? ui.scope : 'all';
    const sess = scope === 'meso' ? S.sessions.filter(s => s.mesoId === m.id) : S.sessions;
    if (m) h += `<div class="seg"><button class="${scope === 'meso' ? 'on' : ''}" onclick="ui_set('scope','meso')">This meso</button><button class="${scope === 'all' ? 'on' : ''}" onclick="ui_set('scope','all')">All time</button></div>`;
    h += `<div class="seg">${[['all', 'All'], ['P', 'Priority'], ['N', 'Normal'], ['M', 'Maintain']].map(([k, l]) => `<button class="${ui.pf === k ? 'on' : ''}" onclick="ui_set('pf','${k}')">${l}</button>`).join('')}</div>`;
    if (!sess.length) return h + '<div class="card mut">Log a workout to see progress. Import a Strong CSV to backfill history.</div>';
    const t0 = scope === 'meso' ? Math.min(m.start, ...sess.map(s => s.start)) : Math.min(...sess.map(s => s.start));
    const have = [...C.MUSCLES, 'Other'].filter(mu => S.exercises.some(e => e.muscle === mu && sess.some(s => s.items.some(i => i.exId === e.id))));
    const muscles = have.filter(mu => ui.pf === 'all' || (m && prioOf(m, mu) === ui.pf));
    // chart: strength index
    const series = muscles.map((mu, i) => ({ name: mu, color: PALETTE[i % PALETTE.length], pts: C.muscleIndex(sess, S.exercises, mu, t0) })).filter(s => s.pts.length);
    h += `<h2>Strength index by muscle <span class="xs" style="text-transform:none">(est. 1RM, first session = 100)</span></h2><div class="card">${lineChart(series, { yFmt: v => Math.round(v), xLab: x => scope === 'meso' ? 'W' + (x + 1) : dstr(t0 + x * C.WEEK) })}</div>`;
    // weekly sets
    if (m) {
      const wk = ui.pw || m.week;
      const done = C.hardSetsByMuscle(S.sessions, EX, s => s.mesoId === m.id && s.week === wk);
      const tgt = {}; m.days.forEach(d => d.items.forEach(it => { const mu = EX[it.exId] && EX[it.exId].muscle; if (mu) tgt[mu] = (tgt[mu] || 0) + C.plannedSets(it.sets, prioOf(m, mu), wk, m); }));
      const ms = Object.keys(tgt).filter(mu => ui.pf === 'all' || prioOf(m, mu) === ui.pf).sort((a, b) => C.MUSCLES.indexOf(a) - C.MUSCLES.indexOf(b));
      h += `<h2>Sets this week</h2><div class="card"><div class="row" style="margin-bottom:8px"><button class="sm" onclick="ui_pw(-1)">‹</button><b class="sp" style="text-align:center">Week ${wk}${C.isDeload(m, wk) ? ' · deload' : ''}</b><button class="sm" onclick="ui_pw(1)">›</button></div>`;
      ms.forEach(mu => { const d = done[mu] || 0, t = tgt[mu]; h += `<div class="row" style="padding:5px 0"><span style="width:92px" class="sm">${esc(mu)}</span><span class="chip ${prioOf(m, mu)}" style="width:20px;text-align:center;padding:2px 0">${prioOf(m, mu)}</span><div class="bar sp"><i style="width:${Math.min(100, d / t * 100)}%;background:${d >= t ? 'var(--ok)' : 'var(--acc)'}"></i></div><span class="sm" style="width:44px;text-align:right">${d}/${t}</span></div>`; });
      h += '</div>';
    }
    // table
    h += '<h2>Muscle summary</h2><div class="card"><table><tr><th>Muscle</th><th></th><th>Index</th><th>Status</th></tr>';
    muscles.forEach(mu => {
      const pts = C.muscleIndex(sess, S.exercises, mu, t0); if (!pts.length) return;
      const ch = pts[pts.length - 1].y - 100;
      const exs = S.exercises.filter(e => e.muscle === mu).map(e => C.exerciseSeries(sess, e.id)).filter(a => a.length);
      const st = exs.filter(C.stalled).length;
      h += `<tr><td>${esc(mu)}</td><td><span class="chip ${m ? prioOf(m, mu) : ''}">${m ? prioOf(m, mu) : ''}</span></td><td style="color:${ch >= 0 ? 'var(--ok)' : 'var(--bad)'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%</td><td class="sm ${st ? '' : 'mut'}">${st ? '⚠ ' + st + ' stalled' : exs.length + (exs.length===1?' lift':' lifts')}</td></tr>`;
    });
    h += '</table></div>';
    // exercise detail
    const exWith = S.exercises.filter(e => C.exerciseSeries(sess, e.id).length).sort((a, b) => a.name.localeCompare(b.name));
    const sel = ui.exSel && exWith.find(e => e.id === ui.exSel) ? ui.exSel : (exWith[0] && exWith[0].id);
    if (sel) {
      const ser = C.exerciseSeries(sess, sel);
      h += `<h2>Exercise</h2><div class="card"><select onchange="ui_set('exSel',this.value)">${exWith.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select><div style="height:8px"></div>`
        + lineChart([{ name: 'e1RM', color: PALETTE[0], pts: ser.map((p, i) => ({ x: i, y: p.e1 })) }], { xLab: x => dstr(ser[x] ? ser[x].t : 0), yFmt: v => Math.round(v) });
      const rows = sess.filter(s => s.items.some(i => i.exId === sel)).sort((a, b) => b.start - a.start).slice(0, 6);
      h += '<table style="margin-top:8px">' + rows.map(s => `<tr><td class="mut sm">${dstr(s.start)}</td><td class="sm">${s.items.filter(i => i.exId === sel).flatMap(i => i.sets.filter(x => x.done).map(x => fw(x.w) + '×' + x.r)).join(' · ')}</td></tr>`).join('') + '</table></div>';
    }
    return h;
  }

  // --- data tab
  function viewData() {
    let h = '<h1>Data</h1>';
    h += `<div class="card"><b>Export / backup</b><div class="mut sm" style="margin:4px 0 10px">${S.sessions.length} workouts logged${S.lastBackup ? ' · last export ' + dstr(S.lastBackup) : ''}</div>
      <div class="g2"><button class="pri" onclick="A.expCSV()">Strong CSV</button><button onclick="A.expJSON()">Full backup (JSON)</button></div>
      <div class="g2" style="margin-top:8px"><label class="btn" style="text-align:center">Import CSV / JSON<input type="file" accept=".csv,.json,text/csv,application/json" style="display:none" onchange="A.imp(this)"></label><span class="xs mut" style="align-self:center">CSV merges history; JSON replaces everything.</span></div></div>`;
    h += `<h2>Settings</h2><div class="card">
      <div class="g2"><label class="xs mut">Unit<select onchange="A.setting('unit',this.value)"><option ${S.settings.unit === 'lb' ? 'selected' : ''}>lb</option><option ${S.settings.unit === 'kg' ? 'selected' : ''}>kg</option></select></label>
      <label class="xs mut">Rest timer (s)<input type="number" inputmode="numeric" value="${S.settings.rest}" onchange="A.setting('rest',+this.value||0)"></label></div>
      <label class="xs mut" style="display:block;margin-top:8px">Weight goes up when last set…<select onchange="A.setting('trigger',this.value)"><option value="exceed" ${S.settings.trigger === 'exceed' ? 'selected' : ''}>exceeds max reps (e.g. 13 on 8–12)</option><option value="hit" ${S.settings.trigger === 'hit' ? 'selected' : ''}>reaches max reps (12 on 8–12)</option></select></label>
      <label class="row" style="margin-top:10px"><input type="checkbox" ${S.settings.dropBelow ? 'checked' : ''} onchange="A.setting('dropBelow',this.checked)"><span class="sm">Drop one increment if last set falls below min reps</span></label></div>`;
    h += `<h2>History</h2>`;
    const list = [...S.sessions].sort((a, b) => b.start - a.start); const shown = ui.histAll ? list : list.slice(0, 15);
    h += '<div class="card" style="padding:4px 12px">' + (shown.map(s => {
      const open = ui.openSess === s.id, n = s.items.reduce((a, i) => a + i.sets.filter(x => x.done).length, 0);
      return `<div class="li" style="display:block"><div class="row" onclick="A.openS('${s.id}')"><div class="sp"><b>${esc(s.name)}</b><div class="mut xs">${dstr(s.start)}${s.week ? ' · W' + s.week : ''} · ${n} sets</div></div><span class="mut">${open ? '▾' : '▸'}</span></div>
        ${open ? s.items.map(i => `<div class="sm" style="margin-top:6px"><b>${esc(EX[i.exId] ? EX[i.exId].name : '?')}</b><div class="mut">${i.sets.filter(x => x.done).map(x => fw(x.w) + '×' + x.r).join(' · ')}</div></div>`).join('') + `<button class="sm bad" style="margin-top:8px" onclick="A.delSess('${s.id}')">Delete workout</button>` : ''}</div>`;
    }).join('') || '<div class="mut sm" style="padding:10px 0">Nothing yet.</div>') + '</div>';
    if (list.length > 15 && !ui.histAll) h += `<button class="ghost" style="width:100%" onclick="ui_set('histAll',true)">Show all ${list.length}</button>`;
    h += `<h2>Exercise library</h2><div class="card"><button class="sm" onclick="A.exEdit(null)">+ New exercise</button><div style="margin-top:6px">${[...C.MUSCLES, 'Other'].map(mu => { const l = S.exercises.filter(e => e.muscle === mu); return l.length ? `<div class="xs mut" style="margin-top:10px;text-transform:uppercase">${mu}</div>` + l.map(e => `<div class="li" onclick="A.exEdit('${e.id}')"><span class="sp sm">${esc(e.name)}</span><span class="mut xs">${esc(e.type || 'Other')} · ${e.min}–${e.max} · +${e.inc}</span></div>`).join('') : ''; }).join('')}</div></div>`;
    h += `<div style="height:10px"></div><button class="bad ghost" onclick="A.reset()">Erase all data</button>`;
    return h;
  }

  // --- modals
  function modalHTML() {
    const q = ui.modal;
    if (q.type === 'pick') {
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><div class="row"><input id="pq" placeholder="Search exercises" value="${esc(q.q)}" oninput="A.pq(this.value)" style="flex:1"><button onclick="A.exEdit(null,true)">＋</button></div>
        <div class="chips" style="margin:8px 0">${C.MUSCLES.map(mu => `<button class="chip ${q.muscle === mu ? 'sel' : ''}" style="min-height:30px" onclick="A.pm('${mu}')">${mu}</button>`).join('')}</div><div class="chips" style="margin-bottom:8px">${C.TYPES.map(t => `<button class="chip ${q.tf === t ? 'sel' : ''}" style="min-height:30px" onclick="A.pt('${t}')">${t}</button>`).join('')}</div><div id="pl">${pickList()}</div></div></div>`;
    }
    if (q.type === 'ex') {
      const e = q.ex;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet"><h1>${q.id ? 'Edit' : 'New'} exercise</h1>
        <input id="e_name" value="${esc(e.name)}" placeholder="Name e.g. Cable Row (Cable)">
        <label class="xs mut">Muscle<select id="e_mu">${[...C.MUSCLES, 'Other'].map(mu => `<option ${mu === e.muscle ? 'selected' : ''}>${mu}</option>`).join('')}</select></label>
        <label class="xs mut">Type<select id="e_type">${C.TYPES.map(t => `<option ${t === (e.type || 'Other') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="g3"><label class="xs mut">Min reps<input id="e_min" type="number" value="${e.min}"></label><label class="xs mut">Max reps<input id="e_max" type="number" value="${e.max}"></label><label class="xs mut">Weight step<input id="e_inc" type="number" step="any" value="${e.inc}"></label></div>
        <div class="g2" style="margin-top:12px">${q.id ? '<button class="bad" onclick="A.exDel()">Delete</button>' : '<button onclick="A.closeModal()">Cancel</button>'}<button class="pri" onclick="A.exSave()">Save</button></div></div></div>`;
    }
    return '';
  }
  function pickList() {
    const q = ui.modal, s = (q.q || '').toLowerCase();
    return S.exercises.filter(e => (!q.muscle || e.muscle === q.muscle) && (!q.tf || (e.type || 'Other') === q.tf) && e.name.toLowerCase().includes(s)).map(e => `<div class="li" onclick="A.pick('${e.id}')"><span class="sp">${esc(e.name)}</span><span class="chip">${esc(e.type || 'Other')}</span><span class="chip">${esc(e.muscle)}</span></div>`).join('') || '<div class="mut" style="padding:12px">No match — tap ＋ to create it.</div>';
  }

  // ---------- render ----------
  const TABS = [['train', '🏋️', 'Train'], ['meso', '📋', 'Meso'], ['prog', '📈', 'Progress'], ['data', '🗂️', 'Data']];
  function render() {
    const y = window.scrollY; reindex();
    const v = { train: viewTrain, meso: viewMeso, prog: viewProg, data: viewData }[ui.tab]();
    $('#app').innerHTML = v + (ui.modal ? modalHTML() : '');
    $('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" onclick="A.go('${k}')"><span>${i}</span>${l}</button>`).join('');
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
      S.active = { id: C.uid(), mesoId: m.id, week: m.week, dayId, name: d.name, start: Date.now(), note: '', items: d.items.filter(it => EX[it.exId]).map(it => buildItem(m, m.week, it.exId, it)) };
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
        if (s.w === '') s.w = 0; if (s.r === '') s.r = 0;
        if (S.settings.rest > 0) startTimer(S.settings.rest);
        const last = it.sets.filter(x => x.done).length === it.sets.length || j === it.sets.length - 1;
        if (last && j === it.sets.length - 1 && !C.isDeload(S.mesos.find(m => m.id === S.active.mesoId), S.active.week)) {
          const exceeded = S.settings.trigger === 'hit' ? s.r >= it.max : s.r > it.max;
          if (exceeded) toast('↑ Weight goes up next session');
        }
      }
      save(); render();
    },
    addSet(i) { const it = S.active.items[i], l = it.sets[it.sets.length - 1] || { w: '', r: it.min }; it.sets.push({ w: l.w, r: l.r, rir: '', done: false }); save(); render(); },
    rmSet(i) { const it = S.active.items[i]; if (it.sets.length > 1 && !it.sets[it.sets.length - 1].done) it.sets.pop(); save(); render(); },
    note(i, v) { S.active.items[i].note = v; save(); }, wnote(v) { S.active.note = v; save(); },
    swap(i) { ui.modal = { type: 'pick', mode: 'swap', i, q: '', muscle: EX[S.active.items[i].exId].muscle }; render(); },
    finish() {
      const a = S.active, n = a.items.reduce((c, it) => c + it.sets.filter(s => s.done).length, 0);
      if (!n) { if (confirm('No completed sets. Discard this workout?')) A.discard(true); return; }
      const open = a.items.some(it => it.sets.some(s => !s.done)); if (open && !confirm('Some sets are unchecked and will be dropped. Finish?')) return;
      a.items.forEach(it => { it.sets = it.sets.filter(s => s.done); });
      a.items = a.items.filter(it => it.sets.length); a.end = Date.now();
      S.sessions.push(a); S.active = null; stopTimer(); try { wake && wake.release(); } catch (e) { }
      save(); toast('Workout saved'); render(); window.scrollTo(0, 0);
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
    wizGen() {
      const w = ui.wiz, prev = lastMeso();
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
      const d = ui.draft; if (!d.days.some(x => x.items.length)) { toast('Add at least one exercise'); return; }
      d.days = d.days.filter(x => x.items.length);
      const bad = d.days.flatMap(x => x.items).find(i => i.min > i.max); if (bad) { toast('Min reps must be ≤ max reps'); return; }
      const wasEditing = d.editing; delete d.editing; delete d.fromWiz;
      if (wasEditing) { const k = S.mesos.findIndex(m => m.id === d.id); S.mesos[k] = d; if (d.week > d.weeks) d.week = d.weeks; }
      else { const old = activeMeso(); if (old) old.ended = Date.now(); d.start = Date.now(); S.mesos.push(d); S.activeMesoId = d.id; }
      ui.draft = null; ui.tab = wasEditing ? 'meso' : 'train'; save(); render(); window.scrollTo(0, 0);
    },
    // --- picker / exercise editor
    pq(v) { ui.modal.q = v; $('#pl').innerHTML = pickList(); },
    pm(mu) { const q = $('#pq').value; ui.modal.muscle = ui.modal.muscle === mu ? '' : mu; ui.modal.q = q; render(); },
    pt(t) { const q = $('#pq').value; ui.modal.tf = ui.modal.tf === t ? '' : t; ui.modal.q = q; render(); },
    swapD(di, ii) { ui.modal = { type: 'pick', mode: 'dswap', di, ii, q: '', muscle: EX[ui.draft.days[di].items[ii].exId].muscle }; render(); },
    pick(exId) {
      const q = ui.modal, ex = EX[exId];
      if (q.mode === 'add') ui.draft.days[q.di].items.push({ exId, sets: 3, min: ex.min, max: ex.max });
      else if (q.mode === 'dswap') ui.draft.days[q.di].items[q.ii].exId = exId; // keeps sets + rep range you set
      else {
        const a = S.active, m = S.mesos.find(x => x.id === a.mesoId), old = a.items[q.i], oldId = old.exId;
        if (oldId !== exId) {
          a.items[q.i] = buildItem(m, a.week, exId, { sets: old.base || old.sets.length, min: old.min, max: old.max });
          const day = m.days.find(d => d.id === a.dayId), t = day && day.items.find(i => i.exId === oldId);
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
      const q = ui.modal, e = { name: $('#e_name').value.trim(), muscle: $('#e_mu').value, type: $('#e_type').value, min: +$('#e_min').value || 1, max: +$('#e_max').value || 1, inc: +$('#e_inc').value || 5 };
      if (!e.name) { toast('Name required'); return; } if (e.min > e.max) { toast('Min reps must be ≤ max'); return; }
      if (q.id) Object.assign(EX[q.id], e); else S.exercises.push(Object.assign(e, { id: 'u' + C.uid() }));
      save(); reindex(); ui.modal = q.back || null; if (q.back) q.back.q = e.name; render();
    },
    exDel() {
      const id = ui.modal.id; if (S.sessions.some(s => s.items.some(i => i.exId === id)) && !confirm('This exercise has logged history. Delete it anyway? (History rows will show "?")')) return;
      S.exercises = S.exercises.filter(e => e.id !== id); save(); ui.modal = null; render();
    },
    // --- data
    expCSV() { shareOrDownload('hypertrophy-strong-export.csv', C.toStrongCSV(S.sessions, EX), 'text/csv'); render(); },
    expJSON() { shareOrDownload('hypertrophy-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S), 'application/json'); render(); },
    imp(inp) {
      const f = inp.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => {
        try {
          if (/\.json$/i.test(f.name)) {
            const j = JSON.parse(rd.result); if (!j.v || !j.exercises || !j.sessions) throw new Error('Not a backup file');
            if (!confirm('Replace ALL current data with this backup?')) return; S = j; save(); toast('Backup restored');
          } else {
            const r = C.fromStrongCSV(rd.result, S.exercises); const have = new Set(S.sessions.map(s => s.start + '|' + s.name));
            const add = r.sessions.filter(s => !have.has(s.start + '|' + s.name));
            S.exercises.push(...r.created); S.sessions.push(...add); save();
            toast(`Imported ${add.length} workouts, ${r.created.length} new exercises${r.created.length ? ' (muscle: Other — set them in Library)' : ''}`);
          }
          reindex(); render();
        } catch (e) { alert('Import failed: ' + e.message); }
      };
      rd.readAsText(f); inp.value = '';
    },
    setting(k, v) { S.settings[k] = v; save(); render(); },
    openS(id) { ui.openSess = ui.openSess === id ? null : id; render(); },
    delSess(id) { if (confirm('Delete this workout?')) { S.sessions = S.sessions.filter(s => s.id !== id); save(); render(); } },
    reset() { if (confirm('Erase ALL data on this device? Export first if unsure.') && confirm('Really erase everything?')) { S = fresh(); save(); reindex(); render(); } },
  };

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (S.active) lock();
  render();
  window.__S = () => S; // debug hook for tests
})();
