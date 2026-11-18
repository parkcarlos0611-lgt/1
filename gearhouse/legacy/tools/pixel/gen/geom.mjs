// mm-space geometry helpers for silhouette specs.
// fillet: polygon [[x,z,r]] -> rounded polygon; r = corner radius in mm (0 = sharp).
export function fillet(pts, steps = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], r = p[2] || 0;
    if (!r) { out.push([p[0], p[1], 1]); continue; }
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, da * 0.5), rb = Math.min(r, db * 0.5);
    const A = [p[0] + (a[0] - p[0]) * ra / da, p[1] + (a[1] - p[1]) * ra / da], B = [p[0] + (b[0] - p[0]) * rb / db, p[1] + (b[1] - p[1]) * rb / db];
    for (let k = 0; k <= steps; k++) { const t = k / steps, u = 1 - t; out.push([u * u * A[0] + 2 * u * t * p[0] + t * t * B[0], u * u * A[1] + 2 * u * t * p[1] + t * t * B[1], 0]); }
  }
  return out;
}
// elliptical arc around (cx,cz); angles in degrees, 0 = toward rear (+x), 90 = up.
export function arc(cx, cz, rx, rz, a0, a1, n = 10) {
  const o = []; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; o.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz, 0]); } return o;
}
export const rrect = (x0, z0, x1, z1, r) => fillet([[x0, z0, r], [x0, z1, r], [x1, z1, r], [x1, z0, r]]);
