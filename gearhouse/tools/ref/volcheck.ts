// The volumetric smoke's GPU passes against the CPU reference (docs/systems/104 B-4, step V2): the same start, puffs and
// a box driven through, on a small grid, both run; the GPU's fields read back and compared (the sums, the correlation).
// Built with tools/ref/buildsite.mjs onto tools/ref/volcheck.html; the result is written on the page and kept as
// window.__volcheck.
import { VolumeSim, VOL_DEFAULT, type VolEmit, type VolBox, type VolParams } from '../../race/volume/sim';
import { GpuVolume } from '../../render/live/volume/simgpu';
import { gpuCaps } from '../../render/live/volume/caps';

function corr(a: Float32Array, b: Float32Array): number { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]!; mb += b[i]!; } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const x = a[i]! - ma, y = b[i]! - mb; sab += x * y; saa += x * x; sbb += y * y; } return sab / Math.sqrt(saa * sbb + 1e-30); }
const sum = (a: Float32Array) => a.reduce((s, x) => s + x, 0);
function run(P: Partial<VolParams>, frames: number) { const c = document.createElement('canvas'), gl = c.getContext('webgl2')!, caps = gpuCaps(gl);
  const prm: VolParams = { ...VOL_DEFAULT, ...P }, cpu = new VolumeSim(prm), gpu = new GpuVolume(gl, prm);
  const { nx, ny } = prm, top = new Float32Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) top[i + nx * j] = i >= 10 && i <= 11 && j >= 4 && j <= 11 ? 0.8 : 0.1;   // the ground and a wall
  cpu.top.set(top); gpu.setTop(top);
  const t0 = performance.now(); let tg = 0;
  for (let f = 0; f < frames; f++) { const E: VolEmit[] = f % 3 ? [] : [{ x: 0.9 + 0.1 * Math.sin(f), y: 2.0, z: 0.4, r: 0.35, smoke: 0.8, dust: f % 2 ? 0.3 : 0, T: 150, vx: 1.5, vy: 0.2, vz: 0.6 }];
    const box: VolBox = { x: -1 + f * 0.12, y: 1.2, z: 0.5, hx: 0.6, hy: 0.35, hz: 0.3, yaw: 0.1, vx: 3.6, vy: 0, vz: 0 };
    cpu.step(1 / 30, E, [box]); const a = performance.now(); gpu.step(1 / 30, E, [box]); gl.finish(); tg += performance.now() - a; }
  const [S, D, T] = gpu.read('scal'), [U, V, W] = gpu.read('vel');
  cpu.light(norm([-0.45, 0.35, 0.82])); gpu.lightPass(norm([-0.45, 0.35, 0.82])); const Lg = gpu.read('light')[0]!, Lc = cpu.light(norm([-0.45, 0.35, 0.82]));
  const dc = cpu.S.map((x, i) => x + cpu.D[i]!), dg = S!.map((x, i) => x + D![i]!);
  pics.push([dc, dg, prm.nx, prm.ny, prm.nz, P.open ? '열린 상자' : '닫힌 상자']);
  return { caps, grid: `${prm.nx}x${prm.ny}x${prm.nz}`, frames, cpuMs: +(performance.now() - t0 - tg).toFixed(1), gpuMs: +tg.toFixed(1),
    sumCpu: +sum(dc).toFixed(4), sumGpu: +sum(dg).toFixed(4), sumErr: +(Math.abs(sum(dg) / sum(dc) - 1) * 100).toFixed(2), corrDensity: +corr(dc, dg).toFixed(4),
    corrDust: +corr(cpu.D, D!).toFixed(4), corrHeat: +corr(cpu.T, T!).toFixed(4), corrU: +corr(cpu.u, U!).toFixed(4), corrV: +corr(cpu.v, V!).toFixed(4), corrW: +corr(cpu.w, W!).toFixed(4), corrLight: +corr(Lc, Lg).toFixed(4) }; }
function norm(v: number[]): [number, number, number] { const l = Math.hypot(...v); return [v[0]! / l, v[1]! / l, v[2]! / l]; }
/** each run's smoke seen from above and from the side (the density summed along the view), the CPU's left, the GPU's right */
const pics: [Float32Array, Float32Array, number, number, number, string][] = [];
function draw() { const S = 14, cv = document.createElement('canvas'), W = 2 * 16 * S + 3 * 20, H = pics.length * (16 + 8 + 24) * S / 1 + 40; cv.width = W; cv.height = 2 * (16 * S + 8 * S + 60) + 20; const x = cv.getContext('2d')!;
  x.fillStyle = '#1b1a18'; x.fillRect(0, 0, cv.width, cv.height); x.font = '16px sans-serif'; void H;
  pics.forEach(([a, b, nx, ny, nz, name], r) => { const y0 = r * (ny * S + nz * S + 60) + 10;
    [a, b].forEach((F, c) => { const x0 = 20 + c * (nx * S + 20); x.fillStyle = '#ebe7de'; x.fillText(`${name} · ${c ? 'GPU' : 'CPU'}`, x0, y0 + 16);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let m = 0; for (let k = 0; k < nz; k++) m += F[i + nx * (j + ny * k)]!; const g = Math.min(255, Math.round(m * 60)); x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(x0 + i * S, y0 + 24 + (ny - 1 - j) * S, S, S); }
      for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { let m = 0; for (let j = 0; j < ny; j++) m += F[i + nx * (j + ny * k)]!; const g = Math.min(255, Math.round(m * 60)); x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(x0 + i * S, y0 + 28 + ny * S + (nz - 1 - k) * S, S, S); } }); });
  return cv; }
const out = { closed: run({ open: false }, 45), open: run({ open: true }, 45) };
(globalThis as { __volcheck?: unknown }).__volcheck = out; document.body.textContent = JSON.stringify(out, null, 1); document.body.prepend(draw());
