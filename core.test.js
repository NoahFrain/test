const C = require('./core.js');
const assert = require('assert');
const S = (w, r, rir) => ({ w, r, rir: rir ?? '', done: true });

// 1) recommend: single instance, 8 reps @ 180, RIR logged 2 -> e1 = 180*(1+10/30)=240; target 6-10 mid 8 +2 => 240/(1+10/30)=180
let r = C.recommend([{ sets: [S(180, 8, 2)] }], { min: 6, max: 10 }, { inc: 10 });
assert.strictEqual(r.w, 180); assert.strictEqual(r.reps, 8); assert.strictEqual(r.n, 1);

// 2) Same history, but 12-15 range: mid 13.5 -> 14 reps +2 = 16 -> 240/(1+16/30)=156.5 -> round to 10 = 160
r = C.recommend([{ sets: [S(180, 8, 2)] }], { min: 12, max: 15 }, { inc: 10 });
assert.strictEqual(r.reps, 14); assert.strictEqual(r.w, 160);

// 3) missing RIR assumes 1
r = C.recommend([{ sets: [S(180, 9)] }], { min: 6, max: 10 }, { inc: 5 }); // eff 10 -> same e1 240
assert.strictEqual(r.e1, 240);

// 4) only last 6 instances, newest weighted more
const inst = [300, 240, 240, 240, 240, 240, 9999].map(w => ({ sets: [S(w, 10, 0)] })); // 7th ignored
r = C.recommend(inst, { min: 8, max: 12 }, { inc: 0.01 });
const W = C.REC_WEIGHTS, e = [300, 240, 240, 240, 240, 240].map(w => w * (1 + 10 / 30));
const exp = e.reduce((a, v, i) => a + v * W[i], 0) / W.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(r.e1 - exp) < 0.02, r.e1 + ' vs ' + exp); assert.strictEqual(r.n, 6);

// 5) best set per instance, bodyweight-only history -> null
assert.strictEqual(C.recommend([{ sets: [S(0, 12)] }], { min: 8, max: 12 }, {}), null);
r = C.recommend([{ sets: [S(100, 12, 0), S(100, 8, 0)] }], { min: 8, max: 12 }, { inc: 5 });
assert.strictEqual(r.e1, 140);

// 6) high reps past 20 still count (cap 30)
r = C.recommend([{ sets: [S(20, 22, 2)] }], { min: 12, max: 20 }, { inc: 2.5 });
assert.ok(r && r.w > 0);

// 7) suggest: no same-workout prev + rec -> mode rec
let sg = C.suggest({ min: 12, max: 15 }, null, { n: 3, rec: { w: 160, reps: 14 } });
assert.strictEqual(sg.mode, 'rec'); assert.deepStrictEqual(sg.sets[0], { w: 160, r: 14 });
// no prev, no rec -> new
assert.strictEqual(C.suggest({ min: 12, max: 15 }, null, { n: 3 }).mode, 'new');
// same-workout prev present -> double progression unchanged, rec ignored for prefill
sg = C.suggest({ min: 6, max: 10 }, [S(185, 8), S(185, 8), S(185, 11)], { n: 3, rir: 2, trigger: 'exceed', inc: 5, rec: { w: 100, reps: 8 } });
assert.strictEqual(sg.mode, 'up'); assert.strictEqual(sg.to, 200);

// ---------- v8 ----------
// set types: warm-ups and drop sets don't drive progression
sg = C.suggest({ min: 6, max: 10 }, [{ w: 95, r: 15, done: true, t: 'W' }, S(185, 8), S(185, 8), { w: 135, r: 14, done: true, t: 'D' }], { n: 3, rir: 2, trigger: 'exceed', inc: 5 });
assert.strictEqual(sg.mode, 'hold', 'drop set must not trigger an increase'); assert.strictEqual(sg.from, 185);
r = C.recommend([{ sets: [{ w: 300, r: 10, done: true, t: 'W' }, S(180, 8, 2)] }], { min: 6, max: 10 }, { inc: 10 });
assert.strictEqual(r.e1, 240, 'warm-up excluded from rec');
// failure set with blank RIR counts as 0 RIR
r = C.recommend([{ sets: [{ w: 180, r: 10, done: true, t: 'F', rir: '' }] }], { min: 6, max: 10 }, { inc: 10 });
assert.strictEqual(r.e1, 240);
// volume: warm-ups excluded, drop sets counted
const exById = { a: { muscle: 'Back' } };
assert.deepStrictEqual(C.hardSetsByMuscle([{ items: [{ exId: 'a', sets: [{ done: true, t: 'W' }, { done: true }, { done: true, t: 'D' }] }] }], exById), { Back: 2 });

// load model
assert.strictEqual(C.effW(25, 'bw', 180), 205); assert.strictEqual(C.effW(60, 'assist', 180), 120); assert.strictEqual(C.effW(60, 'assist', 0), 0);
assert.strictEqual(C.fromEff(130, 'assist', 180, 10), 50); assert.strictEqual(C.fromEff(198, 'bw', 180, 5), 20);
// weighted pull-ups: BW 180 +0 for 13 on 6-10 -> added load goes up
sg = C.suggest({ min: 6, max: 10 }, [S(0, 10), S(0, 11), S(0, 13)], { n: 3, rir: 2, trigger: 'exceed', inc: 5, load: 'bw', bw: 180 });
assert.strictEqual(sg.mode, 'up'); assert.ok(sg.to >= 5 && sg.to <= 20, 'added ' + sg.to);
// assisted pull-up: assist 60, beat range -> less assistance
sg = C.suggest({ min: 6, max: 10 }, [S(60, 11), S(60, 11), S(60, 12)], { n: 3, rir: 2, trigger: 'exceed', inc: 10, load: 'assist', bw: 180 });
assert.strictEqual(sg.mode, 'up'); assert.ok(sg.to < 60 && sg.to >= 40, 'assist ' + sg.to);
// assisted, no bodyweight: one step less assistance
sg = C.suggest({ min: 6, max: 10 }, [S(60, 12)], { n: 1, trigger: 'exceed', inc: 10, load: 'assist', bw: 0 });
assert.strictEqual(sg.to, 50);
// assisted, below range with dropBelow -> MORE assistance
sg = C.suggest({ min: 6, max: 10 }, [S(40, 4)], { n: 1, trigger: 'exceed', inc: 10, load: 'assist', bw: 180, dropBelow: true });
assert.strictEqual(sg.mode, 'down'); assert.strictEqual(sg.to, 50);
// analytics use effective load: bodyweight pull-ups at 0 added now produce an e1RM
const ser = C.exerciseSeries([{ start: 1, items: [{ exId: 'p', sets: [S(0, 10)] }] }], 'p', { mode: 'bw', bwAt: () => 180 });
assert.strictEqual(ser.length, 1); assert.strictEqual(ser[0].e1, 240);

// warm-ups
assert.deepStrictEqual(C.warmups(225, { inc: 5, bar: 45 }), [{ w: 110, r: 8 }, { w: 155, r: 4 }, { w: 190, r: 2 }]);
assert.deepStrictEqual(C.warmups(65, { inc: 5, bar: 45 }), [{ w: 45, r: 8 }, { w: 55, r: 2 }]); // bar floor, dedupe
assert.deepStrictEqual(C.warmups(20, { inc: 5 }), [{ w: 10, r: 8 }, { w: 15, r: 2 }]);
assert.deepStrictEqual(C.warmups(5, { inc: 5 }), []);

// feedback -> delta
const F = (pump, sore, joint, work) => ({ pump, sore, joint, work });
assert.strictEqual(C.volumeDelta(F('mod', 'early', 'none', 'good')), 1);
assert.strictEqual(C.volumeDelta(F('low', 'none', 'none', 'easy')), 2);
assert.strictEqual(C.volumeDelta(F('great', 'early', 'none', 'hard')), 0);
assert.strictEqual(C.volumeDelta(F('low', 'ontime', 'none', 'easy')), 0);
assert.strictEqual(C.volumeDelta(F('low', 'none', 'some', 'easy')), 0);
assert.strictEqual(C.volumeDelta(F('great', 'none', 'high', 'easy')), -1);
assert.strictEqual(C.volumeDelta(F('mod', 'still', 'none', 'good')), -1);
assert.strictEqual(C.volumeDelta(F('low', 'none', 'none', 'easy'), 'M'), 0, 'maintain never adds');
assert.strictEqual(C.volumeDelta({ pump: 'low' }), 0, 'incomplete answers do nothing');
// distribution: adds to fewest, cuts from most, respects cap and floor of 1
let its = [{ sets: 3 }, { sets: 2 }];
assert.deepStrictEqual(C.distributeSets(its, 2, 9), [{ i: 0, from: 3, to: 4 }, { i: 1, from: 2, to: 3 }]);
its = [{ sets: 4 }, { sets: 4 }]; assert.deepStrictEqual(C.distributeSets(its, 1, 8), []);
its = [{ sets: 1 }, { sets: 3 }]; assert.deepStrictEqual(C.distributeSets(its, -1), [{ i: 1, from: 3, to: 2 }]);
its = [{ sets: 1 }]; assert.deepStrictEqual(C.distributeSets(its, -1), []);

// CSV keeps original column order and appends new columns
assert.deepStrictEqual(C.CSV_COLS.slice(-4), ['Set Type', 'Load Type', 'Bodyweight', 'Effective Load']);
const csv = C.toCSV([{ start: 0, name: 'Pull', items: [{ exId: 'p', min: 6, max: 10, sets: [{ w: 25, r: 8, done: true, t: '' }] }] }], { p: { name: 'Pull Up', muscle: 'Back', load: 'bw' } }, {}, 'lb', () => 180);
assert.ok(csv.split('\n')[1].endsWith('Working,Bodyweight + added,180,205'), csv);
console.log('core v8: all tests passed');
