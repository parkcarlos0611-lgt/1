// Prototype B (reviews 33-36): rust repair by hand in the garage. The 1929 sedan, drawn from its 3D part model at
// 5 mm a pixel, seen from the side, the front or the rear (each view keeps its own work in this prototype; the game
// version keeps it per part). Every part has its finish (data/cars/sedan29_finish.json): the base (steel of a gauge,
// rubber, cloth, plated brass, glass) and its coats inside out, so wire wool goes through lacquer, surfacer and primer on
// the body but through baked black enamel straight to thicker steel on the fenders.
// The magnifier picks one part: the view closes in on it and the tools touch nothing else (seams stay sharp).
// Masking: pick a part, its paper is measured out (dotted, in mm), laid, and taped along each side; a side left untaped
// lets the spray creep under the paper.
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { finishOf, coatAt, coatTotal, type Finish, type FinishSheet } from '../../render/car/finish';
import model from '../../data/cars/sedan29.json';
import finishJson from '../../data/cars/sedan29_finish.json';

type Tool = 'lens' | 'brush' | 'lead' | 'mask' | 'spray';
const TOOLS: { id: Tool; name: string; tip: string }[] = [
  { id: 'lens', name: '돋보기', tip: '부품을 누르면 그 부품만 크게 보고, 그 부품에만 작업한다. 빈 곳을 누르면 풀린다' },
  { id: 'brush', name: '철수세미', tip: '문지르면 칠에 긁힌 줄이 생기고, 칠 층을 차례로 지나 바탕이 드러난다' },
  { id: 'lead', name: '납 메움', tip: '드러난 강판에 플럭스와 납. 파인 곳부터 찬다. 많으면 솟는다 (철수세미로 깎는다)' },
  { id: 'mask', name: '마스킹', tip: '가릴 부품을 누르면 종이 치수가 나온다' },
  { id: 'spray', name: '스프레이', tip: '누르고 움직여 칠한다. 넓게 퍼지고, 한곳에 오래 두면 흘러내린다' } ];
const COLOURS: { name: string; rgb: RGB | null }[] = [{ name: '원래 색', rgb: null }, { name: '검정', rgb: hex('#202024') }, { name: '적갈색', rgb: hex('#6a2a22') }, { name: '크림', rgb: hex('#d8c8a0') }];
const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const RUST = [hex('#b0602a'), hex('#8a4a22'), hex('#6a3418'), hex('#4a2410')], LEAD = [hex('#b0b4b8'), hex('#8e9298'), hex('#6e7278')];
const TAPE = [hex('#e8dab0'), hex('#d2c294'), hex('#b8a676')], PAPER = [hex('#c9a878'), hex('#b8966a'), hex('#d8bc8c')];
const MM = 5, VIEW: Rect = { x: 0, y: 24, w: 480, h: 202 }, TAPE_W = 7;
const SHEET = finishJson as unknown as FinishSheet;

interface Mask { part: number; r: { x0: number; y0: number; x1: number; y1: number }; laid: boolean; sides: Uint8Array[] }
interface View { name: 'left' | 'front' | 'rear'; title: string; w: number; h: number; N: number; groundY: number;
  kind: Uint8Array; orig: RGB[]; tone: Float32Array; part: Int16Array; parts: string[]; fin: Finish[];
  rust0: Float32Array; rust: Float32Array; pit: Float32Array; worn: Float32Array; fill: Float32Array; weak: Uint8Array; paint: Float32Array; pcol: Int8Array; over: Float32Array; scratch: Float32Array;
  paper: Int16Array; masks: Mask[]; cam: { x: number; y: number }; camF: { x: number; y: number }; zoom: number; focus: number }

export function bodyworkScene(app: App): Scene {
  const ui = app.ui, S = app.S, base = model as unknown as CarModel;
  const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };
  // ---------------- a view: the picture and every layer of work on it ----------------
  function makeView(name: View['name'], title: string, seed: number): View {
    const d = viewDesign(base, name), im = rasterizeFlat(d, { mm: MM }), w = im.w, h = im.h, N = w * h;
    const kind = new Uint8Array(N), orig: RGB[] = new Array(N), tone = new Float32Array(N), part = new Int16Array(N).fill(-1), parts: string[] = [], fin: Finish[] = [];
    const idx = new Map<string, number>(), partOf = (id: string) => { let k = idx.get(id); if (k === undefined) { k = parts.push(id) - 1; idx.set(id, k); fin.push(finishOf(SHEET, id, base.paint, base.paint2 ?? base.paint)); } return k; };
    const wheels = d.wheels.map(q => ({ cx: im.X(q.x), cy: im.Y(q.z ?? q.r), r: q.r / MM, rim: (q.rim ?? 0.62) * q.r / MM }));
    for (let i = 0; i < N; i++) { orig[i] = [im.rgba[i * 4]!, im.rgba[i * 4 + 1]!, im.rgba[i * 4 + 2]!]; if (im.rgba[i * 4 + 3]! < 128) continue; const o = im.owner[i]!, x = i % w, y = (i / w) | 0;
      const pn = o >= 0 ? d.panels[o] : undefined;
      if (pn) { const id = pn.id.replace('~', ''), k = partOf(id), f = fin[k]!; part[i] = k;
        kind[i] = f.base.kind === 'glass' || f.base.kind === 'brass' ? 2 : f.base.kind === 'rubber' && !f.coats.length ? 3 : f.coats.some(c => c.kind === 'dressing') ? 5 : 1;
        if (kind[i] === 1) { const top = f.coats[f.coats.length - 1]; tone[i] = lum(orig[i]!) / Math.max(8, lum(hex(top?.colour ?? '#808080'))); } }
      else { let wheel = false; for (const q of wheels) if (Math.hypot(x - q.cx, y - q.cy) < q.rim + 1) wheel = true; part[i] = partOf(wheel ? 'wheel' : 'tyre'); kind[i] = wheel ? 4 : 3; } }
    const v: View = { name, title, w, h, N, groundY: im.groundY, kind, orig, tone, part, parts, fin, rust0: new Float32Array(N), rust: new Float32Array(N), pit: new Float32Array(N), worn: new Float32Array(N), fill: new Float32Array(N), weak: new Uint8Array(N),
      paint: new Float32Array(N), pcol: new Int8Array(N).fill(-1), over: new Float32Array(N), scratch: new Float32Array(N), paper: new Int16Array(N).fill(-1), masks: [], cam: { x: 0, y: 0 }, camF: { x: 0, y: 0 }, zoom: 1, focus: -1 };
    // rust on the lower panels of parts whose base rusts: sills, fender skirts and edges, door bottoms
    const low: number[] = []; for (let i = 0; i < N; i++) if (kind[i] === 1 && fin[part[i]!]!.base.rusts && (i / w | 0) > im.groundY - 124) low.push(i);
    let rx = 0, ry = 0, rn = 0;
    for (let k = 0; k < (name === 'left' ? 6 : 3) && low.length; k++) { const c = low[Math.floor(rnd(k * 977 + 13 + seed) * low.length)]!, cx = c % w, cy = (c / w) | 0, r = 10 + rnd(k * 31 + seed) * 16;
      for (let y = cy - 36; y <= cy + 36; y++) for (let x = cx - 44; x <= cx + 44; x++) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (kind[i] !== 1 || !fin[part[i]!]!.base.rusts) continue;
        const dd = Math.hypot((x - cx) / 1.4, y - cy) / r, n = vn(x / 6, y / 6, k + seed) * 0.6 + vn(x / 2.4, y / 2.4, k + 9 + seed) * 0.4, val = Math.max(0, 1 - dd + (n - 0.5) * 0.9);
        if (val > 0.05) { v.rust0[i] = v.rust[i] = Math.min(1, Math.max(v.rust0[i]!, val * (0.6 + n * 0.6))); rx += x; ry += y; rn++; } } }
    v.cam = { x: Math.round(rn ? rx / rn - VIEW.w / 2 : (w - VIEW.w) / 2), y: Math.round(rn ? ry / rn - VIEW.h / 2 : (h - VIEW.h) / 2) }; v.camF = { ...v.cam };
    return v;
  }
  const VIEWS = [makeView('left', '옆', 0), makeView('front', '앞', 50), makeView('rear', '뒤', 90)]; let V = VIEWS[0]!;
  const clampCam = () => { const vw = VIEW.w / V.zoom, vh = VIEW.h / V.zoom; V.cam.x = Math.round(Math.max(-40, Math.min(V.w - vw + 40, V.cam.x))); V.cam.y = Math.round(Math.max(-40, Math.min(V.h - vh + 30, V.cam.y))); };
  VIEWS.forEach(v => { V = v; clampCam(); v.camF = { ...v.cam }; }); V = VIEWS[0]!;

  // ---------------- the work ----------------
  let tool: Tool = 'brush', colour = 0, last: { x: number; y: number } | null = null, dirLast = { x: 1, y: 0 }, minutes = 0, report: string[] | null = null, verdict = '', whole = false;
  let maskPick: Mask | null = null, taping: { m: Mask; side: number; from: number; at: number } | null = null;
  const R = (t: Tool) => (t === 'spray' ? 16 : 6);
  const bare = (i: number) => V.worn[i]! >= coatTotal(V.fin[V.part[i]!]!);
  const allowed = (i: number) => V.focus < 0 || V.part[i] === V.focus;
  /** fresh paint: the chosen colour, or the part's own colour mixed again (a few per cent off) */
  const fresh = (i: number, c: number): RGB => { const cc = COLOURS[c]?.rgb; if (cc) return mix(hex('#000000'), cc, Math.min(1.25, V.tone[i]!)); const o = V.orig[i]!; return [Math.min(255, o[0] * 1.045), Math.min(255, o[1] * 1.035), Math.min(255, o[2] * 1.01)]; };
  function dab(cx: number, cy: number, dt: number, dir: { x: number; y: number }) {
    const r = R(tool); let touched = 0;
    for (let y = Math.floor(cy - r - 6); y <= cy + r + 6; y++) for (let x = Math.floor(cx - r - 6); x <= cx + r + 6; x++) { if (x < 0 || y < 0 || x >= V.w || y >= V.h) continue; const i = y * V.w + x, dd = Math.hypot(x - cx, y - cy); if (!V.kind[i] || !allowed(i)) continue;
      const f = V.fin[V.part[i]!]!;
      if (tool === 'brush') { if (dd > r + 0.5 || V.paper[i]! >= 0) continue;
        const across = -dir.y * x + dir.x * y, strand = rnd((Math.floor(across * 0.8) * 7919 + 17) >>> 0) < 0.55; if (!strand) continue;       // steel wool cuts lines along the stroke
        const s = 0.022 * (1 - dd / (r + 1));
        if (V.kind[i] !== 1) { V.scratch[i] = Math.min(1, V.scratch[i]! + s * 3); continue; } touched++;
        if (V.paint[i]! > 0) { V.paint[i] = Math.max(0, V.paint[i]! - s * 3); if (V.paint[i] === 0) V.pcol[i] = -1; continue; }
        if (V.fill[i]! > V.pit[i]!) { V.fill[i] = Math.max(V.pit[i]!, V.fill[i]! - s * 1.2); continue; }
        if (!bare(i)) { const c = coatAt(f, V.worn[i]!).coat, um = s * 125 / (c?.hardness ?? 1) * (V.rust[i]! > 0.3 ? 2 : 1); V.worn[i] = Math.min(coatTotal(f), V.worn[i]! + um); continue; }   // through the coats, the hard ones slower
        if (V.rust[i]! > 0) { const took = Math.min(V.rust[i]!, s * 0.9); V.rust[i] = V.rust[i]! - took; V.pit[i] = V.pit[i]! + took * 0.55; if (V.rust[i]! < 0.02) V.rust[i] = 0; } }
      else if (tool === 'lead') { if (dd > r + 0.5 || V.kind[i] !== 1 || V.paper[i]! >= 0 || !bare(i) || !f.base.takesLead || V.paint[i]! > 0) continue; touched++; const s = 0.06 * (1 - dd / (r + 1));
        V.fill[i] = V.fill[i]! + (V.fill[i]! < V.pit[i]! ? s * 1.6 : s * 0.5); if (V.rust[i]! > 0.08) V.weak[i] = 1; }
      else if (tool === 'spray') { let s = dt * 5 * Math.exp(-(dd * dd) / (2 * (r / 2.3) ** 2)); if (dd > r * 0.8 && rnd((i * 13 + Math.floor(minutes * 60)) >>> 0) < 0.06) s += dt * 2.5; if (dd > r + 6 || s < 0.0005) continue;
        const pm = V.paper[i]!; if (pm >= 0) { const m = V.masks[pm]!; if (!leaks(m, x, y)) { V.over[i] = V.over[i]! + s; continue; } s *= 0.6; }   // under paper: only where a side is left untaped
        touched++; if (V.kind[i] !== 1) { V.over[i] = V.over[i]! + s; continue; }
        if (V.pcol[i] !== colour && V.paint[i]! > 0 && s > V.paint[i]! * 0.3) V.pcol[i] = colour; else if (V.pcol[i]! < 0) V.pcol[i] = colour; V.paint[i] = V.paint[i]! + s; } }
    return touched;
  }
  // ---------------- masking: paper measured to a part, laid, taped side by side ----------------
  const sideLen = (m: Mask, k: number) => (k % 2 === 0 ? m.r.x1 - m.r.x0 : m.r.y1 - m.r.y0);
  const sideDone = (m: Mask, k: number) => { const s = m.sides[k]!; let n = 0; for (const b of s) n += b; return n >= s.length * 0.95; };
  /** paint creeps under the paper within 8 px of a side whose tape is missing there */
  function leaks(m: Mask, x: number, y: number) { const { x0, y0, x1, y1 } = m.r, near = [y - y0, x1 - x, y1 - y, x - x0];
    for (let k = 0; k < 4; k++) if (near[k]! < 8) { const along = k % 2 === 0 ? x - x0 : y - y0, s = m.sides[k]!; if (!s[Math.max(0, Math.min(s.length - 1, along))]) return true; } return false; }
  function pickMask(i: number) { const k = V.part[i]!; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let j = 0; j < V.N; j++) if (V.part[j] === k) { const x = j % V.w, y = (j / V.w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= 3; y0 -= 3; x1 += 3; y1 += 3; maskPick = { part: k, r: { x0, y0, x1, y1 }, laid: false, sides: [new Uint8Array(x1 - x0 + 1), new Uint8Array(y1 - y0 + 1), new Uint8Array(x1 - x0 + 1), new Uint8Array(y1 - y0 + 1)] }; }
  /** the paper is cut to the part's shape (with a 3 px margin), so the neighbours stay open; the tape goes round the measured outline */
  function layPaper(m: Mask) { const id = V.masks.push(m) - 1; m.laid = true; const near = (x: number, y: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < V.w && yy < V.h && V.part[yy * V.w + xx] === m.part) return true; } return false; };
    for (let y = m.r.y0; y <= m.r.y1; y++) for (let x = m.r.x0; x <= m.r.x1; x++) if (x >= 0 && y >= 0 && x < V.w && y < V.h && V.kind[y * V.w + x] && near(x, y)) V.paper[y * V.w + x] = id; app.sound.once('paper'); }
  function nearSide(m: Mask, x: number, y: number): number { const { x0, y0, x1, y1 } = m.r, inX = x >= x0 - 4 && x <= x1 + 4, inY = y >= y0 - 4 && y <= y1 + 4;
    const c: [number, number][] = [[0, inX ? Math.abs(y - y0) : 99], [1, inY ? Math.abs(x - x1) : 99], [2, inX ? Math.abs(y - y1) : 99], [3, inY ? Math.abs(x - x0) : 99]]; c.sort((a, b) => a[1] - b[1]); return c[0]![1] <= 6 ? c[0]![0] : -1; }
  function unmaskAll() { for (const v of VIEWS) { v.paper.fill(-1); v.masks = []; } maskPick = null; taping = null; app.sound.once('peel'); }

  // ---------------- inspection, over all three views ----------------
  function inspect() { const c: Record<string, number> = {}; const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n); let rustArea = 0;
    for (const v of VIEWS) { const bareV = (i: number) => v.worn[i]! >= coatTotal(v.fin[v.part[i]!]!);
      for (const m of v.masks) for (let k = 0; k < 4; k++) if (!sideDone(m, k)) add('untaped'); if (v.masks.length) add('masksLeft', v.masks.length);
      for (let i = 0; i < v.N; i++) { const k = v.kind[i]; if (!k) continue; const pt = v.paint[i]!;
        if (k === 2) { add('shiny'); if (v.over[i]! > 0.25) add('mist'); if (v.scratch[i]! > 0.3) add('scr'); } if (k === 3 || k === 4) { add('dark'); if (v.over[i]! > 0.25) add('darkMist'); if (k === 4 && v.scratch[i]! > 0.3) add('wheelScr'); }
        if (k === 5 && v.scratch[i]! > 0.3) add('soft'); if (k !== 1) continue; if (v.rust0[i]! > 0.08) rustArea++;
        if (v.rust[i]! > 0.08) add(pt > 0.3 ? 'rustHid' : 'rustSeen'); if (pt > 0.3 && v.pit[i]! - v.fill[i]! > 0.12) add('pits'); if (v.fill[i]! - v.pit[i]! > 0.22) add('bumps');
        if (bareV(i) && pt < 0.3) add('bareLeft'); else if (bareV(i) && pt < 0.7) add('thin'); if (pt > 2.6) add('runs'); if (pt > 0.3 && v.pcol[i]! > 0) add('other'); else if (pt > 0.3) add('near');
        if (bareV(i) && v.rust0[i]! < 0.05) add('extra'); if (!bareV(i) && v.worn[i]! > 3 && pt < 0.3) add('scratched'); if (v.weak[i] && pt > 0.3) add('weakLead'); } }
    const g = (k: string) => c[k] ?? 0, pc = (n: number, of = rustArea) => Math.round(n / Math.max(1, of) * 100), cm = (n: number) => Math.round(n * MM * MM / 100);
    const lines: [string, number, number, string][] = [['보이는 녹', pc(g('rustSeen')), 0.9, `${cm(g('rustSeen'))} cm2`], ['칠 밑에 숨은 녹', pc(g('rustHid')), 1.2, `${cm(g('rustHid'))} cm2`], ['메우지 않은 파인 곳', pc(g('pits')), 0.6, `${cm(g('pits'))} cm2`],
      ['메움 굴곡', pc(g('bumps')), 0.4, `${cm(g('bumps'))} cm2`], ['칠 안 된 맨 철판', pc(g('bareLeft')), 0.8, `${cm(g('bareLeft'))} cm2`], ['얇은 칠', pc(g('thin')), 0.3, `${cm(g('thin'))} cm2`], ['흘러내린 칠', pc(g('runs')), 0.4, `${cm(g('runs'))} cm2`],
      ['다른 색', pc(g('other')), 0.7, `${cm(g('other'))} cm2`], ['같은 색, 새 칠과 옛 칠의 미세한 차이', pc(g('near')), 0.03, `${cm(g('near'))} cm2`], ['긁히기만 하고 덮이지 않은 칠', pc(g('scratched')), 0.3, `${cm(g('scratched'))} cm2`],
      ['녹 없던 곳까지 벗김', pc(g('extra')), 0.15, `${cm(g('extra'))} cm2`], ['녹 위에 올린 납', pc(g('weakLead')), 0.5, `${cm(g('weakLead'))} cm2`], ['유리 · 크롬에 묻은 칠', pc(g('mist'), g('shiny')), 1.5, `${cm(g('mist'))} cm2`],
      ['타이어 · 휠에 묻은 칠', pc(g('darkMist'), g('dark')), 1, `${cm(g('darkMist'))} cm2`], ['유리 · 크롬 긁힘', pc(g('scr'), g('shiny')), 2, `${cm(g('scr'))} cm2`], ['휠 긁힘', pc(g('wheelScr'), g('dark')), 1, `${cm(g('wheelScr'))} cm2`],
      ['고무 발판 · 천 지붕 상처', g('soft') ? Math.max(2, pc(g('soft'))) : 0, 1, `${cm(g('soft'))} cm2`], ['테이프를 덜 붙인 종이 가장자리', g('untaped') * 5, 0.4, `${g('untaped')}곳`], ['떼지 않은 종이 · 테이프', g('masksLeft') * 20, 1, `${g('masksLeft')}장`]];
    const pen = lines.reduce((a, [, v, k]) => a + Math.min(60, v) * k, 0), sat = Math.max(0, Math.round(100 - pen)), back = Math.min(95, Math.round(pc(g('rustHid')) * 1.6 + pc(g('pits')) * 0.9 + pc(g('bareLeft')) * 1.2 + pc(g('weakLead')) * 0.8));
    report = [`녹 슬었던 넓이 ${cm(rustArea)} cm2 (옆 · 앞 · 뒤)`, ...lines.filter(l => l[1] > 0).map(([t, , , s]) => `${t}  ${s}`)];
    verdict = `손님 만족 ${sat}점 · 반년 안에 들뜨거나 다시 녹슬 확률 ${back}%`; }

  // ---------------- drawing ----------------
  const wall = (x: number, y: number): RGB => { const wx = x + Math.floor(V.cam.x * 0.3), plank = Math.floor(wx / 26), g = vn(wx / 40, y / 3, plank) * 0.5 + rnd((plank * 7) >>> 0) * 0.5;
    const c = wx % 26 === 0 ? hex('#3a2a1e') : g > 0.6 ? hex('#6a4e36') : g < 0.35 ? hex('#4e3826') : hex('#5c4430'), lamp = Math.hypot(x - 240, (y - 10) * 1.6), lit = Math.max(0, 1 - lamp / 300); return mix(c, hex('#e8c890'), lit * 0.25); };
  const floor = (x: number, y: number): RGB => { const fx = x + V.cam.x, g = vn(fx / 9, y / 2, 3); let c = g > 0.6 ? hex('#8a8478') : g < 0.3 ? hex('#6e6a60') : hex('#7c776c'); if (rnd((fx * 131 + y * 7) >>> 0) < 0.04) c = hex('#5e5a52'); return c; };
  function pixel(i: number): RGB | null {
    const k = V.kind[i]; if (!k) return null; let c = V.orig[i]!; const f = V.fin[V.part[i]!]!, x = i % V.w, y = (i / V.w) | 0;
    if (k === 1) {
      const top = f.coats[f.coats.length - 1], t = V.tone[i]!, worn = V.worn[i]!, at = coatAt(f, worn), steel = mix(hex('#000000'), hex(f.base.colour), Math.min(1.3, 0.55 + t * 0.45));
      const shown: RGB = at.coat === null ? steel : at.coat === top ? c : mix(hex('#000000'), hex(at.coat.colour), Math.min(1.3, 0.55 + t * 0.45));
      if (V.paint[i]! > 0.05) { const pcR = fresh(i, V.pcol[i]!), under: RGB = at.coat === null ? (V.fill[i]! > 0 ? LEAD[1]! : steel) : shown; c = V.paint[i]! < 0.7 ? mix(under, pcR, V.paint[i]! / 0.7) : pcR;
        const lump = V.fill[i]! - V.pit[i]!; if (lump > 0.22) { const up = i >= V.w ? V.fill[i - V.w]! - V.pit[i - V.w]! : 0; c = mix(c, up < lump ? hex('#ffffff') : hex('#000000'), 0.16); }
        if (V.pit[i]! - V.fill[i]! > 0.15) c = mix(c, hex('#000000'), 0.18); if (V.paint[i]! > 2.6) c = mix(c, hex('#000000'), x % 3 === 0 ? 0.3 : 0.12); }
      else if (at.coat === null) { if (V.fill[i]! > 0.02) { const hi = V.fill[i]! - V.pit[i]!; c = hi > 0.22 ? LEAD[0]! : hi < -0.1 ? LEAD[2]! : LEAD[1]!; }
        else { const p = V.pit[i]!; c = p > 0.3 ? mix(steel, hex('#000000'), 0.5) : p > 0.12 ? mix(steel, hex('#000000'), 0.25) : rnd(i * 3) < 0.25 ? mix(steel, hex('#ffffff'), 0.2) : steel; if (V.rust[i]! > 0.05) c = mix(c, RUST[V.rust[i]! > 0.4 ? 2 : 1]!, Math.min(1, V.rust[i]! * 1.5)); } }
      else { if (V.rust[i]! > 0.05) { const r = V.rust[i]!, n = rnd(i * 7); c = mix(c, r > 0.6 ? (n < 0.3 ? RUST[3]! : RUST[2]!) : r > 0.3 ? RUST[1]! : RUST[0]!, Math.min(1, 0.35 + r)); }
        if (worn > 0) c = at.coat === top ? mix(c, mix(c, hex('#ffffff'), 0.35), Math.min(1, worn / 8)) : mix(shown, at.coat.kind === 'surfacer' ? hex('#ffffff') : shown, 0.1); } }
    else { if (V.over[i]! > 0.05) c = mix(c, COLOURS[colour]!.rgb ?? hex(base.paint), Math.min(0.85, V.over[i]!)); if (V.scratch[i]! > 0.1) c = mix(c, k === 5 ? hex('#5a5a5e') : hex('#e8ecef'), V.scratch[i]! * 0.5); }
    const pm = V.paper[i]!; if (pm >= 0) { const m = V.masks[pm]!, edge = Math.min(y - m.r.y0, m.r.x1 - x, m.r.y1 - y, x - m.r.x0); c = edge < 1 ? PAPER[1]! : (x * 3 + y * 7) % 23 === 0 ? PAPER[2]! : PAPER[0]!; if (V.over[i]! > 0.2) c = mix(c, COLOURS[colour]!.rgb ?? hex(base.paint), Math.min(0.7, V.over[i]! * 0.6));
      for (let s = 0; s < 4; s++) { const dist = [y - m.r.y0, m.r.x1 - x, m.r.y1 - y, x - m.r.x0][s]!, along = s % 2 === 0 ? x - m.r.x0 : y - m.r.y0; if (dist < TAPE_W && m.sides[s]![along]) c = (along + dist) % 6 === 0 ? TAPE[1]! : dist === TAPE_W - 1 ? TAPE[2]! : TAPE[0]!; } }
    if (V.focus >= 0 && V.part[i] !== V.focus) c = mix(c, hex('#000000'), 0.55);
    return c; }
  const overview = () => { const k = Math.max(1, Math.ceil(Math.max(V.w / (S.w - 20), V.h / (VIEW.h - 8)))), ox = Math.round((S.w - V.w / k) / 2), oy = VIEW.y + VIEW.h - Math.round(V.h / k) - 4; return { k, ox, oy }; };
  function scene() {
    if (whole) { const { k, ox, oy } = overview();
      for (let y = VIEW.y; y < VIEW.y + VIEW.h; y++) for (let x = 0; x < S.w; x++) S.px(x, y, y < oy + V.groundY / k ? wall(x, y) : floor(x, y));
      for (let y = 0; y < V.h; y += k) for (let x = 0; x < V.w; x += k) { const c = pixel(y * V.w + x); if (c) S.px(ox + x / k, oy + y / k, c); }
      return; }
    const z = V.zoom, gy = (V.groundY - V.cam.y) * z + VIEW.y;
    for (let y = VIEW.y; y < VIEW.y + VIEW.h; y++) for (let x = 0; x < S.w; x++) { const ix = Math.floor(x / z) + V.cam.x, iy = Math.floor((y - VIEW.y) / z) + V.cam.y, c = ix >= 0 && iy >= 0 && ix < V.w && iy < V.h ? pixel(iy * V.w + ix) : null;
      S.px(x, y, c ?? (y < gy ? wall(x, y) : floor(x, y))); }
    // the measured paper: a dotted outline with its size in mm, then the sides still to tape
    const toScr = (x: number, y: number) => [(x - V.cam.x) * z, (y - V.cam.y) * z + VIEW.y] as const;
    const dotted = (m: Mask, onlyOpen: boolean) => { const [a, b] = toScr(m.r.x0, m.r.y0), [c2, d2] = toScr(m.r.x1 + 1, m.r.y1 + 1), t = Math.floor(performance.now() / 120);
      for (let s = 0; s < 4; s++) { if (onlyOpen && sideDone(m, s)) continue; const pts = s === 0 ? [a, b, c2, b] : s === 1 ? [c2, b, c2, d2] : s === 2 ? [a, d2, c2, d2] : [a, b, a, d2], n = Math.ceil(Math.hypot(pts[2]! - pts[0]!, pts[3]! - pts[1]!));
        for (let k = 0; k < n; k++) if (((k + t) >> 2) % 2 === 0) S.px(pts[0]! + (pts[2]! - pts[0]!) * k / n, pts[1]! + (pts[3]! - pts[1]!) * k / n, m.laid ? hex('#ff6a4a') : COL.lit); }
      if (!m.laid) { const wmm = (m.r.x1 - m.r.x0) * MM, hmm = (m.r.y1 - m.r.y0) * MM, s = `${wmm} × ${hmm} mm`; S.fill(a, b - 11, S.tw(s) + 6, 10, hex('#1a120b')); S.text(s, a + 3, b - 10, COL.lit); } };
    if (maskPick) dotted(maskPick, false); if (tool === 'mask') for (const m of V.masks) if (m.part >= 0) dotted(m, true); }
  /** the tool in the hand, with its shadow on whatever is under it */
  function toolSprite() { const p = ui.pointer(); if (p.y < VIEW.y || p.y > VIEW.y + VIEW.h || report || whole || ui.hover) return; const down = p.down, x = Math.round(p.x), y = Math.round(p.y), lift = down ? 0 : 2;
    const shade = (sx: number, sy: number, sw: number, sh: number, a: number) => { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) { const dx = (i - sw / 2) / (sw / 2), dy = (j - sh / 2) / (sh / 2); if (dx * dx + dy * dy < 1) S.px(sx + i, sy + j, [10, 6, 4], a); } };
    if (tool === 'lens') { shade(x - 2, y + 2, 16, 10, 0.25); for (let a = 0; a < 6.3; a += 0.05) for (const rr of [7, 8]) S.px(x + Math.cos(a) * rr, y - 4 + Math.sin(a) * rr, rr === 8 ? hex('#3a2a1e') : BRASSC); for (let k = 0; k < 8; k++) { S.px(x + 6 + k * 0.7, y + 2 + k * 0.8, hex('#5a3a22')); S.px(x + 7 + k * 0.7, y + 2 + k * 0.8, hex('#7a5232')); } S.px(x - 3, y - 7, hex('#ffffff'), 0.8); return; }
    if (tool === 'brush') { const off = down ? 2 : 6; shade(x - 7 + off, y - 4 + off, 15, 10, 0.35);
      for (let j = -5; j <= 4; j++) for (let i = -7; i <= 7; i++) { if ((i / 7.5) ** 2 + (j / 5.2) ** 2 > 1 - rnd(((i + 40) * 13 + (j + 40) * 7) >>> 0) * 0.25) continue; const n = rnd(((i + 20) * 31 + (j + 20) * 17) >>> 0); S.px(x + i, y + j - lift, n < 0.2 ? hex('#4a4e52') : n < 0.5 ? hex('#7a8086') : n < 0.8 ? hex('#a8aeb4') : hex('#e2e6ea')); } }
    else if (tool === 'lead') { const off = down ? 2 : 6; shade(x - 3 + off, y - 2 + off, 8, 6, 0.32); S.fill(x - 2, y - 15 - lift, 4, 12, hex('#7a5a3a')); S.vline(x - 2, y - 15 - lift, y - 4 - lift, hex('#9a7a52')); S.fill(x - 3, y - 4 - lift, 6, 4, hex('#9a9ea4')); S.px(x - 2, y - 4 - lift, hex('#d8dce0')); S.px(x, y - lift, hex('#5a5e62')); if (down) for (let k = 0; k < 3; k++) S.px(x - 2 + k * 2, y - 6 - ((performance.now() / 90 + k * 3) % 6), hex('#d8d8d0'), 0.5); }
    else if (tool === 'mask') { shade(x - 6 + 4, y - 6 + 4, 13, 13, 0.3); for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const dd = Math.hypot(i, j); if (dd > 6.3 || dd < 2.6) continue; S.px(x + i, y - lift + j, dd > 5.4 ? TAPE[2]! : (i + j) % 3 === 0 ? TAPE[1]! : TAPE[0]!); } }
    else { const off = down ? 3 : 7, cy = y - lift; shade(x - 4 + off, y + off, 22, 9, 0.3);
      S.fill(x - 1, cy - 2, 4, 3, hex('#3a3a3e')); S.fill(x + 3, cy - 4, 12, 6, hex('#7a7e86')); S.hline(x + 3, x + 14, cy - 4, hex('#b8bcc4')); S.fill(x + 9, cy + 2, 3, 8, hex('#5a5e66')); S.fill(x + 6, cy - 11, 7, 7, hex('#9a6a3a')); S.hline(x + 6, x + 12, cy - 11, hex('#c89060'));
      if (down) for (let k = 0; k < 14; k++) { const t = Math.floor(performance.now() / 30); S.px(x - 3 - rnd((k * 7 + t) >>> 0) * 12, cy - 4 + rnd((k * 13 + t) >>> 0) * 8, COLOURS[colour]!.rgb ?? hex(base.paint), 0.6); } } }
  const BRASSC = hex('#c9a052');
  const clock = () => { const m = 8 * 60 + Math.floor(minutes), hh = Math.floor(m / 60), mm = m % 60; return `${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };
  const arrows: [string, string, Rect, number, number][] = [['l', '<', { x: 2, y: VIEW.y + 80, w: 14, h: 40 }, -1, 0], ['r', '>', { x: 464, y: VIEW.y + 80, w: 14, h: 40 }, 1, 0], ['u', '^', { x: 210, y: VIEW.y + 2, w: 60, h: 13 }, 0, -1], ['d', 'v', { x: 210, y: VIEW.y + VIEW.h - 15, w: 60, h: 13 }, 0, 1]];
  /** close in on one part: the zoom that fits it in the view, the view centred on it */
  function focusOn(k: number) { V.focus = k; if (k < 0) { V.zoom = 1; clampCam(); V.camF = { ...V.cam }; return; } let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let j = 0; j < V.N; j++) if (V.part[j] === k) { const x = j % V.w, y = (j / V.w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    V.zoom = Math.max(1, Math.min(3, Math.floor(Math.min(VIEW.w / (x1 - x0 + 30), VIEW.h / (y1 - y0 + 30))))); V.cam = { x: Math.round((x0 + x1) / 2 - VIEW.w / V.zoom / 2), y: Math.round((y0 + y1) / 2 - VIEW.h / V.zoom / 2) }; clampCam(); V.camF = { ...V.cam }; }
  const partName = (k: number) => V.fin[k]?.name ?? '';

  return { id: 'bodywork',
    frame(_a, dt) {
      minutes += dt * 20 / 60;                                                                        // work runs twenty times real time
      scene();
      const p = ui.pointer(), z = V.zoom, lx = Math.floor(p.x / z) + V.cam.x, ly = Math.floor((p.y - VIEW.y) / z) + V.cam.y, li = lx >= 0 && ly >= 0 && lx < V.w && ly < V.h ? ly * V.w + lx : -1;
      let snd: '' | 'scrape' | 'spray' | 'tape' | 'lead' = '', amt = 0, pitch = 1;
      if (!whole && !report) for (const [id, label, r, dx, dy] of arrows) { const held = p.down && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; ui.button('pan-' + id, r, label, { down: held });
        if (held) { V.camF.x += dx * 160 / z * dt; V.camF.y += dy * 120 / z * dt; V.cam.x = V.camF.x; V.cam.y = V.camF.y; clampCam(); } }
      const overUI = ui.hover !== '' || p.y < VIEW.y || p.y >= VIEW.y + VIEW.h, clicked = ui.missed() && !overUI;
      if (whole) { if (clicked) { const { k, ox, oy } = overview(); V.cam.x = Math.round((p.x - ox) * k - VIEW.w / 2 / z); V.cam.y = Math.round((p.y - oy) * k - VIEW.h / 2 / z); clampCam(); V.camF = { ...V.cam }; whole = false; } }
      else if (!report) {
        if (tool === 'lens') { if (clicked) focusOn(li >= 0 && V.kind[li] ? V.part[li]! : -1); }
        else if (tool === 'mask') {
          const open = V.masks.find(m => !m.sides.every((_, k) => sideDone(m, k)));
          if (taping && p.down) { const m = taping.m, s = taping.side, len = sideLen(m, s), pos = Math.max(0, Math.min(len, s % 2 === 0 ? lx - m.r.x0 : ly - m.r.y0)), from = taping.at;
            if (Math.abs(pos - taping.from) > Math.abs(from - taping.from)) { const a = Math.min(from, pos), b = Math.max(from, pos); for (let k = Math.floor(a); k <= Math.ceil(b) && k < m.sides[s]!.length; k++) m.sides[s]![k] = 1; const v = Math.abs(pos - from) / Math.max(dt, 0.001); taping.at = pos; snd = 'tape'; amt = Math.min(1, 0.45 + v / 160); pitch = 0.7 + Math.min(1.2, v / 220); } }
          else if (taping && !p.down) { if (sideDone(taping.m, taping.side)) app.sound.once('peel'); taping = null; }
          else if (clicked && open && li >= 0) { const s = nearSide(open, lx, ly); if (s >= 0) { const pos = s % 2 === 0 ? lx - open.r.x0 : ly - open.r.y0; taping = { m: open, side: s, from: pos, at: pos }; } }
          else if (clicked && !maskPick && li >= 0 && V.kind[li]) pickMask(li); }
        else if (p.down && !overUI && !ui.tookClick) { const from = last ?? { x: lx, y: ly }, moved = Math.hypot(lx - from.x, ly - from.y), n = Math.max(1, Math.ceil(moved)), dir = moved > 0.01 ? { x: (lx - from.x) / moved, y: (ly - from.y) / moved } : dirLast; let t = 0;
          for (let k = 1; k <= n; k++) t += dab(from.x + (lx - from.x) * k / n, from.y + (ly - from.y) * k / n, tool === 'spray' ? dt / n : dt, dir);
          if (tool === 'spray') { if (moved < 0.5) t += dab(lx, ly, dt, dir); snd = 'spray'; amt = 1; } else if (t > 0 && (moved > 0.3 || tool === 'lead')) { snd = tool === 'brush' ? 'scrape' : 'lead'; amt = tool === 'lead' ? 1 : Math.min(1, moved / 4); pitch = tool === 'lead' ? 1 : 0.8 + Math.min(0.6, moved / 30); }
          last = { x: lx, y: ly }; dirLast = dir; }
        else last = null; }
      app.sound.play(snd, amt, pitch);
      toolSprite();
      // the plates
      const bar = { x: 4, y: 4, w: 472, h: 18 }; ui.panel(bar, 'enamel'); const [t1, tv, t2] = split({ x: 12, y: 7, w: 456, h: 12 }, ['*', 100, 70], 4);
      ui.label({ ...t1!, y: 9, h: 9 }, V.focus >= 0 ? `부품: ${partName(V.focus)}` : '수리 견본: 1929 세단 · 녹 제거와 부분 도색', COL.cream);
      split(tv!, ['*', '*', '*'], 2).forEach((r, k) => { if (ui.tab('view' + k, r, VIEWS[k]!.title, V === VIEWS[k])) { V = VIEWS[k]!; maskPick = null; taping = null; whole = false; } });
      ui.label({ ...t2!, y: 9, h: 9 }, clock(), COL.cream, 'r');
      S.fill(0, VIEW.y + VIEW.h, S.w, 14, COL.wood2); S.hline(0, S.w - 1, VIEW.y + VIEW.h, COL.shadow);
      const tipRow = { x: 8, y: 228, w: 464, h: 10 };
      if (maskPick && !maskPick.laid) { const [l, b1, b2] = split(tipRow, ['*', 60, 40], 4); ui.label({ ...l!, y: 229, h: 9 }, `${partName(maskPick.part)}: 점선 치수로 종이를 자른다`, COL.cream); if (ui.button('paper', { ...b1!, y: 227, h: 12 }, '종이 대기')) { layPaper(maskPick); maskPick = null; } if (ui.button('paper-no', { ...b2!, y: 227, h: 12 }, '취소')) maskPick = null; }
      else if (tool === 'mask' && V.masks.some(m => !m.sides.every((_, k) => sideDone(m, k)))) ui.label({ ...tipRow, y: 229, h: 9 }, '붉은 점선 가장자리를 따라 눌러 밀면 테이프가 붙는다 (네 변 모두)', COL.cream);
      else ui.label({ ...tipRow, y: 229, h: 9 }, whole ? '전체 보기: 작업할 곳을 누르면 가까이 간다' : TOOLS.find(t => t.id === tool)!.tip, COL.cream);
      ui.panel({ x: 4, y: 240, w: 472, h: 26 }, 'plate');
      const b = split({ x: 8, y: 244, w: 464, h: 16 }, ['*', '*', '*', '*', '*', 50, 48, 32, 30], 3);
      TOOLS.forEach((t, k) => { if (ui.button('tool-' + t.id, b[k]!, t.name, { down: tool === t.id })) { tool = t.id; taping = null; } });
      if (ui.button('colour', b[5]!, COLOURS[colour]!.name)) { colour = (colour + 1) % COLOURS.length; app.sound.once('shake'); }
      { const sw = COLOURS[colour]!.rgb ?? hex(base.paint); S.fill(b[5]!.x + 3, b[5]!.y + 4, 4, 8, sw); }
      if (ui.button('untape', b[6]!, '종이 떼기', { disabled: !VIEWS.some(v => v.masks.length) })) unmaskAll();
      if (ui.button('whole', b[7]!, whole ? '가까이' : '전체', { down: whole })) whole = !whole;
      if (ui.button('inspect', b[8]!, '검사')) inspect();
      if (report) { const r = { x: 90, y: 28, w: 300, h: 206 }; ui.panel(r, 'card'); ui.label({ x: r.x + 10, y: r.y + 6, w: r.w - 20, h: 10 }, '검사 결과', COL.ink); S.hline(r.x + 8, r.x + r.w - 8, r.y + 18, COL.card2);
        report.slice(0, 15).forEach((l, i) => ui.label({ x: r.x + 10, y: r.y + 21 + i * 10, w: r.w - 20, h: 9 }, l, i ? COL.inkSoft : COL.ink));
        ui.paragraph({ x: r.x + 10, y: r.y + 176, w: r.w - 90, h: 22 }, verdict, COL.ink);
        if (ui.button('close', { x: r.x + r.w - 70, y: r.y + r.h - 20, w: 60, h: 14 }, '계속')) report = null; }
    },
    key(_a, e) { const k = '12345'.indexOf(e.key); if (k >= 0) { tool = TOOLS[k]!.id; return true; }
      const mv: Record<string, [number, number]> = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }; const m = mv[e.key];
      if (m && !whole) { V.cam.x += m[0] / V.zoom; V.cam.y += m[1] / V.zoom; clampCam(); V.camF = { ...V.cam }; return true; } if (e.key === 'Escape') { focusOn(-1); maskPick = null; return true; } return false; } };
}
