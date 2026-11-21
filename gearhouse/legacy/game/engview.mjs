// Engine drawings, written from scratch (no earlier engine sprites are used): a running longitudinal section, a running
// cross-section and an exterior, all laid out from the design itself (cylinders, bore pitch, stroke, valve gear, chamber,
// crank, carburettors, exhaust, cooling). Reference: reference batch 8 (longitudinal section, labelled cross-section, 4-stroke chart).
import { hex } from '../tools/pixel/color.mjs';
import { LAYOUTS } from '../sim/engine.mjs';

const K = { iron: hex('#5d6066'), ironL: hex('#7d8188'), ironD: hex('#3c3e44'), alu: hex('#b9bec4'), aluD: hex('#8d9299'), steel: hex('#9aa0a6'), steelL: hex('#d2d6da'), brass: hex('#c9a24a'), oil: hex('#b88a2c'), water: hex('#4f86b8'),
  dark: hex('#1c1b1f'), red: hex('#c8402a'), amber: hex('#d99a3a'), blue: hex('#5b8fd0'), grey: hex('#77706a'), rubber: hex('#26242a'), rust: hex('#7a4a36'), copper: hex('#b06a3a'), white: hex('#f3ead2'), spark: hex('#fff6b0') };
const ORDER = { I3: [0, 2, 1], I4: [0, 2, 3, 1], F4: [0, 2, 3, 1], I6: [0, 4, 2, 5, 1, 3], V12: [0, 4, 2, 5, 1, 3], I8: [0, 5, 2, 4, 7, 1, 6, 3], V16: [0, 5, 2, 4, 7, 1, 6, 3], V8: [0, 2, 3, 1], V6: [0, 2, 1] };
// cycle angle (0..720) of cylinder i: 0-180 power, 180-360 exhaust, 360-540 intake, 540-720 compression
export const cycleOf = (layout, i, th) => { const o = ORDER[layout] || ORDER.I4, n = o.length, k = o.indexOf(i % n); return (((th - k * 720 / n) % 720) + 720) % 720; };
const strokeCol = c => (c < 180 ? (c < 40 ? K.spark : K.red) : c < 360 ? K.grey : c < 540 ? K.blue : K.amber);
const lift = (c, a, b) => (c > a && c < b ? Math.sin((c - a) / (b - a) * Math.PI) : 0);
function poly(S, pts, col) { let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) { const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) S.fill(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1, col); } }
const disc = (S, cx, cy, r, col) => { for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y)); S.fill(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1, col); } };
const lineP = (S, x0, y0, x1, y1, col, w = 1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) S.fill(Math.round(x0 + (x1 - x0) * i / n - (w - 1) / 2), Math.round(y0 + (y1 - y0) * i / n - (w - 1) / 2), w, w, col); };
// geometry shared by the section and the exterior (mm)
function geo(e) { const L = LAYOUTS[e.layout], n = L.cyl / L.banks, pitch = Math.max(e.bore, e.maxBore || 0) + 22, r = e.stroke / 2, rod = e.stroke * 1.7, sd = 70 + 50 * (e.oil ?? 1), zc = sd + r + 34, pH = e.bore * 0.72;
  const zd = zc + r + rod + pH * 0.55 + 6, sv = e.head === 'sv', ohc = e.head === 'sohc' || e.head === 'dohc', headH = sv ? 58 : 96, cover = sv ? 0 : ohc ? 86 : 62, x0 = 170, len = x0 + n * pitch + 200;
  return { L, n, pitch, r, rod, sd, zc, zd, pH, sv, ohc, headH, cover, x0, len, H: zd + headH + cover + 70 }; }
function frame(g, x, y, w, h) { const k = Math.min(w / g.len, h / g.H), ox = x + (w - g.len * k) / 2, by = y + h - (h - g.H * k) / 2; return { k, X: m => ox + m * k, Y: m => by - m * k, R: (a, b, c, d) => [Math.round(ox + a * k), Math.round(by - d * k), Math.max(1, Math.round((c - a) * k)), Math.max(1, Math.round((d - b) * k))] }; }

// ---------- longitudinal section, running ----------
export function drawLong(S, x, y, w, h, e, th) {
  const g = geo(e), f = frame(g, x, y, w, h), { k, X, Y } = f, R = (a, b, c, d, col) => S.fill(...f.R(a, b, c, d), col), fired = [];
  const bx0 = g.x0 - 14, bx1 = g.x0 + g.n * g.pitch + 14, mainsAll = e.mains === 'full';
  R(bx0 + 30, 0, bx1 - 30, g.sd, K.ironD); R(bx0 + 36, 6, bx1 - 36, 6 + 34 * (e.oil ?? 1), K.oil); R((bx0 + bx1) / 2 - 6, 12, (bx0 + bx1) / 2 + 6, g.zc - g.r - 20, K.steel); R((bx0 + bx1) / 2 - 40, 8, (bx0 + bx1) / 2 + 40, 16, K.steel);   // sump, oil, pick-up
  R(bx0, g.sd, bx1, g.zd, K.iron); R(bx0 + 8, g.sd + 8, bx1 - 8, g.zc + g.r + 26, K.dark);                                                                               // block, crankcase space
  R(bx0, g.zd, bx1, g.zd + g.headH, e.material === 'alHead' ? K.aluD : K.ironL); if (g.cover) R(bx0 + 10, g.zd + g.headH, bx1 - 10, g.zd + g.headH + g.cover, K.ironD);       // head, valve cover
  const camZ = g.ohc ? g.zd + g.headH + g.cover * 0.45 : g.zc + g.r + 46;
  for (let i = 0; i < g.n; i++) { const cx = g.x0 + g.pitch * (i + 0.5), c = cycleOf(e.layout, i, th), ph = c * Math.PI / 180, pinZ = g.zc + g.r * Math.cos(ph), pz = pinZ + Math.sqrt(g.rod * g.rod - (g.r * Math.sin(ph)) ** 2), top = pz + g.pH * 0.55, hb = e.bore / 2;
    R(cx - hb - 9, g.zc + g.r + 26, cx - hb, g.zd, K.water); R(cx + hb, g.zc + g.r + 26, cx + hb + 9, g.zd, K.water);                                                    // water jacket
    R(cx - hb, g.zc + g.r + 26, cx + hb, g.zd + (g.sv ? 0 : 14), K.dark); R(cx - hb, top, cx + hb, g.zd + (g.sv ? 0 : 14), strokeCol(c)); if (c < 30) fired.push(cx);                // bore; gas above the piston by stroke
    R(cx - hb + 1, top - g.pH, cx + hb - 1, top, e.pistons === 'alu' ? K.alu : K.steel); for (let q = 0; q < 3; q++) R(cx - hb + 1, top - 8 - q * 9, cx + hb - 1, top - 5 - q * 9, K.ironD); R(cx - 8, pz - 8, cx + 8, pz + 8, K.ironD);   // piston, rings, gudgeon pin
    R(cx - 7, pinZ, cx + 7, pz, e.rods === 'forged' ? K.steelL : K.steel); R(cx - 13, pinZ - 13, cx + 13, pinZ + 13, K.steelL);                                         // rod, big end
    const wb = e.bore * 0.3; for (const s of [-1, 1]) { R(cx + s * wb - 7, Math.min(g.zc, pinZ) - 6, cx + s * wb + 7, Math.max(g.zc, pinZ) + 6, K.ironL);                     // crank webs
      if (e.cwt === 'yes') R(cx + s * wb - 9, g.zc - (pinZ > g.zc ? g.r * 0.9 : -4), cx + s * wb + 9, g.zc + (pinZ > g.zc ? -4 : g.r * 0.9), K.ironL); }                                       // counterweights opposite the pin
    R(cx - wb, pinZ - 9, cx + wb, pinZ + 9, K.steelL);
    // valves: intake left, exhaust right; lifted by the cam in their strokes
    const li = lift(c, 350, 560), le = lift(c, 150, 370), vz = g.sv ? g.zd : g.zd + 14;
    [[-1, li, K.blue], [1, le, K.grey]].forEach(([s, l]) => { const vx = cx + s * e.bore * 0.24, d = l * 9; if (g.sv) { R(vx - 9, vz + d, vx + 9, vz + d + 5, K.steelL); R(vx - 2, camZ + 16, vx + 2, vz + d, K.steel); for (let q = 0; q < 3; q++) R(vx - 6, camZ + 30 + q * 10, vx + 6, camZ + 33 + q * 10, K.copper); }
      else { R(vx - 9, vz - d - 5, vx + 9, vz - d, K.steelL); R(vx - 2, vz - d, vx + 2, g.zd + g.headH + 12, K.steel); for (let q = 0; q < 3; q++) R(vx - 6, g.zd + g.headH - 26 + q * 9, vx + 6, g.zd + g.headH - 23 + q * 9, K.copper);
        if (!g.ohc) { R(vx - 12, g.zd + g.headH + 10 + d * 0.5, vx + 12, g.zd + g.headH + 16 + d * 0.5, K.steelL); R(vx + s * 10 - 1, camZ + 14, vx + s * 10 + 1, g.zd + g.headH + 12, K.steel); } }   // rocker, push-rod
      const la = (c + (s < 0 ? 0 : 200)) * Math.PI / 360; disc(S, X(vx), Y(camZ + Math.cos(la) * 3), Math.max(1, Math.round(9 * k)), K.steelL); }); }
  R(bx0 - 40, camZ - 5, bx1 + 6, camZ + 5, K.steel);                                                                                                                        // camshaft
  for (let j = 0; j <= g.n; j++) { const mx = g.x0 + g.pitch * j, has = mainsAll || j === 0 || j === g.n || (g.n > 4 && j === Math.round(g.n / 2)); R(mx - 10, g.zc - 11, mx + 10, g.zc + 11, K.steelL); if (has) { R(mx - 14, g.zc - 17, mx + 14, g.zc - 11, K.brass); R(mx - 14, g.zc + 11, mx + 14, g.zc + 17, K.brass); R(mx - 16, g.sd + 8, mx + 16, g.zc - 17, K.iron); } }   // main journals, bearings, webs of the block
  // front: timing drive, pulley, fan; rear: flywheel and ring gear
  const fx = bx0 - 26; if (g.ohc) { for (let q = 0; q < 30; q++) { const t = ((q + th / 24) % 30) / 30; S.fill(Math.round(X(fx + (t < 0.5 ? -8 : 8))), Math.round(Y(g.zc + (camZ - g.zc) * (t < 0.5 ? t * 2 : 2 - t * 2))), 1, 1, K.steelL); } }
  disc(S, X(fx), Y(g.zc), Math.round(24 * k), K.steel); disc(S, X(fx), Y(camZ), Math.round((g.ohc ? 24 : 46) * k), K.steel); if (!g.ohc) for (let q = 0; q < 12; q++) { const a = q / 12 * 6.283 - th * Math.PI / 360; S.fill(Math.round(X(fx) + Math.cos(a) * 44 * k), Math.round(Y(camZ) + Math.sin(a) * 44 * k), 1, 1, K.dark); }
  disc(S, X(bx0 - 70), Y(g.zc), Math.round(46 * k), K.ironL); disc(S, X(bx0 - 70), Y(g.zc), Math.round(14 * k), K.steelL);
  if (e.cooling !== 'thermo') { R(bx0 - 122, g.zc + 30, bx0 - 112, g.zc + 330, K.rubber); R(bx0 - 122, g.zc + 150, bx0 - 60, g.zc + 190, K.ironL); lineP(S, X(bx0 - 70), Y(g.zc + 46), X(bx0 - 90), Y(g.zc + 170), K.rubber); }
  if (e.balancer === 'damper') disc(S, X(bx0 - 46), Y(g.zc), Math.round(34 * k), K.rubber);
  R(bx1 + 26, g.zc - 175, bx1 + 62, g.zc + 175, K.ironL); for (let z = -170; z < 175; z += 12) R(bx1 + 62, g.zc + z + ((th / 6) % 12), bx1 + 68, g.zc + z + 5 + ((th / 6) % 12), K.steelL); R(bx1 + 6, g.zc - 12, bx1 + 120, g.zc + 12, K.steelL);
  const dx = g.x0 + g.pitch * (g.n - 0.6), dz = g.zd + g.headH + g.cover; R(dx - 16, dz, dx + 16, dz + 46, K.dark); R(dx - 20, dz + 46, dx + 20, dz + 60, K.rust);                                   // distributor
  for (const cx of fired) lineP(S, X(dx), Y(dz + 60), X(cx), Y(g.zd + g.headH * 0.5), K.spark);
  return { g, f };
}
// ---------- cross-section through one cylinder (both banks of a V) ----------
export function drawCross(S, x, y, w, h, e, th) {
  const g = geo(e), V = g.L.banks > 1, flat = e.layout === 'F4', half = V ? (flat ? 90 : e.layout === 'V12' || e.layout === 'V6' ? 30 : 45) : 0, span = V ? (g.zd + g.headH + g.cover) * 2 * Math.sin(half * Math.PI / 180) + 420 : 520;
  const HH = V && !flat ? g.sd + (g.zd - g.sd + g.headH + g.cover) * Math.cos(half * Math.PI / 180) + 330 : g.H + 60, k = Math.min(w / span, h / HH), cx0 = x + w / 2, cy0 = y + h - (h - HH * k) / 2 - g.zc * k;
  const T = (ang, u, v) => { const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [cx0 + (u * c + v * s) * k, cy0 - (-u * s + v * c) * k]; };
  const Q = (ang, u0, v0, u1, v1, col) => poly(S, [T(ang, u0, v0), T(ang, u1, v0), T(ang, u1, v1), T(ang, u0, v1)], col);
  Q(0, -150, -g.zc, 150, -g.zc + g.sd, K.ironD); Q(0, -140, -g.zc + 6, 140, -g.zc + 6 + 34 * (e.oil ?? 1), K.oil); disc(S, cx0, cy0, Math.round((g.r + 60) * k), K.iron); disc(S, cx0, cy0, Math.round((g.r + 46) * k), K.dark);   // sump, oil, crankcase
  const banks = V ? [-half, half] : [0];
  banks.forEach((ang, bi) => { const c = cycleOf(e.layout, bi * 2, th), ph = c * Math.PI / 180, hb = e.bore / 2, v0 = g.r + 40, vd = g.zd - g.zc;
    const pin = [g.r * Math.sin(ph), g.r * Math.cos(ph)], a = ang * Math.PI / 180, pu = pin[0] * Math.cos(a) - pin[1] * Math.sin(a) * 0 , along = pin[1] * Math.cos(-a) + pin[0] * Math.sin(-a), across = pin[0] * Math.cos(-a) - pin[1] * Math.sin(-a);
    const pz = along + Math.sqrt(Math.max(1, g.rod * g.rod - across * across)), top = pz + g.pH * 0.55;
    Q(ang, -hb - 26, v0, hb + 26, vd, K.iron); Q(ang, -hb - 14, v0 + 30, -hb, vd - 6, K.water); Q(ang, hb, v0 + 30, hb + 14, vd - 6, K.water); Q(ang, -hb, v0 - 10, hb, vd, K.dark);     // cylinder, jacket, bore
    const sv = g.sv, hx0 = sv ? -hb - 26 : -hb - 30, hx1 = sv ? hb + 26 + e.bore * 0.75 : hb + 30; if (sv) Q(ang, hb + 26, v0 + (vd - v0) * 0.45, hb + 26 + e.bore * 0.75, vd, K.iron);            // side-valve block extension
    Q(ang, hx0, vd, hx1, vd + g.headH, e.material === 'alHead' ? K.aluD : K.ironL);
    const cc = strokeCol(c), ch = e.chamber; if (sv) Q(ang, -hb, vd, hb + e.bore * 0.7, vd + (ch === 'ricardo' ? 16 : 24), cc); else if (ch === 'hemi') poly(S, [T(ang, -hb, vd), T(ang, hb, vd), T(ang, hb * 0.5, vd + 40), T(ang, -hb * 0.5, vd + 40)], cc); else poly(S, [T(ang, -hb, vd), T(ang, hb, vd), T(ang, hb, vd + 12), T(ang, -hb * 0.4, vd + 32), T(ang, -hb, vd + 22)], cc);   // chamber: L-head pocket, hemisphere or wedge
    Q(ang, -hb, top, hb, vd, cc); Q(ang, -hb + 1, top - g.pH, hb - 1, top, e.pistons === 'alu' ? K.alu : K.steel); for (let q = 0; q < 3; q++) Q(ang, -hb + 1, top - 8 - q * 9, hb - 1, top - 5 - q * 9, K.ironD);
    const P0 = T(ang, 0, pz), P1 = T(0, pin[0], pin[1]); lineP(S, P0[0], P0[1], P1[0], P1[1], e.rods === 'forged' ? K.steelL : K.steel, Math.max(2, Math.round(14 * k)));
    const li = lift(c, 350, 560), le = lift(c, 150, 370);
    if (sv) { const vx = hb + 26 + e.bore * 0.32, d = Math.max(li, le) * 9; Q(ang, vx - 16, vd + d, vx + 16, vd + d + 5, K.steelL); Q(ang, vx - 2, v0 + (vd - v0) * 0.5, vx + 2, vd + d, K.steel); const C = T(ang, vx, v0 + (vd - v0) * 0.42); disc(S, C[0], C[1], Math.max(2, Math.round(13 * k)), K.steelL); }
    else { [[-1, li], [1, le]].forEach(([s, l]) => { const vx = s * hb * 0.5, d = l * 9; Q(ang, vx - 13, vd + 8 - d, vx + 13, vd + 13 - d, K.steelL); Q(ang, vx - 2, vd + 13 - d, vx + 2, vd + g.headH + 14, K.steel); });
      Q(ang, -hb - 10, vd + g.headH, hb + 10, vd + g.headH + g.cover, K.ironD); if (g.ohc) { const C = T(ang, 0, vd + g.headH + g.cover * 0.5); disc(S, C[0], C[1], Math.max(2, Math.round(15 * k)), K.steelL); if (e.head === 'dohc') { const C2 = T(ang, hb * 0.6, vd + g.headH + g.cover * 0.5); disc(S, C2[0], C2[1], Math.max(2, Math.round(13 * k)), K.steelL); } }
      else { Q(ang, hb + 14, v0 + 20, hb + 18, vd + g.headH + 18, K.steel); Q(ang, -hb * 0.6, vd + g.headH + 14, hb + 22, vd + g.headH + 20, K.steelL); const C = T(ang, hb + 16, v0 + 6); disc(S, C[0], C[1], Math.max(2, Math.round(13 * k)), K.steelL); } }   // push-rod, rocker, cam in the block
    // induction on the inner / left side, exhaust on the outer / right side
    const ix = V ? (bi ? -1 : 1) : -1, mz = vd + (sv ? -30 : 30), I0 = T(ang, ix * (hb + 30), mz), I1 = T(ang, ix * (hb + 120), mz + (V ? 60 : 0)); lineP(S, I0[0], I0[1], I1[0], I1[1], K.aluD, Math.max(3, Math.round(30 * k)));
    const E0 = T(ang, -ix * (hb + (sv ? 26 + e.bore * 0.75 : 30)), mz), E1 = T(ang, -ix * (hb + (sv ? 26 + e.bore * 0.75 : 30) + 70), mz - 60); lineP(S, E0[0], E0[1], E1[0], E1[1], K.rust, Math.max(3, Math.round(34 * k * (e.exhDia ?? 1))));
    if (!V || bi === 0) { const ct = e.carbType || (sv ? 'std' : 'down'), C = V ? [cx0, cy0 - (vd + g.headH + 90) * k * Math.cos(half * Math.PI / 180)] : I1, dy = ct === 'std' ? 1 : ct === 'down' ? -1 : 0;
      S.fill(Math.round(C[0] - 11 * k * 2), Math.round(C[1] + (dy < 0 ? -70 * k : dy > 0 ? 6 * k : -22 * k)), Math.max(3, Math.round(44 * k)), Math.max(3, Math.round(64 * k)), K.brass);
      if (ct === 'down') S.fill(Math.round(C[0] - 60 * k), Math.round(C[1] - 110 * k), Math.max(4, Math.round(120 * k)), Math.max(2, Math.round(40 * k)), K.dark); } });
  const ph0 = cycleOf(e.layout, 0, th) * Math.PI / 180; disc(S, cx0 + g.r * Math.sin(ph0) * k, cy0 - g.r * Math.cos(ph0) * k, Math.max(2, Math.round(18 * k)), K.steelL); disc(S, cx0, cy0, Math.max(2, Math.round(24 * k)), K.brass); disc(S, cx0, cy0, Math.max(1, Math.round(15 * k)), K.steelL);
  if (e.cwt === 'yes') { disc(S, cx0 - g.r * 0.7 * Math.sin(ph0) * k, cy0 + g.r * 0.7 * Math.cos(ph0) * k, Math.max(3, Math.round(g.r * 0.7 * k)), K.ironL); }
}
// ---------- exterior ----------
export function drawOutside(S, x, y, w, h, e, th = 0, colour = null) {
  const g = geo(e), f = frame(g, x, y, w, h), { k, X, Y } = f, R = (a, b, c, d, col) => S.fill(...f.R(a, b, c, d), col), V = g.L.banks > 1;
  const paint = colour || (g.sv && !V ? hex('#3f5a40') : V ? hex('#5a5f66') : hex('#7a2a24')), pL = paint.map(v => Math.min(255, v + 34)), pD = paint.map(v => Math.max(0, v - 30)), bx0 = g.x0 - 14, bx1 = g.x0 + g.n * g.pitch + 14, zt = g.zd + g.headH + g.cover;
  R(bx1, g.zc - 190, bx1 + 90, g.zd - 40, K.aluD); R(bx1, g.zc - 190, bx1 + 90, g.zc - 176, K.alu);                                                                               // bell housing
  R(bx0 + 30, 0, bx1 - 30, g.sd, K.dark); R(bx0 + 30, g.sd - 8, bx1 - 30, g.sd, K.ironD); for (let q = bx0 + 44; q < bx1 - 40; q += 40) S.fill(Math.round(X(q)), Math.round(Y(g.sd - 3)), 1, 1, K.steelL);   // sump with flange bolts
  R(bx0, g.sd, bx1, g.zd, paint); R(bx0, g.zd - 6, bx1, g.zd, pL); R(bx0, g.sd, bx1, g.sd + 10, pD); for (let i = 0; i < g.n; i++) { const cx = g.x0 + g.pitch * (i + 0.5); disc(S, X(cx), Y(g.zc + g.r + 70), Math.max(1, Math.round(17 * k)), pD); S.fill(Math.round(X(cx - g.pitch / 2)), Math.round(Y(g.zd - 10)), 1, Math.round((g.zd - g.zc - g.r - 40) * k), pD); }   // block: core plugs, casting ribs
  R(bx0, g.zd, bx1, g.zd + g.headH, g.sv ? pL : e.material === 'alHead' ? K.alu : paint); for (let q = bx0 + 20; q < bx1 - 10; q += g.pitch / 2) S.fill(Math.round(X(q)), Math.round(Y(g.zd + g.headH * 0.6)), Math.max(1, Math.round(k * 9)), Math.max(1, Math.round(k * 9)), K.dark);   // head and its studs
  if (g.cover) { R(bx0 + 12, g.zd + g.headH, bx1 - 12, zt, g.ohc ? K.alu : K.dark); R(bx0 + 12, zt - 6, bx1 - 12, zt, g.ohc ? K.steelL : K.ironL); R(bx0 + 90, zt, bx0 + 126, zt + 30, K.steelL); }
  for (let i = 0; i < g.n; i++) { const cx = g.x0 + g.pitch * (i + 0.5), pz = g.sv ? g.zd + g.headH : g.zd + g.headH * 0.5; R(cx - 7, pz, cx + 7, pz + 34, K.white); R(cx - 4, pz + 34, cx + 4, pz + 44, K.steelL); }   // spark plugs
  const ez = g.sv ? g.zd - 150 : g.zd + 6, mz = g.sv ? g.zd - 60 : g.zd + 60, mx0 = g.x0 + g.pitch * 0.4, mx1 = bx1 - g.pitch * 0.4 - 14;
  R(g.x0 + 10, ez - 28 * (e.exhDia ?? 1), bx1 - 24, ez + 28 * (e.exhDia ?? 1), K.rust); for (let i = 0; i < g.n; i++) R(g.x0 + g.pitch * (i + 0.5) - 16, ez + 20, g.x0 + g.pitch * (i + 0.5) + 16, ez + 46, K.rust);
  const outs = e.exhManifold === 'split' || e.exhaust === 'dual' ? [0.3, 0.72] : [0.6]; for (const o of outs) { const ox = g.x0 + g.n * g.pitch * o; poly(S, [[X(ox - 24), Y(ez)], [X(ox + 24), Y(ez)], [X(ox + 60), Y(g.sd - 20)], [X(ox + 16), Y(g.sd - 20)]], K.rust); }
  R(mx0, mz, mx1, mz + 40, K.aluD); R(mx0, mz + 34, mx1, mz + 40, K.alu); const nC = e.carbs || 1, ct = e.carbType || (g.sv ? 'std' : 'down');
  for (let q = 0; q < nC; q++) { const cx = mx0 + (mx1 - mx0) * (q + 0.5) / nC; if (ct === 'down') { R(cx - 30, mz + 40, cx + 30, mz + 110, K.brass); R(cx - 84, mz + 110, cx + 84, mz + 170, K.dark); R(cx - 84, mz + 160, cx + 84, mz + 170, K.ironL); }
    else if (ct === 'side') { R(cx - 28, mz - 4, cx + 28, mz + 60, K.brass); poly(S, [[X(cx - 20), Y(mz + 60)], [X(cx + 20), Y(mz + 60)], [X(cx + 38), Y(mz + 112)], [X(cx - 38), Y(mz + 112)]], K.steelL); }
    else { R(cx - 28, mz - 76, cx + 28, mz, K.brass); poly(S, [[X(cx - 22), Y(mz - 76)], [X(cx + 22), Y(mz - 76)], [X(cx + 36), Y(mz - 136)], [X(cx - 36), Y(mz - 136)]], K.dark); } }
  // accessories: generator on its belt, fan / pump or thermosyphon hose, distributor with its leads, oil filter, starter, fuel pump
  const gz = g.zd - 30; R(bx0 - 50, gz, bx0 + 130, gz + 92, K.dark); R(bx0 - 50, gz + 80, bx0 + 130, gz + 92, K.ironL); disc(S, X(bx0 - 62), Y(gz + 46), Math.max(2, Math.round(40 * k)), K.ironL);
  disc(S, X(bx0 - 62), Y(g.zc), Math.max(2, Math.round(52 * k)), K.ironL); lineP(S, X(bx0 - 62 - 40), Y(gz + 46), X(bx0 - 62 - 50), Y(g.zc), K.rubber); lineP(S, X(bx0 - 62 + 40), Y(gz + 46), X(bx0 - 62 + 50), Y(g.zc), K.rubber);
  if (e.cooling === 'thermo') poly(S, [[X(bx0 - 10), Y(zt - 20)], [X(bx0 + 40), Y(zt - 20)], [X(bx0 - 80), Y(zt + 120)], [X(bx0 - 130), Y(zt + 110)]], K.rubber);
  else { R(bx0 - 104, g.zd - 80, bx0 - 6, g.zd + 20, pL); const fa = th * Math.PI / 180, fl = 250 * Math.abs(Math.cos(fa)) + 40; R(bx0 - 150, g.zd - 30 - fl, bx0 - 134, g.zd - 30 + fl, K.rubber); disc(S, X(bx0 - 142), Y(g.zd - 30), Math.max(2, Math.round(26 * k)), K.steelL); }
  const dx = V ? bx1 - 70 : g.x0 + g.n * g.pitch * 0.62, dz = V ? zt + 40 : g.zd - 40; R(dx - 22, dz - 70, dx + 22, dz + 16, K.dark); R(dx - 34, dz + 16, dx + 34, dz + 56, K.rust);
  for (let i = 0; i < g.n; i++) { const cx = g.x0 + g.pitch * (i + 0.5); lineP(S, X(dx), Y(dz + 56), X(cx), Y((g.sv ? g.zd + g.headH : g.zd + g.headH * 0.5) + 44), K.dark); }
  if (e.lube !== 'splash' && (e.year || 1940) >= 1935) { const fx2 = g.x0 + g.n * g.pitch * 0.8; R(fx2 - 40, g.zc + 30, fx2 + 40, g.zc + 180, hex('#c8642a')); R(fx2 - 44, g.zc + 180, fx2 + 44, g.zc + 194, K.steelL); }
  R(bx1 - 260, g.zc - 30, bx1 - 30, g.zc + 62, K.dark); R(bx1 - 260, g.zc + 50, bx1 - 30, g.zc + 62, K.ironL); R(bx0 + 60, g.zc - 10, bx0 + 110, g.zc + 50, K.steel);
  return { g, f };
}
