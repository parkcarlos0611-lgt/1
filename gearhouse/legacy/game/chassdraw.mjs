// chassis drawings for the driveline + chassis stage (plan 19-2), same shaded / outlined pixel method as the engine:
//   suspension: front axle seen from the front and rear axle seen from behind, a bump rolling under the left wheel
//   brakes: drum brake face-on with the drum cut away, shoes opening on each application, heat colouring after hard stops
//   tyres: bias-ply section on its rim, sidewall bulge and contact patch from the pressure
import { Draw, S_ } from './engdraw.mjs';
import { SUSP_F, SUSP_R, tyreDims } from '../sim/chassis.mjs';

const fitDraw = (P, w, h, spanW, spanH, cx = 0, z0 = 0) => { const k = Math.min((w - 4) / spanW, (h - 4) / spanH); return new Draw(P, w, h, k, w / 2 - cx * k, h - 2 - (h - 4 - spanH * k) / 2 + z0 * k); };
function band(D, cx, cz, r0, r1, a0, a1, ramp, shade, name, n = 24) { const o = [], i = []; for (let q = 0; q <= n; q++) { const a = a0 + (a1 - a0) * q / n; o.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]); i.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]); } return D.poly([...o, ...i.reverse()], ramp, shade, name); }
function coil(D, x0, z0, x1, z1, r, turns, ramp, name) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux; let px = x0, pz = z0;
  for (let q = 1; q <= turns * 2; q++) { const t = q / (turns * 2), s = q % 2 ? 1 : -1, x = x0 + dx * t + nx * r * s, z = z0 + dz * t + nz * r * s; D.bar(px, pz, x, z, 9, 9, ramp, S_.cylH(), name); px = x; pz = z; } D.bar(px, pz, x1, z1, 9, 9, ramp, S_.cylH(), name); }
// a road wheel seen from the front / rear: tyre band and rim, tilted by camber (radians)
function wheelFront(D, xc, zc, r, wmm, camber, name = 'TYRE') { const c = Math.cos(camber), s = Math.sin(camber), P2 = (u, v) => [xc + u * c + v * s, zc - u * s + v * c];
  const T = (u0, v0, u1, v1, ramp, shade, nm) => D.poly([P2(u0, v0), P2(u1, v0), P2(u1, v1), P2(u0, v1)], ramp, shade, nm);
  const q = wmm * 0.28, out = xc < 0 ? -1 : 1; D.poly([P2(-wmm / 2, -r + q), P2(-wmm / 2 + q, -r), P2(wmm / 2 - q, -r), P2(wmm / 2, -r + q), P2(wmm / 2, r - q), P2(wmm / 2 - q, r), P2(-wmm / 2 + q, r), P2(-wmm / 2, r - q)], 'rubber', (x, y, u, v) => Math.max(0, Math.min(3, Math.round(u < 0.2 ? 1 + u * 5 : 3 - (u - 0.2) * 3) - ((y % 4 === 0) ? 1 : 0))), name);
  T(-out * (wmm / 2 + 6), -r * 0.2, -out * wmm / 2, r * 0.2, 'iron', S_.flat(2), 'BRAKE DRUM'); T(out * wmm / 2, -r * 0.24, out * (wmm / 2 + 22), r * 0.24, 'chrome', S_.cylV(), 'HUB CAP'); }
function damper(D, kind, x0, z0, x1, z1, name = 'DAMPER') {
  if (kind === 'tube') { D.bar(x0, z0, (x0 + x1) / 2, (z0 + z1) / 2, 14, 14, 'black', S_.cylV(), name); D.bar((x0 + x1) / 2, (z0 + z1) / 2, x1, z1, 7, 7, 'chrome', S_.cylV(), name); return; }
  if (kind === 'lever') { D.rect(x1 - 40, z1 - 24, x1 + 30, z1 + 24, 'black', S_.cast(2), name); D.bar(x1 - 30, z1, x0, z0, 6, 5, 'iron', S_.flat(2), 'DAMPER ARM'); D.bar(x0, z0, x0, z0 + 2, 9, 9, 'iron', S_.ball(), 'DAMPER ARM'); return; }
  D.circ(x1, z1, 30, 'iron', S_.ball(), name); D.circ(x1, z1, 12, 'chrome', S_.ball(), name); D.bar(x1, z1, x0, z0, 6, 5, 'iron', S_.flat(2), 'DAMPER ARM'); }
function leafEnd(D, x, zBot, zTop, n, name) { const h = (zTop - zBot) / n; for (let q = 0; q < n; q++) D.rect(x - 32 + q * 2, zBot + q * h, x + 32 - q * 2, zBot + (q + 0.8) * h, 'iron', S_.flat(q === n - 1 ? 3 : 2), name); }

export function drawSuspPix(P, c, t, w, h) {
  const ty = tyreDims(c.tyre), R = ty.r * 1000, Wt = ty.w * 25.4, tr = 1420, half = tr / 2, rail = R + 250, gap = 160;
  const spanW = 2 * (tr + Wt + 40) + gap, D = fitDraw(P, w, h, spanW, rail + 210, 0, 0), bump = Math.max(0, Math.sin(t * 0.045)) ** 3 * 70;
  const F = SUSP_F[c.fs], Rr = SUSP_R[c.rs];
  [['F', -(half + Wt / 2 + gap / 2 + 20)], ['R', half + Wt / 2 + gap / 2 + 20]].forEach(([which, cx]) => {
    const ifs = which === 'F' ? F.ifs : c.rs === 'swing', kind = which === 'F' ? c.fs : c.rs, lz = R + bump, rz = R;
    const body = (bump * (ifs ? 0.25 : 0.45)) / tr;                                                // body follows a little, rolling away from the bump
    D.rect(cx - half - Wt, -8, cx + half + Wt, 0, 'iron', () => 1, 'ROAD'); D.poly([[cx - half - 80, 0], [cx - half + 80, 0], [cx - half + 40, bump], [cx - half - 40, bump]], 'iron', S_.flat(2), 'BUMP');
    const fz = x => rail + bump * 0.3 + (x - cx) * body; for (const sx of [-1, 1]) { const x = cx + sx * half * 0.62; D.rect(x - 34, fz(x) - 60, x + 34, fz(x) + 60, 'black', S_.cast(1.6), 'FRAME RAIL'); }
    D.poly([[cx - half * 0.66, fz(cx - half * 0.66) - 8], [cx + half * 0.66, fz(cx + half * 0.66) - 8], [cx + half * 0.66, fz(cx + half * 0.66) - 40], [cx - half * 0.66, fz(cx - half * 0.66) - 40]], 'black', S_.cast(1.6), 'CROSS-MEMBER');
    const xl = cx - half, xr = cx + half;
    if (!ifs) { const cam = Math.atan2(lz - rz, tr); if (which === 'R') { D.bar(xl, lz, xr, rz, 26, 26, 'iron', S_.cylH(), 'AXLE TUBE'); D.circ(cx, (lz + rz) / 2, 120, 'iron', S_.ball(), 'DIFFERENTIAL'); D.circ(cx, (lz + rz) / 2, 70, 'iron', S_.cast(2.4), 'DIFFERENTIAL'); }
      else { D.poly([[xl, lz + 20], [cx - half * 0.4, (lz + rz) / 2 - 30 + (lz - rz) * 0.1], [cx + half * 0.4, (lz + rz) / 2 - 30 - (lz - rz) * 0.1], [xr, rz + 20], [xr, rz - 20], [cx + half * 0.4, (lz + rz) / 2 - 70], [cx - half * 0.4, (lz + rz) / 2 - 70], [xl, lz - 20]], 'iron', S_.cast(2.6), 'AXLE BEAM'); D.rect(xl - 18, lz - 40, xl + 18, lz + 60, 'chrome', S_.cylV(), 'KING PIN'); D.rect(xr - 18, rz - 40, xr + 18, rz + 60, 'chrome', S_.cylV(), 'KING PIN'); }
      const az = x => lz + (rz - lz) * (x - xl) / tr;
      if (kind === 'trans') { const top = fz(cx) - 46, n = 6; for (let q = 0; q < n; q++) { const ww = half * (1 - q * 0.13), z0 = az(cx) + 40 + q * ((top - az(cx) - 40) / n) * 0.9;
          D.poly([[cx - ww, az(cx - ww) + 40], [cx, z0 + 22], [cx + ww, az(cx + ww) + 40], [cx + ww, az(cx + ww) + 48], [cx, z0 + 30], [cx - ww, az(cx - ww) + 48]], 'iron', S_.flat(q ? 2 : 3), 'TRANSVERSE LEAF SPRING'); } }
      else if (kind === 'coil') for (const sx of [-1, 1]) { const x = cx + sx * half * 0.62; coil(D, x, az(x) + 30, x, fz(x) - 60, 36, 5, 'chrome', 'COIL SPRING'); }
      else for (const sx of [-1, 1]) { const x = cx + sx * half * 0.62; leafEnd(D, x, az(x) + 26, fz(x) - 62, 6, 'LEAF SPRING'); }
      for (const sx of [-1, 1]) { const x = cx + sx * half * 0.8; damper(D, c.damp, x, az(x) + 20, x + sx * 40, fz(x) + 10); }
      wheelFront(D, xl, lz, R, Wt, cam); wheelFront(D, xr, rz, R, Wt, cam); }
    else if (which === 'F') {                                                                         // wishbones: each wheel on its own, staying nearly upright
      for (const [sx, wz] of [[-1, lz], [1, rz]]) { const xw = cx + sx * half, xi = cx + sx * half * 0.5, up = fz(xi) - 110, lo = fz(xi) - 300;
        const xu = xw - sx * (Wt / 2 + 34); D.rect(xu - 18, wz - 100, xu + 18, wz + 120, 'iron', S_.cylV(), 'STUB AXLE UPRIGHT'); D.rect(Math.min(xu, xw), wz - 16, Math.max(xu, xw), wz + 16, 'chrome', S_.cylH(), 'STUB AXLE');
        D.bar(xi, up, xu, wz + 110, 18, 14, 'iron', S_.flat(2), 'UPPER WISHBONE'); D.bar(xi, lo, xu, wz - 90, 24, 18, 'iron', S_.flat(2), 'LOWER WISHBONE');
        if (c.fs === 'torsion') { D.circ(xi, lo, 26, 'chrome', S_.ball(), 'TORSION BAR'); D.circ(xi, lo, 10, 'iron', S_.ball(), 'TORSION BAR'); }
        else coil(D, (xi + xw) / 2, lo + (wz - 80 - lo) * 0.45 + 10, xi + sx * 30, fz(xi) - 70, 36, 5, 'chrome', 'COIL SPRING');
        damper(D, c.damp, (xi * 2 + xw) / 3, lo + 40, (xi * 2 + xw) / 3 + sx * 10, fz(xi) + 10);
        if (c.arb && sx < 0) D.bar(cx - half * 0.55, lo + 30, cx + half * 0.55, lo + 30, 6, 6, 'iron', S_.cylH(), 'ANTI-ROLL BAR');
        wheelFront(D, xw, wz, R, Wt, 0); } }
    else { D.circ(cx, rz, 110, 'iron', S_.ball(), 'DIFFERENTIAL'); for (const [sx, wz] of [[-1, lz], [1, rz]]) { const xw = cx + sx * half; D.bar(cx + sx * 60, rz, xw, wz, 24, 24, 'iron', S_.cylH(), 'SWING AXLE'); coil(D, cx + sx * half * 0.62, rz + (wz - rz) * 0.62 + 30, cx + sx * half * 0.62, fz(cx + sx * half * 0.62) - 60, 36, 5, 'chrome', 'COIL SPRING'); wheelFront(D, xw, wz, R, Wt, Math.atan2(wz - rz, half) * sx * -1); } }
    if (c.arb && which === 'F' && !ifs) D.bar(cx - half * 0.55, fz(cx) - 70, cx + half * 0.55, fz(cx) - 70, 6, 6, 'iron', S_.cylH(), 'ANTI-ROLL BAR');
  });
  D.outline(); return D;
}

export function drawBrakePix(P, c, hyd, t, w, h, heat = 0) {
  const ty = tyreDims(c.tyre), rimR = ty.rim * 25.4 / 2, r = c.drum / 2, D = fitDraw(P, w, h, rimR * 2 + 260, rimR * 2 + 40, 110, -rimR - 20), on = Math.max(0, Math.sin(t * 0.05)), open = on * 5, ang = t * 0.04 * (1 - on * 0.9);
  const hot = heat > 0.66 ? 'rust' : 'iron';
  D.circ(0, 0, rimR, 'chrome', (x, y, u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.47 ? 3 : -9), 'WHEEL RIM');               // rim outline: the drum has to fit inside
  D.circ(0, 0, r + 10, hot, S_.ball(), 'BRAKE DRUM'); D.circ(0, 0, r, 'black', S_.flat(0), 'BRAKE DRUM');
  for (let q = 0; q < 12; q++) { const a = ang + q * Math.PI / 6; D.bar(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), Math.cos(a) * (r + 9), Math.sin(a) * (r + 9), 2, 2, hot, S_.flat(3), 'COOLING FIN'); }
  D.circ(0, 0, r - 4, 'alu', S_.cast(1.2), 'BACKING PLATE');
  for (const s of [-1, 1]) { band(D, s * open, 0, r - 46, r - 26, s < 0 ? Math.PI * 0.6 : -Math.PI * 0.4, s < 0 ? Math.PI * 1.4 : Math.PI * 0.4, 'black', S_.flat(2), 'BRAKE SHOE'); band(D, s * open, 0, r - 26, r - 16, s < 0 ? Math.PI * 0.58 : -Math.PI * 0.42, s < 0 ? Math.PI * 1.42 : Math.PI * 0.42, 'chrome', S_.flat(2), 'BRAKE SHOE');
    band(D, s * open, 0, r - 16, r - 5 + open * 0.8, s < 0 ? Math.PI * 0.6 : -Math.PI * 0.4, s < 0 ? Math.PI * 1.4 : Math.PI * 0.4, 'brass', S_.flat(1), 'LINING'); }
  D.circ(0, -r + 30, 14, 'chrome', S_.ball(), 'ANCHOR PIN');
  if (hyd) { D.rect(-34, r - 44, 34, r - 22, 'iron', S_.cylH(), 'WHEEL CYLINDER'); D.rect(-34 - open, r - 40, -26, r - 26, 'chrome', S_.cylH(), 'PISTON'); D.rect(26, r - 40, 34 + open, r - 26, 'chrome', S_.cylH(), 'PISTON'); D.bar(0, r - 22, 0, r + 60, 4, 4, 'black', S_.flat(1), 'BRAKE PIPE'); }
  else { const ca = on * 0.5; D.poly([[-22 * Math.cos(ca), r - 33 - 22 * Math.sin(ca)], [0, r - 22], [22 * Math.cos(ca), r - 33 + 22 * Math.sin(ca)], [0, r - 44]], 'chrome', S_.flat(3), 'BRAKE CAM'); D.bar(0, r - 33, 70, r + 50, 5, 5, 'iron', S_.flat(2), 'CAM LEVER'); D.bar(70, r + 50, 240, r + 60, 3, 3, 'iron', S_.flat(2), 'BRAKE ROD'); }
  for (const z of [r - 60, -r + 60]) for (let q = 0; q < 6; q++) D.bar(-30 + q * 10, z + (q % 2 ? 6 : -6), -20 + q * 10, z + (q % 2 ? -6 : 6), 2, 2, 'chrome', S_.flat(3), 'RETURN SPRING');
  // the drum seen in section beside it: width of the friction face
  const sx = rimR + 70; D.rect(sx, -r - 10, sx + c.drumW + 20, -r, hot, S_.cut(), 'BRAKE DRUM'); D.rect(sx, r, sx + c.drumW + 20, r + 10, hot, S_.cut(), 'BRAKE DRUM'); D.rect(sx, -r, sx + 10, r, hot, S_.cut(), 'BRAKE DRUM');
  D.rect(sx + 14, -r + 2, sx + 14 + c.drumW, -r + 14, 'brass', S_.flat(1), 'LINING'); D.rect(sx + 14, r - 14, sx + 14 + c.drumW, r - 2, 'brass', S_.flat(1), 'LINING');
  D.outline(); return D;
}

export function drawTyrePix(P, c, w, h) {
  const ty = tyreDims(c.tyre), Wt = ty.w * 25.4, H = Wt * 0.96, rimW = Wt * 0.66, bulge = 1 + (28 - c.psi) * 0.012, flat = Math.max(4, (40 - c.psi) * 1.8), sq = flat * 0.4;
  const D = fitDraw(P, w, h, Wt * 1.5, H + 90, 0, -10), Hb = H / 2 + Math.sin(Math.acos(Math.min(0.98, rimW / 2 / (Wt / 2 * bulge)))) * H / 2;
  // carcass: bias plies cross-hatched, widest at mid-height, bulging more at low pressure, flattened on the road under load
  const A = Wt / 2 * bulge, B = H / 2, u1 = Math.acos(Math.min(0.98, rimW / 2 / A)), outer = [], inner = [], n = 32;
  for (let q = 0; q <= n; q++) { const u = -u1 + (Math.PI + 2 * u1) * q / n, x = -Math.cos(u) * A, z = Math.max(sq, B - Math.sin(u) * B); outer.push([x, z]); inner.push([-Math.cos(u) * (A - 14), Math.max(sq + 14, B - Math.sin(u) * (B - 14))]); }
  D.poly([...outer, ...inner.reverse()], 'rubber', (x, y) => ((x + y) % 5 === 0 || (x - y + 500) % 5 === 0 ? 1 : 2), 'BIAS PLY CARCASS');
  D.rect(-Wt * 0.36, sq, Wt * 0.36, sq + 16, 'rubber', x => (x % 6 < 2 ? 0 : 1), 'TREAD');
  const pw = Wt * 0.34 * (1 + flat / 50); D.rect(-pw, -6, pw, 0, 'brass', S_.flat(2), 'CONTACT PATCH'); D.rect(-Wt, -10, Wt, -6, 'iron', () => 1, 'ROAD');
  // rim: flanges hold the beads, drop centre above
  D.poly([[-rimW / 2 - 12, Hb - 12], [-rimW / 2, Hb - 12], [-rimW / 2, Hb + 24], [-rimW * 0.22, Hb + 38], [rimW * 0.22, Hb + 38], [rimW / 2, Hb + 24], [rimW / 2, Hb - 12], [rimW / 2 + 12, Hb - 12], [rimW / 2 + 12, Hb + 8], [rimW * 0.22, Hb + 54], [-rimW * 0.22, Hb + 54], [-rimW / 2 - 12, Hb + 8]], 'chrome', S_.cylH(), 'WHEEL RIM');
  D.outline(); return D;
}
