// The drawing board as a scene of the game (reviews 26, 32; roadmap step 4): the order's checklist, the drawing in lines
// on the sheet the company can afford, red changes, the estimate and a first look at the exterior. It knows nothing of
// the rest of the game: the order comes in as a spec (a customer's inquiry, or the demo's made-up order) and the
// finished design goes out through spec.done.
import type { App, Scene } from '../shell/app';
import { split, rows, BRASS, COL, mix, rnd } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { lineMap, edited, measure, strokeOrder, fits, NO_EDIT, type Edit, type LineMap, type Frame } from '../drawing/lines';
import { rules, ERAS, type Era, type NumKey, type Rules } from '../drawing/rules';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import type { CarImage } from '../../render/car/raster';
import model from '../../data/cars/sedan29.json';
import frameJson from '../../data/cars/sedan29_frame.json';

export type Fig = ReturnType<typeof measure>;
export interface Est { rows: [string, number][]; total: number; kg: number; vmax: number; days: number }
/** one line of the order's checklist: true, false, or null for "not known yet / decided at a later stage" */
export interface Ask { t: string; test: (m: Fig, e: Edit, x: Est) => boolean | null; val: (m: Fig, e: Edit, x: Est) => string }
export interface DrawingSpec { from: string; asks: Ask[]; era: Era; size: number; demo?: boolean; start?: Edit; title?: string;
  done?: (r: { edit: Edit; fig: Fig; est: Est }) => void; back?: () => void }
export const lightsName = (l: number) => (l === 2 ? '2도어' : `${l}라이트`);
const LATER = (t: string, why: string): Ask => ({ t, test: () => null, val: () => why });
/** the checklist from what a customer has said so far (core/sales view): body, must-haves, budget, date */
export function standardAsks(o: { body: string; mustHave?: string[]; budget?: [number, number]; daysLeft?: number }): Ask[] {
  const out: Ask[] = [];
  if (o.body === 'sedan') out.push({ t: '4도어 세단', test: m => m.lights !== 2, val: m => `세단 ${lightsName(m.lights)}` });
  else if (o.body === 'coupe') out.push({ t: '2도어 차', test: m => m.lights === 2, val: m => lightsName(m.lights) });
  else out.push({ t: `차종: ${o.body}`, test: () => false, val: () => '이 도면은 세단뿐' });
  if (!o.mustHave) out.push(LATER('꼭 필요한 것', '상담하면 드러남'));
  else for (const k of o.mustHave) out.push(
    k === 'closed_roof' ? { t: '닫힌 지붕', test: () => true, val: () => '세단 지붕' } :
    k === 'folding_top' ? { t: '접이식 지붕', test: () => false, val: () => '세단은 불가' } :
    k === 'four_seats' ? { t: '네 사람 자리', test: () => true, val: () => '앞뒤 좌석' } :
    k === 'big_boot' ? { t: '큰 짐칸', test: m => m.rack, val: m => (m.rack ? '짐받이' : '없음') } :
    k === 'high_clearance' ? { t: '높은 지상고 (320 이상)', test: m => m.clearance >= 320, val: m => `${m.clearance}` } :
    k === 'fast' ? { t: '빠른 차 (105 이상)', test: (_m, _e, x) => x.vmax >= 105, val: (_m, _e, x) => `${x.vmax}km/h` } :
    LATER(({ dark_colour: '짙은 색', two_tone: '투톤 도장', quiet: '조용한 차', sidemount_spare: '옆 스페어' } as Record<string, string>)[k] ?? k, '다음 단계에서'));
  out.push(o.budget ? { t: `예산 $${o.budget[1]} 이하`, test: (_m, _e, x) => x.total <= o.budget![1], val: (_m, _e, x) => `$${x.total}` } : LATER('예산', '상담하면 드러남'));
  if (o.daysLeft !== undefined) out.push({ t: `${o.daysLeft}일 안에`, test: (_m, _e, x) => x.days <= o.daysLeft!, val: (_m, _e, x) => `제작 ${x.days}일 (설계 빼고)` });
  return out.slice(0, 6);
}

export function drawingScene(app: App, spec: DrawingSpec): Scene {
const W = 480, H = 270, MM = 20, S = app.S, sound = (kind: number, on: number) => app.sound.play(on ? (kind === 1 ? 'pencil' : 'eraser') : '');
const C = { wood: hex('#5a3b26'), wood2: hex('#4a2f1e'), wood3: hex('#6b4730'), ink: hex('#2b2620'), inkSoft: hex('#6b5d48'), ok: hex('#3f6e3a'), bad: hex('#a8402c'),
  card: hex('#f2ead2'), card2: hex('#e2d6b6'), shadow: hex('#2e1d12'), red: hex('#b8322a'), red2: hex('#d0614f') };
// brass, six steps from deep shadow to the polished highlight, for buttons and fittings

// ---------------- the four sheets ----------------
interface Sheet { name: string; who: string; paper: RGB; paper2: RGB; paper3: RGB; grid: RGB; line: RGB; line2: RGB; red: RGB; red2: RGB; smudge: RGB; label: RGB; eraser: boolean; worn: boolean; style: 'worn' | 'clean' | 'blue' | 'screen' }
const SHEETS: Sheet[] = [
  { name: '닳은 제도지', who: '소규모 공방', paper: hex('#e6d8b2'), paper2: hex('#d9c99e'), paper3: hex('#cdbb8c'), grid: hex('#d6c79f'), line: hex('#3d3c44'), line2: hex('#5c5a62'), red: hex('#b8322a'), red2: hex('#d0614f'), smudge: hex('#c4b48a'), label: hex('#6b5d48'), eraser: true, worn: true, style: 'worn' },
  { name: '깔끔한 제도지', who: '설계실이 있는 제작소', paper: hex('#f4f1e6'), paper2: hex('#e9e5d6'), paper3: hex('#d9d4c2'), grid: hex('#e4e8e8'), line: hex('#1d2430'), line2: hex('#3a4352'), red: hex('#c0312a'), red2: hex('#d85a4a'), smudge: hex('#e2ddcb'), label: hex('#4a5260'), eraser: true, worn: false, style: 'clean' },
  { name: '청사진', who: '중견 · 설계 부서', paper: hex('#1f4f8a'), paper2: hex('#1b477d'), paper3: hex('#163c6c'), grid: hex('#2a5c98'), line: hex('#e8f0f8'), line2: hex('#b8cce4'), red: hex('#ffd060'), red2: hex('#ffe598'), smudge: hex('#245590'), label: hex('#b8cce4'), eraser: false, worn: false, style: 'blue' },
  { name: '검은 화면', who: '대기업 · 1980년대 이후', paper: hex('#0c0f14'), paper2: hex('#10141a'), paper3: hex('#161b22'), grid: hex('#151c26'), line: hex('#e6f2ff'), line2: hex('#8fb8e0'), red: hex('#ff6a4a'), red2: hex('#ff9a80'), smudge: hex('#12171e'), label: hex('#8fb8e0'), eraser: false, worn: false, style: 'screen' } ];
let sheetNo = spec.size; const SH = () => SHEETS[sheetNo]!;

// ---------------- the drawing ----------------
const base = model as unknown as CarModel;
let cur: Edit = { ...NO_EDIT, ...spec.start }, next: Edit = { ...cur };
const PAPER = { x: 6, y: 6, w: 316, h: 258 }, SIDE = { x: 22, y: 20 }, PLAN = { x: 22, y: 150 };
type Views = { side: LineMap; plan: LineMap };
const cache = new Map<string, Views>();
const FR = frameJson as unknown as Frame;
let eraNo = ERAS.indexOf(spec.era); const RU = (): Rules => rules(ERAS[eraNo]!, sheetNo);
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

type Fig = ReturnType<typeof measure>;
const fig = (e: Edit) => measure(carOf(e)), B0 = fig(NO_EDIT);
const cost = (e: Edit) => estimate(e).total;
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
const pending = () => JSON.stringify(eff(cur)) !== JSON.stringify(eff(next)) || JSON.stringify(cur) !== JSON.stringify(next);
type RowDef = { k: keyof Edit; label: string; kind: 'num' | 'bool' | 'lights'; base?: () => number; unit?: string; yes?: string; no?: string; allowed?: () => boolean };
const lampZ0 = (() => { const l = base.parts.find(p => p.id === 'lamp')!; return Math.round((l.box.z[0] + l.box.z[1]) / 2); })();
const PAGES: { name: string; rows: RowDef[] }[] = [
  { name: '차체', rows: [{ k: 'wb', label: '축간', kind: 'num', base: () => B0.wb }, { k: 'door', label: '앞문 길이', kind: 'num', base: () => FR.B - FR.A }, { k: 'lights', label: '옆창 배치', kind: 'lights' },
    { k: 'roof', label: '지붕 높이', kind: 'num', base: () => B0.height }, { k: 'lift', label: '차체 높이', kind: 'num', base: () => B0.clearance }, { k: 'rack', label: '지붕 짐받이', kind: 'bool', yes: '있음', no: '없음' }] },
  { name: '앞모습', rows: [{ k: 'lampX', label: '램프 앞뒤', kind: 'num', base: () => 0 }, { k: 'lampZ', label: '램프 높이', kind: 'num', base: () => lampZ0 },
    { k: 'grilleX', label: '그릴 앞뒤', kind: 'num', base: () => 0 }, { k: 'grille', label: '그릴 크기', kind: 'num', base: () => 100, unit: '%' }] },
  { name: '범퍼 · 펜더', rows: [{ k: 'bumperF', label: '앞 범퍼', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().bumpersOff }, { k: 'bumperR', label: '뒤 범퍼', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().bumpersOff },
    { k: 'bumper', label: '범퍼 크기', kind: 'num', base: () => 100, unit: '%' }, { k: 'fenders', label: '펜더 · 발판', kind: 'bool', yes: '있음', no: '없음', allowed: () => RU().fendersOff },
    { k: 'fender', label: '펜더 크기', kind: 'num', base: () => 100, unit: '%' }] } ];
let view: 'order' | 'estimate' | 'exterior' = 'order', page = 0;
const rng = (k: keyof Edit) => RU().r[k as NumKey] ?? null;
const shown = (v: number, d: RowDef) => (d.base!() === 0 ? (v > 0 ? `+${v}` : `${v}`) : `${v}`) + (d.unit ?? '');
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

// ---------------- drawing the screen ----------------
function desk() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const g = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, g > 0.75 ? C.wood3 : g < -0.7 ? C.wood2 : C.wood); } }
// ---------------- paper, ink and screens ----------------
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

// ---------------- cards, tabs, controls ----------------
const ui = app.ui, CARD = { x: 330, y: 20, w: 142, h: 118 };
function orderCard() {
  const { x, y, w, h } = CARD; ui.panel(CARD, 'card'); ui.label({ x: x + 6, y: y + 3, w: w - 12, h: 10 }, spec.from, C.ink); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  const m = fig(cur), n = fig(next), xe = estimate(cur), xn = estimate(next);
  spec.asks.forEach((a, i) => { const yy = y + 18 + i * 16, okNow = a.test(m, cur, xe), okNext = a.test(n, next, xn), vNow = a.val(m, cur, xe), vNext = a.val(n, next, xn), changed = pending() && (okNow !== okNext || vNow !== vNext), ok = changed ? okNext : okNow;
    ui.tick(x + 6, yy, ok, changed ? C.red : ok ? C.ok : C.bad); ui.label({ x: x + 18, y: yy - 2, w: w - 22, h: 9 }, a.t, C.ink); ui.label({ x: x + 18, y: yy + 6, w: w - 22, h: 9 }, changed ? `${vNow} → ${vNext}` : vNow, changed ? C.red : C.inkSoft); });
  void h;
}
function estimateCard() {
  const { x, y, w } = CARD; ui.panel(CARD, 'card'); const E0 = estimate(cur), E = estimate(pending() ? next : cur);
  ui.label({ x: x + 6, y: y + 3, w: w - 12, h: 10 }, '견적 (1929년 값)', C.ink); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  E.rows.forEach(([t, v], i) => { const yy = y + 16 + i * 8, was = E0.rows.find(r => r[0] === t), s = `$${v}`; ui.label({ x: x + 6, y: yy, w: 96, h: 8 }, t, was ? C.inkSoft : C.red); ui.label({ x: x + w - 40, y: yy, w: 34, h: 8 }, s, was?.[1] === v ? C.ink : C.red, 'r'); });
  const yt = y + 18 + E.rows.length * 8; S.hline(x + 6, x + w - 6, yt, C.ink);
  const tot = E.total === E0.total ? `$${E.total}` : `$${E0.total} → $${E.total}`; ui.label({ x: x + 6, y: yt + 1, w: 30, h: 9 }, '합계', C.ink); ui.label({ x: x + 36, y: yt + 1, w: w - 42, h: 9 }, tot, E.total === E0.total ? C.ink : C.red, 'r');
  ui.label({ x: x + 6, y: yt + 10, w: w - 12, h: 9 }, `${E.kg}kg · ${E.vmax}km/h · ${E.days}일`, C.inkSoft);
}
function exteriorCard() {
  const { x, y, w } = CARD, e = eff(cur); ui.panel(CARD, 'card'); ui.label({ x: x + 6, y: y + 3, w: w - 12, h: 10 }, '외장 설계 (다음 단계)', C.ink); S.hline(x + 6, x + w - 6, y + 14, C.card2);
  const lines: [string, string][] = [['차체', `세단 ${lightsName(e.lights)}`], ['그릴', `니켈 껍데기 ${100 + e.grille}%`], ['램프', '바 위 한 쌍'], ['범퍼', e.bumperF && e.bumperR ? '앞뒤' : e.bumperF ? '앞만' : e.bumperR ? '뒤만' : '없음'], ['펜더', e.fenders ? `있음 ${100 + e.fender}%` : '없음'], ['색', '올리브 녹색 (기본)']];
  lines.forEach(([a, b], i) => { ui.label({ x: x + 6, y: y + 17 + i * 10, w: 32, h: 9 }, a, C.inkSoft); ui.label({ x: x + 40, y: y + 17 + i * 10, w: w - 46, h: 9 }, b, C.ink); });
  S.hline(x + 6, x + w - 6, y + 80, C.card2); ui.label({ x: x + 6, y: y + 83, w: w - 12, h: 9 }, '여기서 고를 것 (준비 중):', C.inkSoft);
  ui.label({ x: x + 6, y: y + 93, w: w - 12, h: 9 }, '휠 · 그릴 무늬 · 램프 모양', C.ink); ui.label({ x: x + 6, y: y + 103, w: w - 12, h: 9 }, '색 · 몰딩 · 장식', C.ink);
}
function tabs() { const r = split({ x: 330, y: 4, w: 142, h: 13 }, ['*', '*', '*'], 2);
  ([['tab-order', 'order', '주문서'], ['tab-est', 'estimate', '견적'], ['tab-ext', 'exterior', '외장']] as const).forEach(([id, v, t], i) => { if (ui.tab(id, r[i]!, t, view === v, CARD.y)) view = v; }); }
function speaker(r: { x: number; y: number }) { const sx = r.x + 3, sy = r.y + 3; S.fill(sx, sy + 2, 2, 3, BRASS[0]!); for (let k = 0; k < 3; k++) S.vline(sx + 2 + k, sy + 2 - k, sy + 4 + k, BRASS[0]!);
  if (app.sound.on) { S.px(sx + 6, sy + 2, BRASS[0]!); S.px(sx + 6, sy + 4, BRASS[0]!); S.px(sx + 7, sy + 3, BRASS[0]!); } else { S.px(sx + 6, sy + 1, C.red); S.px(sx + 7, sy + 5, C.red); } }
function controls() {
  ui.panel({ x: 326, y: 141, w: 150, h: 92 }, 'plate'); S.hline(328, 473, 155, C.shadow);
  const tr = split({ x: 330, y: 143, w: 142, h: 11 }, ['*', '*', '*'], 2); PAGES.forEach((pg, i) => { if (ui.tab('page' + i, tr[i]!, pg.name, page === i)) page = i; });
  const P = PAGES[page]!, rr = rows({ x: 332, y: 157, w: 140, h: 12 }, P.rows.length, 12, 1);
  P.rows.forEach((d, i) => { const [lr, cr] = split(rr[i]!, [68, '*'], 4); ui.label(lr!, d.label, C.card);
    if (d.kind === 'num') { const k = d.k as NumKey, r = rng(k); if (!r) { ui.label(cr!, '이 시대엔 고정', C.card2); return; }
      const v = ui.stepper(k, cr!, next[k], r, x => shown(d.base!() + x, d), d.base!(), next[k] !== cur[k]); if (v !== null) change({ ...next, [k]: v }); }
    else if (d.kind === 'bool') { const k = d.k as 'rack' | 'bumperF' | 'bumperR' | 'fenders'; if (d.allowed && !d.allowed()) { ui.label(cr!, '이 시대엔 필수', C.card2); return; }
      if (ui.button(k, cr!, next[k] ? d.yes! : d.no!, { mark: next[k] !== cur[k] })) change({ ...next, [k]: !next[k] }); }
    else { const L = eff(next).lights; if (ui.button('lights', cr!, L === next.lights ? lightsName(L) : `${lightsName(L)} 자동`, { mark: L !== eff(cur).lights })) change({ ...next, lights: next.lights === 6 ? 4 : next.lights === 4 ? 2 : 6 }); } });
  const act = split({ x: 330, y: 236, w: 142, h: 17 }, ['*', '*'], 4);
  if (pending()) { if (ui.button('apply', act[0]!, '수정')) apply(); if (ui.button('cancel', act[1]!, '취소')) cancel(); }
  else if (!spec.demo) { if (ui.button('back', act[0]!, '책상으로')) spec.back?.(); if (ui.button('done', act[1]!, '설계 확정', { disabled: busy() })) spec.done?.({ edit: { ...eff(cur) }, fig: fig(cur), est: estimate(cur) }); }
  else ui.label({ x: 330, y: 240, w: 142, h: 9 }, busy() ? '그리는 중… (누르면 빨리)' : '바꾸면 빨간 선, 숫자는 눌러 입력', C.card2);
  if (spec.demo) { const [a, b, c] = split({ x: 330, y: 256, w: 142, h: 12 }, [82, '*', 14], 2);
    if (ui.button('sheet', a!, '도면: ' + SH().name)) switchSheet(); if (ui.button('era', b!, ['1920년대', '1935', '1939'][eraNo]!)) { flush(); eraNo = (eraNo + 1) % ERAS.length; clampAll(); }
    if (ui.button('sound', c!, '')) app.sound.on = !app.sound.on; speaker(c!); }
  else { const [a, c] = split({ x: 330, y: 256, w: 142, h: 12 }, ['*', 14], 2); ui.label(a!, `범위: ${RU().label}`, C.card2); if (ui.button('sound', c!, '')) app.sound.on = !app.sound.on; speaker(c!); }
}
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

queue('pencil', [...drawnNow]);
return {
  id: 'drawing',
  frame(_app, dt) { step(dt); if (!busy()) fast = false; desk(); if (view === 'exterior') exterior(); else { paper(); sheetPixels(); dims(); tools(); }
    if (view === 'estimate') estimateCard(); else if (view === 'exterior') exteriorCard(); else orderCard(); tabs(); controls();
    if (ui.missed() && busy()) fast = true; },
  key(_app, e) { if (e.key === ' ') { fast = true; return true; } if (e.key === 'Enter' && pending()) { apply(); return true; } if (e.key === 'Escape' && pending()) { cancel(); return true; } return false; },
};
}
