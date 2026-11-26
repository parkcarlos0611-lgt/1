// Prototype (review 65): the running gear in metal, not as a diagram. The car's chassis parts are drawn from below,
// as the sheets' under views show them, each with the shading of its section (a channel rail lit on its flange and
// dark in its web, a tube round across its width, a casting rounded at its edges and rough on its face, a leaf stack in
// bands), the texture of its metal (black enamel on steel, grey cast iron, dull tube, rusty exhaust), wear and grime,
// and the shadow where one part lies over another. Pixels are coloured directly (this is the look being judged, not the
// game's palette yet).
// npx tsx tools/ref/metalproto.ts <model json> <out png> [mm a pixel]
import { readFileSync, writeFileSync } from 'node:fs';
import { viewDesign, type CarModel } from '../../render/car/model';
import { encodePNG } from '../png';

const m = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarModel, OUT = process.argv[3]!, MM = Number(process.argv[4] ?? 5);
const d = viewDesign(m, 'top', undefined, { chassis: true });
const C = m.width / 2, W = Math.ceil((m.length + 200) / MM), H = Math.ceil((m.width + 200) / MM);
const X = (x: number) => (x + 100) / MM, Y = (y: number) => (H - (y + 100) / MM);          // seen from below: the car's left on top
type V3 = [number, number, number];
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(xi, yi, s) * (1 - u) + hash(xi + 1, yi, s) * u) * (1 - v) + (hash(xi, yi + 1, s) * (1 - u) + hash(xi + 1, yi + 1, s) * u) * v; };
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;

// what each part is made of and how its section is shaped
type Kind = 'channel' | 'tube' | 'casting' | 'leaf' | 'box' | 'tyre';
const kindOf = (id: string, el: string): Kind => id.startsWith('tyre') ? 'tyre' : el === 'frame' ? 'channel' : /driveline|axle(?!R)|exhaust|tailpipe|manifold|axleF|axleR/.test(id) ? 'tube' : el === 'spring' || /leaf/.test(id) ? 'leaf' : /tank|muffler/.test(id) ? 'box' : 'casting';
const METAL: Record<string, { base: V3; spec: V3; rough: number; rust: number }> = {
  enamel: { base: [34, 35, 38], spec: [150, 158, 170], rough: 0.25, rust: 0.12 },        // chassis black on steel
  iron: { base: [78, 76, 72], spec: [170, 168, 160], rough: 0.75, rust: 0.2 },           // grey cast iron
  tube: { base: [58, 58, 60], spec: [175, 176, 180], rough: 0.4, rust: 0.18 },           // drawn steel tube
  exhaust: { base: [92, 74, 62], spec: [190, 170, 150], rough: 0.6, rust: 0.6 },         // heat-browned, rusty
  rubber: { base: [30, 30, 31], spec: [80, 80, 82], rough: 0.9, rust: 0 } };
const metalOf = (id: string, el: string) => id.startsWith('tyre') ? 'rubber' : /exhaust|muffler|tailpipe|manifold/.test(id) ? 'exhaust' : el === 'frame' || el === 'spring' || /tank|cross/.test(id) ? 'enamel' : /driveline|axleF/.test(id) ? 'tube' : 'iron';

// the panels from below: lowest parts nearest the eye, so drawn last
const panels = [...d.panels].sort((a, b) => b.z - a.z).sort((a, b) => Number(a.id.startsWith('tyre')) - Number(b.id.startsWith('tyre')));   // the tyres stand round the axle ends
const img = new Uint8ClampedArray(W * H * 4), owner = new Int32Array(W * H).fill(-1);
for (let i = 0; i < W * H; i++) { img[i * 4] = 214; img[i * 4 + 1] = 212; img[i * 4 + 2] = 205; img[i * 4 + 3] = 255; }
const inside = (pts: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!; if ((yi! > y) !== (yj! > y) && x < (xj! - xi!) * (y - yi!) / (yj! - yi!) + xi!) c = !c; } return c; };
const segDist = (px: number, py: number, a: number[], b: number[]) => { const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - a[0]!) * dx + (py - a[1]!) * dy) / l)); return Math.hypot(px - a[0]! - t * dx, py - a[1]! - t * dy); };
const L = [-0.45, -0.55, 0.7];                                                               // light from the upper left, towards the viewer
panels.forEach((p, k) => {
  const pts = p.pts.map(q => [X(q[0]!), Y(q[1]!)]), kind = kindOf(p.id, p.element ?? ''), mt = METAL[metalOf(p.id, p.element ?? '')]!;
  const xs = pts.map(q => q[0]!), ys = pts.map(q => q[1]!), x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  const long = (x1 - x0) >= (y1 - y0);                                                       // which way the part runs
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
    if (!inside(pts, x + 0.5, y + 0.5)) continue;
    let e = 1e9; for (let i = 0; i < pts.length; i++) e = Math.min(e, segDist(x + 0.5, y + 0.5, pts[i]!, pts[(i + 1) % pts.length]!));
    const across = long ? (y + 0.5 - y0) / Math.max(1, y1 - y0) : (x + 0.5 - x0) / Math.max(1, x1 - x0), a2 = across * 2 - 1;
    // the surface normal of the section
    let nx = 0, ny = 0, nz = 1;
    if (kind === 'tube' || kind === 'box' || kind === 'tyre') { const s = Math.max(-0.98, Math.min(0.98, a2)); if (long) ny = s; else nx = s; nz = Math.sqrt(1 - s * s); }
    else if (kind === 'channel') { if (Math.abs(a2) > 0.62) { const s = Math.sign(a2) * 0.55; if (long) ny = s; else nx = s; nz = 0.83; } else { nz = 1; } }   // the flanges turn away; the web lies flat
    else { const r = Math.min(1, e / 3.5); const g = 1 - r; if (e < 3.5) { /* rounded casting edge */ const lx = (x + 0.5 - (x0 + x1) / 2), ly = (y + 0.5 - (y0 + y1) / 2), ll = Math.hypot(lx, ly) || 1; nx = lx / ll * g * 0.8; ny = ly / ll * g * 0.8; nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)); } }
    if (kind === 'leaf') { const band = Math.floor(across * 7); nz = band % 2 ? 0.9 : 1; ny = band % 2 ? 0.3 : 0; }
    // rough surfaces scatter the normal
    const rgh = mt.rough * (kind === 'casting' ? 0.35 : 0.15); nx += (fbm(x * 0.9, y * 0.9, k) - 0.5) * rgh; ny += (fbm(x * 0.9, y * 0.9, k + 3) - 0.5) * rgh;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = Math.max(0, nx * L[0]! + ny * L[1]! + nz * L[2]!), hv = [L[0]!, L[1]!, L[2]! + 1], hl = Math.hypot(hv[0]!, hv[1]!, hv[2]!);
    const spec = Math.pow(Math.max(0, (nx * hv[0]! + ny * hv[1]! + nz * hv[2]!) / hl), mt.rough > 0.6 ? 12 : 40) * (1 - mt.rough * 0.6);
    // the metal's own texture, wear and grime: rust in blotches, oily dirt towards the edges, chipped enamel on edges
    const rust = Math.max(0, fbm(x * 0.12, y * 0.12, k + 20) - (1 - mt.rust * 0.55)) * 3.2, grime = Math.max(0, 1 - e / 6) * 0.25 + fbm(x * 0.05, y * 0.3, 40) * 0.15;
    const chip = metalOf(p.id, p.element ?? '') === 'enamel' && e < 1.6 && hash(x, y, k) < 0.35;
    let c: V3 = [mt.base[0], mt.base[1], mt.base[2]];
    if (chip) c = [110, 108, 104];
    c = [c[0] + (138 - c[0]) * rust * 0.6, c[1] + (78 - c[1]) * rust * 0.6, c[2] + (44 - c[2]) * rust * 0.6];
    const grain = (hash(x, y, k + 9) - 0.5) * 10 * mt.rough;
    const sh = 0.38 + 0.9 * diff;
    let r = c[0] * sh + mt.spec[0] * spec + grain, g = c[1] * sh + mt.spec[1] * spec + grain, b = c[2] * sh + mt.spec[2] * spec + grain;
    r *= 1 - grime; g *= 1 - grime; b *= 1 - grime * 0.9;
    if (e < 0.9) { r *= 0.55; g *= 0.55; b *= 0.55; }                                          // the dark line where a part ends
    if (kind === 'tyre') {   // rubber, not metal: a crowned tread of blocks across the tyre's width, the shoulders rounding away, no gloss
      const t = Math.abs(a2), along = long ? x : y, block = Math.floor(along / 3) % 2, groove = (Math.floor(along / 3) + (t > 0.45 ? 1 : 0)) % 2;
      const crown = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - t * t)), lit = t < 0.82 ? (groove ? 0.62 : 1) : 0.7 - (t - 0.82) * 1.5;
      const v = 34 * crown * lit + (block ? 4 : 0) + (hash(x, y, 77) - 0.5) * 6 + (t > 0.9 ? 8 : 0);
      r = v; g = v; b = v + 1; if (e < 0.9) { r *= 0.6; g *= 0.6; b *= 0.6; } }
    const i = (y * W + x) * 4; img[i] = r; img[i + 1] = g; img[i + 2] = b; owner[y * W + x] = k;
  } });
// shadow cast by each part onto what lies behind it (a soft offset towards the lower right)
const sh = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = owner[y * W + x]!; if (o < 0) continue; for (let d2 = 1; d2 <= 4; d2++) { const xx = x + d2, yy = y + d2; if (xx >= W || yy >= H) break; const o2 = owner[yy * W + xx]!; if (o2 !== o && o2 < o) sh[yy * W + xx] = Math.max(sh[yy * W + xx]!, 0.45 * (1 - d2 / 5)); } }
for (let i = 0; i < W * H; i++) if (sh[i]) { img[i * 4] = img[i * 4]! * (1 - sh[i]!); img[i * 4 + 1] = img[i * 4 + 1]! * (1 - sh[i]!); img[i * 4 + 2] = img[i * 4 + 2]! * (1 - sh[i]!); }
writeFileSync(OUT, encodePNG(W, H, img)); console.log(W, H, panels.length);
