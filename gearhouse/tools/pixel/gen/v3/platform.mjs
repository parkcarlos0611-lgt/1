// Platform (frame / unit body) for the measured-base designer. Every base car starts on its real construction:
//   channel-section ladder (1920s-30s), ladder + X-member (1932+), welded box rails + X-member (late 1930s),
//   unit body / monocoque (mid-1930s pioneers, research-locked here). Mass, stiffness, strength margin and cost come from the
//   rail section (depth x gauge), steel grade, cross-members and length; the same values drive the assembly scene.
import { Pix, Mask, line } from '../../pix.mjs';
import { fillet } from '../geom.mjs';
import { tire } from '../tire.mjs';

export const FRAME_TYPES = {
  ladderC: { name: 'CHANNEL LADDER', year: 1900, box: 0, x: 0, stiff: 0.45, main: 1915 },
  ladderX: { name: 'LADDER + X-MEMBER', year: 1932, box: 0, x: 1, stiff: 0.65, main: 1933 },
  boxX: { name: 'BOX RAILS + X-MEMBER', year: 1937, box: 1, x: 1, stiff: 0.82, main: 1940 },
  platform: { name: 'CENTRE-TUBE PLATFORM', year: 1934, box: 1, x: 0, stiff: 0.78, main: 1946 },          // backbone tube + pressed floor pan, body bolted on (1938 people's-car underside photo)
  unibody: { name: 'UNIT BODY (MONOCOQUE)', year: 1934, tech: 'unibody', box: 1, x: 0, stiff: 1.0, main: 1955 } };   // welded shell + front horns (1934 FWD shell photos)
export const GRADES = { mild: { name: 'MILD STEEL', year: 1900, k: 1, cost: 1 }, medium: { name: 'MEDIUM CARBON STEEL', year: 1928, k: 1.2, cost: 1.15 }, hts: { name: 'HIGH-TENSILE STEEL', year: 1938, k: 1.45, cost: 1.4 } };
const BASE = { sedan30: ['ladderC', 130, 4], coupe30: ['ladderC', 125, 4], cabrio33: ['ladderX', 170, 5], airflow34: ['ladderX', 150, 4.5], town34: ['ladderX', 190, 5.5], zephyr37: ['unibody', 0, 1.6],
  coupe40: ['ladderX', 150, 4], cont40: ['unibody', 0, 1.6], pickup40: ['ladderC', 160, 5], truck40: ['ladderC', 240, 7], lux41: ['boxX', 160, 3.5], sedan42: ['boxX', 150, 3.2], small46: ['ladderC', 120, 3.5], woody46: ['boxX', 150, 3.5] };
export function platformDefault(base, year = 1930) {
  const [type, railH, railT] = BASE[base] || (year < 1932 ? ['ladderC', 130, 4] : year < 1937 ? ['ladderX', 150, 4.2] : ['boxX', 150, 3.4]);
  return { type, railH: railH || 150, railT, cross: type === 'ladderC' ? 5 : 4, kick: base === 'truck40' ? 0 : type === 'unibody' ? 0 : 140, grade: 'mild', prev: type };
}
export const typesFor = (year, hasTech = () => true) => Object.keys(FRAME_TYPES).filter(k => FRAME_TYPES[k].year <= year && (!FRAME_TYPES[k].tech || hasTech(FRAME_TYPES[k].tech)));
export const gradesFor = year => Object.keys(GRADES).filter(k => GRADES[k].year <= year);
export function clampPlatform(pl, year, hasTech) { const ts = typesFor(year, hasTech); if (!ts.includes(pl.type)) { if (pl.type === 'unibody' || pl.type === 'platform') Object.assign(pl, { railH: 150, railT: 3.4, kick: 140, cross: 4 }); pl.type = ts.includes('boxX') ? 'boxX' : ts.includes('ladderX') ? 'ladderX' : 'ladderC'; }
  if (pl.prev && pl.prev !== pl.type) Object.assign(pl, pl.type === 'platform' ? { railH: 125, railT: 2.5 } : pl.type === 'unibody' ? { railT: 1.6 } : (pl.prev === 'unibody' || pl.prev === 'platform') ? { railH: 150, railT: 3.4, kick: 140, cross: 4 } : {});   // sensible section when the construction changes
  pl.prev = pl.type;                        // backbone tube: diameter / wall
  if (!gradesFor(year).includes(pl.grade)) pl.grade = 'mild'; pl.railH = Math.max(90, Math.min(pl.type === 'platform' ? 200 : 280, pl.railH)); pl.railT = Math.max(pl.type === 'unibody' ? 0.9 : 2.5, Math.min(pl.type === 'unibody' ? 2.5 : 8, pl.railT));
  pl.cross = Math.round(Math.max(3, Math.min(8, pl.cross))); pl.kick = Math.max(0, Math.min(260, pl.kick)); return pl; }

const G0 = g => ({ ...g, tailX: Math.max(g.tailX, g.R + 800), noseX: Math.min(g.noseX, g.F - 500) });   // trucks: the bed is not part of the cab outline
// mass (kg), torsional stiffness index (0..1.2), strength margin (needed section modulus vs provided), unit cost ($)
export function platformStats(pl, geo, { heavy = false } = {}) { geo = G0(geo);
  const T = FRAME_TYPES[pl.type], G = GRADES[pl.grade] || GRADES.mild, L = (geo.tailX - geo.noseX - 300) / 1000, wb = (geo.R - geo.F) / 1000;
  if (pl.type === 'unibody') {                                         // floor pan, sills, tunnel, stub rails: the body carries the load
    const kg = Math.round(70 + L * 9 * pl.railT / 1.6), stiff = 1.0 * (pl.railT / 1.6) ** 0.4 * G.k ** 0.2;
    return { kg, stiff, margin: (pl.railT / 1.6) * G.k * 1.15, cost: Math.round(55 * G.cost + kg * 0.2), label: T.name }; }
  if (pl.type === 'platform') {                                        // backbone tube (diameter railH, wall railT) + 1 mm pressed floor pan + front torsion tubes + rear fork
    const D = pl.railH, tubeKg = Math.PI * D * pl.railT * (wb * 1000 + 600) * 7850e-9, pan = 1.0 * 1100 * (wb * 1000 * 0.8) * 7850e-9 * 1.25, kg = Math.round(tubeKg + pan + 24);
    const stiff = T.stiff * (D / 120) ** 0.9 * (pl.railT / 2.5) ** 0.4 * G.k ** 0.1, modulus = Math.PI / 4 * D * D * pl.railT * 2.3 * G.k, need = 122 * 122 * 4 * (wb / 2.8) * (heavy ? 3.2 : 1);
    return { kg, stiff, margin: modulus / need, cost: Math.round(kg * 0.36 * G.cost + 18), label: T.name }; }
  const fl = pl.railH * 0.33, area = (T.box ? 2 * pl.railH + 2 * fl : pl.railH + 2 * fl) * pl.railT, rho = 7850e-6 * 1e-3;   // mm2 -> kg per mm
  const rails = 2 * area * L * 1000 * rho, cross = pl.cross * area * 0.55 * 1300 * rho, xk = T.x ? 2 * area * 0.8 * 1900 * rho : 0, kg = Math.round(rails + cross + xk + 8);
  const stiff = T.stiff * (pl.railH / 150) ** 0.8 * (pl.railT / 4) ** 0.5 * (1 + (pl.cross - 4) * 0.04) * (T.box ? 1 : 0.95);
  const modulus = pl.railH * pl.railH * pl.railT * (T.box ? 1.6 : 1) * G.k, need = 122 * 122 * 4 * (wb / 2.8) * (heavy ? 3.2 : 1);
  return { kg, stiff, margin: modulus / need, cost: Math.round(kg * 0.32 * G.cost + pl.cross * 2 + (T.box ? 12 : 0) + (T.x ? 8 : 0)), label: T.name };
}
// frame centre line in side view (z of the rail centre), shared with the assembly scene
export function frameLine(pl, geo) { geo = G0(geo); const fz = geo.r + 150, k = pl.type === 'unibody' ? 0 : pl.kick;
  if (pl.type === 'platform') { const z = geo.r + 30; return [[geo.F - 120, z + 40], [geo.F + 200, z], [geo.R - 420, z], [geo.R - 150, z + 90], [geo.R + 300, z + 150]]; }   // low tube, rear fork rising over the axle
  return [[geo.noseX + 120, fz + 40], [geo.F + 320, fz], [geo.R - 520, fz], [geo.R - 220, fz + k], [geo.R + 380, fz + k], [geo.tailX - 160, fz + k - Math.min(60, k / 2)]]; }
export function crossAt(pl, geo) { geo = G0(geo); if (pl.type === 'platform' || pl.type === 'unibody') return []; const a = geo.noseX + 160, b = geo.tailX - 200; return Array.from({ length: pl.cross }, (_, i) => a + (b - a) * i / Math.max(1, pl.cross - 1)); }

// ---- drawings (unpainted steel, rivet rows on channel rails, weld seams on box rails) ----
function canvas(P, wMM, hMM, mm, pad = 3) { const w = Math.ceil(wMM / mm) + pad * 2, h = Math.ceil(hMM / mm) + pad * 2; const px = new Pix(w, h); return { px, w, h, pad, M: () => new Mask(w, h) }; }
function paintMask(P, px, m, ramp, base = 2, tag = 40) { const r = P.id(ramp), bb = m.bbox(); if (bb.x1 < 0) return;
  for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { if (!m.get(x, y)) continue; let lv = base; if (!m.get(x, y - 1)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1)) lv = Math.max(0, lv - 1); px.set(x, y, r, lv, tag); } }
function outline(px) { const mark = []; for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { if (!px.ramp(x, y) || px.tag(x, y) !== 3) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !px.ramp(x + dx, y + dy))) mark.push(y * px.w + x); }
  for (const i of mark) px.l[i] = -1; }
// plan view (from above): rails, cross-members, X-member or floor pan, axles, tyres
export function platformPlan(P, pl, geo, { track, tireCode, width }, mm = 30) { geo = G0(geo);
  const T = tire(tireCode || '6.00-16'), len = geo.tailX - geo.noseX + 100, wid = Math.max(width, track + T.section * 1.3) + 80, c = canvas(P, len, wid, mm), { px, M } = c;
  const X = x => (x - geo.noseX + 50) / mm + c.pad, Y = y => c.h / 2 + y / mm;
  const band = (pts, th) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return m; };
  const rect = (x0, y0, x1, y1, r = 0) => M().poly(fillet([[x0, y0, r], [x1, y0, r], [x1, y1, r], [x0, y1, r]], 3).map(([x, y]) => [X(x), Y(y)]));
  for (const ax of [geo.F, geo.R]) for (const sg of [1, -1]) paintMask(P, px, rect(ax - T.r, sg * track / 2 - T.section * 0.55, ax + T.r, sg * track / 2 + T.section * 0.55, 60), 'rubber', 1, 3);
  const rY = Math.min(track / 2 - T.section * 0.7 - 60, width / 2 - 260), steel = 'bare';
  const dot = (x, y, lv) => { const xx = Math.round(X(x)), yy = Math.round(Y(y)); if (px.ramp(xx, yy)) px.set(xx, yy, P.id(steel), lv, 41); };
  if (pl.type === 'unibody') {                                          // welded shell: flat ribbed floor, deep sills, scuttle bulkhead, two box horns forward, rear wheel houses
    const hw = width / 2 - 110, x0 = geo.cowlX - 120, x1 = Math.min(geo.tailX - 120, geo.R + 900);
    paintMask(P, px, rect(x0, -hw, x1, hw, 90), steel, 1);                                                                                         // floor pan
    for (let y = -hw + 140; y < hw - 100; y += 150) paintMask(P, px, band([[x0 + 200, y], [geo.R - 400, y]], 30), steel, 2);                       // pressed longitudinal ribs
    for (const sg of [1, -1]) { paintMask(P, px, rect(x0, sg * hw - 70, x1, sg * hw + 70, 30), steel, 3);                                            // sills
      paintMask(P, px, band([[x0 + 60, sg * 300], [geo.noseX + 170, sg * 290]], 120), steel, 3);                                                    // front horns (box section)
      paintMask(P, px, rect(geo.R - T.r - 40, sg * hw - sg * 260, geo.R + T.r + 40, sg * hw - sg * 10, 120), steel, 0); }                          // rear wheel houses
    paintMask(P, px, band([[x0, -hw], [x0, hw]], 90), steel, 3);                                                                                    // scuttle bulkhead
    paintMask(P, px, band([[geo.noseX + 170, -330], [geo.noseX + 170, 330]], 50), steel, 2);                                                         // horn tie bar
    for (const x of [(x0 + geo.R) / 2, geo.R - 300]) paintMask(P, px, band([[x, -hw + 60], [x, hw - 60]], 50), steel, 2);                           // seat cross-members
    for (let x = x0; x < x1; x += 120) for (const sg of [1, -1]) dot(x, sg * hw, 0);                                                                // spot welds
  } else if (pl.type === 'platform') {                                  // centre tube + ribbed pan halves, front torsion-bar tubes, rear fork; body bolts to the pan flange
    const D = pl.railH, hw = width / 2 - 170, x0 = geo.cowlX - 60, x1 = geo.R - 330;
    for (const sg of [1, -1]) { paintMask(P, px, rect(x0, sg * D / 2, x1, sg * hw, 60), steel, 1);
      for (let x = x0 + 120; x < x1 - 60; x += 140) paintMask(P, px, band([[x, sg * (D / 2 + 60)], [x + 90, sg * (hw - 60)]], 28), steel, 2);        // pressed ribs
      for (let x = x0; x < x1; x += 110) dot(x, sg * hw, 4);                                                                                        // flange bolt row
      paintMask(P, px, band([[x1, sg * D / 2], [geo.R + 260, sg * 280]], 90), steel, 3); }                                                          // rear fork prongs
    paintMask(P, px, band([[geo.F - 140, 0], [x1 + 40, 0]], D), steel, 3);                                                                          // backbone tube
    for (const dx of [-80, 80]) paintMask(P, px, band([[geo.F + dx, -track / 2 + T.section * 0.9], [geo.F + dx, track / 2 - T.section * 0.9]], 75), 'iron', 3);   // torsion-bar tubes
  } else {
    const F = FRAME_TYPES[pl.type], th = Math.max(55, pl.railH * 0.33 * (F.box ? 1.3 : 1));
    for (const sg of [1, -1]) paintMask(P, px, band([[geo.noseX + 150, sg * rY * 0.72], [geo.F + 380, sg * rY * 0.78], [geo.cowlX, sg * rY], [geo.tailX - 160, sg * rY]], th), steel, 2);
    for (const x of crossAt(pl, geo)) paintMask(P, px, band([[x, -rY], [x, rY]], 55), steel, 1);
    if (F.x) { const a = geo.cowlX + 80, b = geo.R - 380; paintMask(P, px, band([[a, -rY * 0.95], [b, rY * 0.95]], th * 0.9), steel, 2); paintMask(P, px, band([[a, rY * 0.95], [b, -rY * 0.95]], th * 0.9), steel, 2); }
    const rivet = !F.box; for (let x = geo.noseX + 250; x < geo.tailX - 200; x += 180) for (const sg of [1, -1]) { const xx = Math.round(X(x)), yy = Math.round(Y(sg * rY)); if (px.ramp(xx, yy)) px.set(xx, yy, P.id(steel), rivet ? 4 : 0, 41); }
  }
  for (const ax of [geo.F, geo.R]) paintMask(P, px, band([[ax, -track / 2 + T.section * 0.5], [ax, track / 2 - T.section * 0.5]], 70), ax === geo.R ? 'paint.tank' : 'iron', 2);
  outline(px); return px;
}
// side profile: rail with kick-up and its section depth, axles, tyres
export function platformSide(P, pl, geo, tireCode, mm = 30) { geo = G0(geo);
  const T = tire(tireCode || '6.00-16'), len = geo.tailX - geo.noseX + 100, c = canvas(P, len, T.od + 200, mm), { px, M } = c;
  const X = x => (x - geo.noseX + 50) / mm + c.pad, Z = z => c.h - c.pad - z / mm;
  for (const ax of [geo.F, geo.R]) { const m = M().circle(X(ax), Z(T.r), T.r / mm); m.sub(M().circle(X(ax), Z(T.r), T.r * 0.62 / mm)); paintMask(P, px, m, 'rubber', 1, 3); paintMask(P, px, M().circle(X(ax), Z(T.r), 60 / mm + 0.6), 'iron', 2); }
  if (pl.type === 'platform') paintMask(P, px, M().poly([[X(geo.cowlX - 60), Z(geo.r + 40)], [X(geo.R - 330), Z(geo.r + 40)], [X(geo.R - 330), Z(geo.r + 75)], [X(geo.cowlX - 60), Z(geo.r + 75)]]), 'bare', 1);   // pan edge flange
  const ln = frameLine(pl, geo), dep = pl.type === 'unibody' ? 120 : pl.railH, m = M(), rr = Math.max(0.7, dep / mm / 2);
  for (let i = 0; i + 1 < ln.length; i++) line(X(ln[i][0]), Z(ln[i][1]), X(ln[i + 1][0]), Z(ln[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr));
  paintMask(P, px, m, 'bare', 2); if (pl.type !== 'unibody') for (const x of crossAt(pl, geo)) { const xx = Math.round(X(x)); for (let y = 0; y < px.h; y++) if (px.ramp(xx, y) === P.id('bare')) px.set(xx, y, P.id('bare'), 0, 41); }
  outline(px); return px;
}
// ---- unit-body shell in side view (1934 FWD shell photos): bolt-on wings and bonnet removed, scuttle panel sloping down to two box
// horns that carry the engine, doors off so the apertures show the far-side door frames and seat pan, window openings open, spot welds.
// `px` is the side view built from the body with fenders / boards / trim stripped and painted bare steel.
export function unitShell(P, px, spec) {
  const g = spec.geo, mm = px.mm, steel = P.id('bare'), X = px.X, Y = px.Y, xmm = x => (x - X(0)) * mm, zmm = y => (Y(0) - y) * mm;
  const r = g.r, sill = r + 120, belt = g.beltZ || g.hoodZ, cut = g.cowlX - 40;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const i = y * px.w + x; if (!px.r[i] || px.t[i] === 1 || px.t[i] === 3) continue;
    if (xmm(x) < cut) { px.r[i] = 0; continue; }                                                               // bonnet, wings, grille are bolt-on
    if (px.t[i] === 8) px.r[i] = 0; else if (px.t[i] === 2) { px.r[i] = steel; px.l[i] = (x + y) % 5 ? 1 : 0; } }   // wheel houses are part of the shell                                                                          // window openings: see through
  const M = () => new Mask(px.w, px.h), poly = pts => M().poly(pts.map(([x, z]) => [X(x), Y(z)]));
  const put = (m, lv) => { const bb = m.bbox(); if (bb.x1 < 0) return; for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) if (m.get(x, y)) { const top = !m.get(x, y - 1); px.set(x, y, steel, top ? Math.min(4, lv + 1) : lv, 4); } };
  put(poly([[cut + 10, belt], [cut - 80, belt - 30], [cut - 330, sill + 230], [cut - 330, sill - 40], [cut + 10, sill - 40]]), 2);   // scuttle / bulkhead panel
  const hz = sill + 40, nose = g.noseX + 160, horn = poly([[cut - 300, hz + 150], [nose, r + 230], [nose, r + 90], [cut - 300, hz - 30]]); put(horn, 3);   // box horn
  put(poly([[nose - 10, r + 260], [nose + 40, r + 260], [nose + 40, r + 40], [nose - 10, r + 40]]), 1);                                  // horn end bracket
  // door apertures between consecutive shut lines: dark cabin, far-side door frame inset, a brace in the far door
  const lines = (spec.doors || []).map(d => { const xs = d.map(p => p[0]), zs = d.map(p => p[1]); return { x: xs.reduce((a, b) => a + b, 0) / xs.length, top: Math.max(...zs), bot: Math.min(...zs) }; }).sort((a, b) => a.x - b.x);
  for (let k = 0; k + 1 < lines.length; k++) { const a = lines[k], b = lines[k + 1]; if (b.x - a.x > 1400 || b.x - a.x < 400) continue;
    const x0 = a.x + 45, x1 = b.x - 45, z0 = Math.max(Math.min(a.bot, b.bot) + 60, sill), z1 = belt;
    const ap = poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]); const bb = ap.bbox();
    for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { if (!ap.get(x, y) || !px.r[y * px.w + x]) continue; const edge = x - bb.x0 < 2 || bb.x1 - x < 2 || bb.y1 - y < 2;
      px.set(x, y, steel, edge ? 2 : (x + y) % 9 === 0 ? 1 : 0, 4); }
    for (let t = 0; t <= 1; t += 0.02) { const xx = Math.round(X(x0 + (x1 - x0) * (0.15 + 0.7 * t))), yy = Math.round(Y(z0 + (z1 - z0) * (0.2 + 0.6 * t))); if (px.r[yy * px.w + xx]) px.set(xx, yy, steel, 1, 4); }   // far door brace
    for (let x = bb.x0; x <= bb.x1; x++) { const yy = Math.round(Y(z0 + 140)); if (px.r[yy * px.w + x]) px.set(x, yy, steel, 2, 4); } }                      // seat pan edge
  for (let x = Math.round(X(cut)); x < px.w; x += Math.max(2, Math.round(120 / mm))) { const yy = Math.round(Y(sill)); if (px.r[yy * px.w + x] && px.t[yy * px.w + x] !== 3) px.set(x, yy, steel, 0, 4); }   // sill spot welds
  return px;
}
