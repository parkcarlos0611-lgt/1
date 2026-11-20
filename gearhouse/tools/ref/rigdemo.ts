// The 1948 utility driven over a test course in the side view, with its running gear (review 24, technology check).
// Physics: physics/rig.ts. Drawing: render/car/running.ts plus the Z designs data/bodies/lr48_right.json and
// lr48_chassis_right.json, drawn once and placed column by column (no picture is turned).
// npx tsx tools/ref/rigdemo.ts <out dir>   -> f0000.png ... (top: as seen, bottom: the body as a line, the chassis in full)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { rasterizeFlat } from '../../render/car/flat';
import { turnDesign } from '../../render/car/pose';
import { Canvas, tyre, leafSpring, damper, shaft, paintSteps, IRON, type RGB } from '../../render/car/running';
import { Rig, UTILITY48 } from '../../physics/rig';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';

const out = process.argv[2]!; mkdirSync(out, { recursive: true });
const J = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as CarDesign;
const right = J('data/bodies/lr48_right.json'), chassisD = J('data/bodies/lr48_chassis_right.json');
const RUNNING = new Set(['houseF', 'houseR', 'horn', 'chassis', 'crossR']);
// each sprung picture drawn at every whole degree of pitch from -8 to 8, from its outlines (render/car/pose.ts)
const PAD = 250, DEG = 8, CXmm = 1740, CZmm = 780;
const poses = (d: CarDesign, o: { outline?: number }) => Array.from({ length: DEG * 2 + 1 }, (_, k) => rasterizeFlat(turnDesign(d, k - DEG, CXmm, CZmm, PAD), { shadow: false, ...o }));
const MODE = process.env.POSE ?? 'turn';                                                            // 'turn': drawn per degree; 'shear': one picture, columns moved
const bodyP = poses({ ...right, wheels: [], panels: right.panels.filter(p => !RUNNING.has(p.id)) }, {});
const houseP = poses({ ...right, wheels: [], features: [], panels: right.panels.filter(p => p.id.startsWith('house')) }, { outline: 1 });
const chassisP = poses({ ...chassisD, wheels: [] }, { outline: 1 });
const PAINT = paintSteps(right.paint);

// ---- the course: two tracks, near and far ----
const hs = (x: number, a: number, b: number, h: number) => (x > a && x < b ? h * Math.sin((x - a) / (b - a) * Math.PI) : 0);
const base = (x: number) => -0.12 * (x > 19 && x < 20.6 ? (1 - Math.cos((x - 19) / 1.6 * Math.PI * 2)) / 2 : 0) - (x < 25 ? 0 : x < 25.08 ? 0.22 * (x - 25) / 0.08 : 0.22)
  + (x > 30 && x < 34 ? 0.022 * Math.sin((x - 30) / 0.5 * Math.PI * 2) : 0);
const ground = { near: (x: number) => base(x) + hs(x, 9, 9.45, 0.13), far: (x: number) => base(x) + hs(x, 14, 14.55, 0.15) + (x > 30 && x < 34 ? 0.022 * Math.sin((x - 30.25) / 0.5 * Math.PI * 2) - 0.022 * Math.sin((x - 30) / 0.5 * Math.PI * 2) : 0) };
const rig = new Rig(UTILITY48, ground, 2);
rig.run(1.2);                                                                                        // settle on the springs

// ---- placing things ----
const W = 560, H = 230, SC = 100, FO: [number, number] = [4, -3], CX = 1.74, S = UTILITY48;
let camX = rig.x, camY = 0;
const sx = (wx: number) => W / 2 + (wx - camX) * SC, sy = (wy: number) => H - 30 - (wy - camY) * SC;
const P = (x: number, y: number, far = false): [number, number] => [sx(x) + (far ? FO[0] : 0), sy(y) + (far ? FO[1] : 0)];
/** world point of a sprung design point (mm, right-side design coordinates) */
const sprung = (xd: number, zd: number, side: number) => { const lx = xd / 1000 - CX; return { x: rig.x + lx, y: rig.y + (zd / 1000 - S.comH) + lx * rig.th + side * S.halfSpringTrack * rig.ph }; };
/** screen pixel -> picture pixel for a sprung picture: pitch moves whole columns, the squash scales rows about the frame */
const pick = (P: ReturnType<typeof rasterizeFlat>[]) => { const deg = rig.th * 180 / Math.PI, k = MODE === 'turn' ? Math.max(-DEG, Math.min(DEG, Math.round(deg))) : 0; return { img: P[k + DEG]!, rest: rig.th - k * Math.PI / 180 }; };
const sprungMap = (P: ReturnType<typeof rasterizeFlat>[], side: number, squash: boolean) => { const { img, rest } = pick(P); return { img, map: (X: number, Y: number): [number, number] | null => {
  const wx = camX + (X + 0.5 - W / 2) / SC, lx = wx - rig.x, wy = camY + (H - 30 - Y - 0.5) / SC, z0 = 0.45 - S.comH;
  let z = wy - rig.y - lx * rest - side * 0.77 * rig.ph; if (squash) z = (z - z0) / (1 + rig.jig) + z0;                       // z from the centre of mass
  return [Math.floor(img.X(lx * 1000 + CXmm + PAD)), Math.floor(img.Y(z * 1000 + CZmm + PAD))]; } }; };
const blitS = (cv: Canvas, P: ReturnType<typeof rasterizeFlat>[], side: number, squash: boolean, only?: Parameters<Canvas['blit']>[3]) => { const m = sprungMap(P, side, squash); cv.blit(m.img, m.map, box, only); return m.img; };
const box: [number, number, number, number] = [0, 0, W, H];
const SKY: RGB = [184, 205, 214], SOIL = ([[150, 128, 98], [128, 108, 82], [106, 88, 68], [84, 70, 56]] as RGB[]), FAR: RGB = [52, 58, 74];
const L0: number[][] = [];

function corner(cv: Canvas, axle: 0 | 1, side: 1 | -1) {
  const far = side < 0, hx = rig.x + S.axleX[axle], ay = rig.ay[axle] + side * S.halfSpringTrack * rig.aph[axle];
  const [fixedX, shackleX] = axle === 0 ? [3220, 2300] : [1160, 260];
  const A = sprung(fixedX, 365, side), Pp = sprung(shackleX, 380, side), Sx = { x: hx, y: ay + 0.075 }, l = 0.1, away = Math.sign(Pp.x - Sx.x);
  const E = (a: number) => ({ x: Pp.x + away * l * Math.sin(a), y: Pp.y - l * Math.cos(a) }), len = (a: number) => Math.hypot(A.x - Sx.x, A.y - Sx.y) + Math.hypot(Sx.x - E(a).x, Sx.y - E(a).y);
  const key = axle * 2 + (far ? 1 : 0); (L0[key] ??= [len(0)]);
  let lo = -0.9, hi = 0.9; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (len(m) < L0[key]![0]!) lo = m; else hi = m; }
  const e = E((lo + hi) / 2);
  leafSpring(cv, P(A.x, A.y, far), P(Sx.x, Sx.y, far), P(e.x, e.y, far), P(Pp.x, Pp.y, far));
  const T = sprung(axle === 0 ? 2610 : 860, 520, side), B = { x: hx + (axle === 0 ? -0.13 : 0.13), y: ay - 0.05 };
  damper(cv, P(T.x, T.y, far), P(B.x, B.y, far));
}
function wheel(cv: Canvas, k: number) {
  const t = rig.tyres[k]!, far = t.side < 0, ring = t.p.map(q => P(q.x, q.y, far)), hub = P(t.hub.x, t.hub.y, far);
  tyre(cv, ring, hub, S.wheelR * 0.6 * SC, -t.angle, PAINT, { tread: true, capR: 0.07 * SC });
}
function ground2(cv: Canvas, far: boolean) {
  for (let X = 0; X < W; X++) { const wx = camX + (X + 0.5 - (far ? FO[0] : 0) - W / 2) / SC, g = far ? ground.far(wx) : ground.near(wx), top = Math.round(sy(g) + (far ? FO[1] : 0));
    for (let Y = Math.max(0, top); Y < H; Y++) { const d = Y - top, n = ((Math.floor(wx * 100) * 73856093) ^ (Y * 19349663)) >>> 0;
      cv.px(X, Y, far ? (d === 0 ? [96, 84, 70] : [78, 68, 58]) : d === 0 ? SOIL[0]! : d === 1 ? SOIL[1]! : (n % 23 === 0 ? SOIL[3]! : SOIL[2]!)); } }
}
function frame(xray: boolean): Canvas {
  const cv = new Canvas(W, H); cv.fill(SKY);
  ground2(cv, true);
  blitS(cv, houseP, 1, false);
  cv.dim = 0.42; cv.dimTo = FAR; corner(cv, 0, -1); corner(cv, 1, -1); wheel(cv, 1); wheel(cv, 3); cv.dim = 0;
  blitS(cv, chassisP, 0, false);
  for (const axle of [0, 1] as const) { const hx = rig.x + S.axleX[axle], ay = rig.ay[axle];
    cv.disc(...P(hx, ay), 0.13 * SC, (dx, dy, q) => (q > 0.85 ? [14, 13, 18] : IRON[(-dx - dy) > 2 ? 3 : 2]!));                       // the axle's differential
    const out = sprung(axle === 0 ? 1900 : 1650, 380, 0), pin = { x: hx + (axle === 0 ? -0.17 : 0.17), y: ay - 0.02 };
    shaft(cv, P(out.x, out.y), P(pin.x, pin.y)); }
  corner(cv, 0, 1); corner(cv, 1, 1); wheel(cv, 0); wheel(cv, 2);
  if (!xray) blitS(cv, bodyP, 1, true);
  else { const bodyImg = pick(bodyP).img; const edge = (sx2: number, sy2: number) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const o = ((sy2 + dy) * bodyImg.w + sx2 + dx) * 4; if (sx2 + dx < 0 || sy2 + dy < 0 || sx2 + dx >= bodyImg.w || sy2 + dy >= bodyImg.h || bodyImg.rgba[o + 3]! < 128) return true; } return false; };
    const prev = cv.rgba.slice(); blitS(cv, bodyP, 1, true, (_r, _g, _b, _a, x, y) => edge(x, y));
    for (let i = 0; i < W * H; i++) if (cv.rgba[i * 4] !== prev[i * 4] || cv.rgba[i * 4 + 1] !== prev[i * 4 + 1]) { cv.rgba[i * 4] = 236; cv.rgba[i * 4 + 1] = 240; cv.rgba[i * 4 + 2] = 228; } }
  ground2(cv, false);
  return cv;
}

// ---- drive the course ----
const FPS = 20, frames = Math.round(Number(process.argv[3] ?? 8.5) * FPS), log: string[] = [];
for (let f = 0; f < frames; f++) {
  rig.throttle = Math.max(0, Math.min(1, (4.2 - rig.vx) * 0.7));
  rig.run(1 / FPS);
  camX += (rig.x + 0.15 - camX) * 0.5; camY += (rig.y - 0.74 - camY) * 0.25;
  const a = frame(false), b = frame(true), img = new Uint8ClampedArray(W * H * 2 * 4); img.set(a.rgba, 0); img.set(b.rgba, W * H * 4);
  writeFileSync(`${out}/f${String(f).padStart(4, '0')}.png`, encodePNG(W, H * 2, img));
  log.push(`${(f / FPS).toFixed(2)} x ${rig.x.toFixed(2)} v ${rig.vx.toFixed(2)} pitch ${(rig.th * 57.3).toFixed(1)} roll ${(rig.ph * 57.3).toFixed(1)} springs ${rig.defl.flat().map(v => (v * 1000).toFixed(0)).join(' ')} squash ${(rig.jig * 100).toFixed(1)}%`);
}
writeFileSync(`${out}/log.txt`, log.join('\n')); console.log(frames, 'frames in', out);
