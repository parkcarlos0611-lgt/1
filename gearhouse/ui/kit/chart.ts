// The design system's cartoon line graph (docs/systems/110 G4: the engine workshop's dyno): thick lines with a black
// outline in the role colours, chunky axes with their tick labels in the title type (rimmed), a dark plate, a hatched
// band (the red line's), the peaks marked with a ringed dot and a tag, a needle. Drawn on a 2D canvas; the tick and
// tag rules are pure (and tested).
import { INK, ROLE, type Role } from './tokens';

/** a tick step for a span up to `max` in about `n` steps: 1, 2, 2.5 or 5 times a power of ten */
export function niceStep(max: number, n = 4): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1; const raw = max / Math.max(1, n), p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw - 1e-9) return m * p; return 10 * p; }
/** the axis' top for a figure with some room over it, on a whole tick, and its step */
export function niceAxis(peak: number, n = 4, room = 1.12): { max: number; step: number } {
  const step = niceStep(peak * room, n); return { max: Math.max(step, Math.ceil(peak * room / step) * step), step }; }
/** tags placed so they do not overlap: each wants its box (x, y the top left, w, h); one that meets one placed before
 *  goes below its point instead (`below` its distance), and if that meets too, further down. Returns the tops */
export function placeTags(tags: { x: number; y: number; w: number; h: number; below: number }[]): number[] {
  const put: { x: number; y: number; w: number; h: number }[] = [], meet = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  return tags.map(t => { let y = t.y; for (let i = 0; i < 4 && put.some(p => meet({ ...t, y }, p)); i++) y = i === 0 ? t.y + t.below : y + t.h + 4; put.push({ ...t, y }); return y; }); }

export interface ChartSeries { ys: number[]; role: Role; /** 0 the left axis, 1 the right */ axis: 0 | 1; /** a soft fill under it */ fill?: boolean;
  /** its peak marked: the index and the tag's two lines */ peak?: { i: number; text: string; sub?: string } }
export interface ChartAxis { max: number; step: number; label: string; role: Role }
export interface ChartOpts { xs: number[]; xMax: number; xStep: number; xText: (v: number) => string; xLabel: string; axes: [ChartAxis, ChartAxis?]; series: ChartSeries[];
  /** draw the series only up to this x (a sweep) */ upTo?: number; /** a hatched band from this x to the end */ band?: number; /** a needle at this x */ needle?: number;
  /** the title font family (CSS) */ font: string; /** the plate's colour */ plate: string; dpr: number }

/** text with a black rim (the title type's edge) */
function rimText(g: CanvasRenderingContext2D, t: string, x: number, y: number, fill: string, rim: number) { g.lineJoin = 'round'; g.lineWidth = rim; g.strokeStyle = INK; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); }
/** the graph drawn over the whole canvas (W x H device pixels) */
export function drawCartoonChart(g: CanvasRenderingContext2D, W: number, H: number, o: ChartOpts): void {
  const k = o.dpr, f = (px: number, w = 700) => `italic ${w} ${Math.round(px * k)}px ${o.font}`, A0 = o.axes[0], A1 = o.axes[1];
  g.clearRect(0, 0, W, H);
  // the plate: a dark well, cut corners, a thick outline
  const c = 10 * k, bw = 3 * k; g.beginPath(); g.moveTo(c, 0); g.lineTo(W, 0); g.lineTo(W, H - c); g.lineTo(W - c, H); g.lineTo(0, H); g.lineTo(0, c); g.closePath(); g.fillStyle = INK; g.fill();
  g.save(); g.beginPath(); const i = bw, ci = c - bw * 0.4; g.moveTo(i + ci, i); g.lineTo(W - i, i); g.lineTo(W - i, H - i - ci); g.lineTo(W - i - ci, H - i); g.lineTo(i, H - i); g.lineTo(i, i + ci); g.closePath(); g.fillStyle = o.plate; g.fill(); g.clip();
  g.font = f(14); const yw = Math.max(g.measureText(String(A0.max)).width, g.measureText(String(A1?.max ?? '')).width);
  const L = 16 * k + yw, R = W - (A1 ? 16 * k + yw : 16 * k), T = 30 * k, B = H - 36 * k;
  const X = (v: number) => L + (R - L) * v / o.xMax, Y = (a: ChartAxis, v: number) => B - (B - T) * v / a.max;
  // the grid: chunky soft lines
  g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,0.10)';
  for (let v = o.xStep; v < o.xMax - 1e-9; v += o.xStep) { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), B); g.stroke(); }
  for (let v = A0.step; v < A0.max + 1e-9; v += A0.step) { g.beginPath(); g.moveTo(L, Y(A0, v)); g.lineTo(R, Y(A0, v)); g.stroke(); }
  // the band (the red line on): hatched red
  if (o.band !== undefined && o.band < o.xMax) { const x0 = X(o.band); g.save(); g.beginPath(); g.rect(x0, T, R - x0, B - T); g.clip(); g.fillStyle = 'rgba(255,90,60,0.18)'; g.fillRect(x0, T, R - x0, B - T);
    g.strokeStyle = 'rgba(255,90,60,0.45)'; g.lineWidth = 5 * k; for (let x = x0 - (B - T); x < R; x += 16 * k) { g.beginPath(); g.moveTo(x, B); g.lineTo(x + (B - T), T); g.stroke(); } g.restore();
    g.lineWidth = 3 * k; g.strokeStyle = ROLE.red[0]; g.beginPath(); g.moveTo(x0, T); g.lineTo(x0, B); g.stroke(); }
  // the series: a soft fill, then the black outline wide and the colour over it
  const upTo = o.upTo ?? Infinity, pts = (s: ChartSeries, a: ChartAxis) => { const p: [number, number][] = []; for (let j = 0; j < o.xs.length; j++) { if (o.xs[j]! > upTo) break; p.push([X(o.xs[j]!), Y(a, s.ys[j]!)]); } return p; };
  for (const s of o.series) { const a = (s.axis ? A1 : A0) ?? A0, p = pts(s, a); if (p.length < 2) continue;
    if (s.fill) { g.beginPath(); g.moveTo(p[0]![0], B); for (const [x, y] of p) g.lineTo(x, y); g.lineTo(p[p.length - 1]![0], B); g.closePath(); g.fillStyle = ROLE[s.role][0] + '30'; g.fill(); }
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [w, col] of [[13, INK], [7, ROLE[s.role][0]]] as const) { g.lineWidth = w * k; g.strokeStyle = col; g.beginPath(); p.forEach(([x, y], j) => j ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
    g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); p.forEach(([x, y], j) => j ? g.lineTo(x, y - 1.8 * k) : g.moveTo(x, y - 1.8 * k)); g.stroke(); }
  // the axes: thick black lines, the ticks' labels rimmed in the title type, the axes' names in their colours
  g.lineCap = 'square'; g.lineWidth = 4 * k; g.strokeStyle = INK; g.beginPath(); g.moveTo(L, T - 6 * k); g.lineTo(L, B); g.lineTo(R, B); if (A1) g.lineTo(R, T - 6 * k); g.stroke();
  g.font = f(14); g.textBaseline = 'middle';
  for (let v = 0; v <= o.xMax + 1e-9; v += o.xStep) { g.textAlign = 'center'; rimText(g, o.xText(v), X(v), B + 13 * k, '#fff', 3.5 * k); g.lineWidth = 3 * k; g.strokeStyle = INK; g.beginPath(); g.moveTo(X(v), B); g.lineTo(X(v), B + 5 * k); g.stroke(); }
  for (const [a, side] of [[A0, 0], [A1, 1]] as const) { if (!a) continue;
    for (let v = 0; v <= a.max + 1e-9; v += a.step) { g.textAlign = side ? 'left' : 'right'; rimText(g, String(Math.round(v)), side ? R + 7 * k : L - 7 * k, Y(a, v), ROLE[a.role][0], 3.5 * k); } }
  g.font = f(14); g.textBaseline = 'alphabetic'; g.textAlign = 'left'; rimText(g, A0.label, L, T - 12 * k, ROLE[A0.role][0], 4 * k);
  if (A1) { g.textAlign = 'right'; rimText(g, A1.label, R, T - 12 * k, ROLE[A1.role][0], 4 * k); }
  g.font = f(11.5); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; rimText(g, o.xLabel, (L + R) / 2, H - 5 * k, 'rgba(255,255,255,0.85)', 3 * k);
  // the needle: a yellow line rimmed black
  if (o.needle && o.needle > 0 && o.needle <= o.xMax) { const x = X(o.needle); for (const [w, col] of [[6, INK], [2.5, ROLE.yellow[0]]] as const) { g.lineWidth = w * k; g.strokeStyle = col; g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke(); } }
  // the peaks: a ringed dot and a tag in the series' colour, the tags kept apart
  const tags: { x: number; y: number; w: number; h: number; below: number; s: ChartSeries; px: number; py: number }[] = [];
  for (const s of o.series) { const pk = s.peak, a = (s.axis ? A1 : A0) ?? A0; if (!pk || o.xs[pk.i]! > upTo) continue; const px = X(o.xs[pk.i]!), py = Y(a, s.ys[pk.i]!);
    g.font = f(14); const w = Math.max(g.measureText(pk.text).width, (g.font = f(10.5), g.measureText(pk.sub ?? '').width)) + 16 * k, h = (pk.sub ? 36 : 22) * k;
    tags.push({ x: Math.max(L + 2 * k, Math.min(R - w - 2 * k, px - w / 2)), y: Math.max(T - 26 * k, py - h - 14 * k), w, h, below: h + 28 * k, s, px, py }); }
  const tops = placeTags(tags.map(t => ({ ...t, x: t.x - 6 * k, w: t.w + 12 * k, h: t.h + 4 * k })));
  tags.forEach((t, j) => { const y = Math.min(B - t.h - 4 * k, tops[j]!), col = ROLE[t.s.role], up = y + t.h < t.py;
    g.lineWidth = 3 * k; g.strokeStyle = INK; g.beginPath(); g.moveTo(t.px, t.py); g.lineTo(Math.max(t.x + 8 * k, Math.min(t.x + t.w - 8 * k, t.px)), up ? y + t.h : y); g.stroke();
    g.save(); g.translate(t.x, y); g.transform(1, 0, -0.14, 1, 0, 0); g.fillStyle = INK; g.fillRect(0, 2 * k, t.w, t.h); g.fillStyle = col[0]; g.fillRect(0, 0, t.w, t.h);
    g.fillStyle = col[1]; g.fillRect(0, t.h * 0.7, t.w, t.h * 0.3); g.lineWidth = 2.5 * k; g.strokeStyle = INK; g.strokeRect(0, 0, t.w, t.h); g.restore();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = f(14); rimText(g, t.s.peak!.text, t.x + t.w / 2, y + 11 * k, '#fff', 3.5 * k);
    if (t.s.peak!.sub) { g.font = f(10.5); g.fillStyle = INK; g.fillText(t.s.peak!.sub, t.x + t.w / 2, y + 27 * k); }
    g.beginPath(); g.arc(t.px, t.py, 7.5 * k, 0, Math.PI * 2); g.fillStyle = col[0]; g.fill(); g.lineWidth = 3.5 * k; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(t.px, t.py, 2.4 * k, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); });
  g.restore(); }
