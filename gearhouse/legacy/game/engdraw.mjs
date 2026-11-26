// Engine drawings, second generation (plan 21): every part is a shaded volume in the palette (five levels per material,
// light from the upper left), then an automatic outline is laid where a part meets a part behind it or empty space.
// Parts carry the design stage that adds them, so the staged designer shows the engine growing step by step:
//   1 block  2 head  3 bottom end  4 top end  5 fuel system  6 exhaust  7 cooling and oil  8 complete
import { Pix } from '../tools/pixel/pix.mjs';
import { LAYOUTS } from '../sim/engine.mjs';

export const STAGE_NAMES = ['BLOCK', 'HEAD', 'BOTTOM END', 'TOP END', 'FUEL SYSTEM', 'EXHAUST', 'COOLING AND OIL', 'TEST AND RELEASE'];
const ORDER = { I3: [0, 2, 1], I4: [0, 2, 3, 1], F4: [0, 2, 3, 1], I6: [0, 4, 2, 5, 1, 3], V12: [0, 4, 2, 5, 1, 3], I8: [0, 5, 2, 4, 7, 1, 6, 3], V16: [0, 5, 2, 4, 7, 1, 6, 3], V8: [0, 2, 3, 1], V6: [0, 2, 1] };
export const cycleOf = (layout, i, th) => { const o = ORDER[layout] || ORDER.I4, n = o.length, k = o.indexOf(i % n); return (((th - k * 720 / n) % 720) + 720) % 720; };
export const strokeRamp = c => (c < 180 ? 'eng.pow' : c < 360 ? 'eng.exh' : c < 540 ? 'eng.in' : 'eng.cmp');
const lift = (c, a, b) => (c > a && c < b ? Math.sin((c - a) / (b - a) * Math.PI) : 0);
const dith = (x, y, v) => { const f = Math.floor(v), r = v - f; return f + ((((x * 3 + y * 5) % 4) / 4) < r ? 1 : 0); };
const cl = v => Math.max(0, Math.min(4, v));

// ---- canvas with tagged painter's order ----
class Draw {
  constructor(P, w, h, k, ox, oy) { this.P = P; this.px = new Pix(w, h); this.k = k; this.ox = ox; this.oy = oy; this.tag = 1; this.names = {}; this.ids = {}; }
  X(m) { return this.ox + m * this.k; } Y(m) { return this.oy - m * this.k; }
  id(r) { return this.ids[r] ?? (this.ids[r] = this.P.id(r)); }
  // scanline fill in mm coordinates; shade(x, y, u, v) -> level, with u,v = 0..1 across the bounding box
  poly(ptsMM, ramp, shade, name = null) { const pts = ptsMM.map(([x, z]) => [this.X(x), this.Y(z)]), t = this.tag = Math.min(250, this.tag + 1), r = this.id(ramp);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.px.h - 1, Math.ceil(y1)); y++) { const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(this.px.w, Math.round(xs[i + 1])); x++) { const lv = shade(x, y, (x + 0.5 - x0) / W, (yc - y0) / H); if (lv > -5) this.px.set(x, y, r, cl(lv), t); } }
    if (name) this.names[t] = name; return t; }
  rect(a, b, c, d, ramp, shade, name) { return this.poly([[a, b], [c, b], [c, d], [a, d]], ramp, shade, name); }
  circ(cx, cz, r, ramp, shade, name, n = 0) { const N = n || Math.max(10, Math.min(40, Math.round(r * this.k * 2))); return this.poly(Array.from({ length: N }, (_, i) => [cx + Math.cos(i / N * 6.2832) * r, cz + Math.sin(i / N * 6.2832) * r]), ramp, shade, name); }
  // a rotated slab from a to b with half-width w (rods, pipes, blades)
  bar(ax, az, bx, bz, w0, w1, ramp, shade, name) { const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L; return this.poly([[ax + nx * w0, az + nz * w0], [bx + nx * w1, bz + nz * w1], [bx - nx * w1, bz - nz * w1], [ax - nx * w0, az - nz * w0]], ramp, shade, name); }
  dot(x, z, ramp, lv) { const X = Math.round(this.X(x)), Y = Math.round(this.Y(z)); if (this.px.in(X, Y)) this.px.set(X, Y, this.id(ramp), lv, this.px.tag(X, Y)); }
  outline() { const { px } = this, W = px.w, mark = []; for (let y = 0; y < px.h; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!px.r[i]) continue; const t = px.t[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!px.in(xx, yy) || !px.r[yy * W + xx] || px.t[yy * W + xx] < t - 0) { if (!px.in(xx, yy) || !px.r[yy * W + xx] || px.t[yy * W + xx] < t) { mark.push(i); break; } } } }
    for (const i of mark) px.l[i] = -1; }
}
// shading models
const S_ = {
  flat: (lv = 2) => (x, y, u, v) => lv + (v < 0.08 ? 1 : v > 0.92 ? -1 : 0),
  cast: (lv = 2) => (x, y, u, v) => dith(x, y, lv + 0.9 - v * 1.6) + ((x * 7 + y * 13) % 29 === 0 ? -1 : 0),          // sand-cast surface: soft fall-off and pitting
  cut: () => (x, y) => ((x + y) % 4 === 0 ? 2 : 3),                                                                     // sectioned casting face: hatching
  cylV: () => (x, y, u) => dith(x, y, u < 0.18 ? 2.2 + u * 9 : 4 - (u - 0.18) * 3.6),                                   // round part, axis vertical
  cylH: () => (x, y, u, v) => dith(x, y, v < 0.25 ? 2.4 + v * 6 : 4 - (v - 0.25) * 3.8),                                 // round part, axis horizontal
  ball: () => (x, y, u, v) => dith(x, y, 4 - Math.hypot(u - 0.3, v - 0.3) * 4),
  gas: () => (x, y, u, v) => dith(x, y, 3.4 - v * 2),
  liquid: () => (x, y, u, v) => (v < 0.06 ? 4 : dith(x, y, 3 - v * 1.6)),
};

// ---- geometry shared by all views (mm) ----
export function engineGeo(e) {
  const L = LAYOUTS[e.layout], n = L.cyl / L.banks, pitch = Math.max(e.bore, e.maxBore || 0) + 22, r = e.stroke / 2, rod = e.stroke * 1.75, sd = 80 + 55 * (e.oil ?? 1), zc = sd + r + 40, pH = e.bore * 0.78;
  const zd = zc + r + rod + pH * 0.55 + 8, sv = e.head === 'sv', ohc = e.head === 'sohc' || e.head === 'dohc', headH = sv ? 64 : 104, cover = sv ? 0 : ohc ? 92 : 70, x0 = 230;
  return { L, n, pitch, r, rod, sd, zc, zd, pH, sv, ohc, headH, cover, x0, bx0: x0 - 18, bx1: x0 + n * pitch + 18, len: x0 + n * pitch + 230, H: zd + headH + cover + 110 };
}
const paintOf = e => e.color || (e.head === 'sv' && LAYOUTS[e.layout].banks === 1 ? 'paint.enginegreen' : e.head === 'sv' ? 'paint.engineGrey' : LAYOUTS[e.layout].cyl === 6 ? 'paint.engineGrey' : 'paint.enginered');
function frame(P, g, w, h, padTop = 0) { const k = Math.min((w - 6) / g.len, (h - 6 - padTop) / g.H); return new Draw(P, w, h, k, (w - g.len * k) / 2, h - 3 - (h - 6 - padTop - g.H * k) / 2); }

// ================= longitudinal section =================
export function drawLongPix(P, e, th, w, h, stage = 8) {
  const g = engineGeo(e), D = frame(P, g, w, h), { bx0, bx1 } = g, col = paintOf(e), alu = e.material === 'alHead' ? 'alu' : col, camZ = g.ohc ? g.zd + g.headH + g.cover * 0.45 : g.zc + g.r + 52;
  const cyl = Array.from({ length: g.n }, (_, i) => { const cx = g.x0 + g.pitch * (i + 0.5), c = cycleOf(e.layout, i, th), ph = c * Math.PI / 180, pinZ = g.zc + g.r * Math.cos(ph), pinX = cx + g.r * Math.sin(ph) * 0.0, pz = pinZ + Math.sqrt(g.rod * g.rod - (g.r * Math.sin(ph)) ** 2); return { i, cx, c, ph, pinZ, pz, top: pz + g.pH * 0.55 }; });
  // rear: flywheel and ring gear, clutch housing (stage 3+)
  if (stage >= 3) { D.rect(bx1 + 30, g.zc - 190, bx1 + 74, g.zc + 190, 'iron', S_.cylH(), 'FLYWHEEL'); for (let z = -186; z < 190; z += 12) { const zz = z + ((th / 4) % 12); if (zz < 186) D.rect(bx1 + 74, g.zc + zz, bx1 + 82, g.zc + zz + 6, 'chrome', S_.flat(3), 'RING GEAR'); } D.rect(bx1 + 6, g.zc - 15, bx1 + 140, g.zc + 15, 'chrome', S_.cylH(), 'CRANKSHAFT'); }
  // sump and oil
  if (stage >= 7) { D.poly([[bx0 + 30, g.sd + 4], [bx1 - 30, g.sd + 4], [bx1 - 46, 18, 0], [bx1 - 70, 0], [bx0 + 70, 0], [bx0 + 46, 18]], 'black', S_.cast(2), 'OIL PAN');
    D.poly([[bx0 + 52, 14], [bx1 - 52, 14], [bx1 - 44, 14 + 46 * (e.oil ?? 1)], [bx0 + 44, 14 + 46 * (e.oil ?? 1)]], 'eng.oil', S_.liquid(), 'OIL');
    const pk = (bx0 + bx1) / 2; D.rect(pk - 7, 20, pk + 7, g.zc - g.r - 34, 'chrome', S_.cylV(), 'OIL PICK-UP'); D.rect(pk - 46, 12, pk + 46, 26, 'chrome', S_.flat(2), 'PICK-UP SCREEN'); }
  // block: casting with water jackets, bores, main bearing webs
  D.poly([[bx0, g.sd], [bx1, g.sd], [bx1, g.zd], [bx0, g.zd]], col, S_.cast(2), 'CYLINDER BLOCK');
  D.rect(bx0 + 10, g.sd + 10, bx1 - 10, g.zc + g.r + 30, 'black', S_.flat(1), 'CRANKCASE');
  for (const cy of cyl) { const hb = e.bore / 2; D.rect(cy.cx - hb - 14, g.zc + g.r + 30, cy.cx + hb + 14, g.zd, col, S_.cut(), 'CYLINDER WALL');
    D.rect(cy.cx - hb - 11, g.zc + g.r + 50, cy.cx - hb - 3, g.zd - 8, 'eng.water', S_.liquid(), 'WATER JACKET'); D.rect(cy.cx + hb + 3, g.zc + g.r + 50, cy.cx + hb + 11, g.zd - 8, 'eng.water', S_.liquid(), 'WATER JACKET');
    D.rect(cy.cx - hb, g.zc + g.r + 30, cy.cx + hb, g.zd, 'black', S_.flat(0), 'BORE'); }
  for (let j = 0; j <= g.n; j++) { const mx = g.x0 + g.pitch * j, has = e.mains === 'full' || j === 0 || j === g.n || (g.n > 4 && j === Math.round(g.n / 2)); if (!has) continue;
    D.poly([[mx - 20, g.sd + 10], [mx + 20, g.sd + 10], [mx + 14, g.zc + g.r + 30], [mx - 14, g.zc + g.r + 30]], col, S_.cut(), 'MAIN BEARING WEB'); D.rect(mx - 22, g.zc - 34, mx + 22, g.zc - 20, col, S_.flat(3), 'BEARING CAP'); for (const s of [-1, 1]) D.rect(mx + s * 16 - 3, g.zc - 44, mx + s * 16 + 3, g.zc - 18, 'iron', S_.cylV(), 'CAP BOLT'); }
  // head and cover
  if (stage >= 2) { D.rect(bx0, g.zd, bx1, g.zd + 4, 'eng.gasket', S_.flat(3), 'HEAD GASKET'); D.poly([[bx0, g.zd + 4], [bx1, g.zd + 4], [bx1 - 8, g.zd + g.headH], [bx0 + 8, g.zd + g.headH]], alu, S_.cast(2.4), 'CYLINDER HEAD');
    for (const cy of cyl) { const hb = e.bore / 2, ch = e.chamber; if (g.sv) D.poly([[cy.cx - hb, g.zd + 4], [cy.cx + hb + 30, g.zd + 4], [cy.cx + hb + 22, g.zd + (ch === 'ricardo' ? 18 : 26)], [cy.cx - hb + 10, g.zd + (ch === 'ricardo' ? 14 : 22)]], 'black', S_.flat(0), 'COMBUSTION CHAMBER');
      else if (ch === 'hemi') D.poly(Array.from({ length: 13 }, (_, k2) => { const a = Math.PI * k2 / 12; return [cy.cx - Math.cos(a) * hb, g.zd + 4 + Math.sin(a) * hb * 0.62]; }), 'black', S_.flat(0), 'COMBUSTION CHAMBER');
      else D.poly([[cy.cx - hb, g.zd + 4], [cy.cx + hb, g.zd + 4], [cy.cx + hb * 0.7, g.zd + 26], [cy.cx - hb * 0.4, g.zd + 34]], 'black', S_.flat(0), 'COMBUSTION CHAMBER');
      D.rect(cy.cx - hb - 10, g.zd + 30, cy.cx - hb - 3, g.zd + g.headH - 14, 'eng.water', S_.liquid(), 'WATER JACKET'); }
    for (let q = bx0 + 16; q < bx1 - 8; q += g.pitch / 2) D.rect(q - 3, g.zd + 10, q + 3, g.zd + g.headH + 6, 'iron', S_.cylV(), 'HEAD BOLT');
    if (stage >= 4 && g.cover) D.poly([[bx0 + 14, g.zd + g.headH], [bx1 - 14, g.zd + g.headH], [bx1 - 26, g.zd + g.headH + g.cover], [bx0 + 26, g.zd + g.headH + g.cover]], 'black', (x, y, u, v) => (v < 0.1 ? 2 : 0), 'VALVE COVER'); }   // opened: dark inside, valve gear in front
  // pistons, rods, crank
  if (stage >= 3) for (const cy of cyl) { const hb = e.bore / 2;
    if (stage >= 4) D.rect(cy.cx - hb, cy.top, cy.cx + hb, g.zd + (g.sv ? 0 : 6), strokeRamp(cy.c), S_.gas(), 'GAS');
    const pr = e.pistons === 'alu' ? 'alu' : 'chrome'; D.poly([[cy.cx - hb + 1, cy.top], [cy.cx + hb - 1, cy.top], [cy.cx + hb - 2, cy.top - g.pH], [cy.cx - hb + 2, cy.top - g.pH]], pr, S_.cylV(), 'PISTON');
    for (let q = 0; q < 3; q++) D.rect(cy.cx - hb + 1, cy.top - 7 - q * 8, cy.cx + hb - 1, cy.top - 4 - q * 8, 'black', S_.flat(1), 'PISTON RING');
    D.circ(cy.cx, cy.pz, 11, 'chrome', S_.ball(), 'GUDGEON PIN');
    D.bar(cy.cx, cy.pz, cy.cx, cy.pinZ, 9, 14, e.rods === 'forged' ? 'chrome' : 'iron', S_.cylV(), 'CONNECTING ROD'); D.bar(cy.cx, cy.pz - 16, cy.cx, cy.pinZ + 18, 3, 4, 'black', S_.flat(1), 'CONNECTING ROD');
    const wb = e.bore * 0.32; for (const s of [-1, 1]) { const zt = Math.max(g.zc, cy.pinZ) + 16, zb = Math.min(g.zc, cy.pinZ) - 16; D.rect(cy.cx + s * wb - 9, zb, cy.cx + s * wb + 9, zt, 'iron', S_.cylV(), 'CRANK WEB');
      if (e.cwt === 'yes') { const up = cy.pinZ > g.zc ? -1 : 1, zr = g.zc + up * g.r * 0.95; D.rect(cy.cx + s * wb - 11, Math.min(g.zc, zr), cy.cx + s * wb + 11, Math.max(g.zc, zr), 'iron', S_.cast(2), 'COUNTERWEIGHT'); } }
    D.rect(cy.cx - wb, cy.pinZ - 12, cy.cx + wb, cy.pinZ + 12, 'chrome', S_.cylH(), 'CRANKPIN'); D.rect(cy.cx - 17, cy.pinZ - 20, cy.cx + 17, cy.pinZ + 20, e.rods === 'forged' ? 'chrome' : 'iron', S_.cylV(), 'BIG END');
    D.rect(cy.cx - 18, cy.pinZ - 3, cy.cx + 18, cy.pinZ - 1, 'black', S_.flat(0), 'BIG END'); for (const s of [-1, 1]) D.dot(cy.cx + s * 13, cy.pinZ - 14, 'chrome', 4); }
  if (stage >= 3) for (let j = 0; j <= g.n; j++) { const mx = g.x0 + g.pitch * j; D.rect(mx - 14, g.zc - 13, mx + 14, g.zc + 13, 'chrome', S_.cylH(), 'MAIN JOURNAL'); D.rect(mx - 16, g.zc + 13, mx + 16, g.zc + 19, 'brass', S_.flat(3), 'MAIN BEARING'); D.rect(mx - 16, g.zc - 19, mx + 16, g.zc - 13, 'brass', S_.flat(2), 'MAIN BEARING'); }
  // valve gear
  if (stage >= 2) { const camShow = stage >= 4;
    for (const cy of cyl) { const li = stage >= 4 ? lift(cy.c, 350, 560) : 0, le = stage >= 4 ? lift(cy.c, 150, 370) : 0;
      [[-1, li], [1, le]].forEach(([s, l]) => { const vx = cy.cx + s * e.bore * 0.25 + (g.sv ? e.bore * 0.6 : 0), d = l * 10;
        if (g.sv) { const vz = g.zd + 4 + d; D.poly([[vx - 14, vz], [vx + 14, vz], [vx + 5, vz - 8], [vx - 5, vz - 8]], 'chrome', S_.cylV(), 'VALVE'); D.rect(vx - 3, camZ + 30, vx + 3, vz - 8, 'chrome', S_.cylV(), 'VALVE STEM');
          for (let q = 0; q < 4; q++) D.rect(vx - 9, camZ + 44 + q * 10 + d * (q / 4), vx + 9, camZ + 49 + q * 10 + d * (q / 4), 'eng.spring', S_.cylH(), 'VALVE SPRING'); D.rect(vx - 8, camZ + 18 + d, vx + 8, camZ + 30 + d, 'iron', S_.cylV(), 'TAPPET'); }
        else { const vz = g.zd + 10 - d; D.poly([[vx - 14, vz], [vx + 14, vz], [vx + 5, vz + 9], [vx - 5, vz + 9]], 'chrome', S_.cylV(), 'VALVE'); D.rect(vx - 3, vz + 9, vx + 3, g.zd + g.headH + 14, 'chrome', S_.cylV(), 'VALVE STEM');
          for (let q = 0; q < 4; q++) D.rect(vx - 9, g.zd + g.headH - 34 + q * 9 - d * (1 - q / 4), vx + 9, g.zd + g.headH - 30 + q * 9 - d * (1 - q / 4), 'eng.spring', S_.cylH(), 'VALVE SPRING');
          if (stage >= 4 && !g.ohc) { const rz = g.zd + g.headH + 22; D.bar(vx - s * 4, rz + 4 - d * 0.6, vx + s * 26, rz + 4 + d * 0.6, 5, 5, 'iron', S_.cylH(), 'ROCKER ARM'); D.rect(vx + s * 26 - 2, camZ + 16, vx + s * 26 + 2, rz, 'chrome', S_.cylV(), 'PUSH ROD'); D.circ(vx + s * 11, rz + 4, 6, 'chrome', S_.ball(), 'ROCKER SHAFT'); } } }); }
    if (camShow) { D.rect(bx0 - 40, camZ - 7, bx1 + 8, camZ + 7, 'chrome', S_.cylH(), 'CAMSHAFT');
      for (const cy of cyl) for (const [s, off] of [[-1, 0], [1, 200]]) { const vx = cy.cx + s * e.bore * 0.25 + (g.sv ? e.bore * 0.6 : 0) + (g.ohc || g.sv ? 0 : s * 26), a = (cy.c + off) * Math.PI / 360;
        D.poly(Array.from({ length: 14 }, (_, k2) => { const t = k2 / 14 * 6.2832, rr = 12 + 7 * Math.max(0, Math.cos(t - a)) ** 3; return [vx + Math.sin(t) * rr * 0.55, camZ + Math.cos(t) * rr]; }), 'chrome', S_.ball(), 'CAM LOBE'); } } }
  // front: timing gears or chain, pulley, damper, fan and water pump
  const fx = bx0 - 40;
  if (stage >= 2) D.poly([[bx0 - 2, g.sd + 20], [bx0 - 70, g.sd + 40], [bx0 - 74, (g.ohc ? g.zd + g.headH + g.cover : camZ + 60)], [bx0 - 2, (g.ohc ? g.zd + g.headH + g.cover : camZ + 60)]], col, S_.cast(1.6), 'TIMING COVER');
  if (stage >= 4) { const gear = (cx, cz, r, n, a, name) => { D.circ(cx, cz, r, 'brass', S_.ball(), name); for (let q = 0; q < n; q++) { const t = a + q / n * 6.2832; D.bar(cx + Math.cos(t) * r * 0.9, cz + Math.sin(t) * r * 0.9, cx + Math.cos(t) * (r + 6), cz + Math.sin(t) * (r + 6), 3, 2.5, 'brass', S_.flat(3), name); } D.circ(cx, cz, r * 0.3, 'chrome', S_.ball(), name); };
    if (g.ohc) { D.circ(fx, g.zc, 26, 'chrome', S_.ball(), 'CRANK SPROCKET'); D.circ(fx, camZ, 34, 'chrome', S_.ball(), 'CAM SPROCKET'); for (let q = 0; q < 40; q++) { const t = ((q + th / 30) % 40) / 40, up = t < 0.5, f = up ? t * 2 : 2 - t * 2; D.circ(fx + (up ? -30 : 30), g.zc + (camZ - g.zc) * f, 4, 'iron', S_.flat(2), 'TIMING CHAIN', 6); } }
    else { gear(fx, g.zc, 26, 14, th * Math.PI / 180, 'CRANK GEAR'); gear(fx, g.zc + 26 + 52 + 4, 52, 28, -th * Math.PI / 360, 'CAM GEAR'); } }
  if (stage >= 3) { D.circ(fx - 52, g.zc, 50, 'iron', S_.ball(), 'CRANK PULLEY'); D.circ(fx - 52, g.zc, 16, 'chrome', S_.ball(), 'CRANK PULLEY'); if (e.balancer === 'damper') D.circ(fx - 52, g.zc, 34, 'rubber', S_.flat(1), 'HARMONIC DAMPER'); D.rect(fx - 52, g.zc - 15, bx0, g.zc + 15, 'chrome', S_.cylH(), 'CRANKSHAFT'); }
  if (stage >= 7 && e.cooling !== 'thermo') { const pz = g.zd - 20; D.poly([[bx0 - 60, pz - 70], [bx0 - 2, pz - 60], [bx0 - 2, pz + 40], [bx0 - 60, pz + 30]], col, S_.cast(2), 'WATER PUMP'); D.circ(bx0 - 74, pz - 20, 34, 'iron', S_.ball(), 'FAN PULLEY');
    D.bar(fx - 52, g.zc + 46, bx0 - 90, pz - 50, 4, 4, 'rubber', S_.flat(1), 'FAN BELT'); D.bar(fx - 52, g.zc - 46, bx0 - 64, pz + 14, 4, 4, 'rubber', S_.flat(1), 'FAN BELT');
    const fa = th * Math.PI / 180, fl = 270 * Math.abs(Math.cos(fa)) + 50; D.rect(bx0 - 128, pz - 20 - fl, bx0 - 108, pz - 20 + fl, 'black', S_.cylV(), 'FAN BLADE'); D.circ(bx0 - 118, pz - 20, 22, 'chrome', S_.ball(), 'FAN HUB'); }
  // ignition (top end): distributor and the spark
  if (stage >= 4) { const dx = g.x0 + g.pitch * (g.n - 0.55), dz = g.zd + g.headH + g.cover + 8; D.rect(dx - 15, dz - 40, dx + 15, dz + 30, 'black', S_.cylV(), 'DISTRIBUTOR'); D.poly([[dx - 24, dz + 30], [dx + 24, dz + 30], [dx + 18, dz + 58], [dx - 18, dz + 58]], 'eng.cap', S_.cylV(), 'DISTRIBUTOR CAP');
    for (const cy of cyl) { const pz = g.sv ? g.zd + g.headH - 6 : g.zd + g.headH * 0.55; D.rect(cy.cx + (g.sv ? e.bore * 0.2 : 0) - 6, pz, cy.cx + (g.sv ? e.bore * 0.2 : 0) + 6, pz + 42, 'white', S_.cylV(), 'SPARK PLUG');
      if (cy.c < 24) { D.circ(cy.cx, g.zd + (g.sv ? 18 : 22), 13, 'eng.spark', () => 4, 'SPARK'); } } }
  if (stage >= 2 && stage < 4 && g.cover) D.poly([[bx0 + 14, g.zd + g.headH], [bx1 - 14, g.zd + g.headH], [bx1 - 26, g.zd + g.headH + g.cover], [bx0 + 26, g.zd + g.headH + g.cover]], g.ohc ? 'alu' : 'black', (x, y, u, v) => (stage >= 4 ? -9 : dith(x, y, 3.2 - v * 1.6)), 'VALVE COVER');   // cut away once the valve gear is in
  // the cover stays open in section: redraw it as a thin cut edge
  if (stage >= 4 && g.cover) { D.rect(bx0 + 14, g.zd + g.headH + g.cover - 6, bx1 - 14, g.zd + g.headH + g.cover, g.ohc ? 'alu' : 'black', S_.flat(2), 'VALVE COVER'); D.rect(bx0 + 90, g.zd + g.headH + g.cover, bx0 + 126, g.zd + g.headH + g.cover + 22, 'chrome', S_.cylV(), 'OIL FILLER'); }
  // negative levels from the cover trick mean 'not drawn'
  for (let i = 0; i < D.px.r.length; i++) if (D.px.l[i] < -1) D.px.r[i] = 0;
  D.outline(); return D;
}

// ================= cross-section through one cylinder (both banks of a V) =================
export function drawCrossPix(P, e, th, w, h, stage = 8) {
  const g = engineGeo(e), V = g.L.banks > 1, flat = e.layout === 'F4', half = V ? (flat ? 90 : e.layout === 'V12' || e.layout === 'V6' ? 30 : 45) : 0, col = paintOf(e), alu = e.material === 'alHead' ? 'alu' : col;
  const reach = g.zd - g.zc + g.headH + g.cover + 40, spanW = V ? 2 * (reach * Math.sin(half * Math.PI / 180) + 170) : 560, spanH = (V && !flat ? reach * Math.cos(half * Math.PI / 180) : reach) + g.zc + 60;
  const k = Math.min((w - 6) / spanW, (h - 6) / spanH), D = new Draw(P, w, h, k, w / 2, h - 3 - (h - 6 - spanH * k) / 2 - g.zc * k);
  const T = (ang, u, v) => { const a = ang * Math.PI / 180; return [u * Math.cos(a) + v * Math.sin(a), -u * Math.sin(a) + v * Math.cos(a)]; };
  const Q = (ang, pts, ramp, shade, name) => D.poly(pts.map(([u, v]) => T(ang, u, v)), ramp, shade, name), R = (ang, u0, v0, u1, v1, ramp, shade, name) => Q(ang, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], ramp, shade, name);
  if (stage >= 7) { D.poly([[-170, -g.zc + g.sd], [170, -g.zc + g.sd], [150, -g.zc + 10], [-150, -g.zc + 10]], 'black', S_.cast(2), 'OIL PAN'); D.poly([[-140, -g.zc + 20], [140, -g.zc + 20], [140, -g.zc + 20 + 40 * (e.oil ?? 1)], [-140, -g.zc + 20 + 40 * (e.oil ?? 1)]], 'eng.oil', S_.liquid(), 'OIL'); }
  D.circ(0, 0, g.r + 74, col, S_.cast(2), 'CRANKCASE'); D.circ(0, 0, g.r + 58, 'black', S_.flat(1), 'CRANKCASE');
  const banks = V ? [-half, half] : [0];
  banks.forEach((ang, bi) => { const c = cycleOf(e.layout, bi, th), ph = c * Math.PI / 180, hb = e.bore / 2, v0 = g.r + 46, vd = g.zd - g.zc, pin = [g.r * Math.sin(ph), g.r * Math.cos(ph)];
    const a = ang * Math.PI / 180, pu = pin[0] * Math.cos(a) - pin[1] * Math.sin(a), pv = pin[0] * Math.sin(a) + pin[1] * Math.cos(a), pz = pv + Math.sqrt(Math.max(1, g.rod * g.rod - pu * pu)), top = pz + g.pH * 0.55;
    const ext = g.sv ? e.bore * 0.8 : 0;
    Q(ang, [[-hb - 30, v0], [hb + 30 + ext, v0 + (g.sv ? 40 : 0)], [hb + 30 + ext, vd], [-hb - 30, vd]], col, S_.cast(2), 'CYLINDER BLOCK');
    R(ang, -hb - 22, v0 + 30, -hb - 4, vd - 8, 'eng.water', S_.liquid(), 'WATER JACKET'); R(ang, hb + 4, v0 + 30, hb + 20, vd - 8, 'eng.water', S_.liquid(), 'WATER JACKET'); R(ang, -hb, v0 - 10, hb, vd, 'black', S_.flat(0), 'BORE');
    if (stage >= 2) { R(ang, -hb - 32, vd, hb + 32 + ext, vd + 4, 'eng.gasket', S_.flat(3), 'HEAD GASKET'); Q(ang, [[-hb - 32, vd + 4], [hb + 32 + ext, vd + 4], [hb + 24 + ext, vd + g.headH], [-hb - 24, vd + g.headH]], alu, S_.cast(2.4), 'CYLINDER HEAD');
      const ch = e.chamber; if (g.sv) Q(ang, [[-hb, vd + 4], [hb + ext - 6, vd + 4], [hb + ext - 14, vd + (ch === 'ricardo' ? 18 : 28)], [-hb + 8, vd + (ch === 'ricardo' ? 14 : 24)]], stage >= 4 ? strokeRamp(c) : 'black', S_.gas(), 'COMBUSTION CHAMBER');
      else if (ch === 'hemi') Q(ang, Array.from({ length: 13 }, (_, k2) => { const t = Math.PI * k2 / 12; return [-Math.cos(t) * hb, vd + 4 + Math.sin(t) * hb * 0.7]; }), stage >= 4 ? strokeRamp(c) : 'black', S_.gas(), 'COMBUSTION CHAMBER');
      else Q(ang, [[-hb, vd + 4], [hb, vd + 4], [hb * 0.6, vd + 28], [-hb * 0.5, vd + 36]], stage >= 4 ? strokeRamp(c) : 'black', S_.gas(), 'COMBUSTION CHAMBER'); }
    if (stage >= 3) { if (stage >= 4) R(ang, -hb, top, hb, vd + 4, strokeRamp(c), S_.gas(), 'GAS');
      Q(ang, [[-hb + 1, top], [hb - 1, top], [hb - 2, top - g.pH], [-hb + 2, top - g.pH]], e.pistons === 'alu' ? 'alu' : 'chrome', S_.cylV(), 'PISTON'); for (let q = 0; q < 3; q++) R(ang, -hb + 1, top - 7 - q * 8, hb - 1, top - 4 - q * 8, 'black', S_.flat(1), 'PISTON RING');
      const A = T(ang, 0, pz); D.bar(A[0], A[1], pin[0], pin[1], 9, 15, e.rods === 'forged' ? 'chrome' : 'iron', S_.cylV(), 'CONNECTING ROD'); D.circ(A[0], A[1], 10, 'chrome', S_.ball(), 'GUDGEON PIN'); D.circ(pin[0], pin[1], 20, e.rods === 'forged' ? 'chrome' : 'iron', S_.ball(), 'BIG END'); }
    if (stage >= 2) { const li = stage >= 4 ? lift(c, 350, 560) : 0, le = stage >= 4 ? lift(c, 150, 370) : 0;
      if (g.sv) { const vx = hb + ext * 0.55, d = Math.max(li, le) * 10; Q(ang, [[vx - 16, vd + 6 + d], [vx + 16, vd + 6 + d], [vx + 5, vd - 2 + d], [vx - 5, vd - 2 + d]], 'chrome', S_.cylV(), 'VALVE'); R(ang, vx - 3, v0 + (vd - v0) * 0.45, vx + 3, vd + d, 'chrome', S_.cylV(), 'VALVE STEM');
        for (let q = 0; q < 4; q++) R(ang, vx - 9, v0 + (vd - v0) * 0.5 + q * 9, vx + 9, v0 + (vd - v0) * 0.5 + q * 9 + 4, 'eng.spring', S_.cylH(), 'VALVE SPRING'); if (stage >= 4) { const C2 = T(ang, vx, v0 + (vd - v0) * 0.36); D.circ(C2[0], C2[1], 15, 'chrome', S_.ball(), 'CAMSHAFT'); } }
      else { const tilt = e.chamber === 'hemi' ? 0.45 : 0.08; [[-1, li], [1, le]].forEach(([s, l]) => { const vx = s * hb * 0.48, d = l * 10, x1 = vx + s * tilt * 60; Q(ang, [[vx - 14, vd + 10 - d], [vx + 14, vd + 10 - d], [vx + 5, vd + 18 - d], [vx - 5, vd + 18 - d]], 'chrome', S_.cylV(), 'VALVE');
          const B0 = T(ang, vx, vd + 18 - d), B1 = T(ang, x1, vd + g.headH + 18 - d); D.bar(B0[0], B0[1], B1[0], B1[1], 3, 3, 'chrome', S_.cylV(), 'VALVE STEM'); const S0 = T(ang, (vx + x1) / 2 + s * 4, vd + g.headH - 18), S1 = T(ang, x1, vd + g.headH + 6); D.bar(S0[0], S0[1], S1[0], S1[1], 9, 9, 'eng.spring', S_.cylH(), 'VALVE SPRING'); });
        if (stage >= 4) { if (g.ohc) { const C = T(ang, 0, vd + g.headH + g.cover * 0.45); D.circ(C[0], C[1], 16, 'chrome', S_.ball(), 'CAMSHAFT'); if (e.head === 'dohc') { const C2 = T(ang, hb * 0.6, vd + g.headH + g.cover * 0.45); D.circ(C2[0], C2[1], 14, 'chrome', S_.ball(), 'CAMSHAFT'); } }
          else { const P0 = T(ang, hb + 18, v0 + 22), P1 = T(ang, hb + 22, vd + g.headH + 22); D.bar(P0[0], P0[1], P1[0], P1[1], 3, 3, 'chrome', S_.cylV(), 'PUSH ROD'); D.circ(P0[0], P0[1], 14, 'chrome', S_.ball(), 'CAMSHAFT'); const R0 = T(ang, -hb * 0.5, vd + g.headH + 22), R1 = T(ang, hb + 24, vd + g.headH + 22); D.bar(R0[0], R0[1], R1[0], R1[1], 5, 5, 'iron', S_.cylH(), 'ROCKER ARM'); } }
        if (g.cover && stage < 4) Q(ang, [[-hb - 22, vd + g.headH], [hb + 30, vd + g.headH], [hb + 20, vd + g.headH + g.cover], [-hb - 12, vd + g.headH + g.cover]], g.ohc ? 'alu' : 'black', S_.cast(2.4), 'VALVE COVER'); } }
    // induction on the inner / left side, exhaust on the outer / right side
    const ix = V ? (bi ? 1 : -1) * -1 : -1, mz = vd + (g.sv ? -40 : 34);
    if (stage >= 5) { const A0 = T(ang, ix * (hb + 30), mz), A1 = T(ang, ix * (hb + 120), mz + (V ? 70 : 0)); D.bar(A0[0], A0[1], A1[0], A1[1], 18, 22, 'alu', S_.cylH(), 'INTAKE MANIFOLD'); }
    if (stage >= 6) { const xo = -ix * (hb + 32 + ext), E0 = T(ang, xo, mz), E1 = T(ang, xo - ix * 80, mz - 70); D.bar(E0[0], E0[1], E1[0], E1[1], 20 * (e.exhDia ?? 1), 22 * (e.exhDia ?? 1), 'rust', S_.cylH(), 'EXHAUST MANIFOLD'); }
    if (stage >= 4 && !g.sv) { const C = T(ang, 0, vd + g.headH * 0.6); D.bar(C[0], C[1], C[0], C[1] + 44, 6, 6, 'white', S_.cylV(), 'SPARK PLUG'); } });
  if (stage >= 3) { const ph0 = cycleOf(e.layout, 0, th) * Math.PI / 180; D.poly(Array.from({ length: 18 }, (_, k2) => { const t = ph0 + Math.PI / 2 + k2 / 17 * Math.PI; return [Math.sin(t) * (e.cwt === 'yes' ? g.r * 0.95 : 26), Math.cos(t) * (e.cwt === 'yes' ? g.r * 0.95 : 26)]; }).concat([[0, 0]]), 'iron', S_.cast(2), 'COUNTERWEIGHT');
    D.circ(0, 0, 26, 'brass', S_.flat(3), 'MAIN BEARING'); D.circ(0, 0, 18, 'chrome', S_.ball(), 'MAIN JOURNAL'); }
  if (stage >= 5) { const C = V ? [0, (g.zd - g.zc + g.headH) * Math.cos(half * Math.PI / 180) + 70] : T(0, -e.bore / 2 - 120, g.zd - g.zc + (g.sv ? -40 : 34)), ct = e.carbType || (g.sv ? 'std' : 'down');
    if (ct === 'down' || V) { D.rect(C[0] - 26, C[1], C[0] + 26, C[1] + 70, 'brass', S_.cylV(), 'CARBURETTOR'); D.poly([[C[0] - 70, C[1] + 70], [C[0] + 70, C[1] + 70], [C[0] + 60, C[1] + 112], [C[0] - 60, C[1] + 112]], 'black', S_.cast(3), 'AIR CLEANER'); }
    else if (ct === 'side') { D.rect(C[0] - 70, C[1] - 26, C[0], C[1] + 26, 'brass', S_.cylH(), 'CARBURETTOR'); D.poly([[C[0] - 70, C[1] - 22], [C[0] - 110, C[1] - 34], [C[0] - 110, C[1] + 34], [C[0] - 70, C[1] + 22]], 'chrome', S_.cylH(), 'AIR HORN'); }
    else { D.rect(C[0] - 26, C[1] - 80, C[0] + 26, C[1], 'brass', S_.cylV(), 'CARBURETTOR'); D.poly([[C[0] - 22, C[1] - 80], [C[0] + 22, C[1] - 80], [C[0] + 36, C[1] - 140], [C[0] - 36, C[1] - 140]], 'black', S_.cylV(), 'AIR HORN'); } }
  for (let i = 0; i < D.px.r.length; i++) if (D.px.l[i] < -1) D.px.r[i] = 0;
  D.outline(); return D;
}

// ================= exterior =================
export function drawOutsidePix(P, e, th, w, h, stage = 8, rate = 0) {
  const g = engineGeo(e), D = frame(P, g, w, h), { bx0, bx1 } = g, col = paintOf(e), V = g.L.banks > 1, zt = g.zd + g.headH + g.cover;
  if (stage >= 3) D.poly([[bx1, g.zc - 200], [bx1 + 86, g.zc - 214], [bx1 + 96, g.zd - 20], [bx1, g.zd - 50]], 'alu', S_.cast(3), 'BELL HOUSING');
  if (stage >= 7) { D.poly([[bx0 + 30, g.sd + 8], [bx1 - 30, g.sd + 8], [bx1 - 50, 20], [bx1 - 76, 0], [bx0 + 76, 0], [bx0 + 50, 20]], 'black', S_.cast(2.2), 'OIL PAN'); D.rect(bx0 + 26, g.sd, bx1 - 26, g.sd + 10, 'black', S_.flat(3), 'PAN FLANGE');
    for (let q = bx0 + 40; q < bx1 - 30; q += 40) D.dot(q, g.sd + 5, 'chrome', 4); D.circ(bx1 - 110, 14, 9, 'chrome', S_.ball(), 'DRAIN PLUG'); }
  D.rect(bx0, g.sd + 8, bx1, g.zd, col, S_.cast(2.2), 'CYLINDER BLOCK'); D.rect(bx0, g.zd - 8, bx1, g.zd, col, S_.flat(3), 'CYLINDER BLOCK');
  for (let i = 0; i <= g.n; i++) { const x = g.x0 + g.pitch * i; D.rect(x - 4, g.sd + 30, x + 4, g.zd - 14, col, S_.cylV(), 'CASTING RIB'); }
  for (let i = 0; i < g.n; i++) { const x = g.x0 + g.pitch * (i + 0.5); D.circ(x, g.zc + g.r + 80, 18, col, S_.ball(), 'CORE PLUG'); D.circ(x, g.zc + g.r + 80, 12, col, () => 1, 'CORE PLUG'); }
  if (stage >= 2) { D.rect(bx0, g.zd, bx1, g.zd + 4, 'eng.gasket', S_.flat(3), 'HEAD GASKET'); D.poly([[bx0, g.zd + 4], [bx1, g.zd + 4], [bx1 - 6, g.zd + g.headH], [bx0 + 6, g.zd + g.headH]], e.material === 'alHead' ? 'alu' : col, S_.cast(2.8), 'CYLINDER HEAD');
    for (let q = bx0 + 18; q < bx1 - 8; q += g.pitch / 2) D.circ(q, g.zd + g.headH * 0.62, 9, 'iron', S_.ball(), 'HEAD BOLT');
    if (g.cover) { D.poly([[bx0 + 12, g.zd + g.headH], [bx1 - 12, g.zd + g.headH], [bx1 - 26, zt], [bx0 + 26, zt]], g.ohc ? 'alu' : 'black', S_.cylH(), 'VALVE COVER'); D.rect(bx0 + 96, zt, bx0 + 130, zt + 26, 'chrome', S_.cylV(), 'OIL FILLER'); for (const f of [0.3, 0.7]) D.circ(bx0 + (bx1 - bx0) * f, g.zd + g.headH + g.cover * 0.5, 8, 'chrome', S_.ball(), 'COVER BOLT'); }
    if (g.sv) D.poly([[bx0 + 4, g.zd + g.headH - 10], [bx0 + 80, g.zd + g.headH - 10], [bx0 + 70, g.zd + g.headH + 60], [bx0 + 10, g.zd + g.headH + 60]], col, S_.cast(3), 'WATER OUTLET'); }
  if (stage >= 4) for (let i = 0; i < g.n; i++) { const x = g.x0 + g.pitch * (i + 0.5), pz = g.sv ? g.zd + g.headH - 4 : g.zd + g.headH * 0.4; D.rect(x - 7, pz, x + 7, pz + 34, 'white', S_.cylV(), 'SPARK PLUG'); D.rect(x - 4, pz + 34, x + 4, pz + 46, 'chrome', S_.cylV(), 'SPARK PLUG'); }
  const ez = g.sv ? g.zd - 160 : g.zd + 8, mz = g.sv ? g.zd - 70 : g.zd + 70, ed = e.exhDia ?? 1;
  if (stage >= 6) { for (let i = 0; i < g.n; i++) D.rect(g.x0 + g.pitch * (i + 0.5) - 18, ez + 18, g.x0 + g.pitch * (i + 0.5) + 18, ez + 48, 'rust', S_.cast(2), 'EXHAUST PORT');
    D.rect(g.x0 + 10, ez - 30 * ed, bx1 - 26, ez + 30 * ed, 'rust', S_.cylH(), 'EXHAUST MANIFOLD'); const outs = e.exhManifold === 'split' || e.exhaust === 'dual' ? [0.3, 0.72] : [0.6];
    for (const o of outs) { const ox = g.x0 + g.n * g.pitch * o; D.bar(ox, ez - 10, ox + 50, g.sd - 30, 24 * ed, 24 * ed, 'rust', S_.cylV(), 'DOWN PIPE'); } }
  if (stage >= 5) { const mx0 = g.x0 + g.pitch * 0.4, mx1 = bx1 - g.pitch * 0.4 - 16; D.rect(mx0, mz, mx1, mz + 42, 'alu', S_.cylH(), 'INTAKE MANIFOLD'); const nC = e.carbs || 1, ct = e.carbType || (g.sv ? 'std' : 'down');
    for (let q = 0; q < nC; q++) { const cx = mx0 + (mx1 - mx0) * (q + 0.5) / nC;
      if (ct === 'down') { D.rect(cx - 32, mz + 42, cx + 32, mz + 112, 'brass', S_.cylV(), 'CARBURETTOR'); D.rect(cx + 32, mz + 52, cx + 52, mz + 92, 'brass', S_.cylV(), 'FLOAT BOWL'); D.poly([[cx - 90, mz + 112], [cx + 90, mz + 112], [cx + 80, mz + 176], [cx - 80, mz + 176]], 'black', S_.cylV(), 'AIR CLEANER'); D.rect(cx - 90, mz + 166, cx + 90, mz + 176, 'chrome', S_.flat(3), 'AIR CLEANER'); }
      else if (ct === 'side') { D.rect(cx - 30, mz - 6, cx + 30, mz + 62, 'brass', S_.cylV(), 'CARBURETTOR'); D.poly([[cx - 22, mz + 62], [cx + 22, mz + 62], [cx + 40, mz + 116], [cx - 40, mz + 116]], 'chrome', S_.cylV(), 'AIR HORN'); }
      else { D.rect(cx - 30, mz - 80, cx + 30, mz, 'brass', S_.cylV(), 'CARBURETTOR'); D.rect(cx + 30, mz - 66, cx + 50, mz - 26, 'brass', S_.cylV(), 'FLOAT BOWL'); D.poly([[cx - 24, mz - 80], [cx + 24, mz - 80], [cx + 38, mz - 142], [cx - 38, mz - 142]], 'black', S_.cylV(), 'AIR HORN'); } }
    D.rect(bx0 + 70, g.zc - 10, bx0 + 116, g.zc + 54, 'iron', S_.cylV(), 'FUEL PUMP'); }
  if (stage >= 4) { const dx = V ? bx1 - 70 : g.x0 + g.n * g.pitch * 0.62, dz = V ? zt + 40 : g.zd - 40; D.rect(dx - 22, dz - 70, dx + 22, dz + 16, 'black', S_.cylV(), 'DISTRIBUTOR'); D.poly([[dx - 34, dz + 16], [dx + 34, dz + 16], [dx + 26, dz + 58], [dx - 26, dz + 58]], 'eng.cap', S_.cylV(), 'DISTRIBUTOR CAP');
    for (let i = 0; i < g.n; i++) { const x = g.x0 + g.pitch * (i + 0.5), pz = (g.sv ? g.zd + g.headH - 4 : g.zd + g.headH * 0.4) + 46; D.bar(dx + (i - g.n / 2) * 6, dz + 54, x, pz, 2.5, 2.5, 'black', S_.flat(1), 'IGNITION LEAD'); } }
  const A = accGeo(e, g), cr = th * Math.PI / 180, pl0 = bx0 - 112, pl1 = bx0 - 92, minW = 2.2 / D.k;   // pulleys all sit in one plane in front of the timing cover
  if (stage >= 3) { D.poly([[bx0 - 2, g.sd + 20], [bx0 - 60, g.sd + 40], [bx0 - 64, g.zd - 30], [bx0 - 2, g.zd - 10]], col, S_.cast(1.8), 'TIMING COVER');
    D.rect(bx1 - 270, g.zc - 34, bx1 - 30, g.zc + 64, 'black', S_.cylH(), 'STARTER'); D.rect(bx1 - 300, g.zc - 4, bx1 - 270, g.zc + 34, 'chrome', S_.cylH(), 'STARTER');
    D.rect(pl1, g.zc - 20, bx0 - 60, g.zc + 20, 'chrome', S_.cylH(), 'CRANK SNOUT'); edgePulley(D, pl0, pl1, g.zc, A.crank.r, 'iron', cr, rate, 'CRANK PULLEY');
    if (e.balancer === 'damper') D.rect(pl0 - 14, g.zc - A.crank.r - 8, pl0, g.zc + A.crank.r + 8, 'rubber', S_.cylV(), 'HARMONIC DAMPER'); }
  if (stage >= 7) { const pz = g.zc + A.pump.z, gz = g.zc + A.gen.z, ap = cr * A.crank.r / A.pump.r, ag = cr * A.crank.r / A.gen.r;
    D.rect(bx0 - 60, gz - 40, bx0 + 140, gz + 40, 'black', S_.cylH(), 'GENERATOR'); for (const q of [0.25, 0.75]) D.rect(bx0 - 60 + 200 * q - 4, gz - 40, bx0 - 60 + 200 * q + 4, gz + 40, 'chrome', S_.cylV(), 'GENERATOR BAND');
    D.rect(pl1, gz - 8, bx0 - 60, gz + 8, 'chrome', S_.cylH(), 'GENERATOR SHAFT'); edgePulley(D, pl0, pl1, gz, A.gen.r, 'iron', ag, rate * A.crank.r / A.gen.r, 'GENERATOR PULLEY');
    if (e.cooling === 'thermo') { D.bar(bx0 + 40, g.zd + g.headH - 10, bx0 - 140, g.zd + g.headH + 110, 26, 26, 'rubber', S_.cylH(), 'RADIATOR HOSE'); D.rect(pl1, pz - 14, bx0 - 2, pz + 14, col, S_.cast(2.4), 'FAN BRACKET'); }
    else D.poly([[bx0 - 84, pz - 50], [bx0 - 4, pz - 60], [bx0 - 4, pz + 50], [bx0 - 84, pz + 40]], col, S_.cast(2.6), 'WATER PUMP');
    D.rect(pl1, pz - 8, bx0 - 84, pz + 8, 'chrome', S_.cylH(), e.cooling === 'thermo' ? 'FAN SPINDLE' : 'PUMP SHAFT'); edgePulley(D, pl0, pl1, pz, A.pump.r, 'iron', ap, rate * A.crank.r / A.pump.r, 'FAN PULLEY');
    // belt seen edge-on: one strip in the pulley plane from the lowest wrap to the highest, its joints running past
    const zb0 = Math.min(g.zc - A.crank.r, gz - A.gen.r, pz - A.pump.r) - 3, zb1 = Math.max(g.zc + A.crank.r, gz + A.gen.r, pz + A.pump.r) + 3, bw = Math.max(8, minW), xm = (pl0 + pl1) / 2, tv = cr * A.crank.r, fast = rate * Math.PI / 180 * A.crank.r > 9;
    D.rect(xm - bw / 2, zb0, xm + bw / 2, zb1, 'rubber', (x, y) => (fast ? 1 : (Math.floor(((D.oy - y) / D.k + tv) / 14) % 2 ? 1 : 2)), 'FAN BELT');
    D.rect(pl0 - 10, pz - 22, pl0, pz + 22, 'chrome', S_.cylV(), 'FAN HUB'); const fa = ap, fx0 = pl0 - 24, fx1 = pl0 - 10;
    if (rate * Math.PI / 180 * A.crank.r / A.pump.r > 0.35) D.rect(fx0, pz - A.fanR, fx1, pz + A.fanR, 'black', (x, y) => ((x + y) % 2 ? -9 : 1), 'FAN BLADE');
    else for (const off of [0, Math.PI / 2]) { const fl = A.fanR * Math.abs(Math.cos(fa + off)) + 14; D.rect(fx0 - (off ? 4 : 0), pz - fl, fx1 - (off ? 4 : 0), pz + fl, 'black', S_.cylV(), 'FAN BLADE'); }
    if (e.lube !== 'splash' && (e.year || 1940) >= 1935) { const fx2 = g.x0 + g.n * g.pitch * 0.82; D.rect(fx2 - 42, g.zc + 34, fx2 + 42, g.zc + 190, 'eng.filter', S_.cylV(), 'OIL FILTER'); D.rect(fx2 - 46, g.zc + 190, fx2 + 46, g.zc + 204, 'chrome', S_.flat(3), 'OIL FILTER'); }
    D.bar(bx0 + 160, g.zd - 30, bx0 + 150, zt + 40, 3, 3, 'chrome', S_.flat(3), 'DIPSTICK'); D.circ(bx0 + 150, zt + 46, 8, 'chrome', S_.ball(), 'DIPSTICK'); }
  D.outline(); return D;
}
// palette entries the drawings use (registered once by the game / sample sheets)
// ---- accessory drive: crank, water pump / fan and generator pulleys, in mm from the crank centre (x across the engine, z up) ----
function accGeo(e, g) { const V = g.L.banks > 1, vd = g.zd - g.zc;
  return { V, crank: { x: 0, z: 0, r: 60 }, pump: { x: 0, z: V ? g.r + 150 : vd * 0.75, r: 48 }, gen: { x: V ? -230 : -(e.bore / 2 + 115), z: V ? g.r + 130 : vd * 0.42, r: 32 }, fanR: Math.min(200, 120 + e.bore * 0.55) }; }
// a pulley seen edge-on (side view): a short drum with a V groove and a glint that runs round with it
function edgePulley(D, x0, x1, zc, r, ramp, ang, rate, name) { const gy = D.Y(zc + r * Math.sin(ang)), blur = Math.abs(rate) * Math.PI / 180 > 0.6;
  return D.rect(x0, zc - r, x1, zc + r, ramp, (x, y, u, v) => { const groove = u > 0.3 && u < 0.7 ? -1 : 0, glint = !blur && Math.abs(y - gy) < 1 && u < 0.3 ? 2 : 0; return Math.max(0, Math.min(4, Math.round(3.6 - Math.abs(v - 0.35) * 3.4) + groove + glint)); }, name); }
// a pulley seen face-on (front view): rim, groove, web and three bolt holes turning with it; a blur ring once it spins too fast to follow
function facePulley(D, cx, cz, r, ramp, ang, rate, name) { D.circ(cx, cz, r, ramp, S_.ball(), name); D.circ(cx, cz, r - 6, 'black', S_.flat(1), name); D.circ(cx, cz, r - 9, ramp, S_.ball(), name); D.circ(cx, cz, Math.max(6, r * 0.22), 'chrome', S_.ball(), name);
  if (Math.abs(rate) * Math.PI / 180 > 0.6) { D.circ(cx, cz, r * 0.62, ramp, (x, y) => ((x + y) % 2 ? 1 : -9), name); return; }
  for (let q = 0; q < 3; q++) { const a = ang + q * 2.0944; D.circ(cx + Math.cos(a) * r * 0.55, cz + Math.sin(a) * r * 0.55, Math.max(4, r * 0.13), 'black', S_.flat(0), name); } }
// the belt path round the pulleys: outer tangents between neighbours and arcs on each pulley, as points with running length
function beltPath(C) { const cx = C.reduce((a, c) => a + c.x, 0) / C.length, cz = C.reduce((a, c) => a + c.z, 0) / C.length, L = C.slice().sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx)), n = L.length, tan = [];
  for (let i = 0; i < n; i++) { const a = L[i], b = L[(i + 1) % n], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, c = (a.r - b.r) / d, sn = Math.sqrt(Math.max(0, 1 - c * c));
    const nx = ux * c + uz * sn, nz = uz * c - ux * sn; tan.push({ nx, nz, p: [a.x + a.r * nx, a.z + a.r * nz], q: [b.x + b.r * nx, b.z + b.r * nz] }); }
  const pts = []; for (let i = 0; i < n; i++) { const c = L[i], tin = tan[(i - 1 + n) % n], tout = tan[i]; let a0 = Math.atan2(tin.nz, tin.nx), a1 = Math.atan2(tout.nz, tout.nx); while (a1 < a0) a1 += 2 * Math.PI;
    for (let a = a0; a <= a1 + 1e-6; a += 0.12) pts.push([c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); pts.push(tout.p, tout.q); }
  let s0 = 0; return pts.map((p, i) => { if (i) s0 += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return { x: p[0], z: p[1], s: s0 }; }); }

export function drawFrontPix(P, e, th, w, h, stage = 8, rate = 0) {
  const g = engineGeo(e), A = accGeo(e, g), V = A.V, flat = e.layout === 'F4', half = V ? (flat ? 90 : e.layout === 'V12' || e.layout === 'V6' ? 30 : 45) : 0, col = paintOf(e), alu = e.material === 'alHead' ? 'alu' : col;
  const reach = g.zd - g.zc + g.headH + g.cover + 40, spanW = Math.max(V ? 2 * (reach * Math.sin(half * Math.PI / 180) + 170) : 560, 2 * (A.fanR + 40), 2 * (-A.gen.x + A.gen.r + 60)), spanH = (V && !flat ? reach * Math.cos(half * Math.PI / 180) : reach) + g.zc + 60;
  const k = Math.min((w - 6) / spanW, (h - 6) / spanH), D = new Draw(P, w, h, k, w / 2, h - 3 - (h - 6 - spanH * k) / 2 - g.zc * k);
  const T = (ang, u, v) => { const a = ang * Math.PI / 180; return [u * Math.cos(a) + v * Math.sin(a), -u * Math.sin(a) + v * Math.cos(a)]; };
  const Q = (ang, pts, ramp, shade, name) => D.poly(pts.map(([u, v]) => T(ang, u, v)), ramp, shade, name), R = (ang, u0, v0, u1, v1, ramp, shade, name) => Q(ang, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], ramp, shade, name);
  if (stage >= 7) D.poly([[-170, -g.zc + g.sd], [170, -g.zc + g.sd], [150, -g.zc + 10], [-150, -g.zc + 10]], 'black', S_.cast(2), 'OIL PAN');
  D.circ(0, 0, g.r + 74, col, S_.cast(2.2), 'CRANKCASE');
  const vd = g.zd - g.zc, hb = e.bore / 2, ext = g.sv ? e.bore * 0.8 : 0, v0 = g.r + 46;
  (V ? [-half, half] : [0]).forEach((ang, bi) => { Q(ang, [[-hb - 30, v0], [hb + 30 + ext, v0 + (g.sv ? 40 : 0)], [hb + 30 + ext, vd], [-hb - 30, vd]], col, S_.cast(2.4), 'CYLINDER BLOCK');
    if (stage >= 2) { R(ang, -hb - 32, vd, hb + 32 + ext, vd + 4, 'eng.gasket', S_.flat(3), 'HEAD GASKET'); R(ang, -hb - 30, vd + 4, hb + 30 + ext, vd + g.headH, alu, S_.cast(2.8), 'CYLINDER HEAD');
      if (g.cover) R(ang, -hb - 20, vd + g.headH, hb + 26, vd + g.headH + g.cover, g.ohc ? 'alu' : 'black', S_.cylH(), 'VALVE COVER'); }
    const side = V ? (bi ? 1 : -1) : 1;
    if (stage >= 6) R(ang, side > 0 ? hb + 30 + ext : -hb - 70, vd - 70, side > 0 ? hb + 70 + ext : -hb - 30, vd - 20, 'rust', S_.cylH(), 'EXHAUST MANIFOLD');
    if (stage >= 5 && !V) R(ang, -hb - 80, vd - (g.sv ? 60 : -30), -hb - 30, vd + (g.sv ? -10 : 80), 'alu', S_.cylH(), 'INTAKE MANIFOLD'); });
  if (stage >= 5 && V) D.rect(-60, g.r + 200, 60, g.r + 250, 'alu', S_.cylH(), 'INTAKE MANIFOLD');
  if (stage >= 3) { D.poly([[-95, -40], [95, -40], [110, 60], [40, vd * 0.6], [-40, vd * 0.6], [-110, 60]], col, S_.cast(3), 'TIMING COVER'); for (let q = 0; q < 6; q++) { const a = q * 1.047; D.dot(Math.cos(a) * 84, 10 + Math.sin(a) * 60, 'chrome', 4); } }
  const cr = th * Math.PI / 180;
  if (stage >= 7) { const ap = cr * A.crank.r / A.pump.r, ag = cr * A.crank.r / A.gen.r;
    if (e.cooling === 'thermo') D.bar(0, A.pump.z, 0, A.pump.z - 70, 18, 22, col, S_.cast(2.4), 'FAN BRACKET'); else D.poly([[-56, A.pump.z - 70], [56, A.pump.z - 70], [64, A.pump.z + 30], [-64, A.pump.z + 30]], col, S_.cast(2.6), 'WATER PUMP');
    D.bar(A.gen.x * 0.4, A.gen.z * 0.5, A.gen.x, A.gen.z, 8, 8, 'iron', S_.flat(2), 'GENERATOR BRACKET'); D.circ(A.gen.x, A.gen.z, 58, 'black', S_.ball(), 'GENERATOR'); D.bar(A.gen.x, A.gen.z, A.gen.x + 80, A.gen.z + 70, 6, 6, 'iron', S_.flat(2), 'ADJUSTING STRAP');
    facePulley(D, A.gen.x, A.gen.z, A.gen.r, 'iron', ag, rate * A.crank.r / A.gen.r, 'GENERATOR PULLEY'); facePulley(D, A.pump.x, A.pump.z, A.pump.r, 'iron', ap, rate * A.crank.r / A.pump.r, 'FAN PULLEY'); }
  if (stage >= 3) { if (e.balancer === 'damper') D.circ(0, 0, A.crank.r + 10, 'rubber', S_.ball(), 'HARMONIC DAMPER'); facePulley(D, 0, 0, A.crank.r, 'iron', cr, rate, 'CRANK PULLEY'); }
  if (stage >= 7) { // belt: joints run along the path at crank speed x crank pulley radius; a plain strip once too fast to follow
    const path = beltPath([A.crank, A.pump, A.gen].map(c => ({ ...c }))), tv = cr * A.crank.r, fast = rate * Math.PI / 180 * A.crank.r > 9, bw = Math.max(8, 2.4 / k);
    for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], seg = Math.hypot(b.x - a.x, b.z - a.z); if (seg < 0.01) continue; const m = Math.max(1, Math.ceil(seg / 7));
      for (let j = 0; j < m; j++) { const t0 = j / m, t1 = (j + 1) / m, sm = a.s + seg * (t0 + t1) / 2, lv = fast ? 1 : Math.floor((sm - tv) / 14) % 2 ? 1 : 2;
        D.bar(a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0, a.x + (b.x - a.x) * t1, a.z + (b.z - a.z) * t1, bw / 2, bw / 2, 'rubber', () => lv, 'FAN BELT'); } }
    const ap = cr * A.crank.r / A.pump.r; D.circ(0, A.pump.z, 26, 'chrome', S_.ball(), 'FAN HUB');
    if (rate * Math.PI / 180 * A.crank.r / A.pump.r > 0.35) D.circ(0, A.pump.z, A.fanR, 'black', (x, y) => ((x + y) % 2 ? -9 : 1), 'FAN BLADE');
    else for (let q = 0; q < 4; q++) { const a = ap + q * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); D.bar(ca * 24, A.pump.z + sa * 24, ca * A.fanR, A.pump.z + sa * A.fanR, 10, 24, 'black', S_.cylH(), 'FAN BLADE'); }
    D.circ(0, A.pump.z, 12, 'chrome', S_.ball(), 'FAN HUB'); }
  D.outline(); return D;
}
export function engPalette(P) { const add = (n, h, o) => { try { P.id(n); } catch { P.auto(n, h, o); } };
  add('eng.water', '#4f86b8'); add('eng.oil', '#b8892c'); add('eng.in', '#5b8fd0'); add('eng.cmp', '#d99a3a'); add('eng.pow', '#d0482c'); add('eng.exh', '#8a827a', { sat: 0.2 });
  add('eng.gasket', '#b06a3a'); add('eng.spring', '#8f969d', { sat: 0.2 }); add('eng.cap', '#6b2a22'); add('eng.spark', '#fff2a0'); add('eng.filter', '#c8642a'); return P; }
export { Draw, S_ };
