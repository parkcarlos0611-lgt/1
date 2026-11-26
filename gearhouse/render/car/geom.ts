// Outline geometry for the car rasteriser: rounded paths through control points, and polygon coverage.
import type { Pt } from './types';

/** Catmull-Rom through the points of a closed outline; sharp points (third value 1) keep their corner */
export function smoothClosed(pts: Pt[], steps = 8): [number, number][] {
  const n = pts.length, out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const sharp = (p1[2] === 1) || (p2[2] === 1);
    if (sharp) { out.push([p1[0], p1[1]]); continue; }
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** an open polyline smoothed the same way (for seams and trim) */
export function smoothOpen(pts: Pt[], steps = 6): [number, number][] {
  if (pts.length < 3) return pts.map(p => [p[0], p[1]]);
  const n = pts.length, out: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(n - 1, i + 2)]!;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const last = pts[n - 1]!; out.push([last[0], last[1]]); return out;
}

/** coverage (0..1) of a polygon in pixel coordinates, 4x4 samples per pixel, even-odd rule */
export function coverage(poly: [number, number][], w: number, h: number): Float32Array {
  const cov = new Float32Array(w * h), SS = 4, xs: number[] = [];
  let minY = Infinity, maxY = -Infinity; for (const p of poly) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const y0 = Math.max(0, Math.floor(minY * SS)), y1 = Math.min(h * SS - 1, Math.ceil(maxY * SS));
  for (let sy = y0; sy <= y1; sy++) {
    const y = (sy + 0.5) / SS; xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!, b = poly[j]!; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q); const row = Math.floor(sy / SS) * w;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, xs[k]! * SS), xb = Math.min(w * SS, xs[k + 1]! * SS);
      for (let sx = Math.ceil(xa - 0.5); sx < xb - 0.5; sx++) { const px = Math.floor(sx / SS); if (px >= 0 && px < w) cov[row + px]! += 1 / (SS * SS); }
    }
  }
  return cov;
}

/** distance (px) from each inside pixel to the nearest outside pixel, two-pass chamfer 3-4 */
export function insideDistance(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i]!, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i]!, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  for (let i = 0; i < w * h; i++) d[i] = d[i]! / 3;
  return d;
}
