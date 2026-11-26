// The nose's bumper panel: below the shut line, in the standard section going round from the centre line to the front
// arch; the lamp strip at its top corners (cells of the same grid), the centre intake and the two outer ones with the
// fog lamps, cut in as pockets.
import type { Ctx } from '../ctx';
import { FLANK } from '../section';
import { border } from '../emit';
import { cross, gp, gridProbe, mir, mix, sub, type V } from '../geom';
import type { OuterIntake } from '../spec';

export function noseBumper(x: Ctx): void {
  const { e, s, c, k } = x, bl = k.bumperLamps, ic = k.intakes.centre, fg = k.intakes.fog, lc = bl.col ?? FLANK.H, outs = [k.intakes.outer, k.intakes.side].filter((o): o is OuterIntake => !!o);
  const lampCell = (i: number, q: number) => q === lc && i >= bl.from && i < bl.to, fogCell = (i: number, q: number) => !!fg && i >= fg.rows[0] && i < fg.rows[1] && q >= fg.cols[0] && q < fg.cols[1];
  const mouthC = (i: number, q: number) => i < ic.rows && q >= ic.cols[0] && q < ic.cols[1], mouthO = (i: number, q: number) => outs.some(oc => i >= oc.rows[0] && i < oc.rows[1] && q >= oc.cols[0] && q < oc.cols[1]);
  const clear = (i: number) => bl.amberFirst ? i >= bl.split : i < bl.split;
  e.name('bumperF').mat(c.paint, c.gloss, 'paint'); e.cells(s.NSG, (i, q) => q >= FLANK.H && !lampCell(i, q) && !mouthC(i, q) && !mouthO(i, q) && !fogCell(i, q));
  const N = s.NSG;
  const ld = bl.depth ?? 0;
  if (ld > 0) for (const sg of [1, -1]) {   // the strip sunk as a dark slot, its lenses at the back
    e.name('indicatorF'); e.pocket(border(N, bl.from, bl.to, lc, lc + 1).map(p => mir(p, sg)), [ld, 0, 0], [-1, 0, 0], c.dark);
    e.with('part', () => { for (let i = bl.from; i < bl.to; i++) { if (clear(i)) e.name('sidelightF').mat(c.lens, 0.7, 'lens'); else e.name('indicatorF').mat(c.amber, 0.7, 'lens'); e.inCell(N, i, lc, 0.04, 0.96, 0.14, 0.86, 3 - ld, [-1, 0, 0], sg); } }); }
  else { e.name('sidelightF').mat(c.lens, 0.7); e.cells(N, (i, q) => lampCell(i, q) && clear(i));
    e.name('indicatorF').mat(c.amber, 0.7); e.cells(N, (i, q) => lampCell(i, q) && !clear(i)); }
  // the centre intake: one pocket across the centre line (none when it has no rows)
  const rows = N.slice(0, ic.rows + 1), r: V[] = [...rows.map(p => p[ic.cols[0]]!)];
  if (ic.rows > 0) {
  for (let q = ic.cols[0] + 1; q < ic.cols[1]; q++) r.push(N[ic.rows]![q]!);
  r.push(...rows.slice().reverse().map(p => p[ic.cols[1]]!));
  const full = [...r, ...r.slice(1, -1).reverse().map(p => mir(p, -1))];
  e.name('grille'); e.pocket(full, [ic.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
  // the face's x at y across the mouth's middle line (the rows' own points joined), for bars that follow it
  const qm = (ic.cols[0] + ic.cols[1]) >> 1, fx = (y: number) => { const a = Math.abs(y); let i = 0; while (i + 1 < ic.rows && rows[i + 1]![qm]![1] < a) i++; const p = rows[i]![qm]!, q = rows[i + 1]![qm]!; return p[0] + (q[0] - p[0]) * Math.max(0, Math.min(1, (a - p[1]) / Math.max(1, q[1] - p[1]))); };
  const bx0 = (y: number) => ic.follow ? fx(y) + ic.barX : ic.barX;
  e.with('part', () => { e.name('grille').mat(c.frame, 0.2); if (!ic.mesh) for (const y of ic.bars) e.b.bar([bx0(y), y, ic.barZ[0]], [bx0(y), y, ic.barZ[1]], 12, 16);
    if (ic.slats && !ic.follow) for (const z of ic.slats.z) e.b.bar([ic.barX, -x.L.my(ic.slats.half), z], [ic.barX, x.L.my(ic.slats.half), z], 12, 10);
    // slats following the face: straight between the rows' places, from one end to the other
    if (ic.slats && ic.follow) { const h = x.L.my(ic.slats.half), ys = [...new Set([...rows.map(p => p[qm]![1]).filter(y => y < h - 1), h])].sort((a, b) => a - b), all = [...ys.slice(1).reverse().map(y => -y), ...ys];
      for (const z of ic.slats.z) for (let i = 0; i + 1 < all.length; i++) e.b.bar([bx0(all[i]!), all[i]!, z], [bx0(all[i + 1]!), all[i + 1]!, z], 12, 10); }
    // a mesh: thin strips across and up each cell of the mouth, behind the face
    if (ic.mesh) { const [nu, nv] = ic.mesh.n, w = ic.mesh.w / 2, back = (p: V): V => [p[0] + ic.barX, p[1], p[2]];
      for (const sg of [1, -1]) for (let i = 0; i < ic.rows; i++) for (let q = ic.cols[0]; q < ic.cols[1]; q++) { const S = (u: number, v: number) => mir(back(mix(mix(N[i]![q]!, N[i + 1]![q]!, u), mix(N[i]![q + 1]!, N[i + 1]![q + 1]!, u), v)), sg);
        const du = w / Math.max(1, N[i + 1]![q]![1] - N[i]![q]![1]), dv = w / Math.max(1, N[i]![q]![2] - N[i]![q + 1]![2]);
        for (let a = 0; a < nu; a++) { const u = (a + 0.5) / nu; e.face(S(u - du, 0), S(u + du, 0), S(u + du, 1), S(u - du, 1), [-1, 0, 0]); }
        for (let a = 0; a < nv; a++) { const v = (a + 0.5) / nv; e.face(S(0, v - dv), S(1, v - dv), S(1, v + dv), S(0, v + dv), [-1, 0, 0]); } } }
    if (ic.badge) { const [h, z0, z1] = ic.badge, bx = bx0(0) - 10; e.name('badge').mat(c.chrome, 0.85, 'metal'); e.face([bx, -h, z0], [bx, h, z0], [bx, h, z1], [bx, -h, z1], [-1, 0, 0]); }
    // its corners rounded: fillets of the skin left across them
    e.name('bumperF').mat(c.paint, c.gloss, 'paint'); for (const [i, q, di, dq] of ic.fillets ?? []) { const cp = N[i]![q]!; e.tri2(cp, mix(cp, N[i + di]![q]!, ic.fillet ?? 0.5), mix(cp, N[i]![q + dq]!, ic.fillet ?? 0.5), [-1, 0, 0]); } }); }
  for (const oc of outs) for (const sg of [1, -1]) { e.name('grille'); e.pocket(border(N, oc.rows[0], oc.rows[1], oc.cols[0], oc.cols[1]).map(p => mir(p, sg)), [oc.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
    e.with('part', () => { const f = oc.fog; if (f) { e.name('fogF').mat(c.lens, 0.7); e.inCell(N, f[0], oc.cols[0], f[1], f[2], f[3], f[4], -f[5], [-1, 0, 0], sg); }
      // body-coloured bars across the opening on the bumper's own lines: a face and a ledge running back from its top
      e.name('bumperF').mat(c.paint, c.gloss, 'paint'); for (const q of oc.slats ?? []) for (let i = oc.rows[0]; i < oc.rows[1]; i++) { const a = mir(N[i]![q]!, sg), b = mir(N[i + 1]![q]!, sg), o = (p: V, dx: number, dz: number): V => [p[0] + dx, p[1], p[2] + dz];
        e.face(o(a, 0, -9), o(b, 0, -9), o(b, 0, 9), o(a, 0, 9), [-1, 0, 0]); e.face(o(a, 0, 9), o(b, 0, 9), o(b, 30, 9), o(a, 30, 9), [0, 0, 1]); } }); }
  // a round lamp sunk in a recess: its block of cells cut round a port
  if (fg) { const [r0, r1] = fg.rows, [c0, c1] = fg.cols, P = (i: number, q: number) => N[i]![q]!, yc = x.L.my(fg.y), d: V = [fg.depth, 0, 0];
    const xa = (y: number, z: number) => { const u = (y - (P(r0, c0)[1] + P(r0, c1)[1]) / 2) / ((P(r1, c0)[1] + P(r1, c1)[1] - P(r0, c0)[1] - P(r0, c1)[1]) / 2), v = (P(r0, c0)[2] - z) / (P(r0, c0)[2] - P(r0, c1)[2]); return mix(mix(P(r0, c0), P(r1, c0), u), mix(P(r0, c1), P(r1, c1), u), v)[0]; };
    for (const sg of [1, -1]) { const hole = Array.from({ length: fg.seg }, (_, t) => { const a = t / fg.seg * Math.PI * 2, y = yc + fg.r * Math.cos(a), z = fg.z + fg.r * Math.sin(a); return [xa(y, z), sg * y, z] as V; });
      e.name('bumperF').mat(c.paint, c.gloss, 'paint'); e.porthole(border(N, r0, r1, c0, c1).map(p => mir(p, sg)), hole, [-1, 0, 0]);
      e.name('fogF').mat(c.dark, 0.2); e.tube(hole, d); e.mat(c.frame, 0.7, 'lens'); e.fan(hole.map(p => [p[0] + d[0], p[1], p[2]] as V), [-1, 0, 0]); } }
}
/** what is laid on the bumper's face: a small shield grille in its middle, dark ducts at its corners; the splitter under it */
export function noseFittings(x: Ctx): void {
  const { e, s, c, k, L } = x, N = s.NSG, I = k.intakes, on = (y: number, z: number, lift: number): V => { const px = gridProbe(N, 1, 2, 0, Math.abs(y), z, false, (_, q) => q >= FLANK.H); return [(Number.isNaN(px) ? N[0]![FLANK.H]![0] : px) - lift, y, z]; };
  if (I.shield) { const P = I.shield.pts, zc = P.reduce((a, p) => a + p[1], 0) / P.length, hs = (g: number, lift: number) => e.fan(P.map(([y, z]) => on(L.my(y) * g, zc + (z - zc) * g, lift)), [-1, 0, 0]);
    e.name('grille').mat(c.paint, c.gloss, 'paint'); hs(I.shield.grow, 3); e.name('grille').mat(c.dark, 0.05, 'grille'); hs(1, 6); }
  e.name('grille').mat(c.dark, 0.05, 'grille'); for (const [y0, y1, z0, z1] of I.patches ?? []) for (const sg of [1, -1]) { const m = (y0 + y1) / 2; e.face(on(sg * L.my(y0), z0, 5), on(sg * L.my(m), z0, 5), on(sg * L.my(m), z1, 5), on(sg * L.my(y0), z1, 5), [-1, sg, 0]); e.face(on(sg * L.my(m), z0, 5), on(sg * L.my(y1), z0, 5), on(sg * L.my(y1), z1, 5), on(sg * L.my(m), z1, 5), [-1, sg, 0]); }
  const S = k.splitter; if (!S) return; const XJ = s.SF[0]!, yw = s.CJ[s.CJ.length - 1]![1], rows = N.map(r => r[r.length - 1]!).filter(p => p[1] / yw <= S.until + 1e-9);
  const P = rows.map(p => { const f = Math.min(p[1] / yw, S.until), ex = L.mx(S.reach) + (XJ - L.mx(S.reach)) * gp(f, k.nose.pow); return [[ex, L.my(S.half) * f, S.z[0]] as V, [p[0], p[1], S.z[0]] as V]; });
  e.name('splitter').mat(c.frame, 0.15); e.cells(P); e.cells(P.map(r => [[r[0]![0], r[0]![1], S.z[1]] as V, r[0]!]));
}
/** the bumper's shut line along its top edge, round the nose to the front arch */
export function noseTrim(x: Ctx): void {
  const { e, s, c, k } = x, N = s.NSG, H = FLANK.H; if (!k.nose.seam) return;
  const nrm = (i: number): V => { const a = N[Math.max(0, i - 1)]![H]!, b = N[Math.min(N.length - 1, i + 1)]![H]!, u = N[i]![H - 1]!, d = N[i]![H + 1]!; return cross(sub(b, a), sub(d, u)); };
  e.name('seam').mat(c.seam, 0.1); e.seam(N.map(r => r[H]!), i => { const n = nrm(i); return n[0] * -1 + n[1] * 1 < 0 ? [-n[0], -n[1], -n[2]] : n; }, 7, 2)([1, -1]);
}
