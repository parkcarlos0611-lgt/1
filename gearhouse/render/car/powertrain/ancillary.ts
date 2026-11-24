// What stands round the engine (docs/systems/101, part 1-3): the cooling (a radiator in the nose with its fans, the
// water's two pipes back down the tunnel to the engine, the header tank), the oil (a cooler in the bay with its lines;
// a dry sump's tank), the fuel tank (across the car ahead of an engine set across it; a saddle tank each side of one
// set along it), the battery in the nose; and the chassis the powertrain hangs in: the rear subframe (two rails, cross
// members, a tower over each rear wheel) with the engine's and the gearbox's mounts, the front subframe.
import { add, bendPath, clamp, mix, rsec, type V } from './geo';
import { floorAt, type Ctx } from './layout';

const ALU = '#c3c6ca', CORE = '#2c2f33', HOSE = '#1c1c1f', FRAME = '#3b3e43', TANK = '#34373b', RUBBER = '#141416', STEEL = '#b9bcc1';

export function cooling(x: Ctx): void {
  const { g, S, site, det, E } = x, wf = site.wheels.f, cab = site.cabin;
  // ---- the radiator: leaning forward ahead of the front wheels, a tank each side, the fans behind it ----
  const W = clamp(520 + 45 * (S.litres - 3) + 35 * S.turbos, 480, 2 * (wf.y - wf.w / 2) - 420), H = 240, rx = Math.max(170, wf.x - wf.r - 230), rz = site.foot + 75 + H / 2;
  const lean = 0.3, e1: V = [Math.cos(lean), 0, Math.sin(lean)], e3: V = [-Math.sin(lean), 0, Math.cos(lean)], rc: V = [rx, 0, rz], at = (a: number, yy: number, c: number): V => [rc[0] + e1[0] * a + e3[0] * c, yy, rc[2] + e1[2] * a + e3[2] * c];
  g.part('radiator', CORE, 0.25, 'metal').obox(rc, e1, 16, [0, 1, 0], W / 2, e3, H / 2);
  for (const s of [1, -1]) g.part('radiator', ALU, 0.6, 'metal').obox(at(0, s * (W / 2 + 14), 0), e1, 20, [0, 1, 0], 14, e3, H / 2 + 6);
  if (det === 2) { g.part('radiator', '#4a4e54', 0.3, 'metal'); for (let k = 1; k < 6; k++) { const c = -H / 2 + k * H / 6; g.quad(at(-17.5, -W / 2, c - 3), at(-17.5, W / 2, c - 3), at(-17.5, W / 2, c + 3), at(-17.5, -W / 2, c + 3)); } }   // the core's rows
  if (det > 0) { const nf = det === 2 && W > 540 ? 2 : 1; for (let k = 0; k < nf; k++) { const yy = nf === 1 ? 0 : (k - 0.5) * W * 0.5, r = Math.min(H * 0.44, W / (2 * nf) - 14), c = at(18, yy, 0), fwd = (d: number): V => add(c, [e1[0] * d, 0, e1[2] * d]);
      g.part('radiatorFan', '#17181a', 0.2).lathe(c, e1, [[0, r], [26, r]], 8, false, [0, 1, 0]); g.part('radiatorFan', '#2a2c30', 0.3).lathe(fwd(12), e1, [[0, r * 0.3], [16, r * 0.3]], 6, 'b', [0, 1, 0]);
      if (det === 2) for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2, rad = (b: number, k2: number, d: number): V => { const cb = Math.cos(a + b), sb = Math.sin(a + b), p = fwd(d); return [p[0] + e3[0] * sb * r * k2, p[1] + cb * r * k2, p[2] + e3[2] * sb * r * k2]; };
          g.quad(rad(-0.2, 0.3, 16), rad(0.2, 0.3, 24), rad(0.32, 0.9, 24), rad(-0.12, 0.9, 16)); } } }
  // ---- the water: out of each tank, back under the cabin (in the tunnel) and up to the engine's ports ----
  const tun = cab?.tunnel, zt = cab ? cab.floor + (tun ? (tun[2] - cab.floor) * 0.3 : 40) : site.foot + 60, x1 = cab ? cab.x[0] + 60 : wf.x + wf.r + 80, x2 = cab ? cab.x[1] - 30 : x.eb.min[0] - 150, pr = det === 0 ? 20 : 15, ps = 4;
  const ports = E.water.map(x.T), back = x.U.map(v => -v) as V;
  [1, -1].forEach((s, k) => { const a = at(22, s * (W / 2 + 14), -s * H * 0.3), p1: V = [x1, s * 42, zt], p2: V = [x2, s * 42, zt], port = ports[k]!;
    g.part('coolantHose', HOSE, 0.15).tube(det === 0 ? [a, p1] : bendPath(a, [1, 0, 0], p1, [1, 0, 0], det === 2 ? 4 : 3, 0.45), pr + 2, ps);
    g.part('coolantPipe', ALU, 0.65, 'metal').tube([p1, p2], pr, ps);
    g.part('coolantHose', HOSE, 0.15).tube(det === 0 ? [p2, port] : bendPath(p2, [1, 0, 0], add(port, [x.U[0] * 30, x.U[1] * 30, x.U[2] * 30]), back, det === 2 ? 4 : 3, 0.5), pr + 2, ps); });
  // ---- the header tank: pale plastic, high in the bay's corner ----
  if (det > 0) { const ey = (x.eb.min[1] + x.eb.max[1]) / 2, side = x.long ? -1 : Math.sign(x.U[1]) || 1, bh = site.bay?.half ?? 600;
    const c: V = x.long ? [x.eb.min[0] + 110, side * Math.min(bh - 70, Math.max(-x.eb.min[1], x.eb.max[1]) + 95), x.eb.max[2] - 90] : [x.o[0] - 150, clamp(ey + side * ((x.eb.max[1] - x.eb.min[1]) / 2 + 95), -bh + 70, bh - 70), x.eb.max[2] - 110];
    g.part('expansionTank', '#d6d2c2', 0.35).prism(add(c, [-62, 0, 0]), add(c, [62, 0, 0]), rsec(52, 58, 8, 3.5), [0, 0, 1]); g.part('expansionTank', '#17181a', 0.3).cyl(add(c, [0, 0, 58]), add(c, [0, 0, 76]), 22, 6, true, [1, 0, 0]);
    if (det === 2) g.part('coolantHose', HOSE, 0.15).bend(add(c, [0, 0, -56]), [0, 0, -1], ports[0]!, [0, c[1] > ports[0]![1] ? -1 : 1, -0.3], 9, 4, 4, 0.5); }
  // ---- the battery: in the nose behind the radiator ----
  { const bx = rx + 170, by = -Math.min(W / 2 - 100, 230), bz = site.foot + 90;
    g.part('battery', '#1d1e21', 0.25).box(bx, bx + 240, by - 88, by + 88, bz, bz + 175); if (det > 0) { g.part('battery', '#3a3c40', 0.2).box(bx + 6, bx + 234, by - 82, by + 82, bz + 175, bz + 190, '-3');
      g.part('battery', '#b3261e', 0.4).box(bx + 30, bx + 56, by + 40, by + 66, bz + 190, bz + 204, '-3'); g.part('battery', '#22262b', 0.4).box(bx + 184, bx + 210, by + 40, by + 66, bz + 190, bz + 204, '-3'); } }
}

export function fuelAndOil(x: Ctx): void {
  const { g, S, site, det, E, o } = x, wr = site.wheels.r, bh = site.bay?.half ?? wr.y - wr.w / 2 - 80, eh = Math.max(-x.eb.min[1], x.eb.max[1]);
  // ---- the fuel tank ----
  const z0 = Math.max(site.foot + 60, (site.bay?.floor ?? 0) + 8), wall = (site.cabin ? site.cabin.x[1] : x.eb.min[0] - 400) + 24, roomAhead = x.eb.min[0] - 25 - wall;
  const strap = (a: V, b: V, hw: number, hh: number, up: V) => { if (det === 2) { g.part('fuelTank', '#8d9094', 0.5, 'metal'); for (const k of [0.25, 0.75]) { const c = mix(a, b, k), d: V = [(b[0] - a[0]) / 60, (b[1] - a[1]) / 60, 0]; const l = Math.hypot(...d) || 1; g.prism(add(c, [d[0] / l * -7, d[1] / l * -7, 0]), add(c, [d[0] / l * 7, d[1] / l * 7, 0]), rsec(hw + 2, hh + 2, 8, 4), up, false); } } };
  if (!x.long && roomAhead >= 90) { const xa = Math.max(wall, x.eb.min[0] - 25 - 230), xb = x.eb.min[0] - 25, hw = (xb - xa) / 2, hh = 125, yy = Math.min(bh - 40, 430), a: V = [(xa + xb) / 2, -yy, z0 + hh], b: V = [(xa + xb) / 2, yy, z0 + hh];
    g.part('fuelTank', TANK, 0.35).prism(a, b, rsec(hw, hh, det === 0 ? 6 : 8, 4), [0, 0, 1]); strap(a, b, hw, hh, [0, 0, 1]);
    if (det > 0) g.part('fuelFiller', STEEL, 0.6, 'metal').tube([[a[0], yy * 0.7, z0 + 2 * hh - 10], [a[0], yy + 20, z0 + 2 * hh + 60], [a[0] + 40, Math.min(bh + 60, yy + 110), z0 + 2 * hh + 150]], 24, 5); }
  else for (const s of [1, -1]) { const y0 = Math.max(eh + 45, x.out.railY + 30), y1 = Math.min(bh - 15, y0 + 190); if (y1 - y0 < 60) break; const xa = x.long ? x.eb.min[0] + 10 : wall, xb = Math.min(xa + 330, wr.x - wr.r - 20), hh = 110, zs = site.foot + 60, a: V = [xa, s * (y0 + y1) / 2, zs + hh], b: V = [xb, s * (y0 + y1) / 2, zs + hh];
    g.part('fuelTank', TANK, 0.35).prism(a, b, rsec((y1 - y0) / 2, hh, det === 0 ? 6 : 8, 4), [0, 0, 1]); strap(a, b, (y1 - y0) / 2, hh, [0, 0, 1]);
    if (det === 2 && s === 1) g.part('fuelLine', '#55585d', 0.5, 'metal').tube([[xa + 30, y0 + 4, zs + 30], [xa - 14, y0 - 40, zs + 24], [xa - 14, -(y0 - 40), zs + 24], [xa + 30, -(y0 + 4), zs + 30]], 9, 4); }   // the pipe that levels the two tanks
  // ---- the oil: a cooler standing at the bay's side behind a rear wheel's arch line, its two lines to the block; a dry sump's tank ----
  if (det > 0) { const side = x.long ? 1 : -(Math.sign(x.U[1]) || 1), c: V = x.long ? [Math.min(x.out.gearboxEnd[0] - 60, wr.x + wr.r + 40), side * Math.min(bh - 30, eh + 120), o[2] + 40] : [o[0] + 30, clamp((x.eb.min[1] + x.eb.max[1]) / 2 + side * ((x.eb.max[1] - x.eb.min[1]) / 2 + 150), -bh + 30, bh - 30), o[2] + 120];
    g.part('oilCooler', CORE, 0.25, 'metal').box(c[0] - 85, c[0] + 85, c[1] - 18, c[1] + 18, c[2] - 62, c[2] + 62);
    g.part('oilCooler', ALU, 0.6, 'metal').box(c[0] - 100, c[0] - 85, c[1] - 21, c[1] + 21, c[2] - 66, c[2] + 66).box(c[0] + 85, c[0] + 100, c[1] - 21, c[1] + 21, c[2] - 66, c[2] + 66);
    const oil = x.T(E.oil); g.part('oilLine', '#44474c', 0.55, 'metal'); for (const k of det === 2 ? [-1, 1] : [1]) g.bend([c[0] + k * 92, c[1], c[2] - 40], [oil[0] - c[0], oil[1] - c[1], 0], add(oil, [0, 0, k * 10]), [oil[0] - c[0], oil[1] - c[1], oil[2] - c[2]], 8, 4, det === 2 ? 4 : 3, 0.35); }
  if (S.sump === 'dry') { const side = x.long ? -1 : Math.sign(x.U[1]) || 1, r = 0.62 * E.B, base: V = x.long ? [o[0] + 60, side * Math.max(eh * 0.55 + 150, 104 + 2 * 56 + 48 + r), o[2] - 0.6 * E.B] : [x.eb.min[0] - 25 - r, o[1] - side * 40, o[2] - 0.6 * E.B];
    g.part('oilTank', ALU, 0.6, 'metal').lathe(base, [0, 0, 1], [[0, r * 0.8], [0.15 * E.B, r], [3.1 * E.B, r], [3.3 * E.B, r * 0.7]], det === 2 ? 8 : 6, true, [1, 0, 0]);
    if (det > 0) { g.part('oilTank', '#17171a', 0.3).cyl(add(base, [0, 0, 3.3 * E.B]), add(base, [0, 0, 3.5 * E.B]), 0.22 * E.B, 6, true, [1, 0, 0]);
      if (E.pump) { const p = x.T(E.pump); g.part('oilLine', '#44474c', 0.55, 'metal').bend(add(base, [0, 0, 0.3 * E.B]), [p[0] - base[0], p[1] - base[1], -0.4 * Math.hypot(p[0] - base[0], p[1] - base[1])], p, [x.U[0], x.U[1], 0], 9, 4, det === 2 ? 5 : 3, 0.4); } } }
}

export function chassis(x: Ctx): void {
  const { g, site, det, E, o } = x, wr = site.wheels.r, wf = site.wheels.f, t = 44;
  // ---- the rear subframe: a rail each side under the engine, cross members at its ends and under the clutch, a tower over each wheel ----
  const ry = x.out.railY, rz = x.out.railZ, xa = Math.min(x.eb.min[0], wr.x - 250) - 30, xb0 = Math.max(x.out.gearboxEnd[0] - 40, wr.x + 230);
  let xb = xb0; while (xb > wr.x + 160 && floorAt(site, xb + t / 2) > rz - t / 2 - 12) xb -= 10;   // not past where the underbody rises to the tail
  g.part('subframe', FRAME, 0.3);
  for (const s of [1, -1]) g.bar([xa, s * ry, rz], [xb, s * ry, rz], t, t * 1.3);
  const xm = clamp(x.long ? o[0] + 60 : wr.x + 60, xa + 120, xb - 120);
  for (const xx of det === 0 ? [xa, xb] : [xa, xm, xb]) g.bar([xx, -ry, rz - 4], [xx, ry, rz - 4], t, t, false);
  const tw = (w: typeof wr, railY: number, railZ: number, rise: number) => { for (const s of [1, -1]) { const top: V = [w.x, s * (w.y - w.w / 2 - 105), w.r + rise];
      g.part(w === wr ? 'subframe' : 'subframeFront', FRAME, 0.3);
      if (det < 2) { g.bar([w.x, s * railY, railZ], top, 36, 36, false); continue; }
      for (const dx of [-150, 150]) g.tube([[w.x + dx, s * railY, railZ + 10], [w.x + dx * 0.45, s * (railY + (Math.abs(top[1]) - railY) * 0.75), w.r + rise * 0.72], top], 17, 4);
      g.box(top[0] - 58, top[0] + 58, top[1] - 44, top[1] + 44, top[2] - 8, top[2] + 8); } };
  tw(wr, ry, rz, 330);
  // a brace between the towers when it clears the engine
  if (det > 0 && (wr.x > x.eb.max[0] + 25 || x.eb.max[2] < wr.r + 300)) { const y = wr.y - wr.w / 2 - 105, z = wr.r + 330 + 16; g.part('strutBrace', '#d8dadc', 0.85, 'metal').prism([wr.x, -y, z], [wr.x, y, z], rsec(15, 10, 6, 3), [0, 0, 1]); }
  // ---- the mounts: a bracket from the block down to each rail on its rubber, one under the gearbox's end ----
  if (det === 2) { const M = E.mounts.map(x.T);
    for (const m of M) { const s = x.long ? Math.sign(m[1]) || 1 : 0, foot: V = x.long ? [m[0], s * ry, rz + t * 0.65 + 14] : [m[0] < o[0] ? Math.max(xa + 30, m[0] - 60) : m[0] + 60, clamp(m[1], -ry + 60, ry - 60), rz + t / 2 + 14];
      if (!x.long) { foot[0] = m[0] < o[0] ? xa : xm; foot[2] = rz - 4 + t / 2 + 14; }
      g.part('engineMount', RUBBER, 0.12).lathe(add(foot, [0, 0, -14]), [0, 0, 1], [[0, 30], [28, 30]], 6, 'b', [1, 0, 0]);
      g.part('engineMount', STEEL, 0.5, 'metal').tube([add(foot, [0, 0, 14]), [foot[0] + (m[0] - foot[0]) * 0.35, foot[1] + (m[1] - foot[1]) * 0.35, m[2] - 5], m], 15, 4, true); }
    const ge = x.out.gearboxEnd, gf: V = x.long ? [Math.min(ge[0] - 30, xb), 0, rz - 4 + t / 2 + 14] : [xm, clamp(ge[1] + (Math.sign(x.U[1]) || 1) * 60, -ry + 40, ry - 40), rz - 4 + t / 2 + 14];
    g.part('engineMount', RUBBER, 0.12).lathe(add(gf, [0, 0, -14]), [0, 0, 1], [[0, 30], [28, 30]], 6, 'b', [1, 0, 0]);
    g.part('engineMount', STEEL, 0.5, 'metal').tube([add(gf, [0, 0, 14]), x.long ? [gf[0], 0, ge[2] - 95] : [ge[0] + (gf[0] - ge[0]) * 0.4, gf[1], ge[2] - 60]], 15, 4, true); }
  // ---- the front subframe: two rails and their cross members between the front wheels, a tower each side ----
  const fy = Math.min(260, wf.y - wf.w / 2 - 190), fz = site.foot + 72;
  g.part('subframeFront', FRAME, 0.3);
  for (const s of [1, -1]) g.bar([wf.x - 250, s * fy, fz], [wf.x + 250, s * fy, fz], t, t * 1.2);
  for (const dx of [-250, 250]) g.bar([wf.x + dx, -fy, fz], [wf.x + dx, fy, fz], t, t, false);
  tw(wf, fy, fz, 270);
}
