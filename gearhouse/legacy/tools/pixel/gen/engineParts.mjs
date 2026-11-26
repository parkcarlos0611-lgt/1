// Part-built engine (stage C): the side view is assembled from separately drawn parts whose sizes and positions come from the
// design (cylinders x bore pitch, stroke, valvetrain, carburettor type/count, manifolds, cooling, lubrication).
// Each part is its own Pix with its assembled position, so the same set gives the exterior view, the exploded view
// and the build-up animation, and a failing part can be shown on its own.
import { Pix, Mask } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { dith } from './car.mjs';
import { LAYOUTS, HEADS } from '../../../sim/engine.mjs';

export const PART_NAMES = { sump: 'OIL PAN', block: 'CYLINDER BLOCK', crank: 'CRANKSHAFT', pistons: 'PISTONS AND RODS', head: 'CYLINDER HEAD', cover: 'VALVE COVER', intake: 'INTAKE MANIFOLD', carbs: 'CARBURETTOR',
  exhaust: 'EXHAUST MANIFOLD', water: 'WATER PUMP AND FAN', generator: 'GENERATOR', distributor: 'DISTRIBUTOR', filter: 'OIL FILTER', starter: 'STARTER', timing: 'TIMING COVER', bell: 'BELL HOUSING' };
export const FAIL_PARTS = { 'MAIN BEARINGS': ['crank', 'block'], VALVES: ['head', 'cover'], 'HEAD GASKET': ['head'], COOLING: ['water'], PISTONS: ['pistons'], CRANKSHAFT: ['crank'] };
export const BUILD_ORDER = ['block', 'crank', 'pistons', 'head', 'cover', 'sump', 'timing', 'intake', 'carbs', 'exhaust', 'water', 'generator', 'distributor', 'filter', 'starter', 'bell'];
export const engineColour = e => e.color || (e.head === 'sv' && LAYOUTS[e.layout].banks === 1 ? 'paint.enginegreen' : e.head === 'sv' ? 'paint.engineGrey' : LAYOUTS[e.layout].cyl === 6 ? 'paint.engineGrey' : 'paint.enginered');

export function buildEngineParts(P, e, es, mm = 12) {
  const L = LAYOUTS[e.layout], V = L.banks > 1, perBank = L.cyl / L.banks, pitch = e.bore + 22 + (V ? 10 : 0), col = engineColour(e);
  const blockLen = perBank * pitch + (V ? pitch * 0.5 : 0) + 30, sd = 80 + 60 * (e.oil ?? 1), zCrank = sd + 30, zDeck = zCrank + e.stroke * (V ? 1.7 : 2.3);
  const sv = e.head === 'sv', ohc = e.head === 'sohc' || e.head === 'dohc', headH = sv ? 70 : 85, coverH = sv ? 0 : ohc ? 120 : 95;
  const W = blockLen + 520, Hh = zDeck + headH + coverH + 360, pad = 3, cw = Math.ceil(W / mm) + pad * 2, ch = Math.ceil(Hh / mm) + pad * 2;
  const X = x => (x + 260) / mm + pad, Z = z => ch - pad - (z + 40) / mm, R = v => v / mm;
  const parts = [];
  const part = (id, draw) => { const px = new Pix(cw, ch); const M = () => new Mask(cw, ch);
    const fill = (m, ramp, { base = 2, grad = null, edge = true } = {}) => { const r = P.id(ramp), bb = m.bbox(); if (bb.x1 < 0) return m;
      for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { if (!m.get(x, y)) continue; let lv = grad ? dith(x, y, grad[0] + (grad[1] - grad[0]) * (y - bb.y0) / Math.max(1, bb.y1 - bb.y0)) : base;
        if (edge) { if (!m.get(x, y - 1)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1) || !m.get(x + 1, y)) lv = Math.max(0, lv - 1); } px.set(x, y, r, Math.max(0, Math.min(4, Math.round(lv))), 40); } return m; };
    const poly = (pts, r = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([x, z]) => [X(x), Z(z)]));
    const rect = (x0, z0, x1, z1, r = 0) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], r), circ = (x, z, rr) => M().circle(X(x), Z(z), Math.max(0.7, R(rr)));
    const dot = (x, z, ramp, lv) => px.set(Math.round(X(x)), Math.round(Z(z)), P.id(ramp), lv, 41);
    draw({ fill, poly, rect, circ, dot, M });
    // outline + crop to the part
    const mark = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { if (!px.ramp(x, y)) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !px.ramp(x + dx, y + dy))) mark.push(y * cw + x); }
    for (const i of mark) px.l[i] = -1;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (px.ramp(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return; const c = new Pix(x1 - x0 + 1, y1 - y0 + 1); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * cw + x; if (px.r[i]) c.set(x - x0, y - y0, px.r[i], px.l[i], px.t[i]); }
    parts.push({ id, name: PART_NAMES[id], px: c, x: x0, y: y0 }); };
  const b0 = 0, b1 = blockLen;
  // ---- block, crankcase, core plugs ----
  part('block', d => { d.fill(d.poly(V ? [[b0, zCrank - 20], [b1, zCrank - 20], [b1, zDeck], [b0 + 60, zDeck], [b0, zDeck - 60]] : [[b0, zCrank - 20], [b1, zCrank - 20], [b1, zDeck], [b0, zDeck]], 20), col, { grad: [3.2, 1.4] });
    for (let k = 0; k < perBank; k++) { const xc = 30 + pitch * (k + 0.5) + (V ? pitch * 0.25 : 0); d.fill(d.circ(xc, zCrank + e.stroke * 1.1, 18), col, { base: 1 }); }   // core plugs
    for (let x = 40; x < b1 - 20; x += pitch) d.fill(d.rect(x, zDeck - 18, x + 6, zDeck - 6), col, { base: 3, edge: false }); });
  part('sump', d => d.fill(d.poly([[b0 + 40, zCrank - 20], [b1 - 30, zCrank - 20], [b1 - 50, 20, 30], [b0 + 90, 0, 40]], 20), 'black', { grad: [2.6, 0.8] }));
  part('crank', d => { d.fill(d.rect(b0 - 60, zCrank - 14, b1 + 40, zCrank + 14), 'iron', { base: 3 }); for (let k = 0; k < perBank; k++) { const xc = 30 + pitch * (k + 0.5); d.fill(d.rect(xc - 16, zCrank - e.stroke / 2 - 10, xc + 16, zCrank + e.stroke / 2 + 10, 8), 'iron', { base: 2 });
    if (e.cwt === 'yes') d.fill(d.circ(xc + pitch * 0.35, zCrank, e.stroke * 0.45), 'iron', { base: 1 }); } d.fill(d.circ(b1 + 60, zCrank, 90), 'iron', { base: 2 }); });   // throws, counterweights, flywheel
  part('pistons', d => { for (let k = 0; k < perBank; k++) { const xc = 30 + pitch * (k + 0.5), zp = zCrank + e.stroke * 1.25; d.fill(d.rect(xc - e.bore / 2 + 3, zp, xc + e.bore / 2 - 3, zp + e.bore * 0.9, 4), e.pistons === 'alu' ? 'alu' : 'iron', { base: 3 });
    for (let r2 = 0; r2 < 3; r2++) d.fill(d.rect(xc - e.bore / 2 + 3, zp + e.bore * 0.6 + r2 * 9, xc + e.bore / 2 - 3, zp + e.bore * 0.6 + r2 * 9 + 3), 'black', { base: 1, edge: false });
    d.fill(d.poly([[xc - 9, zp + 10], [xc + 9, zp + 10], [xc + 13, zCrank + 6], [xc - 13, zCrank + 6]]), 'iron', { base: 2 }); } });
  // ---- head and valve / cam cover ----
  const hz = zDeck, hx0 = b0 + (V ? 50 : 10), hx1 = b1 - 10;
  part('head', d => { d.fill(d.poly([[hx0, hz], [hx1, hz], [hx1 - 10, hz + headH, 14], [hx0 + 10, hz + headH, 14]]), sv ? col : e.material === 'alHead' ? 'alu' : col, { grad: [3.4, 1.8] });
    for (let x = hx0 + 25; x < hx1 - 15; x += pitch / 2) d.dot(x, hz + headH * (sv ? 0.7 : 0.4), 'black', 0);                                                           // head bolts
    if (sv) { d.fill(d.poly([[hx0 - 10, hz + headH * 0.5], [hx0 + 60, hz + headH * 0.5], [hx0 + 50, hz + headH + 45, 12], [hx0 - 5, hz + headH + 45, 12]]), col, { base: 3 });   // water outlet
      if (e.chamber === 'ricardo') d.fill(d.rect(hx0 + 80, hz + headH - 8, hx1 - 40, hz + headH - 2), col, { base: 4, edge: false }); } });
  if (!sv) part('cover', d => { const z0 = hz + headH - 5; d.fill(d.poly([[hx0 + 15, z0], [hx1 - 15, z0], [hx1 - 30, z0 + coverH, 40], [hx0 + 30, z0 + coverH, 40]]), ohc ? 'alu' : e.chamber === 'hemi' ? 'paint.enginered' : 'black', { grad: [3.6, 1.6] });
    d.fill(d.rect(hx0 + 70, z0 + coverH - 4, hx0 + 110, z0 + coverH + 30, 8), 'chrome', { base: 3 });                                                                // oil filler
    for (const x of [hx0 + 0.3 * (hx1 - hx0), hx0 + 0.7 * (hx1 - hx0)]) d.dot(x, z0 + coverH * 0.6, 'chrome', 4);
    if (ohc) d.fill(d.poly([[hx0 - 40, hz - 40], [hx0 + 30, hz - 40], [hx0 + 30, z0 + coverH], [hx0 - 20, z0 + coverH - 20, 20]]), 'alu', { base: 2 }); });          // cam drive housing
  // ---- intake: updraft (carb hangs below the manifold), downdraft (on top, oil-bath cleaner), side-draft (bell mouths) ----
  const nC = e.carbs || 1, ct = e.carbType || (sv ? 'std' : 'down'), mz = V ? zDeck + headH + 10 : sv ? zDeck - 70 : zDeck + 10, mx0 = b0 + blockLen * 0.18, mx1 = b1 - blockLen * 0.18;
  part('intake', d => d.fill(d.poly([[mx0, mz], [mx1, mz], [mx1, mz + 45, 10], [mx0, mz + 45, 10]]), V ? col : 'iron', { grad: [3.2, 1.5] }));
  part('carbs', d => { for (let k = 0; k < nC; k++) { const cx = mx0 + (mx1 - mx0) * (k + 0.5) / nC;
    if (ct === 'down') { d.fill(d.rect(cx - 30, mz + 45, cx + 30, mz + 110, 6), 'brass', { base: 2 }); d.fill(d.poly([[cx - 85, mz + 110], [cx + 85, mz + 110], [cx + 75, mz + 175, 30], [cx - 75, mz + 175, 30]]), 'black', { grad: [3.2, 1] }); }   // oil-bath air cleaner
    else if (ct === 'side') { d.fill(d.rect(cx - 28, mz + 5, cx + 28, mz + 60, 6), 'brass', { base: 2 }); d.fill(d.poly([[cx - 20, mz + 60], [cx + 20, mz + 60], [cx + 34, mz + 110], [cx - 34, mz + 110]]), 'chrome', { base: 3 }); }
    else { d.fill(d.rect(cx - 28, mz - 75, cx + 28, mz, 6), 'brass', { base: 2 }); d.fill(d.poly([[cx - 22, mz - 75], [cx + 22, mz - 75], [cx + 36, mz - 140, 10], [cx - 36, mz - 140, 10]]), 'black', { base: 1 }); } } });   // updraft + air horn
  // ---- exhaust: log or split manifold, one or two down-pipes ----
  const ez = V ? zDeck - 40 : sv ? zDeck - 150 : zDeck - 60;
  part('exhaust', d => { const split = e.exhManifold === 'split'; d.fill(d.poly([[b0 + 40, ez], [b1 - 40, ez], [b1 - 50, ez + 50, 16], [b0 + 50, ez + 50, 16]]), 'rust', { grad: [2.6, 1] });
    if (split) d.fill(d.rect((b0 + b1) / 2 - 6, ez, (b0 + b1) / 2 + 6, ez + 50), 'rust', { base: 0, edge: false });
    const outs = split || e.exhaust === 'dual' ? [b0 + blockLen * 0.3, b0 + blockLen * 0.7] : [b0 + blockLen * 0.55];
    for (const x of outs) d.fill(d.poly([[x - 22, ez + 4], [x + 22, ez + 4], [x + 34, ez - 110, 14], [x - 2, ez - 116, 14]]), 'rust', { base: 1 }); });
  // ---- front: timing cover, water pump + fan (or thermosyphon hose), generator on a belt ----
  part('timing', d => d.fill(d.poly([[b0 - 50, zCrank - 40], [b0 + 5, zCrank - 40], [b0 + 5, zDeck - 40], [b0 - 30, zDeck - 80, 30]], 20), col, { base: 2 }));
  part('water', d => { const wz = zDeck - 40; if (e.cooling === 'thermo') { d.fill(d.poly([[b0 - 10, wz + 20], [b0 + 40, wz + 20], [b0 - 60, wz + 160, 30], [b0 - 110, wz + 150, 30]]), 'rubber', { base: 2 }); return; }
    d.fill(d.rect(b0 - 110, wz - 50, b0 - 10, wz + 40, 12), col, { base: 3 }); d.fill(d.rect(b0 - 160, wz - 230, b0 - 140, wz + 220, 6), 'black', { base: 1 });   // pump body, fan blades edge-on
    d.fill(d.circ(b0 - 150, wz - 5, 28), 'iron', { base: 3 }); });
  part('generator', d => { const gz = zDeck - (V ? 0 : 40), gx = b0 - 40; d.fill(d.rect(gx, gz, gx + 170, gz + 90, 40), 'black', { grad: [3.4, 1] }); d.fill(d.circ(gx - 12, gz + 45, 38), 'iron', { base: 3 });
    for (let x = gx + 40; x < gx + 150; x += 40) d.dot(x, gz + 45, 'chrome', 3); });
  part('distributor', d => { const dx = V ? b1 - 60 : b0 + blockLen * 0.62, dz = V ? zDeck + headH + 60 : zDeck - 20; d.fill(d.rect(dx - 22, dz - 70, dx + 22, dz + 20, 6), 'black', { base: 2 }); d.fill(d.poly([[dx - 34, dz + 20], [dx + 34, dz + 20], [dx + 24, dz + 60, 14], [dx - 24, dz + 60, 14]]), 'paint.enginered', { base: 2 }); });
  if (e.lube !== 'splash' && (e.year || 1940) >= 1935) part('filter', d => { const fx = b0 + blockLen * 0.78, fz = zCrank + 40; d.fill(d.rect(fx - 40, fz, fx + 40, fz + 150, 20), 'paint.engineOrange', { grad: [3.4, 1.2] }); d.fill(d.rect(fx - 44, fz + 150, fx + 44, fz + 165), 'chrome', { base: 3 }); });
  part('starter', d => { const sx = b1 - 40, sz = zCrank - 10; d.fill(d.rect(sx - 230, sz, sx, sz + 95, 40), 'black', { grad: [3.2, 1] }); d.fill(d.rect(sx - 260, sz + 25, sx - 230, sz + 70, 10), 'iron', { base: 3 }); });
  part('bell', d => d.fill(d.poly([[b1, zCrank - 150], [b1 + 60, zCrank - 170], [b1 + 70, zDeck - 10, 30], [b1, zDeck - 40]], 30), 'alu', { grad: [3.4, 1.4] }));
  return { parts, w: cw, h: ch, mm };
}
// exploded offsets (pixels): parts lifted / dropped / pulled forward so each can be named
export function explodedOffsets(set) { const u = Math.max(4, Math.round(70 / set.mm));
  const off = { head: [0, -3 * u], cover: [0, -5 * u], pistons: [0, -1.6 * u], crank: [0, 1.6 * u], sump: [0, 3.2 * u], intake: [0, -6.5 * u], carbs: [0, -8 * u], exhaust: [0, 2 * u], timing: [-2 * u, 0],
    water: [-3.5 * u, -1 * u], generator: [-1 * u, -2 * u], distributor: [2 * u, -7 * u], filter: [1 * u, 3 * u], starter: [2 * u, 4 * u], bell: [3 * u, 0], block: [0, 0] };
  for (const k of Object.keys(off)) off[k] = off[k].map(Math.round);   // whole pixels only
  return off; }
