// The drawing board (reviews 26 and 27): a drafting sheet on the workshop desk, the order's checklist and the estimate
// beside it, the 1929 sedan drawn in lines only (side and plan, 1 px = 20 mm). A change is drawn over the drawing in
// red first; "수정" rubs the old lines out and draws the change in; "취소" rubs the red out. The sheet follows the
// company's size and era: worn paper, clean paper, blueprint, black screen. Figures can be typed in. A last tab shows
// where the drawing goes next: the exterior design, in colour. Everything is pixel art in one 480 x 270 buffer.
import { Screen, hex, type RGB } from './pixel/screen';
import { lineMap, edited, measure, strokeOrder, NO_EDIT, type Edit, type LineMap } from './drawing/lines';
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
const views = (e: Edit): Views => { const k = JSON.stringify(e); let v = cache.get(k); if (!v) { const m = edited(base, e); v = { side: lineMap(m, 'left', MM), plan: lineMap(m, 'top', MM) }; cache.set(k, v); } return v; };
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
const cost = (e: Edit) => estimate(measure(edited(base, e)), e).total;
const ORDER = { from: '닥터 하워드 부부', ask: [
  { t: '4도어 세단', test: () => true, val: () => '세단' },
  { t: '머리 공간: 전고 1850 이상', test: (m: Fig) => m.height >= 1850, val: (m: Fig) => `${m.height}` },
  { t: '뒷좌석: 축간 2700 이상', test: (m: Fig) => m.wb >= 2700, val: (m: Fig) => `${m.wb}` },
  { t: '시골길: 지상고 310 이상', test: (m: Fig) => m.clearance >= 310, val: (m: Fig) => `${m.clearance}` },
  { t: '왕진 가방: 짐받이', test: (m: Fig) => m.rack, val: (m: Fig) => (m.rack ? '있음' : '없음') },
  { t: '예산 $1,200 이하', test: (_m: Fig, e: Edit) => cost(e) <= 1200, val: (_m: Fig, e: Edit) => `$${cost(e)}` } ] };
/** a rough estimate from the drawing (first pass: prices of 1929, a bought chassis, the body built in the shop) */
function estimate(m: Fig, e: Edit) {
  const panel = (m.length * 2 + m.wb) / 1000 * (m.height / 1000) * 2.1, labour = 260 + e.wb * 0.25 + e.roof * 0.3 + Math.abs(e.lift) * 0.2 + (e.rack ? 18 : 0);
  const rows: [string, number][] = [['섀시 (구매)', 520], ['강판 ' + panel.toFixed(1) + '제곱m', Math.round(panel * 9)], ['물푸레 골조', Math.round(70 + e.wb * 0.05 + e.roof * 0.06)],
    ['유리 · 지붕 천', Math.round(48 + e.roof * 0.05)], ['도장 · 내장', 95], ...(e.rack ? [['짐받이', 22] as [string, number]] : []), [`노무 ${Math.round(labour)}시간`, Math.round(labour * 0.5)]];
  const total = rows.reduce((a, r) => a + r[1], 0), kg = Math.round(1020 + e.wb * 0.18 + e.roof * 0.15 + (e.rack ? 14 : 0)), vmax = Math.round(105 - e.roof * 0.02 - (e.rack ? 3 : 0) - e.lift * 0.02);
  return { rows, total, kg, vmax, days: Math.ceil(labour / 9) };
}

// ---------------- controls ----------------
type Btn = { id: string; x: number; y: number; w: number; h: number; label: () => string; on: () => void; show?: () => boolean; big?: boolean };
const pending = () => JSON.stringify(cur) !== JSON.stringify(next);
const CTRL = [
  { k: 'wb', label: '축간', step: 50, min: -200, max: 400, base: () => measure(edited(base, NO_EDIT)).wb },
  { k: 'roof', label: '지붕 높이', step: 25, min: -100, max: 200, base: () => measure(edited(base, NO_EDIT)).height },
  { k: 'lift', label: '차체 높이', step: 25, min: -50, max: 100, base: () => measure(edited(base, NO_EDIT)).clearance } ] as const;
let tab: 'order' | 'estimate' = 'order', mode: 'drawing' | 'exterior' = 'drawing', editing: number | null = null, typed = '';
const buttons: Btn[] = [];
CTRL.forEach((c, i) => { const y = 155 + i * 19;
  buttons.push({ id: c.k + '-', x: 404, y, w: 18, h: 16, label: () => '-', on: () => change({ ...next, [c.k]: Math.max(c.min, next[c.k] - c.step) }) });
  buttons.push({ id: c.k + '+', x: 454, y, w: 18, h: 16, label: () => '+', on: () => change({ ...next, [c.k]: Math.min(c.max, next[c.k] + c.step) }) });
  buttons.push({ id: c.k + '=', x: 423, y, w: 30, h: 16, label: () => '', on: () => startTyping(i) }); });
buttons.push({ id: 'rack', x: 404, y: 212, w: 68, h: 16, label: () => (next.rack ? '떼기' : '달기'), on: () => change({ ...next, rack: !next.rack }) });
buttons.push({ id: 'apply', x: 330, y: 233, w: 70, h: 19, label: () => '수정', big: true, on: () => apply(), show: () => pending() });
buttons.push({ id: 'cancel', x: 404, y: 233, w: 68, h: 19, label: () => '취소', big: true, on: () => cancel(), show: () => pending() });
buttons.push({ id: 'tab-order', x: 330, y: 4, w: 46, h: 13, label: () => '주문서', on: () => (tab = 'order') });
buttons.push({ id: 'tab-est', x: 378, y: 4, w: 46, h: 13, label: () => '견적', on: () => (tab = 'estimate') });
buttons.push({ id: 'tab-ext', x: 426, y: 4, w: 46, h: 13, label: () => '외장', on: () => { mode = mode === 'exterior' ? 'drawing' : 'exterior'; } });
buttons.push({ id: 'sheet', x: 330, y: 255, w: 104, h: 13, label: () => '도면: ' + SH().name, on: () => switchSheet() });
buttons.push({ id: 'sound', x: 436, y: 255, w: 36, h: 13, label: () => (soundOn ? '소리' : '무음'), on: () => (soundOn = !soundOn) });

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
function switchSheet() { flush(); sheetNo = (sheetNo + 1) % SHEETS.length; sheet.fill(0); for (const p of drawnNow) sheet[p] = 1; for (const p of redNow) sheet[p] = 2; }

// ---------------- typing a figure ----------------
const typer = document.getElementById('typer') as HTMLInputElement;
function startTyping(i: number) { flush(); editing = i; const c = CTRL[i]!; typed = String(c.base() + next[c.k]); typer.value = typed; typer.focus({ preventScroll: true }); typer.select(); }
function endTyping(ok: boolean) {
  if (editing === null) return; const c = CTRL[editing]!, v = parseInt(typed, 10); editing = null; typer.blur();
  if (ok && Number.isFinite(v)) { const d = Math.round(Math.max(c.min, Math.min(c.max, v - c.base()))); change({ ...next, [c.k]: d }); }
}
typer.addEventListener('input', () => { typed = typer.value.replace(/[^0-9]/g, '').slice(0, 5); typer.value = typed; });
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
  const P = SH(), m = measure(edited(base, cur)), n = measure(edited(base, next)), V = views(cur), ground = SIDE.y + (100 - V.side.h) + V.side.h - 2;
  const fx = base.wheels[0]!.x / MM + SIDE.x + 2, rx = m.wb / MM + fx, x0 = SIDE.x + 2, x1 = x0 + m.length / MM, lab = (a: number, b: number) => (a === b ? `${a}` : `${a} → ${b}`);
  arrowLine(fx, ground + 8, rx, ground + 8, lab(m.wb, n.wb), m.wb === n.wb ? P.line2 : P.red);
  arrowLine(x0, ground + 18, x1, ground + 18, lab(m.length, n.length), m.length === n.length ? P.line2 : P.red);
  for (const xx of [fx, rx]) S.line(xx, ground - 3, xx, ground + 10, P.line2, 1);
  arrowLine(x1 + 12, ground - m.height / MM, x1 + 12, ground, lab(m.height, n.height), m.height === n.height ? P.line2 : P.red);
  S.line(x0 - 6, ground, x1 + 30, ground, P.line2, 2);
  const py0 = PLAN.y + 2, py1 = PLAN.y + 2 + m.width / MM, px = SIDE.x + 2 + m.length / MM + 12; arrowLine(px, py0, px, py1, `${m.width}`, P.line2);
  S.text('옆면도', PAPER.x + 8, PAPER.y + 6, P.label); S.text('평면도', PAPER.x + 8, PLAN.y - 9, P.label);
}
function cardBox(x: number, y: number, w: number, h: number) { S.fill(x + 2, y + 2, w, h, C.shadow); S.fill(x, y, w, h, C.card); for (let i = 0; i < w; i++) if (rnd(i * 31) < 0.3) S.px(x + i, y, C.card2); }
function tick(x: number, y: number, ok: boolean, col: RGB) {
  S.fill(x, y, 9, 9, hex('#fbf6e6')); S.line(x, y, x + 8, y, C.ink); S.line(x, y + 8, x + 8, y + 8, C.ink); S.line(x, y, x, y + 8, C.ink); S.line(x + 8, y, x + 8, y + 8, C.ink);
  if (ok) { S.line(x + 2, y + 4, x + 3, y + 6, col); S.line(x + 3, y + 6, x + 7, y + 1, col); } else { S.line(x + 2, y + 2, x + 6, y + 6, col); S.line(x + 6, y + 2, x + 2, y + 6, col); } }
function orderCard() {
  const x = 330, y = 20, w = 142, h = 128; cardBox(x, y, w, h); S.text(ORDER.from, x + 6, y + 5, C.ink, w - 10); S.hline(x + 6, x + w - 6, y + 15, C.card2);
  const m = measure(edited(base, cur)), n = measure(edited(base, next));
  ORDER.ask.forEach((a, i) => { const yy = y + 19 + i * 18, okNow = a.test(m, cur), okNext = a.test(n, next), changed = pending() && (okNow !== okNext || a.val(m, cur) !== a.val(n, next)), ok = changed ? okNext : okNow;
    tick(x + 6, yy, ok, changed ? C.red : ok ? C.ok : C.bad); S.text(a.t, x + 18, yy, C.ink, w - 22); S.text(changed ? `${a.val(m, cur)} → ${a.val(n, next)}` : a.val(m, cur), x + 18, yy + 9, changed ? C.red : C.inkSoft, w - 22); });
}
function estimateCard() {
  const x = 330, y = 20, w = 142, h = 128; cardBox(x, y, w, h); const e = pending() ? next : cur, E0 = estimate(measure(edited(base, cur)), cur), E = estimate(measure(edited(base, e)), e);
  S.text('견적 (1929년 값)', x + 6, y + 5, C.ink); S.hline(x + 6, x + w - 6, y + 15, C.card2);
  E.rows.forEach(([t, v], i) => { const yy = y + 19 + i * 9; S.text(t, x + 6, yy, C.inkSoft, 90); const s = `$${v}`; S.text(s, x + w - 6 - S.tw(s), yy, C.ink); });
  const yt = y + 19 + E.rows.length * 9 + 1; S.hline(x + 6, x + w - 6, yt, C.ink);
  const tot = E.total === E0.total ? `$${E.total}` : `$${E0.total} → $${E.total}`; S.text('합계', x + 6, yt + 3, C.ink); S.text(tot, x + w - 6 - S.tw(tot), yt + 3, E.total === E0.total ? C.ink : C.red);
  S.text(`무게 ${E.kg}kg · 최고 ${E.vmax}km/h`, x + 6, yt + 14, C.inkSoft, w - 10); S.text(`제작 기간 ${E.days}일 (9시간/일)`, x + 6, yt + 23, C.inkSoft, w - 10);
}
/** a brass plate: rounded corners, a bevel lit from the top left, a polished streak, an engraved label; pressed when held */
function brassButton(b: Btn, hot: boolean, down: boolean) {
  const { x, y, w, h } = b, R = BRASS, label = b.label(), P = down ? 1 : 0;
  S.fill(x + 1, y + 2, w, h - 1, C.shadow);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j); if (cx + cy < 2 && !(cx === 1 && cy === 1)) continue;     // rounded corners
    const t = j / (h - 1); let k = down ? (t < 0.5 ? 2 : 3) : t < 0.18 ? 4 : t < 0.55 ? 3 : t < 0.85 ? 2 : 1; if (hot && !down) k = Math.min(5, k + 1);
    if (!down && (i + j * 0.6) % 17 < 1.2 && t > 0.15 && t < 0.7) k = Math.min(5, k + 1);                                       // a polished streak
    const edge = cx === 0 || cy === 0 || (cx + cy === 2 && cx === 1); if (edge) k = (i < w / 2 && j < h / 2) !== down ? 4 : 0; if (cx + cy === 2 && cx !== 1 && edge) k = 0;
    S.px(x + i, y + j + P, R[k]!); }
  S.px(x + 2, y + 2 + P, R[5]!);                                                                                                    // a glint on the corner
  const tw = S.tw(label), tx = x + ((w - tw) >> 1), ty = y + ((h - 8) >> 1) + P; S.text(label, tx, ty + 1, R[4]!); S.text(label, tx, ty, R[0]!);   // engraved: dark letters, lit lower lip
}
let hover = '', pressed = '';
function controls() {
  const x = 326, y = 150; S.fill(x + 2, y + 2, 150, 80, C.shadow); S.fill(x, y, 150, 80, C.wood2); S.hline(x, x + 149, y, C.wood3);
  for (const [sx, sy] of [[x + 2, y + 2], [x + 146, y + 2], [x + 2, y + 76], [x + 146, y + 76]] as const) { S.px(sx, sy, BRASS[4]!); S.px(sx + 1, sy + 1, BRASS[1]!); }   // brass screws
  CTRL.forEach((c, i) => { const yy = 155 + i * 19, v = c.base() + next[c.k], changed = next[c.k] !== cur[c.k]; S.text(c.label, 332, yy + 4, C.card);
    // the figure's window: a recessed dark plate; typing shows a caret
    const bx = 423, bw = 30; S.fill(bx, yy, bw, 16, hex('#1a120b')); S.hline(bx, bx + bw - 1, yy + 15, BRASS[2]!); S.vline(bx + bw - 1, yy, yy + 15, BRASS[2]!);
    const s = editing === i ? typed : `${v}`, tw = S.tw(s); S.text(s, bx + ((bw - tw) >> 1), yy + 4, editing === i ? hex('#fff4c8') : changed ? C.red2 : BRASS[4]!);
    if (editing === i && (performance.now() / 400 | 0) % 2) S.vline(bx + ((bw + tw) >> 1) + 1, yy + 3, yy + 12, hex('#fff4c8')); });
  S.text('지붕 짐받이', 332, 216, C.card);
  for (const b of buttons) if ((!b.show || b.show()) && !b.id.endsWith('=')) brassButton(b, hover === b.id, pressed === b.id);
  if (!pending()) S.text(busy() ? '그리는 중… (누르면 빨리)' : '바꾸거나 숫자를 눌러 입력', 332, 238, C.card2, 140);
}
function tabs() { for (const id of ['tab-order', 'tab-est', 'tab-ext']) { const b = buttons.find(q => q.id === id)!, on = (id === 'tab-order' && tab === 'order' && mode === 'drawing') || (id === 'tab-est' && tab === 'estimate' && mode === 'drawing') || (id === 'tab-ext' && mode === 'exterior'); brassButton(b, hover === id || on, on); } }
function tools() {
  if (!tool || !SH().eraser) return; const { x, y } = tool;
  if (tool.kind === 'pencil' || tool.kind === 'red') for (let k = 0; k < 16; k++) { const px = x + 1 + k, py = y - 1 - k; S.px(px, py, k < 2 ? SH().line : k < 4 ? BRASS[4]! : tool.kind === 'red' ? C.red : hex('#5c5a62')); S.px(px + 1, py, k < 4 ? BRASS[1]! : C.shadow); }
  else { S.fill(x - 3, y - 7, 8, 6, hex('#d8a0a8')); S.fill(x - 3, y - 2, 8, 2, hex('#b8808a')); S.fill(x - 3, y - 11, 8, 4, hex('#3a5aa0')); S.hline(x - 3, x + 4, y - 7, hex('#f0c8cc')); }
}
// ---------------- the exterior: where the drawing goes next ----------------
let extKey = '', extImg: CarImage | null = null;
function exterior() {
  const key = JSON.stringify(cur); if (key !== extKey) { extKey = key; extImg = rasterizeFlat(viewDesign(edited(base, cur), 'left'), { shadow: true }); }
  const x = PAPER.x, y = PAPER.y, w = PAPER.w, h = PAPER.h; S.fill(x + 3, y + 3, w, h, C.shadow);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.px(x + i, y + j, j < h * 0.62 ? hex(j % 4 === 0 ? '#c9d3d6' : '#d2dcde') : hex(rnd(j * 91 + i) < 0.1 ? '#8c8478' : '#9a9286'));     // the workshop wall and floor
  const im = extImg!, k = Math.max(1, Math.ceil(im.w / (w - 40))), dw = Math.floor(im.w / k), dh = Math.floor(im.h / k), ox = x + ((w - dw) >> 1), oy = y + Math.round(h * 0.62) - Math.round(im.groundY / k);
  for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) { let r = 0, g = 0, b = 0, a = 0;          // the picture is drawn at 10 mm a pixel: shrink it to fit (box filter)
    for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) { const o = ((j * k + v) * im.w + i * k + u) * 4, aa = im.rgba[o + 3]!; r += im.rgba[o]! * aa; g += im.rgba[o + 1]! * aa; b += im.rgba[o + 2]! * aa; a += aa; }
    if (a < 8 * k * k) continue; S.px(ox + i, oy + j, [Math.round(r / a), Math.round(g / a), Math.round(b / a)], Math.min(1, a / (255 * k * k) * 1.2)); }
  S.text('외장 설계 - 다음 단계', x + 8, y + 6, C.ink); S.text('도면의 치수 그대로. 여기서 휠 · 그릴 · 램프 · 색을 고릅니다 (준비 중)', x + 8, y + h - 14, C.ink, w - 16);
}
function frame() { desk(); if (mode === 'exterior') exterior(); else { paper(); sheetPixels(); dims(); tools(); }
  if (tab === 'estimate') estimateCard(); else orderCard(); tabs(); controls(); }

// ---------------- page ----------------
const cv = document.getElementById('board') as HTMLCanvasElement, ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H);
cv.width = W; cv.height = H;
const toPx = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H] as const; };
const hit = (x: number, y: number) => buttons.find(b => (!b.show || b.show()) && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
cv.addEventListener('pointermove', ev => { const [x, y] = toPx(ev); hover = hit(x, y)?.id ?? ''; cv.style.cursor = hover ? 'pointer' : 'default'; });
cv.addEventListener('pointerdown', ev => { startSound(); const [x, y] = toPx(ev), b = hit(x, y); if (editing !== null && b?.id !== CTRL[editing]!.k + '=') endTyping(true);
  if (b) { pressed = b.id; b.on(); ev.preventDefault(); } else if (busy()) fast = true; });
addEventListener('pointerup', () => (pressed = ''));
addEventListener('keydown', e => { if (document.activeElement === typer) return; if (e.key === ' ') { fast = true; e.preventDefault(); } if (e.key === 'Enter' && pending()) apply(); if (e.key === 'Escape' && pending()) cancel(); });
let last = performance.now();
function loop(now: number) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); if (!busy()) fast = false; frame(); S.blit(ctx, img); requestAnimationFrame(loop); }
queue('pencil', [...drawnNow]);
requestAnimationFrame(loop);
