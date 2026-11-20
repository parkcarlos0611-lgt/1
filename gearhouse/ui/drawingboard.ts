// The drawing board (reviews 26 and 27): a drafting sheet on the workshop desk, the order's checklist and the estimate
// beside it, the 1929 sedan drawn in lines only (side and plan, 1 px = 20 mm). A change is drawn over the drawing in
// red first; "수정" rubs the old lines out and draws the change in; "취소" rubs the red out. The sheet follows the
// company's size and era: worn paper, clean paper, blueprint, black screen. Figures can be typed in. A last tab shows
// where the drawing goes next: the exterior design, in colour. Everything is pixel art in one 480 x 270 buffer.
import { Screen, hex, type RGB } from './pixel/screen';
import { lineMap, edited, measure, strokeOrder, fits, NO_EDIT, type Edit, type LineMap, type Frame } from './drawing/lines';
import { rules, ERAS, eraName, type NumKey, type Rules } from './drawing/rules';
import frameJson from '../data/cars/sedan29_frame.json';
import { viewDesign, type CarModel } from '../render/car/model';
import { rasterizeFlat } from '../render/car/flat';
import type { CarImage } from '../render/car/raster';
import model from '../data/cars/sedan29.json';

const W = 480, H = 270, MM = 20, S = new Screen(W, H);
const C = { wood: hex('#5a3b26'), wood2: hex('#4a2f1e'), wood3: hex('#6b4730'), ink: hex('#2b2620'), inkSoft: hex('#6b5d48'), ok: hex('#3f6e3a'), bad: hex('#a8402c'),
  card: hex('#f2ead2'), card2: hex('#e2d6b6'), shadow: hex('#2e1d12'), red: hex('#b8322a'), red2: hex('#d0614f') };
// brass, six steps from deep shadow to the polished highlight, for buttons and fittings
const BRASS = ['#4a3410', '#7a5a22', '#a37c34', '#c9a052', '#e4c47a', '#fbeab2'].map(hex);

// ---------------- the four sheets ----------------
interface Sheet { name: string; who: string; paper: RGB; paper2: RGB; paper3: RGB; grid: RGB; line: RGB; line2: RGB; red: RGB; red2: RGB; smudge: RGB; label: RGB; eraser: boolean; worn: boolean; style: 'worn' | 'clean' | 'blue' | 'screen' }
const SHEETS: Sheet[] = [
  { name: '닳은 제도지', who: '소규모 공방', paper: hex('#e6d8b2'), paper2: hex('#d9c99e'), paper3: hex('#cdbb8c'), grid: hex('#d6c79f'), line: hex('#3d3c44'), line2: hex('#5c5a62'), red: hex('#b8322a'), red2: hex('#d0614f'), smudge: hex('#c4b48a'), label: hex('#6b5d48'), eraser: true, worn: true, style: 'worn' },
  { name: '깔끔한 제도지', who: '설계실이 있는 제작소', paper: hex('#f4f1e6'), paper2: hex('#e9e5d6'), paper3: hex('#d9d4c2'), grid: hex('#e4e8e8'), line: hex('#1d2430'), line2: hex('#3a4352'), red: hex('#c0312a'), red2: hex('#d85a4a'), smudge: hex('#e2ddcb'), label: hex('#4a5260'), eraser: true, worn: false, style: 'clean' },
  { name: '청사진', who: '중견 · 설계 부서', paper: hex('#1f4f8a'), paper2: hex('#1b477d'), paper3: hex('#163c6c'), grid: hex('#2a5c98'), line: hex('#e8f0f8'), line2: hex('#b8cce4'), red: hex('#ffd060'), red2: hex('#ffe598'), smudge: hex('#245590'), label: hex('#b8cce4'), eraser: false, worn: false, style: 'blue' },
  { name: '검은 화면', who: '대기업 · 1980년대 이후', paper: hex('#0c0f14'), paper2: hex('#10141a'), paper3: hex('#161b22'), grid: hex('#151c26'), line: hex('#e6f2ff'), line2: hex('#8fb8e0'), red: hex('#ff6a4a'), red2: hex('#ff9a80'), smudge: hex('#12171e'), label: hex('#8fb8e0'), eraser: false, worn: false, style: 'screen' } ];
let sheetNo = 0; const SH = () => SHEETS[sheetNo]!;

// ---------------- the drawing ----------------
const base = model as unknown as CarModel;
let cur: Edit = { ...NO_EDIT }, next: Edit = { ...NO_EDIT };
const PAPER = { x: 6, y: 6, w: 316, h: 258 }, SIDE = { x: 22, y: 20 }, PLAN = { x: 22, y: 150 };
type Views = { side: LineMap; plan: LineMap };
const cache = new Map<string, Views>();
const FR = frameJson as unknown as Frame;
let eraNo = 0; const RU = (): Rules => rules(ERAS[eraNo]!, sheetNo);
/** the edit as built: the lights layout falls back to one the doors have room for */
const eff = (e: Edit): Edit => { const R = RU(), ok = fits(FR, e, R.rearDoorMin, R.cabinMin), L = ([6, 4, 2] as const).filter(l => l <= e.lights).find(l => ok.includes(l)) ?? 2; return L === e.lights ? e : { ...e, lights: L }; };
const carOf = (e: Edit) => edited(base, eff(e), FR);
const views = (e: Edit): Views => { const k = JSON.stringify(eff(e)); let v = cache.get(k); if (!v) { const m = carOf(e); v = { side: lineMap(m, 'left', MM), plan: lineMap(m, 'top', MM) }; cache.set(k, v); } return v; };
const sheet = new Uint8Array(W * H);                                    // 0 paper, 1 line, 2 red, 3 smudge
const put = (L: LineMap, ox: number, oy: number, into: Set<number>) => { for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.on[y * L.w + x]) into.add((oy + y) * W + ox + x); };
const pixelsOf = (V: Views) => { const s = new Set<number>(); put(V.side, SIDE.x, SIDE.y + (100 - V.side.h), s); put(V.plan, PLAN.x, PLAN.y, s); return s; };
let drawnNow = pixelsOf(views(cur)), redNow = new Set<number>(), drawnKeep = new Set<number>();

// ---------------- strokes: pencil, red pencil, eraser ----------------
type Job = { kind: 'pencil' | 'red' | 'erase' | 'unred' | 'scan'; pix: number[]; i: number; then?: () => void; tgt?: Uint8Array; y?: number; speed?: number };
const jobs: Job[] = []; let tool: { kind: Job['kind']; x: number; y: number } | null = null, fast = false, blink = 0;
const queue = (kind: Job['kind'], pix: Set<number> | number[], then?: () => void) => { const arr = [...pix];
  if (!SH().eraser && (kind === 'erase' || kind === 'unred')) { jobs.push({ kind, pix: arr, i: 0, then }); return; }
  jobs.push({ kind, pix: kind === 'erase' || kind === 'unred' ? arr.sort((a, b) => (a % W) - (b % W) || a - b) : strokeOrder(arr, W), i: 0, then }); };
function apply1(job: Job, p: number) {
  if (job.kind === 'pencil') sheet[p] = 1; else if (job.kind === 'red') sheet[p] = 2;
  else if (!SH().eraser) { sheet[p] = job.kind === 'erase' && drawnKeep.has(p) ? 1 : 0; }
  else { const x = p % W, y = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx;
    if (job.kind === 'erase' ? sheet[q] === 1 && !drawnKeep.has(q) : sheet[q] === 2) sheet[q] = job.kind === 'erase' ? 3 : 0; else if (job.kind === 'erase' && sheet[q] === 0 && Math.random() < 0.15) sheet[q] = 3; } }
}
function step(dt: number) {
  const job = jobs[0]; if (!job) { tool = null; sound(0, 0); return; }
  if (job.kind === 'scan') { const y0 = Math.floor(job.y!); job.y = job.y! + (fast ? 4000 : job.speed!) * dt; sound(0, 0);   // the screen redraws under a falling scan line
    for (let y = Math.max(PAPER.y, y0); y < Math.min(PAPER.y + PAPER.h, job.y); y++) for (let x = PAPER.x; x < PAPER.x + PAPER.w; x++) sheet[y * W + x] = job.tgt![y * W + x]!;
    if (job.y >= PAPER.y + PAPER.h) { jobs.shift(); job.then?.(); } return; }
  if (!SH().eraser && (job.kind === 'erase' || job.kind === 'unred')) {   // screens and blueprints: the old lines blink and go
    blink += dt; if (blink > 0.45 || fast) { for (const p of job.pix) apply1(job, p); job.i = job.pix.length; blink = 0; } }
  else { let n = Math.max(1, Math.round((fast ? 8000 : job.kind === 'erase' || job.kind === 'unred' ? 700 : job.kind === 'red' ? 900 : SH().eraser ? 420 : 1400) * dt));
    while (n-- > 0 && job.i < job.pix.length) { const p = job.pix[job.i++]!; apply1(job, p); tool = { kind: job.kind, x: p % W, y: (p / W) | 0 }; } }
  sound(job.kind === 'pencil' || job.kind === 'red' ? 1 : 2, fast || !SH().eraser ? 0 : 1);
  if (job.i >= job.pix.length) { jobs.shift(); job.then?.(); }
}
/** finish every stroke at once (a button pressed while drawing) */
function flush() { while (jobs.length) { const j = jobs[0]!; if (j.tgt) sheet.set(j.tgt); while (j.i < j.pix.length) apply1(j, j.pix[j.i++]!); jobs.shift(); j.then?.(); } tool = null; }
const busy = () => jobs.length > 0;

// ---------------- the order and the estimate ----------------
type Fig = ReturnType<typeof measure>;
const fig = (e: Edit) => measure(carOf(e)), B0 = fig(NO_EDIT);
const cost = (e: Edit) => estimate(e).total;
const lightsName = (l: number) => (l === 2 ? '2도어' : `${l}라이트`);
const ORDER = { from: '닥터 하워드 부부', ask: [
  { t: '4도어 세단', test: (m: Fig) => m.lights !== 2, val: (m: Fig) => `세단 ${lightsName(m.lights)}` },
  { t: '머리 공간: 전고 1850 이상', test: (m: Fig) => m.height >= 1850, val: (m: Fig) => `${m.height}` },
  { t: '뒷좌석: 축간 2700 이상', test: (m: Fig) => m.wb >= 2700, val: (m: Fig) => `${m.wb}` },
  { t: '시골길: 지상고 310 이상', test: (m: Fig) => m.clearance >= 310, val: (m: Fig) => `${m.clearance}` },
  { t: '왕진 가방: 짐받이', test: (m: Fig) => m.rack, val: (m: Fig) => (m.rack ? '있음' : '없음') },
  { t: '예산 $1,200 이하', test: (_m: Fig, e: Edit) => cost(e) <= 1200, val: (_m: Fig, e: Edit) => `$${cost(e)}` } ] };
/** a rough estimate from the drawing (first pass: prices of 1929, a bought chassis, the body built in the shop) */
function estimate(e0: Edit) {
  const e = eff(e0), m = fig(e0), L = e.lights, gs = 1 + e.grille / 100, bs = 1 + e.bumper / 100, fs = 1 + e.fender / 100, nb = +e.bumperF + +e.bumperR;
  const panel = (m.length * 2 + m.wb) / 1000 * (m.height / 1000) * 2.1, doors = L === 2 ? 2 : 4, glass = (L === 6 ? 6 : 4) + 2;
  const labour = 260 + e.wb * 0.25 + e.roof * 0.3 + Math.abs(e.lift) * 0.2 + (e.rack ? 18 : 0) + Math.abs(e.door) * 0.05 - (L !== 6 ? 6 : 0) - (L === 2 ? 14 : 0)
    + (Math.abs(e.lampX) + Math.abs(e.lampZ)) * 0.03 + Math.abs(e.grilleX) * 0.05 + Math.abs(e.grille) * 0.6 - (e.fenders ? 0 : 12);
  const rows: [string, number][] = [['섀시 (구매)', 520], ['강판 ' + panel.toFixed(1) + '제곱m', Math.round(panel * 9)], ['물푸레 골조', Math.round(70 + e.wb * 0.05 + e.roof * 0.06)],
    [`문 ${doors}짝 · 유리 ${glass}장`, Math.round(doors * 7 + glass * 4 + e.roof * 0.05)], ['그릴 · 램프', Math.round(30 * gs + 16)],
    ...(nb ? [[`범퍼 ${nb}개`, Math.round(14 * nb * bs)] as [string, number]] : []), ...(e.fenders ? [['펜더 · 발판', Math.round(38 * fs)] as [string, number]] : []),
    ['도장 · 내장', 95], ...(e.rack ? [['짐받이', 22] as [string, number]] : []), [`노무 ${Math.round(labour)}시간`, Math.round(labour * 0.5)]];
  const total = rows.reduce((a, r) => a + r[1], 0);
  const kg = Math.round(1020 + e.wb * 0.18 + e.roof * 0.15 + (e.rack ? 14 : 0) - (2 - nb) * 16 - (e.fenders ? 0 : 45) + e.fender * 0.8 + e.grille * 0.3 - (L === 2 ? 10 : 0));
  const vmax = Math.round(105 - e.roof * 0.02 - (e.rack ? 3 : 0) - e.lift * 0.02 + (e.fenders ? 0 : 4) - e.fender * 0.05);
  return { rows, total, kg, vmax, days: Math.ceil(labour / 9) };
}

// ---------------- controls ----------------
type Btn = { id: string; x: number; y: number; w: number; h: number; label: () => string; on: () => void; show?: () => boolean; big?: boolean; off?: () => boolean };
const pending = () => JSON.stringify(eff(cur)) !== JSON.stringify(eff(next)) || JSON.stringify(cur) !== JSON.stringify(next);
type RowDef = { k: keyof Edit; label: string; kind: 'num' | 'bool' | 'lights'; base?: () => number; unit?: string; yes?: string; no?: string; allowed?: () => boolean };
const lampZ0 = (() => { const l = base.parts.find(p => p.id === 'lamp')!; return Math.round((l.box.z[0] + l.box.z[1]) / 2); })();
const PAGES: { name: string; w: number; rows: RowDef[] }[] = [
  { name: '차체', w: 34, rows: [{ k: 'wb', label: '축간', kind: 'num', base: () => B0.wb }, { k: 'door', label: '앞문 길이', kind: 'num', base: () => FR.B - FR.A }, { k: 'lights', label: '옆창 배치', kind: 'lights' },
    { k: 'roof', label: '지붕 높이', kind: 'num', base: () => B0.height }, { k: 'lift', label: '차체 높이', kind: 'num', base: () => B0.clearance }, { k: 'rack', label: '지붕 짐받이', kind: 'bool', yes: '있음', no: '없음' }] },
  { name: '앞모습', w: 40, rows: [{ k: 'lampX', label: '램프 앞뒤', kind: 'num', base: () => 0 }, { k: 'lampZ', label: '램프 높이', kind: 'num', base: () => lampZ0 },
    { k: 'grilleX', label: '그릴 앞뒤', kind: 'num', base: () => 0 }, { k: 'grille', label: '그릴 크기', kind: 'num', base: () => 100, unit: '%' }] },
  { name: '범퍼 · 펜더', w: 62, rows: [{ k: 'bumperF', label: '앞 범퍼', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().bumpersOff }, { k: 'bumperR', label: '뒤 범퍼', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().bumpersOff },
    { k: 'bumper', label: '범퍼 크기', kind: 'num', base: () => 100, unit: '%' }, { k: 'fenders', label: '펜더 · 발판', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().fendersOff },
    { k: 'fender', label: '펜더 크기', kind: 'num', base: () => 100, unit: '%' }] } ];
let view: 'order' | 'estimate' | 'exterior' = 'order', page = 0, editing: NumKey | null = null, typed = '';
const ROW0 = 156, PITCH = 13, rng = (k: keyof Edit) => RU().r[k as NumKey] ?? null;
const shown = (v: number, d: RowDef) => (d.base!() === 0 ? (v > 0 ? `+${v}` : `${v}`) : `${v}`) + (d.unit ?? '');
const buttons: Btn[] = [];
PAGES.forEach((pg, pi) => pg.rows.forEach((d, i) => { const y = ROW0 + i * PITCH, here = () => page === pi;
  if (d.kind === 'num') { const k = d.k as NumKey, ok = () => here() && !!rng(k);
    buttons.push({ id: k + '-', x: 404, y, w: 16, h: 12, label: () => '-', show: ok, off: () => (next[k] as number) <= rng(k)!.min, on: () => change({ ...next, [k]: Math.max(rng(k)!.min, (next[k] as number) - rng(k)!.step) }) });
    buttons.push({ id: k + '+', x: 456, y, w: 16, h: 12, label: () => '+', show: ok, off: () => (next[k] as number) >= rng(k)!.max, on: () => change({ ...next, [k]: Math.min(rng(k)!.max, (next[k] as number) + rng(k)!.step) }) });
    buttons.push({ id: k + '=', x: 421, y, w: 34, h: 12, label: () => '', show: ok, on: () => startTyping(k) }); }
  else if (d.kind === 'bool') { const k = d.k as 'rack' | 'bumperF' | 'bumperR' | 'fenders', ok = () => here() && (!d.allowed || d.allowed());
    buttons.push({ id: k + '!', x: 404, y, w: 68, h: 12, label: () => (next[k] ? d.yes! : d.no!), show: ok, on: () => change({ ...next, [k]: !next[k] }) }); }
  else buttons.push({ id: 'lights!', x: 404, y, w: 68, h: 12, show: here, label: () => { const L = eff(next).lights; return L === next.lights ? lightsName(L) : `${lightsName(L)} 자동`; },
    on: () => change({ ...next, lights: next.lights === 6 ? 4 : next.lights === 4 ? 2 : 6 }) }); }));
buttons.push({ id: 'apply', x: 330, y: 236, w: 70, h: 17, label: () => '수정', big: true, on: () => apply(), show: () => pending() });
buttons.push({ id: 'cancel', x: 404, y: 236, w: 68, h: 17, label: () => '취소', big: true, on: () => cancel(), show: () => pending() });
buttons.push({ id: 'tab-order', x: 330, y: 4, w: 46, h: 13, label: () => '주문서', on: () => (view = 'order') });
buttons.push({ id: 'tab-est', x: 378, y: 4, w: 46, h: 13, label: () => '견적', on: () => (view = 'estimate') });
buttons.push({ id: 'tab-ext', x: 426, y: 4, w: 46, h: 13, label: () => '외장', on: () => (view = 'exterior') });
{ let px = 330; PAGES.forEach((pg, pi) => { buttons.push({ id: 'page' + pi, x: px, y: 143, w: pg.w, h: 11, label: () => pg.name, on: () => { endTyping(true); page = pi; } }); px += pg.w + 2; }); }
buttons.push({ id: 'sheet', x: 330, y: 256, w: 82, h: 12, label: () => '도면: ' + SH().name, on: () => switchSheet() });
buttons.push({ id: 'era', x: 414, y: 256, w: 44, h: 12, label: () => ['1920년대', '1935', '1939'][eraNo]!, on: () => { flush(); eraNo = (eraNo + 1) % ERAS.length; clampAll(); } });
buttons.push({ id: 'sound', x: 458, y: 256, w: 14, h: 12, label: () => '', on: () => (soundOn = !soundOn) });

/** keep the edit inside the table after the era or the company size changed; what no longer fits shows as a red change */
function clampAll() { const R = RU(), e = { ...next } as Edit & Record<string, unknown>;
  for (const k of Object.keys(R.r) as NumKey[]) { const r = R.r[k]; e[k] = r ? Math.max(r.min, Math.min(r.max, e[k] as number)) : 0; }
  if (!R.fendersOff) e.fenders = true; if (!R.bumpersOff) { e.bumperF = true; e.bumperR = true; }
  if (JSON.stringify(e) !== JSON.stringify(next)) change(e); }
const isScan = () => SH().style === 'screen';
function scanTo(drawn: Set<number>, red: Set<number>, speed: number, then?: () => void) {
  const t = new Uint8Array(W * H); for (const p of drawn) t[p] = 1; for (const p of red) t[p] = 2; jobs.push({ kind: 'scan', pix: [], i: 0, tgt: t, y: PAPER.y, speed, then }); }
function change(e: Edit) {
  flush(); next = e; const want = pixelsOf(views(next)), redWant = new Set([...want].filter(p => !drawnNow.has(p)));
  if (isScan()) { redNow = redWant; scanTo(drawnNow, redNow, 520); return; }
  const add = [...redWant].filter(p => !redNow.has(p)), drop = [...redNow].filter(p => !redWant.has(p));
  redNow = redWant; if (drop.length) queue('unred', drop); if (add.length) queue('red', add);
}
function apply() {
  flush(); const want = pixelsOf(views(next)), gone = [...drawnNow].filter(p => !want.has(p)), red = [...redNow], after = { ...next };
  if (isScan()) { scanTo(want, new Set(), 210, () => { cur = after; drawnNow = want; redNow = new Set(); }); return; }
  drawnKeep = want; queue('erase', gone, () => queue('pencil', red, () => { cur = after; drawnNow = want; redNow = new Set(); }));
}
function cancel() { flush(); const red = [...redNow]; next = { ...cur }; redNow = new Set(); if (isScan()) scanTo(drawnNow, redNow, 520); else queue('unred', red); }
function switchSheet() { flush(); sheetNo = (sheetNo + 1) % SHEETS.length; sheet.fill(0); for (const p of drawnNow) sheet[p] = 1; for (const p of redNow) sheet[p] = 2; clampAll(); }

// ---------------- typing a figure ----------------
const typer = document.getElementById('typer') as HTMLInputElement;
const rowOf = (k: keyof Edit) => PAGES.flatMap(p => p.rows).find(d => d.k === k)!;
function startTyping(k: NumKey) { flush(); editing = k; typed = String(rowOf(k).base!() + next[k]); typer.value = typed; typer.focus({ preventScroll: true }); typer.select(); }
function endTyping(ok: boolean) {
  if (editing === null) return; const k = editing, d = rowOf(k), r = rng(k)!, v = parseInt(typed, 10); editing = null; typer.blur();
  if (ok && Number.isFinite(v)) { const x = Math.round(Math.max(r.min, Math.min(r.max, v - d.base!()))); if (x !== next[k]) change({ ...next, [k]: x }); }
}
typer.addEventListener('input', () => { typed = typer.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '').slice(0, 6); typer.value = typed; });
typer.addEventListener('keydown', e => { if (e.key === 'Enter') { endTyping(true); e.preventDefault(); } else if (e.key === 'Escape') { endTyping(false); e.preventDefault(); } });
typer.addEventListener('blur', () => { if (editing !== null) endTyping(true); });

// ---------------- sound ----------------
let AC: AudioContext | null = null, gainP: GainNode | null = null, gainE: GainNode | null = null, soundOn = true, tSnd = 0;
function startSound() { if (AC) return; try { AC = new AudioContext(); const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const mk = (f: number, q: number) => { const src = AC!.createBufferSource(); src.buffer = buf; src.loop = true; const bp = AC!.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = AC!.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(AC!.destination); src.start(); return g; };
  gainP = mk(4200, 1.2); gainE = mk(900, 0.8); } catch { AC = null; } }
function sound(kind: number, on: number) { if (!AC || !gainP || !gainE) return; tSnd += 1; const now = AC.currentTime, j = 0.5 + 0.5 * Math.sin(tSnd * 0.9) * Math.sin(tSnd * 0.37);
  gainP.gain.setTargetAtTime(soundOn && kind === 1 && on ? 0.05 + 0.06 * j : 0, now, 0.02); gainE.gain.setTargetAtTime(soundOn && kind === 2 && on ? 0.12 + 0.1 * j : 0, now, 0.03); }

// ---------------- drawing the screen ----------------
const rnd = (i: number) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
function desk() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const g = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, g > 0.75 ? C.wood3 : g < -0.7 ? C.wood2 : C.wood); } }
// ---------------- paper, ink and screens ----------------
const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]!;
function vnoise(x: number, y: number, seed: number) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)) >>> 0); return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; }
/** the sheet's ground, made once per sheet: a few tones of the paper laid with an ordered dither, so it stays pixel art */
const tex = new Map<number, RGB[]>();
function paperTex(): RGB[] {
  let t = tex.get(sheetNo); if (t) return t; const P = SH(), { w, h } = PAPER; t = new Array(w * h);
  const hi = P.style === 'screen' ? mix(P.paper, P.grid, 0.5) : mix(P.paper, P.style === 'blue' ? hex('#3a72b8') : hex('#fffdf4'), 0.45), tones = [hi, P.paper, P.paper2, P.paper3];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = Math.min(i, j, w - 1 - i, h - 1 - j), n = 0.6 * vnoise(i / 22, j / 22, 1) + 0.4 * vnoise(i / 6, j / 6, 2), fibre = vnoise(i / 11, j / 1.6, 3);
    let v = 1;
    if (P.style === 'worn') { v = 1 + (n - 0.5) * 1.6 + (fibre > 0.8 ? 0.6 : 0) + Math.max(0, 7 - edge) / 7 * 1.3;
      if (i === 157 || j === 128) v -= 0.9; if (i === 158 || j === 129) v += 1.4; if (i === 159 || j === 130) v += 0.6;            // the folds: a lit side and a shadow side
      const d = Math.hypot(i - 262, j - 46); v += 1.3 * Math.exp(-((d - 17) ** 2) / 1.6) + (d < 17 ? 0.3 : 0);                      // a cup ring
      for (const [fx, fy] of [[40, 210], [205, 20], [290, 150], [120, 240]] as const) { const e = Math.hypot(i - fx, j - fy); if (e < 2.2) v += 1.5 - e * 0.4; }   // foxing
      if (i + j < 9) v += 0.8; }
    else if (P.style === 'clean') v = 0.7 + (n - 0.5) * 0.5 + Math.max(0, 3 - edge) / 3 * 0.8;
    else if (P.style === 'blue') v = 1 + (n - 0.5) * 1.7 + (fibre > 0.85 ? -0.5 : 0) + Math.max(0, 6 - edge) / 6 * 0.9;
    else { const cx = (i - w / 2) / (w / 2), cy = (j - h / 2) / (h / 2); v = 1.2 + (cx * cx + cy * cy) * 0.9 - (n - 0.5) * 0.4; }
    let c = tones[Math.max(0, Math.min(3, Math.floor(v + bayer(i, j) - 0.5)))]!;
    // the grid: fine lines every 10 px, a stronger one every 50; pencil grids are broken, printed ones whole, screens show dots between
    const gi = (i - 16) % 10 === 0, gj = (j - 14) % 10 === 0, Gi = (i - 16) % 50 === 0, Gj = (j - 14) % 50 === 0, inside = i > 12 && i < w - 12 && j > 10 && j < h - 34;
    if (inside && (gi || gj)) { const major = (Gi && i > 12) || (Gj && j > 10);
      if (P.style === 'worn') { if (vnoise(i / 4, j / 4, 9) > 0.35) c = major ? P.grid : mix(c, P.grid, 0.5); }
      else if (P.style === 'screen') { if (major) c = (i + j) % 2 ? P.grid : mix(P.grid, P.paper, 0.4); else if (gi && gj) c = P.grid; }
      else c = major ? P.grid : mix(c, P.grid, 0.55); }
    t[j * w + i] = c; }
  tex.set(sheetNo, t); return t;
}
function paper() {
  const { x, y, w, h } = PAPER, P = SH(), T = paperTex();
  S.fill(x + 3, y + 3, w, h, C.shadow); S.fill(x + 1, y + 1, w, h, mix(C.shadow, C.wood, 0.5));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.px(x + i, y + j, T[j * w + i]!);
  if (P.style !== 'worn') { const fc = P.style === 'clean' ? P.line2 : P.line2;                                                   // a ruled border with zone ticks
    S.hline(x + 3, x + w - 4, y + 3, fc); S.hline(x + 3, x + w - 4, y + h - 4, fc); S.vline(x + 3, y + 3, y + h - 4, fc); S.vline(x + w - 4, y + 3, y + h - 4, fc);
    for (let k = 1; k < 6; k++) { const zx = x + 3 + Math.round(k * (w - 7) / 6); S.vline(zx, y + 1, y + 2, fc); S.vline(zx, y + h - 3, y + h - 2, fc); }
    for (let k = 1; k < 4; k++) { const zy = y + 3 + Math.round(k * (h - 7) / 4); S.hline(x + 1, x + 2, zy, fc); S.hline(x + w - 3, x + w - 2, zy, fc); } }
  if (P.style === 'worn' || P.style === 'clean') for (const [px, py] of [[x + 5, y + 5], [x + w - 8, y + 5], [x + 5, y + h - 8], [x + w - 8, y + h - 8]] as const) {   // drawing pins
    S.px(px + 1, py + 3, C.shadow); S.px(px + 2, py + 3, C.shadow); S.px(px + 3, py + 2, C.shadow); S.fill(px, py, 3, 3, BRASS[2]!); S.px(px, py, BRASS[5]!); S.px(px + 1, py, BRASS[4]!); S.px(px, py + 1, BRASS[4]!); S.px(px + 2, py + 2, BRASS[1]!); }
  const tw = 98, th = 28, tx = x + w - 4 - tw, ty = y + h - 4 - th, ink = P.line, ink2 = P.line2;                                        // the title block
  if (P.style === 'worn') { S.line(tx, ty, tx + tw, ty + 1, ink); S.line(tx, ty, tx + 1, ty + th, ink); }
  else { S.hline(tx, tx + tw, ty, ink); S.vline(tx, ty, ty + th, ink); S.hline(tx + 1, tx + tw, ty + 1, ink2); }
  S.hline(tx, tx + tw, ty + 14, ink2); S.vline(tx + 50, ty + 14, ty + th, ink2);
  S.text('4도어 세단 1929', tx + 4, ty + 4, ink); S.text('축척 1:20', tx + 4, ty + 17, ink2); S.text(P.style === 'screen' ? 'DWG-001' : '도면 1', tx + 55, ty + 17, ink2);
}
function sheetPixels() { const P = SH(), glow = P.style === 'blue' ? mix(P.paper, P.line, 0.28) : P.style === 'screen' ? mix(P.paper, P.line2, 0.3) : null;
  if (glow || P.style === 'worn') for (let i = 0; i < W * H; i++) { const v = sheet[i]; if (v !== 1 && v !== 2) continue; const x = i % W, y = (i / W) | 0;   // a glow on lit lines, graphite dust on pencil
    for (const q of [i - 1, i + 1, i - W, i + W]) if (!sheet[q]) { if (glow) S.px(q % W, (q / W) | 0, v === 2 ? mix(P.paper, P.red, 0.3) : glow); else if (rnd(q * 7 + 3) < 0.22) S.px(q % W, (q / W) | 0, v === 2 ? P.red2 : P.line2, 0.22); }
    if (P.style === 'screen' && (x + y) % 2 === 0) for (const q of [i - W - 1, i + W + 1]) if (!sheet[q]) S.px(q % W, (q / W) | 0, glow!, 0.5); }
  for (let i = 0; i < W * H; i++) { const v = sheet[i]; if (!v) continue; const x = i % W, y = (i / W) | 0;
    if (v === 1) { let c = P.line;
      if (P.style === 'worn') { const pr = vnoise(x / 7, y / 7, 7); c = pr > 0.62 ? P.line : pr < 0.3 ? P.line2 : rnd(i) < 0.25 ? P.line2 : P.line; }      // the pencil's pressure comes and goes
      else if (P.style === 'blue') c = rnd(i) < 0.12 ? P.line2 : P.line;
      S.px(x, y, c); }
    else if (v === 2) S.px(x, y, P.style === 'worn' && vnoise(x / 6, y / 6, 8) < 0.35 ? P.red2 : P.red);
    else if (P.eraser) S.px(x, y, mix(P.smudge, T0(i), 0.4)); }
  const job = jobs[0];
  if (job?.kind === 'scan') { const sy = Math.floor(job.y!); for (let k = 0; k < 10; k++) { const yy = sy - k; if (yy < PAPER.y || yy >= PAPER.y + PAPER.h) continue;   // the scan line and its afterglow
    for (let xx = PAPER.x + 1; xx < PAPER.x + PAPER.w - 1; xx++) S.px(xx, yy, k === 0 ? P.line : P.line2, k === 0 ? 0.85 : 0.32 * (1 - k / 10)); } }
  if (P.style === 'screen') { polyhedron(); for (let yy = PAPER.y + 1; yy < PAPER.y + PAPER.h; yy += 2) for (let xx = PAPER.x; xx < PAPER.x + PAPER.w; xx++) S.px(xx, yy, [0, 0, 0], 0.18); }   // scanlines
}
const T0 = (i: number) => { const T = paperTex(), x = i % W - PAPER.x, y = ((i / W) | 0) - PAPER.y; return T[y * PAPER.w + x] ?? SH().paper; };
/** an icosahedron turning slowly in the corner of the screen: the machine is thinking */
const PHI = (1 + Math.sqrt(5)) / 2, ICO: [number, number, number][] = [];
for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ICO.push([0, a, b], [a, b, 0], [b, 0, a]);
const ICO_E: [number, number][] = []; ICO.forEach((p, i) => ICO.forEach((q, j) => { if (j > i && Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - 2) < 1e-6) ICO_E.push([i, j]); }));
function polyhedron() {
  const P = SH(), t = performance.now() / 1000, ay = t * 0.45, ax = 0.5 + Math.sin(t * 0.21) * 0.35, cx = PAPER.x + PAPER.w - 28, cy = PAPER.y + 26, r = 9.5;
  const pr = ICO.map(([x, y, z]) => { const x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay), y1 = y * Math.cos(ax) - z1 * Math.sin(ax), z2 = y * Math.sin(ax) + z1 * Math.cos(ax); return [cx + x1 * r, cy + y1 * r, z2] as const; });
  const order = ICO_E.map(([i, j]) => ({ i, j, z: pr[i]![2] + pr[j]![2] })).sort((a, b) => a.z - b.z);
  for (const { i, j, z } of order) S.line(pr[i]![0], pr[i]![1], pr[j]![0], pr[j]![1], z < 0 ? mix(P.paper, P.line2, 0.45) : P.line, z < 0 ? 1 : 0);
  S.text('형상 연산', cx - 18, cy + 18, P.line2);
}
function arrowLine(x0: number, y0: number, x1: number, y1: number, label: string, col: RGB) {
  const P = SH(); S.line(x0, y0, x1, y1, col);
  if (y0 === y1) { S.px(x0 + 1, y0 - 1, col); S.px(x0 + 1, y0 + 1, col); S.px(x1 - 1, y1 - 1, col); S.px(x1 - 1, y1 + 1, col); const tw = S.tw(label); S.fill(((x0 + x1) >> 1) - (tw >> 1) - 1, y0 - 4, tw + 2, 8, P.paper); S.text(label, ((x0 + x1) >> 1) - (tw >> 1), y0 - 4, col); }
  else { S.px(x0 - 1, y0 + 1, col); S.px(x0 + 1, y0 + 1, col); S.px(x1 - 1, y1 - 1, col); S.px(x1 + 1, y1 - 1, col); S.text(label, x0 + 3, ((y0 + y1) >> 1) - 4, col); }
}
function dims() {
  const P = SH(), m = fig(cur), n = fig(next), V = views(cur), ground = SIDE.y + (100 - V.side.h) + V.side.h - 2;
  const fx = base.wheels[0]!.x / MM + SIDE.x + 2, rx = m.wb / MM + fx, x0 = SIDE.x + 2 + m.x0 / MM, x1 = x0 + m.length / MM, lab = (a: number, b: number) => (a === b ? `${a}` : `${a} → ${b}`);
  arrowLine(fx, ground + 8, rx, ground + 8, lab(m.wb, n.wb), m.wb === n.wb ? P.line2 : P.red);
  arrowLine(x0, ground + 18, x1, ground + 18, lab(m.length, n.length), m.length === n.length ? P.line2 : P.red);
  for (const xx of [fx, rx]) S.line(xx, ground - 3, xx, ground + 10, P.line2, 1);
  arrowLine(x1 + 12, ground - m.height / MM, x1 + 12, ground, lab(m.height, n.height), m.height === n.height ? P.line2 : P.red);
  S.line(SIDE.x - 4, ground, x1 + 30, ground, P.line2, 2);
  const py0 = PLAN.y + 2, py1 = PLAN.y + 2 + m.width / MM, px = x1 + 12; arrowLine(px, py0, px, py1, `${m.width}`, P.line2);
  S.text('옆면도', PAPER.x + 8, PAPER.y + 6, P.label); S.text('평면도', PAPER.x + 8, PLAN.y - 9, P.label);
  const L0 = eff(cur).lights, L1 = eff(next).lights; S.text(L0 === L1 ? lightsName(L0) : `${lightsName(L0)} → ${lightsName(L1)}`, PAPER.x + 50, PAPER.y + 6, L0 === L1 ? P.label : P.red);
}
function cardBox(x: number, y: number, w: number, h: number) { S.fill(x + 2, y + 2, w, h, C.shadow); S.fill(x, y, w, h, C.card); for (let i = 0; i < w; i++) if (rnd(i * 31) < 0.3) S.px(x + i, y, C.card2); }
function tick(x: number, y: number, ok: boolean, col: RGB) {
  S.fill(x, y, 9, 9, hex('#fbf6e6')); S.line(x, y, x + 8, y, C.ink); S.line(x, y + 8, x + 8, y + 8, C.ink); S.line(x, y, x, y + 8, C.ink); S.line(x + 8, y, x + 8, y + 8, C.ink);
  if (ok) { S.line(x + 2, y + 4, x + 3, y + 6, col); S.line(x + 3, y + 6, x + 7, y + 1, col); } else { S.line(x + 2, y + 2, x + 6, y + 6, col); S.line(x + 6, y + 2, x + 2, y + 6, col); } }
const CARD = { x: 330, y: 20, w: 142, h: 118 };
function orderCard() {
  const { x, y, w, h } = CARD; cardBox(x, y, w, h); S.text(ORDER.from, x + 6, y + 4, C.ink, w - 10); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  const m = fig(cur), n = fig(next);
  ORDER.ask.forEach((a, i) => { const yy = y + 18 + i * 16, okNow = a.test(m, cur), okNext = a.test(n, next), changed = pending() && (okNow !== okNext || a.val(m, cur) !== a.val(n, next)), ok = changed ? okNext : okNow;
    tick(x + 6, yy, ok, changed ? C.red : ok ? C.ok : C.bad); S.text(a.t, x + 18, yy - 1, C.ink, w - 22); S.text(changed ? `${a.val(m, cur)} → ${a.val(n, next)}` : a.val(m, cur), x + 18, yy + 7, changed ? C.red : C.inkSoft, w - 22); });
}
function estimateCard() {
  const { x, y, w, h } = CARD; cardBox(x, y, w, h); const E0 = estimate(cur), E = estimate(pending() ? next : cur);
  S.text('견적 (1929년 값)', x + 6, y + 4, C.ink); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  E.rows.forEach(([t, v], i) => { const yy = y + 17 + i * 8, was = E0.rows.find(r => r[0] === t), col = was?.[1] === v ? C.ink : C.red; S.text(t, x + 6, yy, was ? C.inkSoft : C.red, 96); const s = `$${v}`; S.text(s, x + w - 6 - S.tw(s), yy, col); });
  const yt = y + 18 + E.rows.length * 8; S.hline(x + 6, x + w - 6, yt, C.ink);
  const tot = E.total === E0.total ? `$${E.total}` : `$${E0.total} → $${E.total}`; S.text('합계', x + 6, yt + 2, C.ink); S.text(tot, x + w - 6 - S.tw(tot), yt + 2, E.total === E0.total ? C.ink : C.red);
  S.text(`${E.kg}kg · ${E.vmax}km/h · ${E.days}일`, x + 6, yt + 11, C.inkSoft, w - 10);
}
function exteriorCard() {
  const { x, y, w, h } = CARD, e = eff(cur); cardBox(x, y, w, h); S.text('외장 설계 (다음 단계)', x + 6, y + 4, C.ink); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  const lines: [string, string][] = [['차체', `세단 ${lightsName(e.lights)}`], ['그릴', `니켈 껍데기 ${100 + e.grille}%`], ['램프', '바 위 한 쌍'], ['범퍼', e.bumperF && e.bumperR ? '앞뒤' : e.bumperF ? '앞만' : e.bumperR ? '뒤만' : '없음'], ['펜더', e.fenders ? `있음 ${100 + e.fender}%` : '없음'], ['색', '올리브 녹색 (기본)']];
  lines.forEach(([a, b], i) => { S.text(a, x + 6, y + 18 + i * 10, C.inkSoft); S.text(b, x + 40, y + 18 + i * 10, C.ink, w - 46); });
  S.hline(x + 6, x + w - 6, y + 80, C.card2); S.text('여기서 고를 것 (준비 중):', x + 6, y + 84, C.inkSoft); S.text('휠 · 그릴 무늬 · 램프 모양', x + 6, y + 94, C.ink, w - 10); S.text('색 · 몰딩 · 장식', x + 6, y + 104, C.ink, w - 10);
}
/** a brass plate: rounded corners, a bevel lit from the top left, a polished streak, an engraved label. Held down it sinks
 *  into the panel: darker, lit from below, the letters bright */
function brassButton(b: Btn, hot: boolean, down: boolean, dim = false) {
  const { x, y, w, h } = b, R = BRASS, label = b.label(), P = down ? 1 : 0;
  if (!down) S.fill(x + 1, y + 2, w, h - 1, C.shadow);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j); if (cx + cy < 2 && !(cx === 1 && cy === 1)) continue;     // rounded corners
    const t = j / (h - 1); let k = down ? (t < 0.25 ? 0 : t < 0.6 ? 1 : 2) : t < 0.18 ? 4 : t < 0.55 ? 3 : t < 0.85 ? 2 : 1; if (hot && !down) k = Math.min(5, k + 1);
    if (!down && (i + j * 0.6) % 17 < 1.2 && t > 0.15 && t < 0.7) k = Math.min(5, k + 1);                                       // a polished streak
    const edge = cx === 0 || cy === 0 || (cx + cy === 2 && cx === 1); if (edge) k = down ? (j > h / 2 ? 3 : 0) : (i < w / 2 && j < h / 2) ? 4 : 0; if (cx + cy === 2 && cx !== 1 && edge) k = 0;
    if (dim) k = Math.max(0, k - 2); S.px(x + i, y + j + P, R[k]!); }
  if (!down) S.px(x + 2, y + 2, R[5]!);                                                                                             // a glint on the corner
  const tw = S.tw(label), tx = x + ((w - tw) >> 1), ty = y + ((h - 8) >> 1) + P;
  if (down) S.text(label, tx, ty, hex('#fff1c0')); else { S.text(label, tx, ty + 1, R[dim ? 2 : 4]!); S.text(label, tx, ty, R[0]!); }   // engraved: dark letters on a lit lip; pressed: lit letters
}
let hover = '', pressed = '';
function controls() {
  const x = 326, y = 141, w = 150, h = 92; S.fill(x + 2, y + 2, w, h, C.shadow); S.fill(x, y, w, h, C.wood2); S.hline(x, x + w - 1, y, C.wood3); S.hline(x + 2, x + w - 3, y + 14, C.shadow);
  for (const [sx, sy] of [[x + 2, y + 88], [x + w - 4, y + 88]] as const) { S.px(sx, sy, BRASS[4]!); S.px(sx + 1, sy + 1, BRASS[1]!); }   // brass screws
  PAGES[page]!.rows.forEach((d, i) => { const yy = ROW0 + i * PITCH;
    S.text(d.label, 332, yy + 2, C.card);
    if (d.kind === 'num') { const k = d.k as NumKey, r = rng(k);
      if (!r) { S.text('이 시대엔 고정', 404, yy + 2, C.card2); return; }
      const v = d.base!() + next[k], changed = next[k] !== cur[k], bx = 421, bw = 34;
      S.fill(bx, yy, bw, 12, hex('#1a120b')); S.hline(bx, bx + bw - 1, yy + 11, BRASS[2]!); S.vline(bx + bw - 1, yy, yy + 11, BRASS[2]!);
      const s = editing === k ? typed : shown(v, d), tw = S.tw(s); S.text(s, bx + ((bw - tw) >> 1), yy + 2, editing === k ? hex('#fff4c8') : changed ? C.red2 : BRASS[4]!);
      if (editing === k && (performance.now() / 400 | 0) % 2) S.vline(bx + ((bw + tw) >> 1) + 1, yy + 2, yy + 9, hex('#fff4c8')); }
    else if (d.allowed && !d.allowed()) S.text('이 시대엔 필수', 404, yy + 2, C.card2); });
  for (const b of buttons) if ((!b.show || b.show()) && !b.id.endsWith('=') && !b.id.startsWith('tab') && !b.id.startsWith('page')) {
    const changed = b.id.endsWith('!') && (b.id === 'lights!' ? eff(next).lights !== eff(cur).lights : next[b.id.slice(0, -1) as 'rack'] !== cur[b.id.slice(0, -1) as 'rack']);
    brassButton(b, hover === b.id, pressed === b.id, b.off?.()); if (changed) { S.px(b.x + b.w - 4, b.y + 3, C.red2); S.px(b.x + b.w - 3, b.y + 3, C.red2); S.px(b.x + b.w - 4, b.y + 4, C.red); S.px(b.x + b.w - 3, b.y + 4, C.red); } }
  PAGES.forEach((_, pi) => { const b = buttons.find(q => q.id === 'page' + pi)!; brassButton(b, hover === b.id, page === pi); });
  // the sound switch: a little speaker
  const sb = buttons.find(q => q.id === 'sound')!; const sx = sb.x + 3, sy = sb.y + 3; S.fill(sx, sy + 2, 2, 3, BRASS[0]!); for (let k = 0; k < 3; k++) S.vline(sx + 2 + k, sy + 2 - k, sy + 4 + k, BRASS[0]!);
  if (soundOn) { S.px(sx + 6, sy + 2, BRASS[0]!); S.px(sx + 6, sy + 4, BRASS[0]!); S.px(sx + 7, sy + 3, BRASS[0]!); } else { S.px(sx + 6, sy + 1, C.red); S.px(sx + 7, sy + 5, C.red); }
  if (!pending()) S.text(busy() ? '그리는 중… (누르면 빨리)' : `범위: ${RU().label}`, 330, 240, C.card2, 142);
}
/** the three tabs over the card: the one you are on stays pressed in and opens into the card like a folder tab */
function tabs() { for (const [id, v] of [['tab-order', 'order'], ['tab-est', 'estimate'], ['tab-ext', 'exterior']] as const) { const b = buttons.find(q => q.id === id)!, on = view === v;
  brassButton(b, hover === id && !on, on); if (on) { S.fill(b.x + 1, b.y + b.h + 1, b.w - 2, CARD.y - b.y - b.h - 1, C.card); S.vline(b.x, b.y + b.h, CARD.y, C.shadow); } } }
function tools() {
  if (!tool || !SH().eraser) return; const { x, y } = tool;
  if (tool.kind === 'pencil' || tool.kind === 'red') for (let k = 0; k < 16; k++) { const px = x + 1 + k, py = y - 1 - k; S.px(px, py, k < 2 ? SH().line : k < 4 ? BRASS[4]! : tool.kind === 'red' ? C.red : hex('#5c5a62')); S.px(px + 1, py, k < 4 ? BRASS[1]! : C.shadow); }
  else { S.fill(x - 3, y - 7, 8, 6, hex('#d8a0a8')); S.fill(x - 3, y - 2, 8, 2, hex('#b8808a')); S.fill(x - 3, y - 11, 8, 4, hex('#3a5aa0')); S.hline(x - 3, x + 4, y - 7, hex('#f0c8cc')); }
}
// ---------------- the exterior: where the drawing goes next ----------------
let extKey = '', extImg: CarImage | null = null;
function exterior() {
  const key = JSON.stringify(eff(cur)); if (key !== extKey) { extKey = key; extImg = rasterizeFlat(viewDesign(carOf(cur), 'left'), { shadow: true }); }
  const x = PAPER.x, y = PAPER.y, w = PAPER.w, h = PAPER.h; S.fill(x + 3, y + 3, w, h, C.shadow);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.px(x + i, y + j, j < h * 0.62 ? hex(j % 4 === 0 ? '#c9d3d6' : '#d2dcde') : hex(rnd(j * 91 + i) < 0.1 ? '#8c8478' : '#9a9286'));     // the workshop wall and floor
  const im = extImg!, k = Math.max(1, Math.ceil(im.w / (w - 40))), dw = Math.floor(im.w / k), dh = Math.floor(im.h / k), ox = x + ((w - dw) >> 1), oy = y + Math.round(h * 0.62) - Math.round(im.groundY / k);
  for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) { let r = 0, g = 0, b = 0, a = 0;          // the picture is drawn at 10 mm a pixel: shrink it to fit (box filter)
    for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) { const o = ((j * k + v) * im.w + i * k + u) * 4, aa = im.rgba[o + 3]!; r += im.rgba[o]! * aa; g += im.rgba[o + 1]! * aa; b += im.rgba[o + 2]! * aa; a += aa; }
    if (a < 8 * k * k) continue; S.px(ox + i, oy + j, [Math.round(r / a), Math.round(g / a), Math.round(b / a)], Math.min(1, a / (255 * k * k) * 1.2)); }
  S.text('외장 설계 - 다음 단계', x + 8, y + 6, C.ink); S.text('도면의 치수 그대로. 여기서 휠 · 그릴 · 램프 · 색을 고릅니다 (준비 중)', x + 8, y + h - 14, C.ink, w - 16);
}
function frame() { desk(); if (view === 'exterior') exterior(); else { paper(); sheetPixels(); dims(); tools(); }
  if (view === 'estimate') estimateCard(); else if (view === 'exterior') exteriorCard(); else orderCard(); tabs(); controls(); }

// ---------------- page ----------------
const cv = document.getElementById('board') as HTMLCanvasElement, ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H);
cv.width = W; cv.height = H;
const toPx = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H] as const; };
const hit = (x: number, y: number) => buttons.find(b => (!b.show || b.show()) && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
cv.addEventListener('pointermove', ev => { const [x, y] = toPx(ev); hover = hit(x, y)?.id ?? ''; cv.style.cursor = hover ? 'pointer' : 'default'; });
cv.addEventListener('pointerdown', ev => { startSound(); const [x, y] = toPx(ev), b = hit(x, y); if (editing !== null && b?.id !== editing + '=') endTyping(true);
  if (b) { pressed = b.id; if (!b.off?.()) b.on(); ev.preventDefault(); } else if (busy()) fast = true; });
addEventListener('pointerup', () => (pressed = ''));
addEventListener('keydown', e => { if (document.activeElement === typer) return; if (e.key === ' ') { fast = true; e.preventDefault(); } if (e.key === 'Enter' && pending()) apply(); if (e.key === 'Escape' && pending()) cancel(); });
let last = performance.now();
function loop(now: number) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); if (!busy()) fast = false; frame(); S.blit(ctx, img); requestAnimationFrame(loop); }
queue('pencil', [...drawnNow]);
requestAnimationFrame(loop);
