import { describe, it, expect } from 'vitest';
import { VolumeSim, type VolParams, type VolEmit } from '../race/volume/sim';
import { atlasLayout, atlasTexel, atlasCell } from '../render/live/volume/atlas';
import { smokeTier, type GpuCaps } from '../render/live/volume/caps';
import { invert, worley } from '../render/live/volume/draw';
import { carBoxes } from '../render/live/volume/volume';

const still: Partial<VolParams> = { fade: 0, spread: 0, vort: 0, wind: [0, 0], drag: 0, alpha: 0, betaS: 0, betaD: 0, edge: 0, settle: 0 };
const maxAbs = (a: Float32Array) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
/** a ball of smoke `r` cells across about cell (ci, cj, ck) */
function ball(s: VolumeSim, ci: number, cj: number, ck: number, r: number, d = 1) { const { nx, ny, nz } = s.P;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.S[s.idx(i, j, k)] = d * Math.max(0, 1 - Math.hypot(i + 0.5 - ci, j + 0.5 - cj, k + 0.5 - ck) / r); }

describe('volumetric smoke, the CPU reference (docs/systems/104 B-5)', () => {
  it('keeps the smoke: no fading, a closed box, carried and projected, its sum within 2 %', () => {
    const s = new VolumeSim({ ...still, open: false }), { nx, ny, nz } = s.P; ball(s, 8, 8, 4, 3);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = s.idx(i, j, k); s.u[q] = 0.5 * Math.sin((j + 0.5) / 2.5); s.v[q] = 0.5 * Math.cos((i + 0.5) / 2.5); }
    const m0 = s.mass(); for (let t = 0; t < 30; t++) s.step(1 / 30);
    expect(Math.abs(s.mass() / m0 - 1)).toBeLessThan(0.02);
    { const c = s.centroid(); expect(Math.hypot(c[0] - 2, c[1] - 2, c[2] - 1)).toBeGreaterThan(0.05); }   // and it did move
  });
  it('leaves no divergence: after the projection at most 5 % of what was before', () => {
    const s = new VolumeSim({ open: true }), { nx, ny, nz } = s.P;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.u[s.idx(i, j, k)] = 2 * Math.max(0, 1 - Math.hypot(i - 8, j + 0.5 - 8, k + 0.5 - 3) / 2);
    const d0 = maxAbs(s.divergence()); s.pressure(s.P.iters); s.project(); const d1 = maxAbs(s.divergence());
    expect(d0).toBeGreaterThan(0.5); expect(d1).toBeLessThan(d0 * 0.05);
  });
  it('lifts hot smoke and lets cold dust settle', () => {
    const hot = new VolumeSim({ open: false, nz: 12, wind: [0, 0] }); hot.inject([{ x: 2, y: 2, z: 0.8, r: 0.4, smoke: 0.8, dust: 0, T: 160, vx: 0, vy: 0, vz: 0 }]);
    const z0 = hot.centroid()[2]; for (let t = 0; t < 30; t++) hot.step(1 / 30); expect(hot.centroid()[2]).toBeGreaterThan(z0 + 0.03);
    const dust = new VolumeSim({ open: false, nz: 12, wind: [0, 0] }); dust.inject([{ x: 2, y: 2, z: 1.8, r: 0.4, smoke: 0, dust: 0.8, T: 5, vx: 0, vy: 0, vz: 0 }]);
    const y0 = dust.centroid(dust.D)[2]; for (let t = 0; t < 30; t++) dust.step(1 / 30); expect(dust.centroid(dust.D)[2]).toBeLessThan(y0 - 0.1);
  });
  it('keeps solids empty, and a flow at a wall goes round it (smoke behind the wall)', () => {
    const s = new VolumeSim({ ...still, nx: 24, ny: 16, nz: 8, open: true, wind: [2, 0], drag: 2 }), { nx, ny } = s.P;
    // a wall across the middle, 1 m high, with gaps at its ends: x cells 11..12, y cells 3..12
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.top[i + nx * j] = i >= 11 && i <= 12 && j >= 3 && j <= 12 ? 1.0 : 0;
    const E: VolEmit[] = [{ x: 1.0, y: 2.0, z: 0.5, r: 0.35, smoke: 0.5, dust: 0, T: 0, vx: 2, vy: 0, vz: 0 }];
    for (let t = 0; t < 120; t++) s.step(1 / 30, t % 2 ? [] : E);
    let inSolid = 0, behind = 0; for (let k = 0; k < s.P.nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = s.idx(i, j, k); if (s.solid[q]) inSolid = Math.max(inSolid, s.S[q]!); else if (i >= 14 && j >= 5 && j <= 10 && k < 4) behind += s.S[q]!; }
    expect(inSolid).toBe(0); expect(behind).toBeGreaterThan(0.05);
    // with no wall the flow is not turned: the smoke behind the wall's place comes the straight way, so the wall's case is
    // also checked against a flow pointed at the wall's middle: it splits round both ends
    const s2 = new VolumeSim({ ...still, nx: 24, ny: 16, nz: 8, open: true, wind: [2, 0], drag: 2 });
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s2.top[i + nx * j] = i >= 11 && i <= 12 && j >= 3 && j <= 12 ? 1.6 : 0;
    const E2: VolEmit[] = [{ x: 3.0, y: 2.0, z: 0.5, r: 0.5, smoke: 0.5, dust: 0, T: 0, vx: 2, vy: 0, vz: 0 }];
    for (let t = 0; t < 150; t++) s2.step(1 / 30, t % 2 ? [] : E2);
    let left = 0, right = 0; for (let k = 0; k < 4; k++) for (let i = 14; i < nx; i++) { for (let j = 0; j < 3; j++) left += s2.S[s2.idx(i, j, k)]!; for (let j = 13; j < ny; j++) right += s2.S[s2.idx(i, j, k)]!; }
    expect(left).toBeGreaterThan(0.05); expect(right).toBeGreaterThan(0.05);
  });
  it('is bored through by a box driven through it; the hole stays clear 2 s (the cut, V4) and fills again slowly', () => {
    const P: Partial<VolParams> = { nx: 40, ny: 16, nz: 10, h: 0.4, open: true, fade: 0, wind: [0, 0], alpha: 0, betaS: 0, edge: 0 };
    const bank = () => { const s = new VolumeSim(P), { nx, ny, nz } = s.P;   // a bank of smoke 0.8 dense, up to 2 m, across the middle third
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.S[s.idx(i, j, k)] = i >= 12 && i < 30 && k < 5 ? 0.8 : 0; return s; };
    const s = bank(), ref = bank(), at = (v: VolumeSim) => v.densityAt(8.4, 3.2, 0.6), step = () => { s.step(1 / 30); ref.step(1 / 30); };
    const car = { x: 1, y: 3.2, z: 0.7, hx: 2.0, hy: 0.85, hz: 0.6, yaw: 0, vx: 12, vy: 0, vz: 0 };
    for (; car.x < 15.5; car.x += car.vx / 30) { s.step(1 / 30, [], [car]); ref.step(1 / 30); }
    expect(at(s)).toBeLessThan(at(ref) * 0.2);   // the hole, just after (the same smoke without the car beside it)
    for (let n = 0; n < 60; n++) step(); expect(at(s)).toBeLessThan(at(ref) * 0.35);   // still clear two seconds on
    for (let n = 0; n < 180; n++) step(); expect(at(s)).toBeGreaterThan(at(ref) * 0.5);   // filled again by 8 s
  });
  it('moved by whole cells, keeps the smoke where it is in the world', () => {
    const s = new VolumeSim({ ...still }); ball(s, 8, 8, 4, 3); const pts: [number, number, number][] = [[2, 2, 1], [2.3, 1.8, 0.9], [1.6, 2.4, 1.2]], a = pts.map(p => s.densityAt(...p));
    s.shift(1, -1, 0); expect(s.origin[0]).toBeCloseTo(0.25); expect(s.origin[1]).toBeCloseTo(-0.25);
    pts.forEach((p, i) => expect(s.densityAt(...p)).toBeCloseTo(a[i]!, 5));
  });
  it('gives the same smoke from the same seed', () => {
    const run = (seed: number) => { const s = new VolumeSim(); let r = seed; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
      for (let t = 0; t < 20; t++) s.step(1 / 30, [{ x: 1 + rnd() * 2, y: 1 + rnd() * 2, z: 0.4, r: 0.35, smoke: 0.7, dust: 0, T: 150, vx: rnd() - 0.5, vy: rnd() - 0.5, vz: 0.5 }]); return s.S; };
    const a = run(3), b = run(3), c = run(4); expect(Array.from(a)).toEqual(Array.from(b)); expect(Array.from(a)).not.toEqual(Array.from(c));
  });
  it('lights the smoke: deeper inside, less of the sun', () => {
    const s = new VolumeSim({ ...still, nz: 8 }); ball(s, 8, 8, 4, 5, 0.8); const L = s.light([0, 0, 1]), mx = 8, my = 8, at = (i: number, j: number, k: number) => L[i + mx * (j + my * k)]!;
    expect(at(4, 4, 3)).toBeGreaterThan(at(4, 4, 0)); expect(at(0, 0, 3)).toBeGreaterThan(0.9);
  });
});

describe('the volume on the GPU: the atlas and the quality chosen', () => {
  it('lays the slices out as tiles and finds each cell again', () => {
    const A = atlasLayout(64, 64, 24); expect(A.cols * A.rows).toBeGreaterThanOrEqual(24); expect(A.w).toBe(64 * A.cols); expect(A.h).toBe(64 * A.rows);
    for (const [i, j, k] of [[0, 0, 0], [63, 63, 23], [5, 9, 13]] as const) { const [x, y] = atlasTexel(A, i, j, k); expect(atlasCell(A, x, y)).toEqual([i, j, k]); }
  });
  it('falls back to the parcels without float render targets, and keeps "off" off', () => {
    const full: GpuCaps = { webgl2: true, floatRT: true, halfRT: true, maxTex: 8192, coarse: false };
    expect(smokeTier('high', full)).toBe('high'); expect(smokeTier('mid', { ...full, coarse: true })).toBe('low');
    expect(smokeTier('high', { ...full, floatRT: false, halfRT: false })).toBe('parcels'); expect(smokeTier('mid', { ...full, webgl2: false })).toBe('parcels');
    expect(smokeTier('off', full)).toBe('off'); expect(smokeTier('parcels', full)).toBe('parcels');
  });
});
describe('the volume drawn: the noise, the ray\'s matrix, the cars as boxes', () => {
  it('makes cellular noise that tiles: 1 near each cell\'s point, falling off between, the same at the opposite sides', () => {
    const N = worley(), S = 32, at = (x: number, y: number, z: number, c: number) => N[(((x + S) % S) + S * (((y + S) % S) + S * ((z + S) % S))) * 2 + c]!;
    for (const c of [0, 1]) { let mx = 0, mn = 255; for (let q = c; q < N.length; q += 2) { mx = Math.max(mx, N[q]!); mn = Math.min(mn, N[q]!); } expect(mx).toBeGreaterThan(230); expect(mn).toBeLessThan(90);
      let jump = 0; for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) jump = Math.max(jump, Math.abs(at(0, y, z, c) - at(S - 1, y, z, c))); expect(jump).toBeLessThan(80); }
  });
  it('inverts the view matrix (the march unprojects each pixel with it)', () => {
    const m = new Float32Array([1.2, 0.1, 0, 0, -0.2, 0.9, 0.3, 0, 0, -0.4, 1.1, -1, 3, 2, -5, 6]), r = invert(m)!;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += m[i + 4 * k]! * r[k + 4 * j]!; expect(s).toBeCloseTo(i === j ? 1 : 0, 4); }
    expect(invert(new Float32Array(16))).toBeNull();
  });
  it('gives each car two boxes, its lower body and its cabin, moving with it; at most four cars', () => {
    const car = { x: 10, y: 5, z: 0.5, yaw: 0.3, vx: 12, vy: 3, len: 4.4, width: 1.8, height: 1.3 }, B = carBoxes([car]);
    expect(B).toHaveLength(2); for (const b of B) { expect(b.vx).toBe(12); expect(b.yaw).toBe(0.3); expect(b.z - b.hz).toBeGreaterThanOrEqual(car.z); expect(b.z + b.hz).toBeLessThanOrEqual(car.z + car.height + 1e-9); }
    expect(B[0]!.hx).toBeLessThan(car.len / 2); expect(B[1]!.hz + B[1]!.z).toBeGreaterThan(B[0]!.z + B[0]!.hz);
    expect(carBoxes(Array(6).fill(car))).toHaveLength(8);
  });
});
