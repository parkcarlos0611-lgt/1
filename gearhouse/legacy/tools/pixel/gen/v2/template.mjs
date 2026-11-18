// Body generator v2 - reference-first. Every body is a MEASURED replica (template) re-proportioned by a section warp,
// so all detail (fenders, glass, trim, lamps, chassis) comes from real drawings and never from invented primitives.
//  sections along x:  front (nose..front arch) | HOOD zone | CABIN (fixed) | QUARTER zone | rear (rear arch..tail)
//  sections along z:  body (ground..belt) fixed | GREENHOUSE (belt..roof) scalable
// Blending: target section lengths / heights are the weighted average of several templates; the primary template is warped
// to them - proportions stay inside the measured cars, details stay those of a real car.
import { tire } from '../tire.mjs';
import { sedanD, coupeD } from '../detail30.mjs';
import { tourer33, sedan30 } from '../specs30.mjs';
import { airflow34, zephyr37 } from '../stream30d.mjs';
import { townCar34 } from '../luxury30d.mjs';
import { lux41, cont40, sedan42, coupe40, small46, woody46, pickup40, truck40 } from '../e2civil.mjs';

export const TEMPLATES = [
  { id: 'sedan30', name: '1930 TOWN SEDAN', year: 1930, style: 'box', type: 'sedan4d', seg: 'family', spec: sedanD },
  { id: 'coupe30', name: '1930 COUPE', year: 1930, style: 'box', type: 'coupe2d', seg: 'economy', spec: coupeD },
  { id: 'cabrio33', name: '1933 CABRIOLET', year: 1933, style: 'box', type: 'coupe2d', seg: 'luxury', spec: tourer33 },
  { id: 'airflow34', name: '1934 AIRFLOW-TYPE SEDAN', year: 1934, style: 'stream', type: 'sedan4d', seg: 'family', spec: airflow34 },
  { id: 'town34', name: '1934 V12 TOWN CAR', year: 1934, style: 'box', type: 'sedan4d', seg: 'luxury', spec: townCar34 },
  { id: 'zephyr37', name: '1937 STREAMLINE COUPE', year: 1937, style: 'stream', type: 'coupe2d', seg: 'sport', spec: zephyr37 },
  { id: 'coupe40', name: '1940 V8 COUPE', year: 1940, style: 'stream', type: 'coupe2d', seg: 'family', spec: coupe40 },
  { id: 'cont40', name: '1940 V12 CONTINENTAL-TYPE', year: 1940, style: 'stream', type: 'coupe2d', seg: 'luxury', spec: cont40 },
  { id: 'pickup40', name: '1940 HALF-TON PICKUP', year: 1940, style: 'stream', type: 'pickup', seg: 'utility', spec: pickup40 },
  { id: 'truck40', name: '1940 3-TON TRUCK', year: 1940, style: 'stream', type: 'truck', seg: 'utility', spec: truck40 },
  { id: 'lux41', name: '1941 V8 LUXURY SEDAN', year: 1941, style: 'stream', type: 'sedan4d', seg: 'luxury', spec: lux41 },
  { id: 'sedan42', name: '1942 FOUR-DOOR SEDAN', year: 1942, style: 'stream', type: 'sedan4d', seg: 'family', spec: sedan42 },
  { id: 'small46', name: '1946 SMALL FOUR-DOOR', year: 1946, style: 'stream', type: 'sedan4d', seg: 'economy', spec: small46 },
  { id: 'woody46', name: '1946 WOODY WAGON', year: 1946, style: 'stream', type: 'wagon', seg: 'family', spec: woody46 }];

const clone = o => JSON.parse(JSON.stringify(o));
const isPt = a => Array.isArray(a) && a.length >= 2 && a.length <= 4 && a.every(v => typeof v === 'number');
function eachPoint(o, f, skip = new Set(['grad', 'win', 'seats'])) { if (Array.isArray(o)) { if (isPt(o)) { f(o); return; } o.forEach(v => eachPoint(v, f, skip)); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!skip.has(k)) eachPoint(v, f, skip); }

// ---- landmarks (mm) read from the measured spec itself ----
export function landmarks(spec) {
  const T = tire(spec.tire || '6.00-16'), w = spec.wheels.map(v => v.x).sort((a, b) => a - b), F = w[0], R = w[w.length - 1];
  const gap = Math.max(T.r * 1.08, ...(spec.arches || []).map(a => a.r || 0).filter(r => r > 10), ...(spec.fenders || []).map(f => f.wr || 0).filter(r => r > 10));
  const body = []; eachPoint(spec.body, p => body.push(p)); const xs = body.map(p => p[0]), zs = body.map(p => p[1]);
  const noseX = Math.min(...xs), tailX = Math.max(...xs), roof = Math.max(...zs);
  let belt = spec.win?.belt; if (belt == null) { const g = []; eachPoint(spec.glass || [], p => g.push(p)); belt = g.length ? Math.min(...g.map(p => p[1])) : roof * 0.62; }
  const upper = body.filter(p => p[1] > belt + Math.max(150, (roof - belt) * 0.35)); const cowl = Math.min(...upper.map(p => p[0])), cab = Math.max(...upper.map(p => p[0]));
  const a0 = F + gap + 40, b1 = R - gap - 40, cRear = cab + 40, quarterOK = b1 - cRear > 80;
  return { F, R, wb: R - F, r: T.r, gap, noseX, tailX, roof, belt, cowl, cab, a0, hood: Math.max(0, cowl - 40 - a0), cabin: cab - cowl, quarter: quarterOK ? b1 - cRear : 0, quarterOK, b1, cRear,
    greenhouse: roof - belt, frontOH: F - noseX, rearOH: tailX - R };
}

// ---- section warp: dWB split into hood / quarter zones, greenhouse scale; arches, cabin and both ends stay rigid ----
export function warpSpec(spec0, { dWB = 0, gh = 1, shareHood = 0.5 } = {}) {
  const L = landmarks(spec0), s = clone(spec0);
  let dB = L.quarterOK ? dWB * (1 - shareHood) : 0, dA = dWB - dB;
  dA = Math.max(dA, -(L.hood - 450)); if (L.quarterOK) dB = Math.max(dB, -(L.quarter - 60));
  const xa = L.a0, xh = L.cowl - 40, xc = L.cRear, xq = L.b1;
  const X = x => x <= xa ? x : x <= xh ? xa + (x - xa) * ((xh - xa + dA) / Math.max(1, xh - xa)) : x <= xc || !L.quarterOK ? x + dA + (L.quarterOK ? 0 : (x > xc ? dB : 0)) : x <= xq ? xc + dA + (x - xc) * ((xq - xc + dB) / Math.max(1, xq - xc)) : x + dA + dB;
  const Z = z => (z <= L.belt ? z : L.belt + (z - L.belt) * gh);
  const P = p => { p[0] = X(p[0]); p[1] = Z(p[1]); };
  // rigid groups: lamps / small parts / handles translate by their centre (no stretched ellipses or emblems)
  const rigid = arr => (arr || []).forEach(o => { const pts = []; eachPoint(o, p => pts.push(p)); if (!pts.length) return; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const dx = X(cx) - cx, dz = Z(cz) - cz; pts.forEach(p => { p[0] += dx; p[1] += dz; }); });
  rigid(s.lamps); rigid((s.parts || []).filter(p => !p.behind || (p.pts && p.pts.length < 9))); (s.handles || []).forEach(P);
  const done = new Set(['lamps', 'parts', 'handles', 'grad', 'win', 'id', 'paint', 'tire', 'wheel', 'glassStyle', 'frame']);
  for (const [k, v] of Object.entries(s)) if (!done.has(k)) eachPoint(v, P);
  (s.parts || []).filter(p => p.behind && p.pts && p.pts.length >= 9).forEach(p => eachPoint(p, P));
  for (const o of [...(s.wheels || []), ...(s.arches || []), ...(s.spares || [])]) { if (typeof o.x === 'number') o.x = X(o.x); if (typeof o.z === 'number' && o.z > L.belt) o.z = Z(o.z); }
  for (const f of s.fenders || []) { if (typeof f.wx === 'number') f.wx = X(f.wx); }
  for (const b of s.bumperSets || []) for (const k of ['x0', 'x1', 'clamp']) if (typeof b[k] === 'number') b[k] = X(b[k]);
  for (const l of s.louvres || []) { l.x0 = X(l.x0); l.x1 = X(l.x1); }
  if (s.win) { const w = s.win; w.open = w.open.map(([a, b, o = {}]) => [a == null ? null : X(a), b == null ? null : X(b), { ...o, cut: o.cut && o.cut.map(([x, z]) => [X(x), Z(z)]) }]);
    for (const k of ['vent', 'wheel']) if (typeof w[k] === 'number') w[k] = X(w[k]); w.seats = (w.seats || []).map(X); if (typeof w.ventTop === 'number') w.ventTop = Z(w.ventTop); }
  s.len = Math.ceil(spec0.len + dA + dB); s.height = Math.ceil(Math.max(spec0.height, Z(L.roof) + 60));
  s.v2 = { template: spec0.id, dA, dB, gh, wb: L.wb + dA + dB };
  return s;
}
// repaint: every use of the template's own paint becomes the player's colour (wood, black fenders, chrome stay)
export function repaint(spec, paint) { const old = spec.paint; const f = o => { if (Array.isArray(o)) o.forEach(f); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (v === old) o[k] = paint; else f(v); } }; f(spec); spec.paint = paint; return spec; }

// ---- player-facing build: template + optional blend partner -> target proportions -> warp ----
export function available(year, type) { return TEMPLATES.filter(t => t.year <= year && (!type || t.type === type)); }
export function makeBody({ base, partner = null, mix = 0, wb = null, roof = 0, paint = null }) {
  const A = TEMPLATES.find(t => t.id === base) || TEMPLATES[0], B = partner && TEMPLATES.find(t => t.id === partner), la = landmarks(A.spec);
  let tgtWB = la.wb, tgtGH = la.greenhouse;
  if (B && mix > 0) { const lb = landmarks(B.spec); tgtWB = la.wb + (lb.wb - la.wb) * mix; tgtGH = la.greenhouse + (lb.greenhouse - la.greenhouse) * mix; }
  if (wb) tgtWB = wb; tgtGH *= 1 + roof;                                                   // roof: -0.12 .. +0.12 of the measured greenhouse
  const s = warpSpec(A.spec, { dWB: tgtWB - la.wb, gh: tgtGH / la.greenhouse });
  if (paint) repaint(s, paint); return { spec: s, lm: la, tpl: A };
}
