// The drawing board, first demo (reviews 26 and 27): a worn drafting sheet on a workshop desk, the order's checklist
// beside it, the 1929 sedan drawn in pencil lines only (side and plan, 1 px = 20 mm). A change is drawn over the
// drawing in red pencil first; "수정" rubs the old lines out with an eraser and draws the change in pencil; "취소"
// rubs the red out. Everything is pixel art in one 480 x 270 buffer.
import { Screen, hex, type RGB } from './pixel/screen';
import { lineMap, edited, measure, strokeOrder, NO_EDIT, type Edit, type LineMap } from './drawing/lines';
import type { CarModel } from '../render/car/model';
import model from '../data/cars/sedan29.json';

const W = 480, H = 270, MM = 20, S = new Screen(W, H);
const C = { wood: hex('#5a3b26'), wood2: hex('#4a2f1e'), wood3: hex('#6b4730'), paper: hex('#e6d8b2'), paper2: hex('#d9c99e'), paper3: hex('#cdbb8c'), grid: hex('#d6c79f'),
  lead: hex('#3d3c44'), lead2: hex('#5c5a62'), red: hex('#b8322a'), red2: hex('#d0614f'), smudge: hex('#c4b48a'), ink: hex('#2b2620'), inkSoft: hex('#6b5d48'),
  brass: hex('#c8a050'), brass2: hex('#e8c878'), brass3: hex('#8a6a30'), ok: hex('#3f6e3a'), bad: hex('#a8402c'), card: hex('#f2ead2'), shadow: hex('#2e1d12') };

// ---------------- the drawing ----------------
const base = model as unknown as CarModel;
let cur: Edit = { ...NO_EDIT }, next: Edit = { ...NO_EDIT };
const PAPER = { x: 6, y: 6, w: 316, h: 258 };
const SIDE = { x: 22, y: 20 }, PLAN = { x: 22, y: 150 };
type Views = { side: LineMap; plan: LineMap };
const views = (e: Edit): Views => { const m = edited(base, e); return { side: lineMap(m, 'left', MM), plan: lineMap(m, 'top', MM) }; };
// the sheet: what is on the paper now, pixel by pixel (0 paper, 1 pencil, 2 red, 3 smudge left by the eraser)
const sheet = new Uint8Array(W * H);
const put = (L: LineMap, ox: number, oy: number, v: number, into: Set<number>) => { for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.on[y * L.w + x]) into.add((oy + y) * W + ox + x); };
const pixelsOf = (V: Views) => { const s = new Set<number>(); put(V.side, SIDE.x, SIDE.y + (100 - V.side.h), 1, s); put(V.plan, PLAN.x, PLAN.y, 1, s); return s; };
let drawnNow = pixelsOf(views(cur)); for (const p of drawnNow) sheet[p] = 1;
let redNow = new Set<number>();

// ---------------- animation: a queue of pencil and eraser strokes ----------------
type Job = { kind: 'pencil' | 'red' | 'erase' | 'unred'; pix: number[]; i: number; then?: () => void };
const jobs: Job[] = []; let tool: { kind: Job['kind']; x: number; y: number } | null = null, fast = false;
const queue = (kind: Job['kind'], pix: Set<number> | number[], then?: () => void) => { const arr = [...pix]; jobs.push({ kind, pix: kind === 'erase' || kind === 'unred' ? arr.sort((a, b) => (a % W) - (b % W) || a - b) : strokeOrder(arr, W), i: 0, then }); };
function step(dt: number) {
  const job = jobs[0]; if (!job) { tool = null; sound(0, 0); return; }
  const rate = (fast ? 6000 : job.kind === 'erase' || job.kind === 'unred' ? 700 : job.kind === 'red' ? 900 : 420) * dt; let n = Math.max(1, Math.round(rate));
  while (n-- > 0 && job.i < job.pix.length) { const p = job.pix[job.i++]!;
    if (job.kind === 'pencil') sheet[p] = 1; else if (job.kind === 'red') sheet[p] = 2;
    else { const x = p % W, y = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (job.kind === 'erase' ? sheet[q] === 1 && !drawnKeep.has(q) : sheet[q] === 2) sheet[q] = job.kind === 'erase' ? 3 : 0; else if (job.kind === 'erase' && sheet[q] === 0 && Math.random() < 0.15) sheet[q] = 3; } }
    tool = { kind: job.kind, x: p % W, y: (p / W) | 0 }; }
  sound(job.kind === 'pencil' || job.kind === 'red' ? 1 : 2, fast ? 0 : 1);
  if (job.i >= job.pix.length) { jobs.shift(); job.then?.(); }
}
let drawnKeep = new Set<number>();

// ---------------- what the order asks for ----------------
const ORDER = { from: '닥터 하워드 부부', ask: [
  { k: 'style', t: '4도어 세단', test: (m: ReturnType<typeof measure>) => true, val: () => '세단' },
  { k: 'height', t: '머리 공간: 전고 1850 이상', test: (m: ReturnType<typeof measure>) => m.height >= 1850, val: (m: ReturnType<typeof measure>) => `${m.height}` },
  { k: 'wb', t: '뒷좌석: 축간 2700 이상', test: (m: ReturnType<typeof measure>) => m.wb >= 2700, val: (m: ReturnType<typeof measure>) => `${m.wb}` },
  { k: 'clear', t: '시골길: 지상고 310 이상', test: (m: ReturnType<typeof measure>) => m.clearance >= 310, val: (m: ReturnType<typeof measure>) => `${m.clearance}` },
  { k: 'rack', t: '왕진 가방: 짐받이', test: (m: ReturnType<typeof measure>) => m.rack, val: (m: ReturnType<typeof measure>) => (m.rack ? '있음' : '없음') },
  { k: 'cost', t: '예산 $1,200 이하', test: (_m: ReturnType<typeof measure>, e: Edit) => cost(e) <= 1200, val: (_m: ReturnType<typeof measure>, e: Edit) => `$${cost(e)}` } ] };
const cost = (e: Edit) => Math.round(1000 + e.wb * 0.6 + e.roof * 0.8 + e.lift * 0.5 + (e.rack ? 45 : 0));

// ---------------- controls ----------------
type Btn = { id: string; x: number; y: number; w: number; h: number; label: string; on: () => void; show?: () => boolean; big?: boolean };
const pending = () => JSON.stringify(cur) !== JSON.stringify(next);
const CTRL = [
  { k: 'wb', label: '축간', step: 100, min: -200, max: 400, unit: 'mm' },
  { k: 'roof', label: '지붕 높이', step: 50, min: -100, max: 200, unit: 'mm' },
  { k: 'lift', label: '차체 높이', step: 25, min: -50, max: 100, unit: 'mm' } ] as const;
const buttons: Btn[] = [];
CTRL.forEach((c, i) => { const y = 160 + i * 17;
  buttons.push({ id: c.k + '-', x: 408, y, w: 16, h: 13, label: '-', on: () => change({ ...next, [c.k]: Math.max(c.min, next[c.k] - c.step) }), show: () => !busy() });
  buttons.push({ id: c.k + '+', x: 452, y, w: 16, h: 13, label: '+', on: () => change({ ...next, [c.k]: Math.min(c.max, next[c.k] + c.step) }), show: () => !busy() }); });
buttons.push({ id: 'rack', x: 408, y: 211, w: 60, h: 13, label: '', on: () => change({ ...next, rack: !next.rack }), show: () => !busy() });
buttons.push({ id: 'apply', x: 334, y: 236, w: 66, h: 22, label: '수정', big: true, on: () => apply(), show: () => pending() && !busy() });
buttons.push({ id: 'cancel', x: 406, y: 236, w: 62, h: 22, label: '취소', big: true, on: () => cancel(), show: () => pending() && !busy() });
const busy = () => jobs.length > 0;

function change(e: Edit) {
  next = e; const want = pixelsOf(views(next)), redWant = new Set([...want].filter(p => !drawnNow.has(p)));
  const add = [...redWant].filter(p => !redNow.has(p)), drop = [...redNow].filter(p => !redWant.has(p));
  redNow = redWant; if (drop.length) queue('unred', drop); if (add.length) queue('red', add);
}
function apply() {
  const want = pixelsOf(views(next)), gone = [...drawnNow].filter(p => !want.has(p));
  drawnKeep = want; queue('erase', gone, () => { queue('pencil', [...redNow], () => { cur = { ...next }; drawnNow = want; redNow = new Set(); }); });
  for (const p of redNow) sheet[p] = 2;
}
function cancel() { const red = [...redNow]; next = { ...cur }; redNow = new Set(); queue('unred', red); }

// ---------------- sound: a pencil's scratch and an eraser's rub, from noise ----------------
let AC: AudioContext | null = null, gainP: GainNode | null = null, gainE: GainNode | null = null, soundOn = true;
function startSound() { if (AC) return; try { AC = new AudioContext(); const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const mk = (f: number, q: number) => { const src = AC!.createBufferSource(); src.buffer = buf; src.loop = true; const bp = AC!.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = AC!.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(AC!.destination); src.start(); return g; };
  gainP = mk(4200, 1.2); gainE = mk(900, 0.8); } catch { AC = null; } }
let tSnd = 0;
function sound(kind: number, on: number) { if (!AC || !gainP || !gainE) return; tSnd += 1; const now = AC.currentTime, j = 0.5 + 0.5 * Math.sin(tSnd * 0.9) * Math.sin(tSnd * 0.37);
  gainP.gain.setTargetAtTime(soundOn && kind === 1 && on ? 0.05 + 0.06 * j : 0, now, 0.02); gainE.gain.setTargetAtTime(soundOn && kind === 2 && on ? 0.12 + 0.1 * j : 0, now, 0.03); }

// ---------------- drawing the screen ----------------
const rnd = (i: number) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
function desk() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const g = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, g > 0.75 ? C.wood3 : g < -0.7 ? C.wood2 : C.wood); } }
function paper() {
  const { x, y, w, h } = PAPER;
  S.fill(x + 3, y + 3, w, h, C.shadow);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = rnd(j * 3301 + i * 7), edge = Math.min(i, j, w - 1 - i, h - 1 - j), stain = Math.hypot(i - 262, j - 46);
    let c = r < 0.06 ? C.paper2 : C.paper; if (edge < 3 && r < 0.5) c = C.paper2; if (edge < 1) c = C.paper3; if (Math.abs(stain - 17) < 1.2 && r < 0.7) c = C.paper3; else if (stain < 17 && r < 0.12) c = C.paper2;
    if (i === 158 || j === 129) c = r < 0.5 ? C.paper2 : C.paper3;                                   // where the sheet was folded
    if ((i - 16) % 10 === 0 && j > 12 && j < h - 40 && i > 12 && i < 230 && r < 0.6) c = C.grid; if ((j - 14) % 10 === 0 && i > 12 && i < 230 && j < h - 40 && r < 0.6) c = C.grid;
    S.px(x + i, y + j, c); }
  // the corner of a torn-off sheet and drawing pins
  for (const [px, py] of [[x + 4, y + 4], [x + w - 6, y + 4], [x + 4, y + h - 6], [x + w - 6, y + h - 6]] as const) { S.fill(px, py, 3, 3, C.brass3); S.px(px, py, C.brass2); }
  // the title block
  const tx = x + 214, ty = y + 226, tw = 96, th = 28; S.line(tx, ty, tx + tw, ty, C.lead); S.line(tx, ty, tx, ty + th, C.lead); S.line(tx, ty + 14, tx + tw, ty + 14, C.lead2); S.line(tx + 50, ty + 14, tx + 50, ty + th, C.lead2);
  S.text('4도어 세단 1929', tx + 4, ty + 3, C.lead); S.text('축척 1:20', tx + 4, ty + 17, C.lead2); S.text('도면 1', tx + 55, ty + 17, C.lead2);
}
function sheetPixels() {
  for (let i = 0; i < W * H; i++) { const v = sheet[i]; if (!v) continue; const x = i % W, y = (i / W) | 0, r = rnd(i);
    if (v === 1) S.px(x, y, r < 0.18 ? C.lead2 : C.lead); else if (v === 2) S.px(x, y, r < 0.2 ? C.red2 : C.red); else S.px(x, y, C.smudge); } }
function arrowLine(x0: number, y0: number, x1: number, y1: number, label: string, col: RGB) {
  S.line(x0, y0, x1, y1, col); const horiz = y0 === y1;
  if (horiz) { S.px(x0 + 1, y0 - 1, col); S.px(x0 + 1, y0 + 1, col); S.px(x1 - 1, y1 - 1, col); S.px(x1 - 1, y1 + 1, col); const tw = S.tw(label); S.fill(((x0 + x1) >> 1) - (tw >> 1) - 1, y0 - 4, tw + 2, 8, C.paper); S.text(label, ((x0 + x1) >> 1) - (tw >> 1), y0 - 4, col); }
  else { S.px(x0 - 1, y0 + 1, col); S.px(x0 + 1, y0 + 1, col); S.px(x1 - 1, y1 - 1, col); S.px(x1 + 1, y1 - 1, col); S.text(label, x0 + 3, ((y0 + y1) >> 1) - 4, col); }
}
function dims() {
  // dimension lines of the drawing as it stands; a pending change shows its new figure in red beside the old
  const m = measure(edited(base, cur)), n = measure(edited(base, next)), V = views(cur), sideTop = SIDE.y + (100 - V.side.h), ground = sideTop + V.side.h - 2;
  const fx = (base.wheels[0]!.x) / MM + SIDE.x + 2, rx = m.wb / MM + fx, x0 = SIDE.x + 2, x1 = x0 + m.length / MM;
  const lab = (a: number, b: number) => (a === b ? `${a}` : `${a} → ${b}`);
  arrowLine(fx, ground + 8, rx, ground + 8, lab(m.wb, n.wb), m.wb === n.wb ? C.lead2 : C.red);
  arrowLine(x0, ground + 18, x1, ground + 18, lab(m.length, n.length), m.length === n.length ? C.lead2 : C.red);
  for (const xx of [fx, rx]) S.line(xx, ground - 3, xx, ground + 10, C.lead2, 1);
  arrowLine(x1 + 12, ground - m.height / MM, x1 + 12, ground, lab(m.height, n.height), m.height === n.height ? C.lead2 : C.red);
  S.line(x0 - 6, ground, x1 + 30, ground, C.lead2, 2);
  const py0 = PLAN.y + 2, py1 = PLAN.y + 2 + m.width / MM, px = SIDE.x + 2 + m.length / MM + 12; arrowLine(px, py0, px, py1, `${m.width}`, C.lead2);
  S.text('옆면도', PAPER.x + 8, PAPER.y + 6, C.inkSoft); S.text('평면도', PAPER.x + 8, PLAN.y - 9, C.inkSoft);
}
function card() {
  const x = 330, y = 8, w = 142, h = 142; S.fill(x + 2, y + 2, w, h, C.shadow); S.fill(x, y, w, h, C.card);
  for (let i = 0; i < w; i++) if (rnd(i * 31) < 0.3) S.px(x + i, y, C.paper2);
  S.fill(x + w / 2 - 2, y - 2, 5, 5, C.bad); S.px(x + w / 2 - 1, y - 1, C.red2);
  S.text('주문서', x + 6, y + 6, C.ink); S.text(ORDER.from, x + 6, y + 17, C.inkSoft, w - 10); S.hline(x + 6, x + w - 6, y + 28, C.paper3);
  const m = measure(edited(base, cur)), n = measure(edited(base, next));
  ORDER.ask.forEach((a, i) => { const yy = y + 33 + i * 18, okNow = a.test(m, cur), okNext = a.test(n, next), changed = pending() && (okNow !== okNext || a.val(m, cur) !== a.val(n, next));
    // the tick box: a tick when met, a cross when not; a pending change shows what it would be, in red
    S.fill(x + 6, yy, 9, 9, C.paper); S.line(x + 6, yy, x + 14, yy, C.ink); S.line(x + 6, yy + 8, x + 14, yy + 8, C.ink); S.line(x + 6, yy, x + 6, yy + 8, C.ink); S.line(x + 14, yy, x + 14, yy + 8, C.ink);
    const ok = changed ? okNext : okNow, col = changed ? C.red : ok ? C.ok : C.bad;
    if (ok) { S.line(x + 8, yy + 4, x + 9, yy + 6, col); S.line(x + 9, yy + 6, x + 13, yy + 1, col); } else { S.line(x + 8, yy + 2, x + 12, yy + 6, col); S.line(x + 12, yy + 2, x + 8, yy + 6, col); }
    S.text(a.t, x + 18, yy, C.ink, w - 22); const v = changed ? `${a.val(m, cur)} → ${a.val(n, next)}` : a.val(m, cur); S.text(v, x + 18, yy + 9, changed ? C.red : C.inkSoft, w - 22); });
}
function brassButton(b: Btn, hot: boolean) {
  const { x, y, w, h } = b; S.fill(x + 1, y + 1, w, h, C.shadow); S.fill(x, y, w, h, hot ? C.brass2 : C.brass); S.hline(x, x + w - 1, y, C.brass2); S.vline(x, y, y + h - 1, C.brass2); S.hline(x, x + w - 1, y + h - 1, C.brass3); S.vline(x + w - 1, y, y + h - 1, C.brass3);
  const label = b.id === 'rack' ? (next.rack ? '떼기' : '달기') : b.label, tw = S.tw(label); S.text(label, x + ((w - tw) >> 1), y + ((h - 7) >> 1) - (b.big ? 0 : 1), C.ink);
}
let hover = '';
function controls() {
  const x = 330, y = 152; S.fill(x + 2, y + 2, 142, 78, C.shadow); S.fill(x, y, 142, 78, C.wood2); S.hline(x, x + 141, y, C.wood3);
  CTRL.forEach((c, i) => { const yy = 160 + i * 17, v = next[c.k], cv = cur[c.k]; S.text(c.label, 336, yy + 3, C.card); const s = `${v > 0 ? '+' : ''}${v}`, tw = S.tw(s); S.text(s, 438 - (tw >> 1), yy + 3, v !== cv ? C.red2 : C.brass2); });
  S.text('지붕 짐받이', 336, 214, C.card);
  for (const b of buttons) if (!b.show || b.show()) brassButton(b, hover === b.id);
  if (!pending() && !busy()) S.text('바꾸면 빨간 선으로 겹쳐 그립니다', 334, 240, C.paper2, 140);
  if (busy()) S.text(jobs[0]!.kind === 'erase' ? '지우는 중…' : '그리는 중…  (누르면 빨리)', 334, 240, C.paper2, 140);
  // the sound switch
  S.text(soundOn ? '소리 켬' : '소리 끔', 436, 258, C.paper2);
}
function tools() {
  if (!tool) return; const { x, y } = tool;
  if (tool.kind === 'pencil' || tool.kind === 'red') { // a mechanical pencil leaning to the right
    for (let k = 0; k < 16; k++) { const px = x + 1 + k, py = y - 1 - k; S.px(px, py, k < 2 ? C.lead : k < 4 ? C.brass2 : tool.kind === 'red' ? C.red : C.lead2); S.px(px + 1, py, k < 4 ? C.brass3 : C.shadow); } }
  else { S.fill(x - 3, y - 7, 8, 6, hex('#d8a0a8')); S.fill(x - 3, y - 2, 8, 2, hex('#b8808a')); S.fill(x - 3, y - 11, 8, 4, hex('#3a5aa0')); S.hline(x - 3, x + 4, y - 7, hex('#f0c8cc')); }
}
function frame() { desk(); paper(); sheetPixels(); dims(); card(); controls(); tools(); }

// ---------------- page ----------------
const cv = document.getElementById('board') as HTMLCanvasElement, ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H);
cv.width = W; cv.height = H;
const toPx = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H] as const; };
const hit = (x: number, y: number) => buttons.find(b => (!b.show || b.show()) && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
cv.addEventListener('pointermove', ev => { const [x, y] = toPx(ev); hover = hit(x, y)?.id ?? ''; cv.style.cursor = hover ? 'pointer' : 'default'; });
cv.addEventListener('pointerdown', ev => { startSound(); const [x, y] = toPx(ev);
  if (x > 430 && y > 254) { soundOn = !soundOn; return; }
  if (busy()) { fast = true; return; } const b = hit(x, y); if (b) b.on(); });
addEventListener('keydown', e => { if (e.key === ' ') { fast = true; e.preventDefault(); } });
let last = performance.now();
function loop(now: number) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); if (!busy()) fast = false; frame(); S.blit(ctx, img); requestAnimationFrame(loop); }
// the first drawing is drawn in pencil, as if just begun
{ const first = [...drawnNow]; for (const p of first) sheet[p] = 0; queue('pencil', first); }
requestAnimationFrame(loop);
