// 1940s powertrain detail sprites (S2, 5 mm/px), generic and debadged, built from the user's engine-room / exploded / cutaway refs.
//  flatheadV8 : 90-deg L-head V8, left side - stud-covered heads, twin water pumps low at the front, fan, generator + oil filter
//               on top front, distributor at the nose, centre carburettor under an oil-bath air cleaner, tall breather at the rear.
//  ohvI6      : long-block pushrod six (truck / passenger), left side - rocker cover, two pushrod side plates, distributor + coil,
//               oil-filter canister, fuel pump, horizontal oil-bath cleaner, bolted to a gearbox with a tall floor lever.
//  fluidAuto  : fluid-coupling 4-speed automatic, cut-away - torus, front / rear / reverse planetary units, clutch packs, pump.
//  gearbox / transfer : plain housings for manual 3/4/5-speed and 2-speed transfer cases.
import { Pix, Mask, line } from '../pix.mjs';
import { outlineAll } from './props.mjs';
import { dith } from './car.mjs';
import { fillet } from './geom.mjs';

function kit(P, Wmm, Hmm, ox, oz, mm = 5) {
  const w = Math.ceil(Wmm / mm) + 4, h = Math.ceil(Hmm / mm) + 4, px = new Pix(w, h);
  const X = x => (x + ox) / mm + 2, Y = z => h - 2 - (z + oz) / mm, M = () => new Mask(w, h);
  const poly = (pts, rr = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? rr]), 3).map(([x, z]) => [X(x), Y(z)]));
  const rect = (x0, z0, x1, z1, r = 0) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], r);
  const ell = (x, z, rx, rz) => M().ellipse(X(x), Y(z), Math.max(0.8, rx / mm), Math.max(0.8, rz / mm));
  let tag = 20;
  const solid = (m, ramp, { base = 2, grad = null, speck = 0, axis = 'y' } = {}) => { const t = tag++, r = P.id(ramp), bb = m.bbox();
    for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { if (!m.get(x, y)) continue; let lv = base;
      if (grad) { const u = axis === 'y' ? (y - bb.y0) / Math.max(1, bb.y1 - bb.y0) : (x - bb.x0) / Math.max(1, bb.x1 - bb.x0); lv = dith(x, y, grad[0] + (grad[1] - grad[0]) * u); }
      if (!m.get(x, y - 1)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1)) lv = Math.max(0, lv - 1);
      if (speck && ((x * 73 + y * 151) % speck === 0)) lv = Math.max(0, lv - 1);
      px.set(x, y, r, lv, t); } return m; };
  const band = (pts, th, ramp, base = 2) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return solid(m, ramp, { base }); };
  const dot = (x, z, ramp, lv) => px.set(Math.round(X(x)), Math.round(Y(z)), P.id(ramp), lv, tag);
  const done = (anchor) => { outlineAll(px); px.ax = X(anchor[0]); px.ay = Y(anchor[1]); return px; };
  return { px, X, Y, M, poly, rect, ell, solid, band, dot, done };
}

// ---- flathead V8 (221/239 ci passenger, 337 ci truck/luxury: bigger bore & stroke -> longer, taller) ----
export function flatheadV8(P, { bore = 81, stroke = 95, color = 'iron', head = 'alu', perBank = 4 } = {}, mm = 5) {   // perBank 6 = L-head V12
  const pitch = bore + (perBank > 4 ? 38 : 50), L = perBank * pitch + 60, k = stroke / 95, nS = perBank * 2;            // bank length (4 cyl per bank, staggered)
  const K = kit(P, L + 420, 1000 * k + 200, 210, 290 * k, mm), { solid, band, poly, rect, ell, dot } = K;
  const deck = 200 * k, hd = 150;
  band([[-150, 380 * k], [-120, 150 * k], [-60, 60]], 16, 'rubber', 1);                                          // fan belt
  solid(poly([[-180, 260 * k], [-150, 520 * k], [-120, 260 * k], [-150, 0]], 20), 'black', { base: 1 });         // fan blade (edge)
  solid(poly([[-20, -40], [L, -40], [L - 20, -260 * k], [L * 0.55, -280 * k], [L * 0.35, -200 * k], [30, -190 * k]], 40), color, { base: 1, grad: [2, 0.8] });   // deep oil pan + rear sump
  solid(poly([[0, -40], [L, -40], [L, deck], [0, deck]]), color, { grad: [2.6, 1.2], speck: 37 });               // block (bank side)
  solid(poly([[L, -180 * k], [L + 70, -150 * k], [L + 70, deck - 20], [L, deck]], 30), color, { base: 1, grad: [2.2, 0.8] });   // bell housing
  solid(poly([[-70, 40], [10, 40], [10, deck * 0.8], [-50, deck * 0.8]], 30), color, { base: 2, grad: [2.6, 1.2] });  // water pump (one per bank, low front)
  band([[-40, deck * 0.8], [-60, deck + 150], [-20, deck + hd + 120]], 50, 'rubber', 2);                         // lower -> upper hose
  // head: raked slab with three staggered rows of stud nuts (the defining look)
  solid(poly([[-10, deck], [L + 5, deck], [L - 10, deck + hd], [10, deck + hd + 10]]), head, { grad: [3.2, 1.6] });
  for (let r = 0; r < 3; r++) for (let i = 0; i < nS; i++) { const x = 34 + i * (L - 80) / (nS - 1) + (r % 2) * (L / 30), z = deck + 30 + r * 40;   // 24 stud nuts: lit top-left, shadow bottom-right
    solid(rect(x - 6, z - 6, x + 6, z + 6), head, { base: 4 }); dot(x + 5, z - 6, 'black', 1); dot(x + 5, z - 1, 'black', 1); }
  for (let i = 0; i <= nS; i++) band([[20 + i * (L - 40) / nS, deck + 8], [24 + i * (L - 40) / nS, deck + hd - 12]], 5, head, 1);   // cooling ribs between studs
  solid(rect(-20, deck + hd - 20, 40, deck + hd + 40, 10), head, { base: 3 });                                   // water outlet
  for (let c = 0; c < perBank; c++) { const x = 60 + c * pitch; solid(rect(x - 8, deck + hd + 5, x + 8, deck + hd + 40), 'white', { grad: [4, 2.4] }); band([[x, deck + hd + 40], [x + 40, deck + hd + 110], [-10, deck + hd + 150]], 7, 'black', 1); }   // plugs + leads
  // exhaust manifold along the lower block, rear outlet down
  band([[40, deck * 0.25], [L - 60, deck * 0.25], [L - 10, -60], [L - 10, -240 * k]], 40, 'rust', 2); for (let c = 0; c < perBank; c++) solid(rect(70 + c * pitch - 18, deck * 0.25, 70 + c * pitch + 18, deck * 0.25 + 50), 'rust', { base: 2 });
  // nose: timing cover, distributor + cap, generator, oil filter canister on top front
  solid(rect(-40, deck * 0.6, 20, deck + 80), color, { base: 2 }); solid(ell(-10, deck + 130, 45, 40), 'black', { base: 2 });
  solid(rect(-30, deck + hd + 60, 170, deck + hd + 150, 40), 'black', { grad: [3.2, 0.8] }); solid(rect(110, deck + hd + 58, 126, deck + hd + 152), 'chrome', { grad: [4, 1.5] });   // generator
  solid(rect(190, deck + hd + 50, 260, deck + hd + 210, 20), 'black', { grad: [3, 1] }); band([[190, deck + hd + 120], [260, deck + hd + 120]], 14, 'chrome', 3);              // oil filter canister + clamp
  // centre: intake, downdraft carburettor, oil-bath air cleaner; fuel pump; rear breather / oil filler tube
  solid(rect(L * 0.4, deck + hd, L * 0.6, deck + hd + 70), color, { base: 3 });
  solid(rect(L * 0.44, deck + hd + 70, L * 0.56, deck + hd + 150, 10), 'alu', { grad: [3.6, 1.4] });
  solid(poly([[L * 0.3, deck + hd + 150], [L * 0.7, deck + hd + 150], [L * 0.72, deck + hd + 210], [L * 0.62, deck + hd + 250], [L * 0.38, deck + hd + 250], [L * 0.28, deck + hd + 210]], 30), 'black', { grad: [3.4, 1] });
  solid(rect(L * 0.65, deck + hd + 40, L * 0.72, deck + hd + 110, 10), 'alu', { base: 3 }); band([[L * 0.68, deck + hd + 110], [L * 0.56, deck + hd + 130]], 8, 'brass', 3);
  solid(rect(L - 60, deck + hd - 10, L - 20, deck + hd + 210, 10), color, { grad: [3, 1.6] }); solid(ell(L - 40, deck + hd + 225, 40, 22), 'black', { base: 3 });
  solid(rect(L - 30, -130, L + 140, -40, 40), 'black', { grad: [2.8, 0.8] });                                   // starter
  return K.done([0, 0]);                                                                                        // anchor = crank nose
}

// ---- OHV inline six (216/235 passenger, 228-270 truck) ----
export function ohvI6(P, { bore = 90, stroke = 100, color = 'paint.engineGrey', box = 'gear4' } = {}, mm = 5) {
  const pitch = bore + 22, L = 6 * pitch + 30, k = stroke / 100, deck = 300 * k;
  const gbL = box === 'none' ? 0 : box === 'gear4' ? 420 : 330;
  const K = kit(P, L + gbL + 360, 1200 * k + 300, 200, 270 * k, mm), { solid, band, poly, rect, ell, dot } = K;
  band([[-130, 420 * k], [-110, 120 * k], [-40, 40]], 16, 'rubber', 1); solid(poly([[-160, 280 * k], [-130, 560 * k], [-100, 280 * k], [-130, 0]], 20), 'black', { base: 1 });   // belt, fan
  solid(poly([[0, -60], [L, -60], [L - 30, -230 * k], [40, -230 * k]], 40), color, { base: 1, grad: [2, 0.8] });                        // pan
  solid(poly([[0, -60], [L, -60], [L, deck], [0, deck]]), color, { grad: [2.7, 1.2], speck: 41 });                                       // block
  for (const [a, b] of [[0.08, 0.46], [0.54, 0.92]]) { solid(rect(L * a, deck * 0.38, L * b, deck * 0.82, 20), color, { base: 3 });     // two pushrod side plates
    for (let i = 0; i < 2; i++) solid(rect(L * (a + 0.03 + i * (b - a) / 2), deck * 0.48, L * (a + (i + 1) * (b - a) / 2 - 0.02), deck * 0.72, 10), 'black', { base: 0 });
    for (let i = 0; i <= 6; i++) dot(L * a + i * L * (b - a) / 6, deck * 0.8, 'iron', 4); }
  solid(rect(-10, deck, L + 10, deck + 85), color, { grad: [3, 1.6] });                                                                  // head
  solid(poly([[10, deck + 85], [L - 10, deck + 85], [L - 30, deck + 165], [30, deck + 165]], 40), color, { grad: [3.6, 1.8] });          // rocker cover
  for (let i = 0; i < 6; i++) dot(60 + i * (L - 120) / 5, deck + 95, 'iron', 4);
  solid(rect(L, -200 * k, L + 70, deck + 20, 30), color, { base: 1, grad: [2.2, 0.8] });                                                  // bell housing
  solid(poly([[-60, deck * 0.7], [0, deck * 0.7], [0, deck + 80], [-40, deck + 60]], 20), color, { base: 2 });                          // water pump / thermostat
  band([[-30, deck + 70], [-60, deck + 120], [-30, deck + 200]], 45, 'rubber', 2);
  solid(rect(L * 0.42, deck * 0.82, L * 0.47, deck + 90), color, { base: 2 }); solid(ell(L * 0.445, deck + 110, 32, 30), 'black', { base: 2 });   // distributor
  for (let i = 0; i < 6; i++) band([[L * 0.445, deck + 120], [60 + i * pitch, deck + 140], [60 + i * pitch, deck + 90]], 6, 'black', 1);       // plug leads
  solid(rect(L * 0.53, deck * 0.86, L * 0.6, deck * 1.0, 10), 'black', { grad: [3, 1] });                                                // coil
  solid(rect(L * 0.66, -40, L * 0.76, deck * 0.34, 20), 'black', { grad: [3.2, 1] }); band([[L * 0.66, deck * 0.1], [L * 0.76, deck * 0.1]], 12, 'chrome', 3);   // oil-filter canister
  solid(rect(L * 0.2, -10, L * 0.28, deck * 0.3, 10), 'alu', { base: 2 }); band([[L * 0.24, deck * 0.3], [L * 0.35, deck + 200]], 8, 'brass', 3);   // fuel pump + line
  band([[L * 0.12, deck * 0.4], [L * 0.1, deck + 120]], 30, color, 3); solid(ell(L * 0.1, deck + 130, 26, 14), 'black', { base: 3 });          // oil filler tube
  solid(rect(L * 0.18, deck + 230, L * 0.78, deck + 330, 50), 'iron', { grad: [3.6, 1.2] }); band([[L * 0.5, deck + 230], [L * 0.5, deck + 165]], 50, 'iron', 2);   // horizontal oil-bath cleaner
  solid(rect(L - 40, -130, L + 150, -30, 40), 'black', { grad: [2.8, 0.8] });                                                           // starter
  if (gbL) { solid(poly([[L + 70, -150], [L + gbL, -110], [L + gbL, 120], [L + 70, 170]], 25), color, { grad: [2.6, 1] });             // gearbox
    solid(rect(L + gbL, -40, L + gbL + 60, 50, 15), color, { base: 2 }); band([[L + gbL * 0.45, 170], [L + gbL * 0.42, 260], [L + gbL * 0.3, 950 * k]], 22, 'black', 2); solid(ell(L + gbL * 0.3, 960 * k, 26, 26), 'black', { base: 3 }); }
  return K.done([0, 0]);
}

// ---- fluid-coupling 4-speed automatic, cut-away (torus + front / rear / reverse planetaries) ----
export function fluidAuto(P, { cut = true } = {}, mm = 5) {
  const K = kit(P, 960, 560, 20, 300, mm), { solid, band, poly, rect, ell } = K, L = 900;
  solid(poly([[0, -260], [200, -260], [230, -150], [L - 210, -170], [L - 60, -120], [L, -90], [L, 90], [L - 60, 110], [L - 210, 160], [230, 170], [200, 250], [0, 250]], 40), 'alu', { grad: [3.2, 1.2] });   // case
  solid(rect(260, -260, 640, -170, 30), 'alu', { base: 1 });                                                                                              // oil pan
  if (!cut) return K.done([0, 0]);
  solid(rect(20, -230, 190, 220, 80), 'black', { base: 1 });                                                       // coupling housing (section)
  solid(ell(105, 0, 70, 205), 'paint.enginered', { grad: [3, 1.4] }); for (let z = -180; z <= 180; z += 24) band([[60, z], [150, z * 0.92]], 8, 'iron', 3);   // torus + vanes
  for (const [x0, x1, c] of [[250, 400, 'brass'], [430, 590, 'brass'], [630, 760, 'paint.enginered']]) {          // front unit, rear unit, reverse planetary
    solid(rect(x0, -150, x1, 150, 20), 'iron', { base: 1 }); solid(rect(x0 + 15, -110, x1 - 15, 110, 15), c, { grad: [3.4, 1.4] });
    for (let z = -90; z <= 90; z += 30) band([[x0 + 25, z], [x1 - 25, z]], 6, 'iron', 4); }
  for (let x = 405; x < 430; x += 6) band([[x, -140], [x, 140]], 4, 'alu', 4);                                    // clutch plates
  band([[0, 0], [L + 40, 0]], 30, 'chrome', 3);                                                                    // main shaft
  solid(ell(450, -215, 55, 42), 'iron', { grad: [3, 1] });                                                         // pump / governor
  band([[300, -170], [360, -235], [520, -235], [580, -170]], 14, 'iron', 2);                                       // valve body feed
  return K.done([0, 0]);
}
// plain gearbox / transfer housings (vehicle-scale or S2)
export function gearbox(P, { speeds = 3, transfer = false, color = 'iron' } = {}, mm = 5) {
  const L = 220 + speeds * 50 + (transfer ? 260 : 0), K = kit(P, L + 120, 900, 20, 260, mm), { solid, band, rect, poly, ell } = K;
  solid(poly([[0, -170], [L * 0.2, -150], [L - (transfer ? 260 : 0), -120], [L - (transfer ? 260 : 0), 130], [L * 0.2, 170], [0, 190]], 25), color, { grad: [2.8, 1] });
  solid(rect(L * 0.2, 130, L - (transfer ? 290 : 30), 175, 10), color, { base: 3 });
  band([[L * 0.45, 175], [L * 0.42, 640]], 20, 'black', 2); solid(ell(L * 0.42, 650, 25, 25), 'black', { base: 3 });
  if (transfer) { solid(rect(L - 260, -240, L, 100, 30), color, { grad: [2.6, 0.9] }); for (const dx of [80, 150]) { band([[L - 260 + dx, 100], [L - 260 + dx - 30, 520]], 16, 'black', 2); solid(ell(L - 260 + dx - 30, 530, 20, 20), 'black', { base: 3 }); }
    solid(rect(L, -200, L + 60, -110, 10), color, { base: 2 }); solid(rect(L - 300, -200, L - 260, -110, 10), color, { base: 2 }); }
  return K.done([0, 0]);
}

// ramps the powertrain sprites use
export const ptPalette = P => { P.auto('paint.enginered', '#a8322a'); P.auto('paint.enginegreen', '#45574d', { sat: 0.8 }); P.auto('rust', '#8a5236', { sat: 0.8 });
  P.auto('paint.engineGrey', '#7d8288', { sat: 0.4 }); P.auto('paint.engineOrange', '#c0552a'); return P; };
