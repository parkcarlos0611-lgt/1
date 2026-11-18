// Free placement of front / rear parts (plan 17). Offsets are stored once in mm; specs are half-drawings mirrored about the
// centre line, so headlamps, tail lamps and guards always stay symmetric. Heights are shared with the side view.
export const POS0 = { lampDY: 0, lampDZ: 0, lampK: 1, grilleDZ: 0, grilleW: 1, grilleH: 1, bumperDZ: 0, bumperW: 1, tailDY: 0, tailDZ: 0, rBumperDZ: 0 };
export const POS_R = { lampDY: [-240, 240], lampDZ: [-220, 220], lampK: [0.8, 1.25], grilleDZ: [-120, 160], grilleW: [0.7, 1.35], grilleH: [0.7, 1.25], bumperDZ: [-90, 120], bumperW: [0.88, 1.12], tailDY: [-220, 220], tailDZ: [-200, 260], rBumperDZ: [-90, 120] };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function clampPos(pos) { for (const k of Object.keys(POS0)) pos[k] = clamp(pos[k] ?? POS0[k], POS_R[k][0], POS_R[k][1]); return pos; }
const each = (o, f) => { if (Array.isArray(o)) { if (o.length >= 2 && o.length <= 4 && o.every(v => typeof v === 'number')) f(o); else o.forEach(v => each(v, f)); } };
const bb = list => { let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; each(list, p => { y0 = Math.min(y0, p[0]); y1 = Math.max(y1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); return { y0, y1, z0, z1 }; };
// front / rear half-spec: move the parts, keep them inside the car, report overlaps and the handle positions
export function placeFront(f, pos, rear = false) {
  if (!pos) return f; const half = (f.width - 160) / 2, warn = [], handles = [];
  const bum = (f.bumpers || []).length ? bb(f.bumpers.map(b => b.pts)) : null, dzB = rear ? pos.rBumperDZ : pos.bumperDZ;
  if (bum) { for (const b of f.bumpers) each(b.pts, p => { p[0] *= rear ? 1 : pos.bumperW; p[1] += dzB; }); for (const q of f.parts || []) if (q.guard) each(q.pts, p => { p[1] += dzB; });
    handles.push({ k: rear ? 'rBumperDZ' : 'bumperDZ', y: 0, z: (bum.z0 + bum.z1) / 2 + dzB, ax: 'z' }); if (!rear) handles.push({ k: 'bumperW', y: bum.y1 * pos.bumperW, z: (bum.z0 + bum.z1) / 2 + dzB, ax: 'x', base: bum.y1 }); }
  const bTop = bum ? bum.z1 + dzB : 300, top = f.cowlZ || (f.hood ? f.hood.top + 80 : f.height * 0.62);
  if (!rear && (f.grilles || []).some(g => g.half)) { const gs = f.grilles.filter(g => g.half), g0 = bb(gs.map(g => g.pts));
    for (const g of f.grilles) each(g.pts, p => { if (g.half) { p[0] *= pos.grilleW; p[1] = g0.z0 + (p[1] - g0.z0) * pos.grilleH + pos.grilleDZ; } else p[1] += pos.grilleDZ; });
    const g1 = bb(gs.map(g => g.pts)); f.grilleBox = g1; f.grilleArea = pos.grilleW * pos.grilleH;
    handles.push({ k: 'grilleDZ', y: 0, z: g1.z1, ax: 'z' }, { k: 'grilleW', y: g1.y1, z: (g1.z0 + g1.z1) / 2, ax: 'x', base: g0.y1 }); }
  const main = (f.lamps || []).filter(l => !l.fog && l.ramp === (rear ? 'lensR' : 'lensW') && (l.pts || l.r >= 50))[0];
  if (main) { const dy = rear ? pos.tailDY : pos.lampDY, dz = rear ? pos.tailDZ : pos.lampDZ, k = rear ? 1 : pos.lampK;
    if (main.pts) { const c = bb([main.pts]), cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2, hw = (c.y1 - c.y0) / 2, hh = (c.z1 - c.z0) / 2; if (cy > 1) { const ny = clamp(cy + dy, hw + 20, half - hw * 0.4), nz = clamp(cz + dz, bTop + hh, f.height - hh - 200); each(main.pts, p => { p[0] += ny - cy; p[1] += nz - cz; }); handles.push({ k: rear ? 'tail' : 'lamp', y: ny, z: nz, ax: 'xy' }); } }
    else if (main.y > 1) { const oy = main.y, oz = main.z, r = main.r * k, ny = clamp(oy + dy, r * 0.9, half - r * 0.4), nz = clamp(oz + dz, bTop + r, top - r * 0.2);
      for (const u of f.under || []) { if (u.half || !u.pts || u.pts.length < 12) continue; const c = bb([u.pts]), cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2; if (Math.abs(Math.abs(cy) - oy) < 40 && Math.abs(cz - oz) < 40) { const sg = cy < 0 ? -1 : 1; each(u.pts, p => { p[0] = sg * ny + (p[0] - cy) * k; p[1] = nz + (p[1] - cz) * k; }); } }   // the nacelle follows its lamp
      main.y = ny; main.z = nz; main.r = r; handles.push({ k: rear ? 'tail' : 'lamp', y: ny, z: nz, ax: 'xy' });
      if (!rear && f.grilleBox && ny - r < f.grilleBox.y1 - 10 && nz + r > f.grilleBox.z0 && nz - r < f.grilleBox.z1) warn.push('LAMPS OVERLAP THE GRILLE'); } }
  f.handles = handles; f.warn = warn; return f; }
// side view: the same heights (and lamp size) as the front
export function placeSide(s, pos) {
  if (!pos) return s; for (const l of s.lamps || []) { if (!l.e) continue; if (l.ramp === 'lensW') l.e = [l.e[0], l.e[1] + pos.lampDZ, l.e[2] * pos.lampK, l.e[3] * pos.lampK]; if (l.ramp === 'lensR') l.e = [l.e[0], l.e[1] + pos.tailDZ, l.e[2], l.e[3]]; }
  const bs = s.bumperSets || []; if (bs[0]) bs[0].zs = bs[0].zs.map(z => z + pos.bumperDZ); if (bs[1]) bs[1].zs = bs[1].zs.map(z => z + pos.rBumperDZ); return s; }
