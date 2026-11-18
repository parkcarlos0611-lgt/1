// Measured-base body designer (stage A, rebuilt). The player starts from one of the MEASURED replicas and reshapes it:
//  side  : the measured side spec, section-warped (front overhang | hood | cabin fixed | quarter | rear overhang, body height, greenhouse)
//  front : the measured front/rear drawing where one exists, otherwise a front/rear built from the side spec's own heights
//          (fender crown, hood top, lamp centre, bumper line, belt, roof) and the front/rear photos -> all views agree
//  parts : grille, headlamps, bumpers, tail lamps and wheels can be taken from another measured car of the same or an earlier year;
//          they are re-fitted to the base car's own mounting points (grille box, lamp centre, bumper line).
import { fillet } from '../geom.mjs';
import { tire } from '../tire.mjs';
import { TEMPLATES, landmarks, repaint } from '../v2/template.mjs';
import { sedan30front, sedan30rear } from '../specs30.mjs';
import { airflow34Front, airflow34Rear, zephyr37Front, zephyr37Rear } from '../stream30d.mjs';
import { townCarFront, townCarRear } from '../luxury30d.mjs';

const clone = o => JSON.parse(JSON.stringify(o)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isPt = a => Array.isArray(a) && a.length >= 2 && a.length <= 4 && a.every(v => typeof v === 'number');
function eachPoint(o, f, skip = new Set()) { if (Array.isArray(o)) { if (isPt(o)) { f(o); return; } o.forEach(v => eachPoint(v, f, skip)); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!skip.has(k)) eachPoint(v, f, skip); }
const circ = (cy, cz, r, n = 20) => Array.from({ length: n }, (_, k) => [cy + Math.cos(k / n * 6.2832) * r, cz + Math.sin(k / n * 6.2832) * r]);
const pw = (knots) => x => { const k = knots; if (x <= k[0][0]) return x + k[0][1] - k[0][0]; for (let i = 1; i < k.length; i++) if (x <= k[i][0]) { const [a, A] = k[i - 1], [b, B] = k[i]; return A + (x - a) * (B - A) / Math.max(1e-6, b - a); }
  const [a, A] = k[k.length - 1]; return x + A - a; };
const knots = arr => arr.filter((p, i) => i === 0 || p[0] > arr.slice(0, i).reduce((m, q) => Math.max(m, q[0]), -1e9) + 1);

// ---- base cars: generic names (no makes or model names), real overall widths, front/rear source ----
// front descriptors for the cars without a measured front come from the front/rear photo set (1939-46): grille family, lamp spacing, catwalk
export const BASES = {
  sedan30: { name: '1930 TOWN SEDAN', width: 1710, front: sedan30front, rear: sedan30rear },
  coupe30: { name: '1930 COUPE', width: 1700, front: sedan30front, rear: sedan30rear },
  cabrio33: { name: '1933 CABRIOLET', width: 1860, front: townCarFront, rear: townCarRear },
  airflow34: { name: '1934 STREAMLINED SEDAN', width: 1760, front: airflow34Front, rear: airflow34Rear },
  town34: { name: '1934 V12 TOWN CAR', width: 1900, front: townCarFront, rear: townCarRear },
  zephyr37: { name: '1937 STREAMLINED COUPE', width: 1880, front: zephyr37Front, rear: zephyr37Rear },
  coupe40: { name: '1940 V8 COUPE', width: 1860, gen: { grille: 'prow', catwalk: 150, lampU: 0.55, split: 1, guards: 2, tail: 'pod', rw: 'single' } },
  cont40: { name: '1940 V12 LONG-DECK COUPE', width: 1960, gen: { grille: 'lowH', catwalk: 120, lampU: 0.6, guards: 2, tail: 'pod', rw: 'small', spare: 1 } },
  pickup40: { name: '1940 HALF-TON PICKUP', width: 1880, gen: { grille: 'prow', catwalk: 160, lampU: 0.55, split: 1, guards: 0, tail: 'bracket', rw: 'small', bed: 'pickup' } },
  truck40: { name: '1940 3-TON TRUCK', width: 2200, gen: { grille: 'truck', catwalk: 120, lampU: 0.5, split: 1, guards: 0, tail: 'bracket', rw: 'small', bed: 'truck' } },
  lux41: { name: '1941 V8 LUXURY SEDAN', width: 1990, gen: { grille: 'waterfall', catwalk: 110, lampU: 0.58, guards: 2, tail: 'pod', rw: 'single' } },
  sedan42: { name: '1942 FOUR-DOOR SEDAN', width: 1880, gen: { grille: 'wideH', catwalk: 120, lampU: 0.6, guards: 2, tail: 'pod', rw: 'split' } },
  small46: { name: '1946 SMALL FOUR-DOOR', width: 1580, gen: { grille: 'shellV', catwalk: 130, lampU: 0.6, guards: 0, tail: 'pod', rw: 'small' } },
  woody46: { name: '1946 WOODY WAGON', width: 1880, gen: { grille: 'wideH', catwalk: 120, lampU: 0.6, guards: 2, tail: 'pod', rw: 'wagon' } },
};
const tplOf = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
export const baseList = year => TEMPLATES.filter(t => t.year <= year).map(t => t.id);
export const baseName = id => (BASES[id] || {}).name || id;

// ---- design record for a measured base: every value starts at the measured car ----
export function measuredDesign(id, year) {
  const t = tplOf(id), L = landmarks(t.spec), B = BASES[t.id];
  return { base: t.id, year, type: t.type, wb: Math.round(L.wb), frontOH: Math.round(L.frontOH), rearOH: Math.round(L.rearOH), belt: Math.round(L.belt), roof: Math.round(L.roof), width: B.width,
    wheelFrom: t.id, whitewall: t.spec.wheel?.whitewall ?? 0, lampFrom: t.id, grilleFrom: t.id, bumperFrom: t.id, tailFrom: t.id, shape: { screen: 0, crown: 0, back: 0, deck: 0, nose: 0, fTail: 0, fCrown: 0 }, fenderBlack: false, guards: B.gen ? B.gen.guards : 0, fog: false, ornament: true };
}
// limits around the measured car (body pressings can be re-tooled, not reinvented)
export function measuredRanges(d) {
  const t = tplOf(d.base), L = landmarks(t.spec), B = BASES[t.id];
  return { wb: [Math.round(L.wb - Math.min(450, L.hood - 450 + (L.quarterOK ? L.quarter - 60 : 0))), Math.round(L.wb + 600)], frontOH: [Math.round(L.frontOH * 0.8), Math.round(L.frontOH * 1.3 + 60)],
    rearOH: [Math.round(L.rearOH * 0.75), Math.round(L.rearOH * 1.3 + 80)], belt: [Math.round(L.belt * 0.9), Math.round(L.belt * 1.1)], roof: [Math.round(L.belt * 1.0 + (L.roof - L.belt) * 0.82 + (L.roof - L.belt) * 0), Math.round(L.roof + (L.roof - L.belt) * 0.15)],
    width: [Math.round(B.width * 0.92), Math.round(B.width * 1.08)] };
}
export function clampMeasured(d) { const R = measuredRanges(d), notes = [];
  for (const k of Object.keys(R)) { const v = clamp(d[k], R[k][0], R[k][1]); if (Math.abs(v - d[k]) > 0.5) notes.push(k); d[k] = v; }
  const SR = shapeRanges(d); d.shape = { ...(d.shape || {}) }; for (const k of Object.keys(SR)) d.shape[k] = clamp(d.shape[k] || 0, SR[k][0], SR[k][1]);
  const ok = baseList(d.year); for (const k of ['wheelFrom', 'lampFrom', 'grilleFrom', 'bumperFrom', 'tailFrom']) if (!ok.includes(d[k])) d[k] = d.base;
  return notes; }

// ---- shape control points on the measured outline (mm). Each one moves only its neighbourhood; the door shut lines stay. ----
export const SHAPE_KEYS = ['screen', 'crown', 'back', 'deck', 'nose', 'fTail', 'fCrown'];
export function shapeRanges(d) { const t = tplOf(d.base), boards = (t.spec.boards || []).length > 0, L = landmarks(t.spec);
  return { screen: [-120, 260], crown: [-50, 80], back: [-260, 320], deck: [-160, Math.round(Math.min(160, (L.roof - L.belt) * 0.3))], nose: [-140, 260], fTail: boards ? [0, 0] : [-150, 450], fCrown: [-70, 110] }; }
const xf = t => (t >= 1 ? 0 : (1 - t * t) * (1 - t * t)), zr = (z, a, b) => clamp((z - a) / Math.max(1, b - a), 0, 1);
function shapeSide(s, sh) {
  const L = landmarks(s), body = []; eachPoint(s.body, p => body.push(p));
  const roof = L.roof, belt = L.belt, top = body.filter(p => p[1] > roof - 70), hx = Math.min(...top.map(p => p[0])), rx = Math.max(...top.map(p => p[0]));
  const rearPts = body.filter(p => p[0] > rx + 150 && p[1] > L.r), deckZ = rearPts.length ? Math.max(...rearPts.map(p => p[1])) : belt, deckX = L.tailX - (L.tailX - rx) * 0.4;
  const front = body.filter(p => p[0] < L.F + 100), nz = front.length ? Math.max(...front.map(p => p[1])) : belt;
  const f0 = (s.fenders || [])[0], fz = f0 ? Math.max(...f0.pts.map(p => p[1])) : 0, fRear = f0 ? Math.max(...f0.pts.map(p => p[0])) : 0, fRearZ = f0 ? f0.pts.reduce((a, p) => (p[0] > a[0] ? p : a), [-1e9, 0])[1] : 0;
  const v = k => sh[k] || 0;
  const fn = (x, z) => { const g = zr(z, belt, roof); return [v('screen') * xf(Math.abs(x - hx) / 550) * g ** 1.3 + v('back') * xf(Math.abs(x - rx) / 600) * g ** 1.3 + v('nose') * xf(Math.abs(x - L.noseX) / (L.F - L.noseX + 350)) * zr(z, L.r, nz) ** 1.5,
    v('crown') * xf(Math.abs(x - (hx + rx) / 2) / ((rx - hx) / 2 + 300)) * g * g + v('deck') * xf(Math.abs(x - deckX) / ((L.tailX - rx) * 0.65 + 1)) * zr(z, L.r * 1.6, deckZ)]; };
  const mv = p => { const [dx, dz] = fn(p[0], p[1]); p[0] += dx; p[1] += dz; };
  const rigid = arr => (arr || []).forEach(o => { const pts = []; eachPoint(o, q => pts.push(q)); if (!pts.length) return; const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length, [dx, dz] = fn(cx, cz); pts.forEach(q => { q[0] += dx; q[1] += dz; }); });
  if (SHAPE_KEYS.some(k => v(k))) {
    for (const k of ['body', 'glass', 'tone', 'trim', 'doors', 'decals']) if (s[k]) eachPoint(s[k], mv);
    (s.handles || []).forEach(mv); if (s.win) s.win.open = s.win.open.map(([a, b, o = {}]) => [a, b, { ...o, cut: o.cut && o.cut.map(q => { const r = [...q]; mv(r); return r; }) }]);
    (s.parts || []).forEach(p => { if (p.behind && p.pts && p.pts.length >= 9) eachPoint(p, mv); else rigid([p]); }); rigid(s.lamps);
    if (f0 && (v('fTail') || v('fCrown'))) eachPoint(f0.pts, p => { p[0] += v('fTail') * zr(p[0], L.F + L.gap * 0.5, fRear) ** 1.5; p[1] += v('fCrown') * xf(Math.abs(p[0] - L.F) / (L.gap * 1.8)) * zr(p[1], L.r, fz); });
  }
  return [{ k: 'screen', x: hx + v('screen'), z: roof, ax: 'x' }, { k: 'crown', x: (hx + rx) / 2, z: roof + v('crown'), ax: 'z' }, { k: 'back', x: rx + v('back'), z: roof, ax: 'x' }, { k: 'deck', x: deckX, z: deckZ + v('deck'), ax: 'z' },
    { k: 'nose', x: L.noseX + v('nose'), z: nz, ax: 'x' }, ...(f0 ? [{ k: 'fTail', x: fRear + v('fTail'), z: fRearZ, ax: 'x' }, { k: 'fCrown', x: L.F, z: fz + v('fCrown'), ax: 'z' }] : [])];
}
// ---- side: measured spec + extended section warp ----
function warpSide(spec0, L, { dFO = 0, dWB = 0, dRO = 0, bh = 1, gh = 1 }) {
  const s = clone(spec0); let dB = L.quarterOK ? dWB * 0.5 : 0, dA = dWB - dB; dA = Math.max(dA, -(L.hood - 450)); if (L.quarterOK) dB = Math.max(dB, -(L.quarter - 60));
  const fz = L.F - L.gap - 20, rz = L.R + L.gap + 20; dFO = Math.max(dFO, -(fz - L.noseX - 40)); dRO = Math.max(dRO, -(L.tailX - rz - 40));
  const xa = L.a0, xh = L.cowl - 40, xc = L.cRear, xq = L.b1;
  const X = pw(knots([[L.noseX, L.noseX], [fz, fz + dFO], [xa, xa + dFO], [xh, xh + dFO + dA], [xc, xc + dFO + dA], [xq, xq + dFO + dA + dB], [rz, rz + dFO + dA + dB], [L.tailX, L.tailX + dFO + dA + dB + dRO]]));
  const zr = L.r, belt2 = zr + (L.belt - zr) * bh;
  const Z = z => z <= zr ? z : z <= L.belt ? zr + (z - zr) * bh : belt2 + (z - L.belt) * gh;
  const P = p => { p[0] = X(p[0]); p[1] = Z(p[1]); };
  const rigid = arr => (arr || []).forEach(o => { const pts = []; eachPoint(o, p => pts.push(p)); if (!pts.length) return; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const dx = X(cx) - cx, dz = Z(cz) - cz; pts.forEach(p => { p[0] += dx; p[1] += dz; }); });
  rigid(s.lamps); rigid((s.parts || []).filter(p => !p.behind || (p.pts && p.pts.length < 9))); (s.handles || []).forEach(P);
  const done = new Set(['lamps', 'parts', 'handles', 'grad', 'win', 'id', 'paint', 'tire', 'wheel', 'glassStyle', 'frame']);
  for (const [k, v] of Object.entries(s)) if (!done.has(k)) eachPoint(v, P);
  (s.parts || []).filter(p => p.behind && p.pts && p.pts.length >= 9).forEach(p => eachPoint(p, P));
  for (const o of [...(s.wheels || []), ...(s.arches || []), ...(s.spares || [])]) { if (typeof o.x === 'number') o.x = X(o.x); if (typeof o.z === 'number' && o.z > zr + 5) o.z = Z(o.z); }
  for (const f of s.fenders || []) { if (typeof f.wx === 'number') f.wx = X(f.wx); }
  for (const b of s.bumperSets || []) { for (const k of ['x0', 'x1', 'clamp']) if (typeof b[k] === 'number') b[k] = X(b[k]); }
  for (const l of s.louvres || []) { l.x0 = X(l.x0); l.x1 = X(l.x1); if (typeof l.z0 === 'number') { l.z0 = Z(l.z0); l.z1 = Z(l.z1); } }
  if (s.win) { const w = s.win; w.open = w.open.map(([a, b, o = {}]) => [a == null ? null : X(a), b == null ? null : X(b), { ...o, cut: o.cut && o.cut.map(([x, z]) => [X(x), Z(z)]) }]);
    for (const k of ['vent', 'wheel']) if (typeof w[k] === 'number') w[k] = X(w[k]); w.seats = (w.seats || []).map(X); for (const k of ['ventTop', 'belt', 'top']) if (typeof w[k] === 'number') w[k] = Z(w[k]);
    if (Array.isArray(w.line)) eachPoint(w.line, P); }
  s.len = Math.ceil(X(spec0.len) + 20); s.height = Math.ceil(Math.max(spec0.height, Z(L.roof) + 60));
  return { s, X, Z };
}
const lensW = sp => (sp.lamps || []).find(l => l.ramp === 'lensW' && l.e), lensR = sp => (sp.lamps || []).find(l => l.ramp === 'lensR' && l.e);
export function measuredSide(d, paint, strip = null) {
  const t = tplOf(d.base), L = landmarks(t.spec);
  const gh0 = L.roof - L.belt, belt2 = d.belt, roof2 = d.roof, bh = (belt2 - L.r) / Math.max(1, L.belt - L.r), gh = Math.max(0.6, (roof2 - belt2) / Math.max(1, gh0));
  const { s, X, Z } = warpSide(t.spec, L, { dFO: d.frontOH - L.frontOH, dWB: d.wb - L.wb, dRO: d.rearOH - L.rearOH, bh, gh });
  const handles = shapeSide(s, d.shape || {});
  // part swaps (side view): wheels, headlamp, tail lamp, bumper section
  const W = tplOf(d.wheelFrom).spec.wheel; if (W) s.wheel = { ...clone(W), whitewall: d.whitewall };
  const swapLamp = (pick, src) => { const a = pick(s), b = pick(tplOf(src).spec); if (a && b) { a.e = [a.e[0], a.e[1], b.e[2], b.e[3]]; a.bezel = b.bezel; } };
  if (d.lampFrom !== t.id) swapLamp(lensW, d.lampFrom); if (d.tailFrom !== t.id) swapLamp(lensR, d.tailFrom);
  if (d.bumperFrom !== t.id) { const src = tplOf(d.bumperFrom).spec.bumperSets || []; (s.bumperSets || []).forEach((b, i) => { const o = src[i] || src[0]; if (!o) return; const m0 = b.zs.reduce((a, z) => a + z, 0) / b.zs.length, m1 = o.zs.reduce((a, z) => a + z, 0) / o.zs.length;
    b.zs = o.zs.map(z => z - m1 + m0); b.h = o.h; }); }
  if (d.fenderBlack) for (const f of s.fenders || []) f.paint = 'black';
  if (strip === 'lamps') s.lamps = (s.lamps || []).filter(l => l.ramp !== 'lensW'); if (strip === 'tail') s.lamps = (s.lamps || []).filter(l => l.ramp !== 'lensR');   // part removed (fitting effect)
  if (strip === 'bumpers') s.bumperSets = []; if (strip === 'wheel') s.wheel = { style: 'disc', paint: 'black', whitewall: 0 };
  s.paint = t.spec.paint; repaint(s, paint);
  const L2 = landmarks(s);
  s.geo = { handles, r: L2.r, F: L2.F, R: L2.R, gap: L2.gap, noseX: L2.noseX, tailX: L2.tailX, cowlX: L2.cowl, hoodZ: L2.belt, beltZ: L2.belt, roofF: L2.cowl, roofR: L2.cab, H: L2.roof, base: t.id };
  s.v2 = { template: t.spec.id }; return s;
}

// ---- front / rear ----
// A) measured drawing re-fitted: y scaled to the chosen width, z warped through (wheel centre, belt, roof) of the side spec
function fitFront(f0, d, side, L2) {
  const f = clone(f0); const ys = [], zs = []; eachPoint(f.body, p => { ys.push(Math.abs(p[0])); zs.push(p[1]); });
  const half0 = Math.max(...ys), roofF = Math.max(...zs), beltF = f.cowlZ ?? (() => { const g = []; eachPoint(f.glass || [], p => g.push(p[1])); return g.length ? Math.min(...g) : roofF * 0.65; })();
  const ky = (d.width / 2) / half0, r = L2.r, Z = pw([[0, 0], [r, r], [beltF, L2.belt], [roofF, L2.roof]]);
  const P = p => { p[0] *= ky; p[1] = Z(p[1]); };
  for (const k of ['body', 'tone', 'glass', 'under', 'grilles', 'bumpers', 'parts', 'tyre']) if (f[k]) eachPoint(f[k], P);
  for (const l of f.lamps || []) { if (l.pts) eachPoint(l.pts, P); else { l.y *= ky; l.z = Z(l.z); } }
  if (f.hood) { f.hood.half *= ky; f.hood.top = Z(f.hood.top); f.hood.bottom = Z(f.hood.bottom); if (f.hood.pts) eachPoint(f.hood.pts, P); }
  for (const k of ['cowlZ', 'mirrorIn', 'lowZ']) if (typeof f[k] === 'number') f[k] = Z(f[k]);
  if (f.wheelIn) { f.wheelIn[0] *= ky; f.wheelIn[1] = Z(f.wheelIn[1]); } if (f.interior) f.interior.forEach(h => { h[0] *= ky; h[1] = Z(h[1]); });
  if (f.wiper) f.wiper = [f.wiper[0] * ky, Z(f.wiper[1]), f.wiper[2] * ky, Z(f.wiper[3])]; if (f.spare) f.spare.z = Z(f.spare.z);
  f.tire = side.tire || '6.00-16'; f.track = Math.round(d.width - tire(f.tire).section * 1.4 - 180); f.hub = f.hub ?? 40; delete f.tyre;
  f.width = d.width + 160; f.height = Math.ceil(L2.roof + 40); return f;
}
// B) built from the side spec's own heights + the photo-derived descriptor (1939-46 cars)
function sideHeights(side, L2) {
  const zmax = (o, f = () => true) => { let m = -1e9; eachPoint(o, p => { if (f(p)) m = Math.max(m, p[1]); }); return m; };
  const crown = zmax((side.fenders || [])[0]?.pts || [], () => true), hoodTop = zmax(side.body, p => p[0] > L2.F - 200 && p[0] < L2.cowl - 150);
  const lw = lensW(side), bs = (side.bumperSets || [])[0];
  return { crown: crown > 0 ? crown : L2.r * 2.2, hoodTop: Math.max(hoodTop, crown + 60), lampZ: lw ? lw.e[1] : crown - 120, lampR: lw ? Math.max(lw.e[3], 70) : 95, bz: bs ? bs.zs.reduce((a, z) => a + z, 0) / bs.zs.length : L2.r + 100, bh: bs ? bs.h : 100 };
}
export function front40(p) {
  const { W, H, belt, hoodTop, crown, r, rear } = p, half = W / 2, cab = half - 140, roofH = half * 0.66, hoodHalf = p.hoodHalf ?? Math.max(240, W * 0.19), fin = hoodHalf + p.catwalk, fz0 = r * 0.98, bz = p.bz, bh = Math.max(115, p.bh * 1.3);
  const paint = p.paint, fp = p.fenderPaint || paint, body = fillet([[0, fz0 - 40, 0], [half - 160, fz0 - 40, 0], [half - 20, fz0 + 100, 80], [half - 20, crown - 260, 200], [half - 90, crown - 30, 120], [cab, crown + 40, 60], [cab, belt - 40, 60], [cab - 25, belt + 40, 60], [roofH + 70, H - 200, 220], [roofH, H, 120], [0, H, 0]]);   // strong 1940s tumblehome
  const fender = sg => fillet([[sg * fin, fz0, 0], [sg * fin, crown - 200, 150], [sg * (fin + (half - fin) * 0.42), crown, 240], [sg * (half - 10), crown - 160, 200], [sg * half, crown - 420, 160], [sg * (half - 6), fz0 + 60, 80], [sg * (half - 120), fz0 - 10, 40], [sg * (fin + 50), fz0 - 10, 0]]);
  const under = [{ half: 1, pts: [[0, r - 80], [half - 200, r - 80], [half - 200, fz0 + 20], [0, fz0 + 20]], ramp: 'black', base: 1 }];              // splash pan / axle
  under.push({ half: 0, pts: fender(1), ramp: fp, base: 2 }, { half: 0, pts: fender(-1), ramp: fp, base: 2 });
  const lampY = fin + (half - fin) * p.lampU, lampR = clamp(p.lampR * 1.5, 92, 120), lampZ = clamp(p.lampZ, fz0 + lampR + 120, crown - lampR - 40);
  const parts = [], lamps = [], grilles = [];
  if (!rear) { for (const sg of [1, -1]) under.push({ half: 0, pts: circ(sg * lampY, lampZ, lampR * 1.32), ramp: fp, base: 3 }); }                // lamp nacelle faired into the fender
  // bumper: one deep blade with wrapped ends, iron brackets behind, optional guards
  const bumpers = [{ half: 1, pts: [[0, bz - bh / 2], [half - 40, bz - bh / 2 + 10], [half + 40, bz - bh * 0.15], [half + 50, bz + bh * 0.1], [half + 20, bz + bh / 2], [0, bz + bh / 2]], smooth: 1 }];
  under.push({ half: 0, pts: [[half * 0.5 - 30, bz - 160], [half * 0.5 + 30, bz - 160], [half * 0.5 + 30, bz], [half * 0.5 - 30, bz]], ramp: 'iron', base: 1 }, { half: 0, pts: [[-half * 0.5 - 30, bz - 160], [-half * 0.5 + 30, bz - 160], [-half * 0.5 + 30, bz], [-half * 0.5 - 30, bz]], ramp: 'iron', base: 1 });
  if (p.guards) for (const sg of [1, -1]) parts.push({ guard: 1, pts: fillet([[sg * half * 0.4 - 32, bz - bh * 0.7, 10], [sg * half * 0.4 + 32, bz - bh * 0.7, 10], [sg * half * 0.4 + 26, bz + bh * 1.9, 30], [sg * half * 0.4 - 26, bz + bh * 1.9, 30]]), chrome: 1 });
  let hood = null, glass, wiper = null, wheelIn = null, interior = [];
  if (!rear) {
    const g0 = bz + bh / 2 + 25, gt = hoodTop - 45, gh = gt - g0, gw = hoodHalf;
    hood = { half: hoodHalf, top: hoodTop, bottom: g0 - 10, round: 1, pts: [[0, g0 - 10, 0], [hoodHalf - 10, g0 - 10, 40], [hoodHalf, crown - 120, 180], [hoodHalf * 0.78, hoodTop - 40, 160], [hoodHalf * 0.3, hoodTop, 60], [0, hoodTop, 0]] };
    const G = {
      prow: [[0, g0, 0], [gw * 0.62, g0 + 20, 40], [gw * 0.5, g0 + gh * 0.55, 220], [gw * 0.2, gt, 100], [0, gt + 10, 0]],
      wideH: [[0, g0, 0], [fin - 20, g0, 50], [fin - 30, g0 + gh * 0.5, 80], [gw * 0.6, g0 + gh * 0.62, 120], [0, g0 + gh * 0.64, 0]],
      waterfall: [[0, g0, 0], [gw * 1.2, g0, 60], [gw * 1.1, g0 + gh * 0.6, 160], [gw * 0.45, g0 + gh * 0.82, 120], [0, g0 + gh * 0.84, 0]],
      lowH: [[0, g0, 0], [fin - 10, g0, 40], [fin - 10, g0 + gh * 0.33, 40], [0, g0 + gh * 0.36, 0]],
      shellV: [[0, g0, 0], [gw * 0.6, g0, 40], [gw * 0.6, gt - 130, 90], [gw * 0.42, gt, 90], [0, gt, 0]],
      truck: [[0, g0, 0], [gw * 0.92, g0, 30], [gw * 0.92, gt - 50, 70], [0, gt, 0]] }[p.grille] || [[0, g0, 0], [gw * 0.6, g0, 40], [gw * 0.6, gt, 60], [0, gt, 0]];
    grilles.push({ half: 1, pattern: ['wideH', 'lowH', 'truck'].includes(p.grille) ? 'hbar' : 'vbar', bars: 'chrome', surround: 'chrome', pts: fillet(G) });
    if (p.grille === 'prow') for (const sg of [1, -1]) grilles.push({ half: 0, pattern: 'hbar', bars: 'chrome', surround: 'chrome', pts: fillet([[sg * (hoodHalf + 15), g0 + 10, 0], [sg * (fin + 30), g0 + 10, 30], [sg * (fin + 10), g0 + gh * 0.32, 50], [sg * (hoodHalf + 15), g0 + gh * 0.36, 0]]) });
    if (p.grille !== 'shellV' && p.grille !== 'truck') parts.push({ pts: [[-12, gt + 10], [12, gt + 10], [12, hoodTop + 8], [-12, hoodTop + 8]], chrome: 1 });          // centre chrome strip
    if (p.ornament) parts.push({ orn: 1, pts: fillet([[-16, hoodTop], [16, hoodTop], [6, hoodTop + 70, 20], [-6, hoodTop + 70, 20]]), chrome: 1 });
    lamps.push({ y: lampY, z: lampZ, r: lampR, ramp: 'lensW', bezel: 'chrome' }, { y: fin - 10, z: crown - 70, r: 28, ramp: 'lensA', bezel: 'chrome' });   // headlamps + parking lamps
    if (p.fog) lamps.push({ fog: 1, y: half * 0.42, z: bz + bh + 110, r: 62, ramp: 'lensA', bezel: 'chrome' });
    parts.push({ pts: [[-180, bz - bh / 2 - 125], [180, bz - bh / 2 - 125], [180, bz - bh / 2 - 15], [-180, bz - bh / 2 - 15]], ramp: 'white', base: 2 });          // plate
    const gw2 = roofH + 10; glass = p.split ? [fillet([[22, belt + 40, 0], [gw2, belt + 40, 30], [gw2 - 30, H - 130, 50], [22, H - 130, 0]])] : [fillet([[0, belt + 40, 0], [gw2, belt + 40, 30], [gw2 - 30, H - 130, 50], [0, H - 130, 0]])];
    wiper = [-gw2 * 0.6, belt + 60, -gw2 * 0.15, belt + 150]; wheelIn = [gw2 * 0.45, belt + 160, 170]; interior = [[gw2 * 0.45, belt + 150, 170, 60]];
  } else {
    const ty = half - 150, tz = clamp(crown - 140, fz0 + 200, crown - 60);
    if (p.bed === 'pickup' || p.bed === 'truck') {                                                                  // cab back above the bed, tailgate / platform below
      const bedTop = p.bed === 'truck' ? belt - 120 : belt - 60, bw = p.bed === 'truck' ? half + 40 : half - 210;
      under.push({ half: 1, pts: [[0, fz0 + 60], [bw, fz0 + 60], [bw, bedTop], [0, bedTop]], ramp: p.bed === 'truck' ? 'wood' : paint, base: 2 });
      for (let k = 1; k < 4; k++) parts.push({ half: 1, pts: [[0, fz0 + 60 + (bedTop - fz0 - 60) * k / 4 - 8], [bw - 20, fz0 + 60 + (bedTop - fz0 - 60) * k / 4 - 8], [bw - 20, fz0 + 60 + (bedTop - fz0 - 60) * k / 4 + 8], [0, fz0 + 60 + (bedTop - fz0 - 60) * k / 4 + 8]], ramp: p.bed === 'truck' ? 'iron' : paint, base: 1 });
      lamps.push({ y: bw - 40, z: fz0 + 140, r: 45, ramp: 'lensR', bezel: 'chrome', single: p.bed === 'pickup' ? 1 : 0 });
      glass = [fillet([[0, belt + 120, 0], [cab * 0.5, belt + 120, 40], [cab * 0.5, H - 180, 40], [0, H - 180, 0]])];
    } else {
      under.push({ half: 1, pts: fillet([[0, bz + bh / 2 + 20, 0], [half * 0.55, bz + bh / 2 + 20, 60], [half * 0.5, belt - 60, 220], [0, belt + 10, 0]]), ramp: paint, base: 3 });   // trunk lid
      parts.push({ pts: fillet([[-50, belt * 0.8 - 18, 10], [50, belt * 0.8 - 18, 10], [50, belt * 0.8 + 18, 10], [-50, belt * 0.8 + 18, 10]]), chrome: 1 });
      lamps.push({ y: ty, z: tz, pts: fillet([[ty - 40, tz - 90, 30], [ty + 40, tz - 90, 30], [ty + 30, tz + 90, 30], [ty - 30, tz + 90, 30]]), ramp: 'lensR', bezel: 'chrome' });
      const rw = p.rw, gz0 = belt + 110, gz1 = H - 150;
      glass = rw === 'split' ? [fillet([[30, gz0, 0], [cab * 0.4, gz0, 50], [cab * 0.38, gz1, 60], [30, gz1, 0]])] : rw === 'wagon' ? [fillet([[0, gz0 - 30, 0], [cab - 120, gz0 - 30, 40], [cab - 140, gz1 + 40, 50], [0, gz1 + 40, 0]])]
        : [fillet([[0, gz0, 0], [cab * (rw === 'small' ? 0.36 : 0.5), gz0, 60], [cab * (rw === 'small' ? 0.34 : 0.46), gz1, 60], [0, gz1, 0]])];
      if (p.spare) parts.push({ pts: circ(0, bz + bh / 2 + r * 0.95, r * 0.95, 28), ramp: 'rubber', base: 1 }, { pts: circ(0, bz + bh / 2 + r * 0.95, r * 0.8, 28), ramp: paint, base: 3 }, { pts: circ(0, bz + bh / 2 + r * 0.95, r * 0.25), chrome: 1 });
      parts.push({ pts: [[-170, bz + bh / 2 + 20], [170, bz + bh / 2 + 20], [170, bz + bh / 2 + 125], [-170, bz + bh / 2 + 125]], ramp: 'white', base: 2 });
    }
  }
  return { width: W + 160, height: H + 40, paint, lowZ: fz0 + 160, frame: 'chrome', glassStyle: 'period', hood, cowlZ: rear ? null : belt, tire: p.tire, track: p.track, hub: 40,
    body, tone: p.roofTone ? [[0, H - 60], [half, H - 60], [half, H + 200], [0, H + 200]] : null, tonePaint: 'black', glass, interior, under, grilles, bumpers, lamps, parts, wiper, wheelIn };
}
function genFront(d, side, L2, rear, srcDesc) {
  const B = BASES[d.base], gd = { ...B.gen, ...(srcDesc || {}) }, h = sideHeights(side, L2), T = tire(side.tire || '6.00-16');
  return front40({ W: d.width, H: L2.roof, belt: L2.belt, hoodTop: h.hoodTop, crown: h.crown, r: T.r, tire: T.code, track: Math.round(d.width - T.section * 1.4 - 180), lampZ: h.lampZ, lampR: h.lampR,
    bz: h.bz, bh: h.bh, paint: side.paint, fenderPaint: d.fenderBlack ? 'black' : null, rear, ...gd, guards: d.guards, fog: d.fog, ornament: d.ornament, hoodHalf: B.gen.grille === 'shellV' ? d.width * 0.17 : null });
}
// bbox of a list of point sets
function bbox(list) { let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; eachPoint(list, p => { y0 = Math.min(y0, p[0]); y1 = Math.max(y1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); return { y0, y1, z0, z1 }; }
const viewOf = (id, d, rear) => { const dd = { ...measuredDesign(id, d.year), width: BASES[id].width }; const side = measuredSide(dd, 'paint.c0'); const L2 = landmarks(side); return BASES[id].front ? fitFront(rear ? BASES[id].rear : BASES[id].front, dd, side, L2) : genFront(dd, side, L2, rear); };
export function measuredView(d, paint, rear = false, strip = null) {
  const side = measuredSide(d, paint), L2 = landmarks(side), B = BASES[d.base];
  let f = B.front ? fitFront(rear ? B.rear : B.front, d, side, L2) : genFront(d, side, L2, rear);
  if (B.front) { repaint(f, paint); f.paint = paint; if (!rear && d.ornament && f.hood && B.front !== townCarFront) f.parts.push({ orn: 1, pts: fillet([[-16, f.hood.top], [16, f.hood.top], [6, f.hood.top + 80, 20], [-6, f.hood.top + 80, 20]]), chrome: 1 });
    if (!rear && d.fog) f.lamps.push({ fog: 1, y: d.width * 0.21, z: L2.r + 260, r: 62, ramp: 'lensA', bezel: 'chrome' }); }
  // part swaps, re-fitted to the base car's mounting points
  if (!rear && d.grilleFrom !== d.base && f.grilles?.length) { const src = viewOf(d.grilleFrom, d, false), sg = (src.grilles || []).filter(g => g.half); if (sg.length) {
    const a = bbox(f.grilles.filter(g => g.half).map(g => g.pts)), b = bbox(sg.map(g => g.pts)), hw = Math.max(a.y1, 60);
    f.grilles = clone(sg).map(g => { eachPoint(g.pts, p => { p[0] = p[0] / Math.max(1, b.y1) * hw; p[1] = a.z0 + (p[1] - b.z0) / Math.max(1, b.z1 - b.z0) * (a.z1 - a.z0); }); return g; }); } }
  const lampSrc = rear ? d.tailFrom : d.lampFrom;
  if (lampSrc !== d.base) { const src = viewOf(lampSrc, d, rear), sl = (src.lamps || [])[0], bl = (f.lamps || [])[0];
    if (sl && bl) { if (sl.r && bl.r) { bl.r = sl.r; bl.bezel = sl.bezel; } else if (sl.r) { const c = bbox([bl.pts]); bl.y = (c.y0 + c.y1) / 2; bl.z = (c.z0 + c.z1) / 2; bl.r = sl.r; delete bl.pts; } else if (sl.pts) {
      const c = bl.pts ? bbox([bl.pts]) : { y0: bl.y - bl.r, y1: bl.y + bl.r, z0: bl.z - bl.r, z1: bl.z + bl.r }, s0 = bbox([sl.pts]), cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2, sy = (s0.y0 + s0.y1) / 2, sz = (s0.z0 + s0.z1) / 2;
      bl.pts = clone(sl.pts).map(([y, z]) => [y - sy + cy, z - sz + cz]); delete bl.r; } } }
  if (d.bumperFrom !== d.base) { const src = viewOf(d.bumperFrom, d, rear); if (src.bumpers?.length && f.bumpers?.length) {
    const a = bbox(f.bumpers.map(b => b.pts)), b = bbox(src.bumpers.map(x => x.pts)), ky = a.y1 / Math.max(1, b.y1), dz = (a.z0 + a.z1) / 2 - (b.z0 + b.z1) / 2;
    f.bumpers = clone(src.bumpers).map(x => { eachPoint(x.pts, p => { p[0] *= ky; p[1] += dz; }); return x; }); } }
  if (strip === 'grille') f.grilles = []; if (strip === 'lamps') f.lamps = (f.lamps || []).filter(l => l.ramp !== 'lensW' || l.r < 40); if (strip === 'tail') f.lamps = (f.lamps || []).filter(l => l.ramp !== 'lensR');
  if (strip === 'fog') f.lamps = (f.lamps || []).filter(l => !l.fog); if (strip === 'ornament') f.parts = (f.parts || []).filter(q => !q.orn);
  if (strip === 'bumpers') { f.bumpers = []; f.parts = (f.parts || []).filter(q => !q.guard); }
  return f;
}
