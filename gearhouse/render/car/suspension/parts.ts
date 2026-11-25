// The suspension's parts (docs/systems/101, M3), drawn from a corner's hardpoints in the kit's and the powertrain's
// clean low-poly way (the powertrain's collector and shapes: ../powertrain/geo.ts). Each part is named and hangs on one
// bone of its corner (kinematics.ts BONES), so the renderer moves it whole as the wheel travels and steers:
//   wishboneLower, wishboneUpper   the A-arms: two legs from the chassis pivots (a bush on each) to the ball joint
//   upright, hubFlange, caliper    the knuckle between the ball joints with its bearing housing and steering arm, the
//                                  hub the wheel bolts to, the brake's caliper (it does not turn with the wheel)
//   brakeDisc                      the disc and its bell, turning with the wheel inside the rim
//   tieRod (front), toeLink (rear) from the rack's end, or the chassis, to the upright's arm
//   damper, damperRod, spring      the coil-over: the body on the lower arm with the lower seat, the rod and the top
//                                  mount, the coil between the seats (it shortens as the wheel rises)
//   antiRollBar, dropLink          each side's half of the bar turning in its bushes, the link down to the lower arm
//   steeringRack                   the rack's housing across the car (it stands still)
// Every part is drawn in the pose the hardpoints are given in and carried to the car's static ride by its bone (`at`).
// In the drift-game look (a collector with that style: ../powertrain/style.ts) the same parts on the same bones are
// drawn chunky: the arms and links near twice as thick, a coil of fewer turns in thick wire, a big bevelled caliper in
// the palette's colour, a drilled disc (its holes dark dots on the face), no small slots.
//   detail 2   the builder: round sections, bushes, the disc's slots      (about 600 triangles a corner)
//   detail 1   a lighter car for the drive: three- and four-sided sections (about 250)
//   detail 0   the arms, the upright, the disc and the damper as bare bars (about 100)
import { Geo, circle, type V } from '../powertrain/geo';
import type { Hardpoints, SuspLook } from './hardpoints';
import { add, affPt, mix, mul, norm, sub, dist, cross, type Aff } from './kinematics';

export type Detail = 0 | 1 | 2;
/** the disc's middle, outboard of the wheel's middle: between the wheel's closed back and its face */
export const DISC_OUT = 10;
const STEEL = '#3a3c40', RUBBER = '#18181a', BRIGHT = '#c9ccd0';

/** a corner's parts into the collector; `at`: each bone's map from the hardpoints' own pose to the car as it stands */
export function cornerParts(g: Geo, H: Hardpoints, look: SuspLook, det: Detail, at: Aff[]): void {
  const dr = g.drift, on = (bone: number) => g.frame(p => affPt(at[bone]!, p)), s = H.side, out: V = [0, s, 0], w = H.wheel, wc = H.wc, tube = look.armKind === 'tube';
  const along = (y: number): V => add(wc, mul(out, y));
  // ---- the arms ----
  const arm = (name: string, bone: number, A: { f: V; r: V; bj: V }, r: number, brace: number) => { on(bone); g.part(name, look.arms, look.armGloss, 'metal');
    for (const p of [A.f, A.r]) { if (tube || det < 2) g.cyl(p, A.bj, det === 0 ? r * 1.15 : r, det === 2 ? 5 : det === 1 ? 4 : 3, false); else g.bar(p, A.bj, r * 2.7, r * 1.5, false); }
    if (det === 2 && brace > 0) { const a = mix(A.f, A.bj, brace), b = mix(A.r, A.bj, brace); if (tube) g.cyl(a, b, r * 0.85, 4, false); else g.bar(a, b, r * 2.4, r * 1.3, false); }
    if (det > 0) g.cyl(add(A.bj, [0, 0, -r * 1.3]), add(A.bj, [0, 0, r * 1.3]), r * 1.55, det === 2 ? 5 : 4, true, [1, 0, 0]);
    if (det === 2) { g.part(name, RUBBER, 0.1); for (const p of [A.f, A.r]) g.cyl(add(p, [-20, 0, 0]), add(p, [20, 0, 0]), r * 1.6, 5, false); } };
  // a strut has no upper arm: its coil-over's body is clamped in the upright (below)
  arm('wishboneLower', 0, H.lower, 11, H.dampers.length && H.type !== 'macpherson' ? 0.5 : 0); if (H.type !== 'macpherson') arm('wishboneUpper', 1, H.upper, 9, 0);
  // ---- the upright: the bearing's housing inboard of the wheel's back, a leg to each ball joint, the steering arm ----
  on(2); g.part('upright', look.upright, 0.45, 'metal');
  const inY = Math.abs(wc[1] - H.lower.bj[1]), housing = Math.min(52, w.rim * 0.26);
  g.cyl(along(-inY - 12), along(-w.back + 4), det === 0 ? housing * 0.8 : housing, det === 2 ? 7 : det === 1 ? 5 : 4, 'a', [1, 0, 0]);
  for (const [bj, dz] of [[H.lower.bj, -1], [H.upper.bj, 1]] as const) { const root: V = [wc[0], bj[1], wc[2] + dz * housing * 0.7], tip = add(bj, [0, 0, -dz * 14]);
    if (det === 0) g.cyl(root, tip, 13, 3, false); else g.prism(root, tip, [[-17, -13], [17, -13], [17, 13], [-17, 13]], [1, 0, 0], false); }
  if (det > 0) { const k = (H.steer.outer[2] - H.lower.bj[2]) / (H.upper.bj[2] - H.lower.bj[2]), root = mix(H.lower.bj, H.upper.bj, k);
    g.prism(root, H.steer.outer, [[-9, -11], [9, -11], [9, 11], [-9, 11]], [0, 0, 1], 'b'); }
  // the hub: through the wheel's back to where the wheel bolts on
  const y0 = DISC_OUT - H.brake.t / 2, y1 = DISC_OUT + H.brake.t / 2, bell = y1 + 18;
  if (det > 0) { g.part('hubFlange', STEEL, 0.5, 'metal').cyl(along(-w.back + 4), along(bell + 3), 34, det === 2 ? 6 : 5, 'b', [1, 0, 0]); }
  // ---- the caliper: a body bridging the disc's edge, its bridge standing a little proud ----
  { const B = H.brake, a = B.at * Math.PI / 180, dir: V = [-Math.cos(a), 0, Math.sin(a)], tan: V = [Math.sin(a), 0, Math.cos(a)], hy = B.t / 2 + 20;
    g.part('caliper', look.caliper, 0.6, 'paint');
    if (dr) { const c = add(add(along(DISC_OUT), mul(out, -5)), mul(dir, B.r - 24));   // the drift look: a big block over a third of the disc, grown inboard and toward the hub (the wheel's face and barrel stay clear)
      const half = Math.min(B.caliper * 0.72, B.r * 0.62);
      if (det < 2) g.obox(c, tan, half, out, hy + 5, dir, 34);
      else { // three blocks leaning round the disc's edge, a groove drawn on the middle one: it reads as one curved caliper
        const lean = 2 * Math.asin(Math.min(0.4, half / 3 / (B.r - 24)));
        for (const k of [-1, 0, 1]) { const b = a + k * lean, d2: V = [-Math.cos(b), 0, Math.sin(b)], t2: V = [Math.sin(b), 0, Math.cos(b)], c2 = add(add(along(DISC_OUT), mul(out, -5)), mul(d2, B.r - 24));
          g.obox(c2, t2, half * 0.37, out, hy + 5, d2, 34); if (k) continue; const f = add(c2, mul(out, hy + 6.5)); g.line('crease', [add(f, mul(t2, -half * 0.25)), add(f, mul(t2, half * 0.25))]); } } }
    else g.obox(add(along(DISC_OUT), mul(dir, B.r - 14)), tan, B.caliper / 2, out, hy, dir, 24);
    if (det === 2 && !dr) g.obox(add(along(DISC_OUT), mul(dir, B.r + 13)), tan, B.caliper * 0.3, out, hy * 0.62, dir, 4, '-3'); }
  // ---- the disc and its bell: they turn with the wheel ----
  { const B = H.brake, n = det === 2 ? (dr ? 14 : 10) : det === 1 ? 8 : 6, rin = B.r * 0.58; on(3);
    g.part('brakeDisc', look.disc, 0.75, 'metal').lathe(wc, out, det === 0 ? [[y1, rin], [y1, B.r], [y0, B.r]] : [[y0, rin], [y0, B.r], [y1, B.r], [y1, rin]], n, false, [1, 0, 0]);
    if (det > 0) g.part('brakeDisc', STEEL, 0.4, 'metal').lathe(wc, out, [[y1, rin], [bell, rin * 0.6]], n, false, [1, 0, 0]);
    // slots across the outer face, so its turning shows
    // the drift look: a drilled disc, its holes dark dots in two rings on the outer face
    if (det === 2 && dr) { g.part('brakeDisc', '#2c2d30', 0.2); const h = Math.max(5, B.r * 0.045);
      for (let k = 0; k < 16; k++) { const a = (k + (k & 1) * 0.5) / 16 * Math.PI * 2, r = rin + (B.r - rin) * (k & 1 ? 0.68 : 0.34), c = Math.cos(a), si = Math.sin(a), p = (dx: number, dz: number): V => add(along(y1 + 0.9), [c * r + dx, 0, si * r + dz]);
        g.quad(p(-h, 0), p(0, -h), p(h, 0), p(0, h)); } }
    if (det === 2 && !dr) { g.part('brakeDisc', '#2c2d30', 0.2); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, c = Math.cos(a), si = Math.sin(a), p = (r: number, o: number): V => add(along(y1 + 0.9), [c * r - si * o, 0, si * r + c * o]);
        g.quad(p(rin + 10, -9), p(B.r - 8, 5), p(B.r - 8, 10), p(rin + 10, -4)); } } }
  // ---- the tie rod or the toe link ----
  { on(4); g.part(H.steer.rack ? 'tieRod' : 'toeLink', BRIGHT, 0.6, 'metal').cyl(H.steer.inner, H.steer.outer, det === 0 ? 8 : 7, det === 2 ? 5 : 3, false);
    if (det === 2) g.part(H.steer.rack ? 'tieRod' : 'toeLink', STEEL, 0.4, 'metal').cyl(add(H.steer.outer, [0, 0, -13]), add(H.steer.outer, [0, 0, 13]), 12, 4, true, [1, 0, 0]); }
  // ---- the coil-overs ----
  for (const D of H.dampers) { const u = norm(sub(D.top, D.bot)), L = dist(D.top, D.bot), P = (k: number): V => add(D.bot, mul(u, k)), rs = D.spring[0], turns = dr ? 3.5 : 4.5;
    // the coil's wire: in the drift look thick by the spring's rule, as far as the coil's pitch leaves it
    g.part('spring', look.spring, 0.45, 'paint'); const wire = dr ? Math.min(g.rr(D.spring[1]), (L - D.seat[0] - D.seat[1]) / turns * 0.3) : D.spring[1];
    on(5); g.part('damper', look.damper, 0.5, 'metal').cyl(P(det === 2 ? 16 : 0), P(D.seat[0] - 3), D.body, det === 2 ? 6 : det === 1 ? 5 : 4, 'b', [1, 0, 0]);
    if (det === 2) { g.cyl(add(D.bot, [-17, 0, 0]), add(D.bot, [17, 0, 0]), 15, 5, true); }
    if (det > 0) g.part('damper', STEEL, 0.4, 'metal').lathe(D.bot, u, [[D.seat[0] - 9, D.body + 1], [D.seat[0], rs + wire + 2]], det === 2 ? 7 : 5, 'b', [1, 0, 0]);
    on(6); g.part('damperRod', BRIGHT, 0.85, 'metal').cyl(P(D.seat[0] - 95), P(L - 6), 7, det === 2 ? 4 : 3, false);
    if (det > 0) { g.part('damperRod', STEEL, 0.4, 'metal').lathe(D.bot, u, [[L - D.seat[1], rs + wire + 2], [L - D.seat[1] + 9, 22]], det === 2 ? 7 : 5, 'a', [1, 0, 0]);
      g.part('damperRod', RUBBER, 0.1, 'plain', 'round').cyl(P(L - D.seat[1] + 9), P(L), 26, det === 2 ? 6 : 4, 'b', [1, 0, 0]); }
    // the coil: a wire of three sides wound between the seats (a flat strip at the lighter detail)
    on(7); g.part('spring', look.spring, 0.45, 'paint', det === 0 ? 'round' : undefined);
    const l = L - D.seat[0] - D.seat[1], [e1, e2] = [norm(cross(u, [1, 0, 0])), norm(cross(u, cross(u, [1, 0, 0])))];
    if (det === 0) { g.cyl(P(D.seat[0]), P(L - D.seat[1]), rs, 4, false, [1, 0, 0]); continue; }
    const per = det === 2 && H.dampers.length === 1 ? 6 : 5, N = Math.round(turns * per), pts: V[] = [], rad: V[] = [];
    for (let i = 0; i <= N; i++) { const a = i / per * Math.PI * 2, n = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))); rad.push(n); pts.push(add(P(D.seat[0] + wire + (l - 2 * wire) * i / N), mul(n, rs))); }
    if (det === 2) g.sweep(pts, circle(wire, dr ? 4 : 3), true, u);
    else for (let i = 0; i < N; i++) g.quad(add(pts[i]!, mul(u, -wire)), add(pts[i + 1]!, mul(u, -wire)), add(pts[i + 1]!, mul(u, wire)), add(pts[i]!, mul(u, wire))); }
  // ---- the anti-roll bar's half and its drop link ----
  if (H.bar && det > 0) { const B = H.bar, px = B.pivot[0], pz = B.pivot[2], ey = B.end[1], sx = Math.sign(B.end[0] - px) || 1;
    on(8); g.part('antiRollBar', '#2f3135', 0.4, 'metal').tube([[px, 0, pz], [px, ey - s * 34, pz], [px + sx * 30, ey, pz + (B.end[2] - pz) * 0.12], B.end], B.r, det === 2 ? 4 : 3);
    on(9); g.part('dropLink', BRIGHT, 0.6, 'metal').cyl(B.link, B.end, 5.5, det === 2 ? 4 : 3, false); }
  g.frame(null);
}

/** what stands still on an axle: the steering rack between the tie rods' inner ends (a front axle's) */
export function axleParts(g: Geo, L: Hardpoints, R: Hardpoints, det: Detail): void { g.frame(null); if (det === 0) return;
  if (L.steer.rack) { const a = L.steer.inner, b = R.steer.inner, k = 64 / Math.abs(a[1] - b[1]), p = mix(a, b, k), q = mix(b, a, k);
    g.part('steeringRack', '#8f9296', 0.5, 'metal').cyl(p, q, 21, det === 2 ? 6 : 4, false);
    if (det === 2) { g.part('steeringRack', RUBBER, 0.1); for (const [e, m] of [[a, p], [b, q]] as const) g.lathe(m, sub(e, m), [[0, 24], [dist(e, m) - 8, 11]], 6, false);
      // the pinion's tower where the column comes down to the rack
      const t = mix(a, b, 0.36); g.part('steeringRack', '#8f9296', 0.5, 'metal').cyl(t, add(t, [70, 0, 62]), 15, 5, 'b'); } }
}
