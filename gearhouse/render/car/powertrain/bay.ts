// The engine bay's own fittings in the drift-game look (docs/systems/109 section 10; the references in
// docs/reference/frl_style): big simple boxes in bold colours round the engine.
//   the fittings   a white washer tank with a blue cap and a black fuse box with its lid. With the whole powertrain in a
//                  car they stand in the nose beside the battery (the mid- and rear-engined cars' front compartment);
//                  in a bay drawn on its own they stand on the bay's shelves, with a battery and a coolant tank when
//                  the engine is built alone
//   the bay        (asked for: PowertrainOpts.bay) the black tub round the engine, by where the engine is: a shelf
//                  along each side from the engine's flanks out to the wall (as high as the engine leaves: a flat
//                  engine, low and wide, has low wide shelves), the walls up to the rim with a lip, the bulkhead on
//                  the cabin's side, and the panel across the car's end: at the front its cross bars and struts with
//                  the radiator's core in it, two thick hoses to the engine and the headlamps' backs at its corners;
//                  at the rear a cross bar and the tail lamps' backs
// Nothing here is read by the checks: these parts only show.
import { add, type V } from './geo';
import { nosePlace } from './ancillary';
import type { Ctx } from './layout';

/** the bay's size round an engine: its ends (the bulkhead's and the panel's stations), half its width inside the
 *  walls, its floor, shelf and rim; `front`: the engine is ahead of the car's middle, `e`: the way to the car's end */
export function bayBox(x: Ctx): { front: boolean; e: number; xf: number; xp: number; half: number; inner: number; z0: number; shelf: number; rim: number } {
  const { eb, site } = x, front = (eb.min[0] + eb.max[0]) / 2 < (site.wheels.f.x + site.wheels.r.x) / 2, e = front ? -1 : 1, eh = Math.max(-eb.min[1], eb.max[1]), h = eb.max[2] - eb.min[2];
  const inner = eh + 35, z0 = eb.min[2] + 20, shelf = Math.max(eb.max[2] - 190, z0 + 0.42 * h);
  return { front, e, xf: (front ? eb.max[0] : eb.min[0]) - e * 90, xp: (front ? eb.min[0] : eb.max[0]) + e * 170, half: inner + 215, inner, z0, shelf, rim: eb.max[2] + 30 }; }

export function bayProps(x: Ctx, tub: boolean, engineOnly: boolean): void {
  const { g, det } = x; g.frame(null);
  // a tank: a pale bevelled box, its cap, its level's line; a fuse box: a black box with its lid
  const tank = (name: string, c: V, hx: number, hy: number, hz: number, cap: string) => { g.part(name, '#e9e7dc', 0.3).box(c[0] - hx, c[0] + hx, c[1] - hy, c[1] + hy, c[2], c[2] + 2 * hz);
    if (det > 0) g.part(name, cap, 0.4).cyl([c[0] - hx * 0.35, c[1], c[2] + 2 * hz - 2], [c[0] - hx * 0.35, c[1], c[2] + 2 * hz + 26], 30, 8, true, [1, 0, 0]);
    if (det === 2) g.line('crease', [[c[0] - hx + 14, c[1] - hy - 1.5, c[2] + hz * 1.3], [c[0] + hx - 14, c[1] - hy - 1.5, c[2] + hz * 1.3]]).line('crease', [[c[0] - hx + 14, c[1] + hy + 1.5, c[2] + hz * 1.3], [c[0] + hx - 14, c[1] + hy + 1.5, c[2] + hz * 1.3]]); };
  const fuse = (c: V, hx: number, hy: number) => { g.part('fuseBox', '#232427', 0.2).box(c[0] - hx, c[0] + hx, c[1] - hy, c[1] + hy, c[2], c[2] + 70);
    if (det > 0) g.part('fuseBox', '#17181a', 0.2).box(c[0] - hx + 10, c[0] + hx - 10, c[1] - hy + 10, c[1] + hy - 10, c[2] + 70, c[2] + 88, '-3');
    if (det === 2) g.line('trim', [[c[0] - hx + 4, c[1] - hy + 4, c[2] + 71.5], [c[0] + hx - 4, c[1] - hy + 4, c[2] + 71.5], [c[0] + hx - 4, c[1] + hy - 4, c[2] + 71.5], [c[0] - hx + 4, c[1] + hy - 4, c[2] + 71.5]], true); };
  const battery = (c: V) => { g.part('battery', '#1d1e21', 0.25).box(c[0] - 125, c[0] + 125, c[1] - 88, c[1] + 88, c[2], c[2] + 175);
    if (det > 0) { g.part('battery', '#3a3c40', 0.2).box(c[0] - 119, c[0] + 119, c[1] - 82, c[1] + 82, c[2] + 175, c[2] + 190, '-3');
      g.part('battery', '#b3261e', 0.4).box(c[0] - 95, c[0] - 65, c[1] + 36, c[1] + 66, c[2] + 190, c[2] + 206, '-3'); g.part('battery', '#22262b', 0.4).box(c[0] + 65, c[0] + 95, c[1] + 36, c[1] + 66, c[2] + 190, c[2] + 206, '-3');
      if (det === 2) for (const k of [-0.4, 0, 0.4]) g.line('vent', [[c[0] + 125 * k, c[1] - 70, c[2] + 191.5], [c[0] + 125 * k, c[1] + 16, c[2] + 191.5]]); } };
  if (!tub) { if (engineOnly) return;
    // ---- in the nose: beside the battery, on the car's other side ----
    const N = nosePlace(x), y = -N.by; tank('washerTank', [N.bx + 70, y, N.bz], 70, 62, 70, '#2a63d4'); fuse([N.bx + 215, y, N.bz], 60, 75); return; }
  // ---- the bay ----
  const B = bayBox(x), { e, xf, xp, half, inner, z0, shelf, rim } = B, wall = 40, xa = Math.min(xf, xp), xb = Math.max(xf, xp), TUB = '#151618', LIP = '#222326';
  g.part('bayTub', TUB, 0.12);
  for (const s of [1, -1]) { const ya = s * inner, yb = s * (half + wall);
    g.box(xa, xb, Math.min(ya, yb), Math.max(ya, yb), z0, shelf);                                                       // the shelf
    g.box(xa, xb, Math.min(s * half, yb), Math.max(s * half, yb), shelf, rim, '-3'); }                                  // the wall over it
  g.box(Math.min(xf, xf - e * wall), Math.max(xf, xf - e * wall), -half - wall, half + wall, z0, rim + (B.front ? 90 : 30));              // the bulkhead
  if (det > 0) { g.part('bayTub', LIP, 0.15); for (const s of [1, -1]) g.box(xa, xb, s * half - 34, s * half + 34 + s * wall / 2, rim, rim + 22, '-3'); }   // the rim's lip
  // the panel across the car's end: the cross bars, the uprights and (at the front) the two struts down to the lower bar
  const xq = xp + e * 26, W = Math.min(2 * inner + 120, 760), H = Math.min(330, rim - z0 - 110), zc = z0 + 60 + H / 2;
  g.part('radiatorPanel', '#2b2d31', 0.25);
  g.bar([xq, -half - wall, rim - 24], [xq, half + wall, rim - 24], 46, 46); g.bar([xq, -half - wall, z0 + 22], [xq, half + wall, z0 + 22], 46, 46);
  for (const s of [1, -1]) g.bar([xq, s * (W / 2 + 58), z0 + 40], [xq, s * (W / 2 + 58), rim - 40], 46, 46, false);
  if (B.front && det > 0) for (const s of [1, -1]) g.bar([xq + e * 30, s * 50, rim - 40], [xq + e * 30, s * W * 0.3, z0 + 40], 30, 30, false);
  // the lamps' backs at the panel's corners
  if (det > 0) { g.part('lampBack', '#3a3d42', 0.3); for (const s of [1, -1]) { const y = s * (half - 105), z = shelf + 30; g.box(Math.min(xq + e * 30, xq + e * 150), Math.max(xq + e * 30, xq + e * 150), y - 130, y + 130, z, z + 150);
      if (det === 2) g.line('lamp', [[xq + e * 30 - e * 1.5, y - 100, z + 26], [xq + e * 30 - e * 1.5, y + 100, z + 26], [xq + e * 30 - e * 1.5, y + 100, z + 124], [xq + e * 30 - e * 1.5, y - 100, z + 124]], true); } }
  // the radiator in a front bay's panel when the engine is built alone (the whole powertrain brings its own in the nose): the core, a tank each side, two thick hoses to the engine's ports
  if (B.front && engineOnly) { const xr = xp + e * 2;
    g.part('radiator', '#2c2f33', 0.25, 'metal').box(xr - 18, xr + 18, -W / 2, W / 2, zc - H / 2, zc + H / 2);
    for (const s of [1, -1]) g.part('radiator', '#c3c6ca', 0.6, 'metal').box(xr - 22, xr + 22, s * W / 2 - (s < 0 ? 30 : 0), s * W / 2 + (s > 0 ? 30 : 0), zc - H / 2 - 6, zc + H / 2 + 6);
    if (det === 2) for (let k = 1; k < 6; k++) { const z = zc - H / 2 + k * H / 6; g.line('vent', [[xr - e * 20, -W / 2 + 10, z], [xr - e * 20, W / 2 - 10, z]]); }
    if (det > 0) { const ports = x.E.water.map(x.T), back = x.U.map(v => -v) as V;
      [1, -1].forEach((s, k) => { const a: V = [xr - e * 24, s * (W / 2 - 60), zc + (k ? -1 : 1) * H * 0.34], p = ports[k]!;
        g.part('coolantHose', '#1c1c1f', 0.15).bend(a, [-e, 0, 0], add(p, [x.U[0] * 30, x.U[1] * 30, 0]), back, 17, 5, 4, 0.5); }); } }
  // ---- the fittings on the shelves: by the bulkhead and by the panel, each side ----
  const yS = (s: number) => s * (inner + half) / 2, nearF = xf + e * 190, nearP = xf + e * Math.max(430, Math.abs(xp - xf) * 0.62);   /* the tanks along the shelf's middle, clear of the panel's bar */
  tank('washerTank', [nearP, yS(1), shelf], 72, 64, 72, '#2a63d4'); fuse([nearF, yS(1), shelf], 85, 62);
  if (engineOnly) { battery([nearF + e * 20, yS(-1), shelf]);
    g.part('expansionTank', '#d6d2c2', 0.35).box(nearP - 66, nearP + 66, yS(-1) - 60, yS(-1) + 60, shelf, shelf + 130); if (det > 0) g.part('expansionTank', '#17181a', 0.3).cyl([nearP, yS(-1), shelf + 128], [nearP, yS(-1), shelf + 156], 30, 8, true, [1, 0, 0]); }
}
