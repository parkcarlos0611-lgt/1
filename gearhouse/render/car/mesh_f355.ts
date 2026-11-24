// The 1994 Ferrari F355 Berlinetta as a low-polygon mesh (docs/systems/70_mesh_car_rules.md), built panel by panel from
// the dimension sheet data/cars/spec/f355.json (docs/systems/88_f355_sheet.md).
//
// One skin of stations runs from the nose to the tail; every station is a chain of 21 points from the centre line of
// the top round the flank to the tuck under the sill, and the same columns carry different panels along the car:
//   top         the bonnet and the front wings (the pop-up lamp covers flush in the slope, hinged at their back edge),
//               warped at its back so its last row is the screen's bowed foot; in the cabin the same columns sink to
//               the dash, the floor and the doors' inner walls (a hollow cockpit); behind it they are the shelf, the
//               gutter beside the louvred engine cover and the deck
//   flank       the crest, a rounded shoulder down to the crease (the widest line, round the whole car), the long side
//               scoop cut in under it (extra columns that stand in from the skin: a tapering channel from the door's
//               front third back to the dark intake), the sill with its lip and the dark sill slot, the foot, the tuck;
//               the arches are cut by clamping the chain to the arch
//   nose, tail  caps of rows going round from the centre line to the first and last station (the columns keep their
//               order, so the bumpers, the lip, the tail panel and the ducktail come out of the same chain)
//   glasshouse  the screen with its body-coloured pillars, the roof, the side glass (door glass, black B pillar,
//               the quarter glass running to a point), the flying buttresses falling to the tail, the upright rear glass
//               sunk between them
//   cover       the louvred engine cover: two rows of slots round a raised centre panel; under it a dark bay with the
//               longitudinal V8 of render/car/enginemesh.ts, its red intakes seen between the slots
// Axes: x from the nose back, y across, z up; mm. Axles at 1032 and 3482. `lamps` 0..1 raises the head lamps.
import { Build, type Mesh, type V } from './mesh';
import { addEngine, ENGINES } from './enginemesh';

const PAINT = '#f5c300', GLOSS = 0.6, BLACK = '#0d0d10', FRAME = '#16171b', DARK = '#121216', TRIM = '#2a2a2e', GLASS = '#a9c2cc', SILVER = '#c3c6ca', CHROME = '#d4d6d9', RUBBER = '#242328';
const SHADE = '#2a2008';   // the intake's dark inside
const LENS = '#eef0f2', RED = '#e3281c', SMOKE = '#4a1214', AMBER = '#e8a040', TAN = '#b8763a', TAN2 = '#8e5a2c', SEAM = '#5a4300', WHITE = '#e8e6de';
const L = 4250, FX = 1032, RX = 3482, RF = 319, RR = 335, WYF = 757, WYR = 808, TWF = 225, TWR = 265;      // axles, tyre radii, half tracks, tyre widths
const RAF = 345, RAR = 360, YINF = 600, YINR = 630;                                                          // arch radii, the wells' inner walls
const XN = 160, XW = 1060, XA = 1442, XD = 1490, XR0 = 1971, XR1 = 2730, XB0 = 2640, XB1 = 2700, XQ = 3227, XS = 3565, XC0 = 2930, XC1 = 3990, XT = 4040;
// the first station, the bonnet's back edge (where the top starts to bow to the screen), the screen's corner, the door's
// front edge, the roof's front corner and back edge, the B pillar, the quarter glass's tip, the buttresses' tips, the
// louvred cover, the last station
type Tri = [V, V, V];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], un = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t, mix = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mir = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
/** straight runs through a table of [x, value] given with x falling */
function lin(tab: [number, number][]): (x: number) => number { return x => { if (x >= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x >= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; }; }
/** a smooth curve through a table of [x, value] (x rising): a monotone cubic, it never overshoots a point */
function curve(tab: [number, number][]): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }

// ---- the lines along the car (the sheet's tables, smoothed) ----
/** the front top's centre line: the nose rolling over into the long straight bonnet, the cowl */
const ZT = curve([[0, 450], [60, 490], [XN, 545], [300, 604], [450, 655], [600, 700], [800, 748], [1000, 785], [1100, 805], [1160, 812], [1500, 812]]);
/** half the width at the crease (the plan's widest line) */
const W = curve([[XN, 795], [253, 830], [338, 850], [422, 865], [507, 879], [591, 890], [700, 899], [930, 906], [1076, 913], [1266, 921], [1450, 932], [1880, 939], [2660, 943], [3000, 947], [3230, 949], [3460, 943], [3570, 933], [3735, 922], [3925, 910], [4010, 896], [XT, 885]]);
/** the crease's height: the bumper's top line at the nose, rising gently along the door to the rear wing */
const ZH = curve([[XN, 500], [1000, 505], [1450, 528], [2000, 558], [2650, 594], [3000, 600], [XT, 605]]);
/** the sill's foot */
const ZG = curve([[XN, 150], [700, 138], [1400, 118], [3100, 112], [3842, 170], [XT, 192]]);
/** the crest: the front wings' top edge, the belt under the side glass, the quarter glass's foot, the deck's edge */
const YKF = curve([[XN, 762], [460, 790], [700, 818], [1032, 832], [1300, 812], [XA, 765]]);
const YKR = curve([[XA, 765], [2000, 768], [2650, 775], [3100, 798], [XS, 795], [3900, 772], [XT, 745]]);
const ZKR = curve([[XA, 790], [2000, 805], [2650, 825], [2800, 846], [3000, 862], [3150, 869], [3400, 867], [XS, 862], [3750, 860], [3900, 866], [XT, 877]]);
/** the screen's foot in plan (bowed forward at the centre) */
const footX = (y: number) => 1160 + (XA - 1160) * (Math.min(y, 765) / 765) ** 2;
/** the front top: nearly flat across, the wings a touch proud over the front wheels, rolling off toward the crest */
const zTop = (x: number, y: number) => { const r = y / 760; return ZT(x) - 24 * r * r + 26 * sm(560, 820, x) * (1 - sm(1250, 1420, x)) * sm(0.5, 0.9, r); };
/** the cockpit's floor (the dash's top at its front edge) */
const ZFL = curve([[XD, 798], [1560, 470], [1640, 215], [XB1, 215]]);
/** the rear deck's centre: the shelf under the rear glass, the louvred cover falling back, the ducktail rising */
const ZCV = curve([[XB1, 902], [XC0, 896], [3200, 883], [3500, 866], [3650, 856], [3800, 846], [3940, 838], [XC1, 846], [XT, 876]]);
const crown = (y: number) => 14 * (y / 600) ** 2;
/** the cover's edge, the buttresses' inner foot, their inner top edge, their outer top edge and its height */
const CE = curve([[XB1, 470], [XC0, 470], [3500, 535], [4080, 600]]), BF = curve([[XB1, 495], [3100, 520], [XS, 572]]);
const YBI = curve([[XR1, 500], [3100, 540], [XS, 622]]), YBO = curve([[XR1, 590], [3100, 625], [XS, 650]]);
const BT = curve([[XR1, 1112], [2850, 1080], [3000, 1036], [3200, 976], [3400, 912], [XS, 866]]);
/** the roof: its centre line, the rail's height, the half-width at the A pillar's inner edge */
const ZRC = curve([[XR0 + 89, 1160], [2200, 1168], [2350, 1170], [2500, 1166], [2620, 1157], [XR1, 1140]]), ZRL = curve([[XR0, 1100], [2150, 1118], [2450, 1120], [XR1, 1112]]);
const YRL = 590, YRI = (x: number) => lerp(540, 500, sm(XR0, XR1, x));
const roofX = (y: number) => XR0 + 89 * (1 - (y / 540) ** 2), roofZ = (x: number, y: number) => { const c = ZRC(x), r = ZRL(x); return c - (c - r) * Math.min(1, y / YRL) ** 3; };
/** the wheel arches: round over each hub */
const archZ = (x: number) => Math.abs(x - FX) < RAF - 0.5 ? RF + Math.sqrt(RAF * RAF - (x - FX) ** 2) : Math.abs(x - RX) < RAR - 0.5 ? RR + Math.sqrt(RAR * RAR - (x - RX) ** 2) : 0;

// ---- the stations and the chain ----
const arcS = (hx: number, ra: number) => Array.from({ length: 9 }, (_, k) => Math.round(hx - ra * Math.cos(k * 22.5 * Math.PI / 180)));
const SF = [XN, 260, 360, 460, 560, 630, ...arcS(FX, RAF).slice(0, 5), XW, ...arcS(FX, RAF).slice(5), XA, XD, 1560, 1640, 1720, 1800, 1880, XR0, 2060, 2150, 2250, 2350, 2450, 2530, 2585, 2615, XB0, XB1, XR1, 2760, 2840, XC0, 3030,
  ...arcS(RX, RAR).slice(0, 5), XS, ...arcS(RX, RAR).slice(5), 3920, XC1, XT], NS = SF.length;
const at = (x: number) => { const i = SF.indexOf(x); if (i < 0) throw new Error(`f355: no station at ${x}`); return i; };
// the chain's columns
const T2 = 2, T3 = 3, T4 = 4, K = 5, S1 = 6, H = 9, A = 10, AI = 11, BI = 12, CI = 13, C = 14, S = 15, SI = 16, FI = 17, F = 18, G = 19, U = 20, NCH = 21;
/** the shoulder's arc from the crest K (level there) down to the crease H (upright there) */
function band(Kp: V, Hp: V, t: number): V { const dz = Kp[2] - Hp[2], P1: V = [lerp(Kp[0], Hp[0], 0.6), lerp(Kp[1], Hp[1], 0.62), Kp[2] - 0.1 * dz], P2: V = [Hp[0], Hp[1], Hp[2] + 0.5 * dz], v = 1 - t;
  return [0, 1, 2].map(k => v * v * v * Kp[k]! + 3 * v * v * t * P1[k]! + 3 * v * t * t * P2[k]! + t * t * t * Hp[k]!) as V; }
/** how far the flank stands in from the crease at height z: the door's face, the sill's lip at 250 and the step under it, the foot */
const INSET = lin([[400, 16], [330, 22], [262, 25], [252, 14], [240, 24], [190, 36], [150, 44], [100, 54]]);
const inset = (z: number, zH: number) => z >= 400 ? 16 * (zH - z) / Math.max(1, zH - 400) : INSET(z);
const yKat = (s: number) => s <= XA ? YKF(s) : YKR(s);
function crest(s: number): V { if (s <= XA) { const y = YKF(s), x = s <= XW ? s : XW + (s - XW) * (footX(y) - XW) / (XA - XW); return [x, y, zTop(x, y) - 6]; } return [s, YKR(s), ZKR(s)]; }
/** the flank's skin at station s and height z */
function surf(s: number, z: number): V { const Kp = crest(s), Hp: V = [s, W(s), ZH(s)]; if (z >= Kp[2]) return Kp; if (z < Hp[2]) return [s, Hp[1] - inset(z, Hp[2]), z];
  let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (band(Kp, Hp, m)[2] > z) lo = m; else hi = m; } return band(Kp, Hp, (lo + hi) / 2); }
/** the side scoop's depth and the sill slot's depth along the car */
const scoopD = (s: number) => 110 * sm(1560, 2400, s), slotD = (s: number) => 24 * sm(1640, 1900, s) * (1 - sm(2585, XB0, s));
/** how far the scoop's edges have closed toward its middle: a round end at the B pillar's foot */
const scoopEnd = (s: number) => { const t = Math.max(0, Math.min(1, (s - 2440) / (XB0 - 2440))); return 1 - Math.sqrt(1 - t * t); };
const inScoop = (s: number) => s >= 1560 && s <= XB0;
/** the top's columns at station s: y and z for the bonnet, the cockpit, the shelf and deck (by zone) */
function top(s: number): V[] { const Kp = crest(s);
  if (s <= XA) return [0, 200, 432, 590, 735].map(y => { const x = s <= XW ? s : XW + (s - XW) * (footX(y) - XW) / (XA - XW); return [x, y, zTop(x, y)] as V; }).concat([Kp]);
  if (s <= XB1) { const zc = ZFL(s), zt = Math.max(zc, 330); return [[s, 0, zt], [s, 130, zt], [s, 175, zc], [s, 690, zc], [s, 722, Kp[2] - 18], Kp]; }
  const zc = ZCV(s), ye = CE(s), y4 = s < XS ? BF(s) : lerp(ye, Kp[1], 0.5), z4 = s < XS ? zc - crown(y4) - 6 : lerp(zc - crown(ye), Kp[2], 0.45);
  return [[s, 0, zc], [s, 160, zc - crown(160)], [s, 320, zc - crown(320)], [s, ye - 8, zc - crown(ye) - 4], [s, y4, z4], Kp]; }
/** the chain at station s: the top, then the flank down to the tuck; the scoop and the sill slot stand in; cut by the arches */
function chain(s: number): V[] { const out = top(s), Kp = out[K]!, Hp: V = [s, W(s), ZH(s)], zH = Hp[2];
  const sc = inScoop(s), u1 = sm(1560, 2400, s), zA0 = zH - 28 - (sc ? 30 * (1 - u1) : 0), zC0 = 330 + (sc ? 55 * (1 - u1) : 0), e = sc ? scoopEnd(s) : 0, zm = (zA0 + zC0) / 2;
  const zA = lerp(zA0, zm + 1, e), zC = lerp(zC0, zm - 1, e), d = scoopD(s) * (sc && s < XB0 ? 1 : 0), sd = slotD(s), zSi = 236, zFi = 206 + 18 * (1 - sm(1640, 2150, s));
  const inn = (p: V, dd: number): V => [p[0], p[1] - dd, p[2]];
  for (let k = 1; k < 4; k++) out.push(band(Kp, Hp, k / 4));
  out.push(Hp, surf(s, zA));
  if (d > 0.5) out.push(inn(surf(s, zA - 4), d), inn(surf(s, (zA + zC) / 2), d * 1.06), inn(surf(s, zC + 4), d)); else out.push(surf(s, zA), surf(s, (zA + zC) / 2), surf(s, zC));
  out.push(surf(s, zC), surf(s, 250));
  if (sd > 0.5) out.push(inn(surf(s, zSi), sd), inn(surf(s, zFi), sd)); else out.push(surf(s, 250), surf(s, 190));
  const Gp = surf(s, ZG(s)); out.push(surf(s, 190), Gp, [s, Gp[1] - 70, Gp[2] - 4]);
  const az = archZ(s); if (az > 0) for (let k = S1; k < NCH; k++) if (out[k]![2] < az) { const p = surf(s, az); out[k] = k === U ? [s, p[1] - 70, az] : p; }
  return out; }

// ---- the nose and the tail: rows going round from the centre line to the first / last station ----
/** per column (K down to the tuck): how far back from the nose and how high at the centre line */
const NX = [25, 14, 8, 5, 4, 4, 6, 12, 18, 22, 26, 6, 4, 40, 110, 150], NZ = [480, 474, 468, 462, 455, 440, 410, 380, 330, 290, 250, 215, 195, 165, 152, 146];
const NTX = [XN, 128, 96, 66, 42];                                                                           // the top columns' foremost points along the centre line
const TX = [4100, 4108, 4116, 4122, 4150, 4176, 4240, 4250, 4246, 4222, 4208, 4212, 4200, 4188, 4160, 4080], TZ = [858, 848, 836, 805, 720, 625, 606, 560, 470, 425, 405, 335, 240, 215, 198, 185];
const TTX = [XT, 4055, 4068, 4080, 4090], TTZ = [876, 878, 876, 872, 866];
const frN = (f: number) => Math.sqrt(Math.max(0, 1 - f * f)), frT = curve([[0, 1], [0.4, 0.97], [0.635, 0.9], [0.8, 0.82], [0.875, 0.75], [0.94, 0.6], [0.98, 0.4], [1, 0]]);
const NF = [0, 0.25, 0.47, 0.65, 0.79, 0.9, 0.955, 0.985], TFR = [0, 0.2, 0.388, 0.606, 0.75, 0.87, 0.94, 0.98];
const C0 = chain(XN), CT = chain(XT);
function noseRow(f: number): V[] { const g = sm(0.9, 1, f), r = frN(f);
  return C0.map((P, j) => { const y = f * P[1]; if (j < K) { const x = XN - (XN - NTX[j]!) * r; return [x, y, zTop(x, y)] as V; } return [XN - (XN - NX[j - K]!) * r, y, lerp(NZ[j - K]!, P[2], g)] as V; }); }
function tailRow(f: number): V[] { const g = sm(0.85, 1, f), r = frT(f);
  return CT.map((P, j) => { const y = f * P[1]; if (j < K) return [XT + (TTX[j]! - XT) * r, y, lerp(TTZ[j]!, P[2], g)] as V; return [XT + (TX[j - K]! - XT) * r, y, lerp(TZ[j - K]!, P[2], g)] as V; }); }
/** a point on the nose's / the tail's face at (y, z), moved out by lift (only for the face's middle, before the corners) */
function onEnd(tail: boolean, y: number, z: number, lift: number): V { const Z = tail ? TZ : NZ, X = tail ? TX : NX, P = tail ? CT : C0; let j = 0; while (j + 2 < Z.length && z < Z[j + 1]!) j++;
  const t = Math.max(0, Math.min(1, (Z[j]! - z) / (Z[j]! - Z[j + 1]!))), Y = lerp(P[K + j]![1], P[K + j + 1]![1], t), x0 = lerp(X[j]!, X[j + 1]!, t), f = Math.min(1, Math.abs(y) / Y);
  return tail ? [XT + (x0 - XT) * frT(f) + lift, y, z] : [XN - (XN - x0) * frN(f) - lift, y, z]; }

/** the five-spoke star wheel: a bright lip, five tapering spokes standing on a dark barrel, a cap with five nuts */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, R = front ? RF : RR, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = 229, f = s * tw / 2, SEG = 20;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-f, R - 34], [-f * 0.74, R], [f * 0.74, R], [f * 0.95, R - 12], [f, R - 34], [f, rim + 6]], SEG, false);
  b.name('rim').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f, rim + 6], [f - s * 8, rim - 3], [f - s * 30, rim - 14]], SEG, false);
  b.name('wheel').mat(DARK, 0.05); disc(b, [x, s * wy + f - s * 70, R], rim - 10, 10);
  const r1 = rim - 16, yAt = (r: number) => s * wy + f - s * (30 + 26 * (1 - r / r1));
  b.name('wheel').mat('#dfe1e4', 0.45, 'metal'); for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.05) * Math.PI * 2, P = (r: number, da: number): V => [x + Math.cos(a + da) * r, yAt(r), R + Math.sin(a + da) * r];
    fan(b, [P(58, -0.5), P(110, -0.27), P(r1 - 8, -0.13), P(r1, -0.16), P(r1, 0.16), P(r1 - 8, 0.13), P(110, 0.27), P(58, 0.5)], [0, s, 0]);
    face(b, P(110, 0), P(r1 - 8, 0), P(r1 - 8, 0.025), P(110, 0.05), [0, s, 0]); }
  b.name('hub').mat(SILVER, 0.7, 'metal'); disc(b, [x, yAt(0) + s * 4, R], 62, 10);
  b.name('hub').mat(PAINT, 0.6); disc(b, [x, yAt(0) + s * 7, R], 20, 6);
  b.name('hub').mat(FRAME, 0.4); for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.15) * Math.PI * 2; disc(b, [x + Math.cos(a) * 42, yAt(0) + s * 7, R + Math.sin(a) * 42], 9, 5); }
}
/** a flat disc across the axle at o */
function disc(b: Build, o: V, r: number, seg: number, a0 = 0) { for (let i = 0; i < seg; i++) { const a = a0 + i / seg * Math.PI * 2, c = a0 + (i + 1) / seg * Math.PI * 2; tri(b, o, [o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r], [o[0] + Math.cos(c) * r, o[1], o[2] + Math.sin(c) * r], [0, Math.sign(o[1]) || 1, 0]); } }
/** a four-sided face wound so that it looks along n */
function face(b: Build, p: V, q: V, r: V, t: V, n: V) { tri(b, p, q, r, n); tri(b, p, r, t, n); }
/** a triangle wound so that it looks along n (none if it has no area) */
function tri(b: Build, p: V, q: V, r: V, n: V) { const c = cross(sub(q, p), sub(r, p)); if (Math.hypot(c[0], c[1], c[2]) < 0.5) return; if (dot(c, n) >= 0) b.tri(p, q, r); else b.tri(p, r, q); }
/** a flat many-sided face as a fan about its middle, looking along n */
function fan(b: Build, pts: V[], n: V) { const c: V = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; } for (let i = 0; i < pts.length; i++) tri(b, c, pts[i]!, pts[(i + 1) % pts.length]!, n); }
/** the walls of a pocket: from a ring of points, d deep, facing the ring's middle */
function tube(b: Build, ring: V[], d: V) { const c: V = [0, 0, 0]; for (const p of ring) { c[0] += p[0] / ring.length; c[1] += p[1] / ring.length; c[2] += p[2] / ring.length; }
  for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!; if (Math.hypot(...sub(q, p)) < 0.5) continue; face(b, p, q, add(q, d), add(p, d), sub(c, mix(p, q, 0.5))); } }
/** a ring of n points round (cy, cz) in the plane x = fx(y, z) */
const ringAt = (fx: (y: number, z: number) => number, cy: number, cz: number, ry: number, rz: number, n: number, p = 2): V[] => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a), y = cy + ry * Math.sign(c) * Math.abs(c) ** (2 / p), z = cz + rz * Math.sign(s2) * Math.abs(s2) ** (2 / p); return [fx(y, z), y, z] as V; });

/** a flat-looking patch laid on a curved face: concentric rings, every point projected onto the face (a fan's middle would sink behind it) */
function patch(b: Build, fx: (y: number, z: number) => number, cy: number, cz: number, ry: number, rz: number, n: number, p: number, nrm: V) { const rs = [1, 0.66, 0.33].map(k => ringAt(fx, cy, cz, ry * k, rz * k, n, p)), c: V = [fx(cy, cz), cy, cz];
  for (let r = 0; r + 1 < rs.length; r++) for (let i = 0; i < n; i++) face(b, rs[r]![i]!, rs[r]![(i + 1) % n]!, rs[r + 1]![(i + 1) % n]!, rs[r + 1]![i]!, nrm);
  const l = rs[rs.length - 1]!; for (let i = 0; i < n; i++) tri(b, c, l[i]!, l[(i + 1) % n]!, nrm); }

export function f355Mesh(spin = 0, lamps = 0): Mesh { const b = new Build(); lamps = Math.max(0, Math.min(1, lamps));
  /** the cells of a grid of points (given for the car's right half) laid on both sides; each cell cut along the diagonal
   *  that folds it less; `pick` chooses the cells; `flip` when the grid's rows and columns run the other way round */
  const cells = (P: V[][], pick: (i: number, j: number) => boolean = () => true, flip = false) => { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q0 = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], q = flip ? [q0[0], q0[3], q0[2], q0[1]] as [V, V, V, V] : q0, nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p)));
    const alt = dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (Math.hypot(c[0], c[1], c[2]) < 4) continue; b.tri(t[0], t[1], t[2]); b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); } } };
  const both = (fn: (sg: number, m: (p: V) => V) => void) => { for (const sg of [1, -1]) fn(sg, p => mir(p, sg)); };
  const UPV: V = [0, 0, 1], BACK: V = [1, 0, 0], FWD: V = [-1, 0, 0];

  // ---- the points ----
  const CH = SF.map(chain);
  const NG: V[][] = [...NF.map(noseRow), CH[0]!], TG: V[][] = [CH[NS - 1]!, ...TFR.slice().reverse().map(tailRow)];
  const iA = at(XA), iD = at(XD), iW = at(XW), iB0 = at(XB0), iB1 = at(XB1), iR1 = at(XR1), iC0 = at(XC0), iC1 = at(XC1), iSt = at(XS), iFa = at(FX - RAF), iFb = at(FX + RAF), iRa = at(RX - RAR), iRb = at(RX + RAR);
  const sx = (i: number) => SF[i]!;

  // ---- the skin's top: bonnet, lamp covers (built below), wings, cowl; cockpit; shelf, gutter, deck ----
  const isCover = (i: number, j: number) => i < 3 && (j === T2 || j === T3);
  b.name('bonnet').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => j < T2 && i < iW);
  b.name('wingF').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => j >= T2 && j < K && i < iA && !isCover(i, j)); cells(NG, (_i, j) => j < K);
  b.name('cowl').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => j < T2 && i >= iW && i < iA);
  b.name('cockpit').mat(DARK, 0.06); cells(CH, (i, j) => i >= iA && i < iB1 && j < T4); cells(CH, (i, j) => i === iB1 && j < T4);
  b.name('cockpit').mat(TRIM, 0.15); cells(CH, (i, j) => i >= iA && i < iB1 && j === T4);
  b.name('shelf').mat(DARK, 0.08); cells(CH, (i, j) => i >= iR1 && i < iC0 && j < T3);
  b.name('gutter').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => i >= iR1 && i < iSt && j === T3);
  b.name('deck').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => (i >= iC1 && j < T3) || (i >= iSt && j >= T3 && j < K)); cells(TG, (_i, j) => j < K);

  // ---- the flank: wings, doors, quarters, the scoop cut in, sills with the slot, bumpers' sides ----
  const isScoop = (i: number, j: number) => j >= A && j < C && i >= at(1560) - 1 && i < iB0, isSlot = (i: number, j: number) => j >= S && j < F && i >= at(1640) && i < iB0;
  const isSill = (i: number, j: number) => j >= S && i >= iFb && i < iRa && !isSlot(i, j), isDoor = (i: number, j: number) => i >= iD && i < iB1 && j >= K && j < S && !isScoop(i, j);
  b.name('bumperF').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => i < iFa && j >= H); cells(NG, (_i, j) => j >= K);
  b.name('wingF').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => i < iD && j >= K && !(i < iFa && j >= H) && !isSill(i, j));
  b.name('door').mat(PAINT, GLOSS, 'paint'); cells(CH, isDoor);
  b.name('scoop').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => isScoop(i, j) && sx(i) < 2400);
  b.name('scoop').mat(SHADE, 0.1); cells(CH, (i, j) => isScoop(i, j) && sx(i) >= 2400);
  b.name('sill').mat(PAINT, GLOSS, 'paint'); cells(CH, isSill);
  b.name('sillSlot').mat(DARK, 0.06); cells(CH, isSlot);
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => i >= iB1 && i < iRb && j >= K && !isSill(i, j));
  b.name('bumperR').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, j) => i >= iRb && j >= K); cells(TG, (_i, j) => j >= K);

  // ---- the glasshouse ----
  // the side: belt (the crest), the glass's foot, middle and top, the top edge (the A pillar, the roof's rail, the buttress's top)
  const railAt = (s: number): V => s <= XR0 ? mix(CH[iA]![K]!, [XR0, YRL, ZRL(XR0)], (s - XA) / (XR0 - XA)) : s <= XR1 ? [s, YRL, ZRL(s)] : [s, YBO(s), BT(s)];
  const SU = SF.slice(iA, iSt + 1), SG: V[][] = SU.map(s => { const k0 = CH[at(s)]![K]!, k4 = railAt(s), w = sm(XB1, XQ, s), lo = mix(k0, k4, 0.05);
    const hi = s <= XB1 ? mix(k0, k4, 0.92) : s <= XQ ? mix(mix(k0, k4, 0.92), mix(k0, k4, 0.07), (s - XB1) / (XQ - XB1)) : mix(k0, k4, 0.55);
    const mid = mix(lo, hi, 0.5); return [k0, lo, [mid[0], mid[1] + 8 * (1 - w), mid[2]] as V, hi, k4]; });
  const sIdx = (s: number) => at(s) - iA;
  b.name('glassSeal').mat(FRAME, 0.3); cells(SG, (i, j) => (j === 0 || j === 3) && i < sIdx(XQ) && !(j === 3 && i >= sIdx(XB1)), true);
  b.name('bPillar').mat(BLACK, 0.7); cells(SG, (i, j) => j > 0 && i >= sIdx(XB0) && i < sIdx(XB1), true);
  b.name('sidePane').mat(GLASS, 0.5, 'glass'); cells(SG, (i, j) => (j === 1 || j === 2) && i < sIdx(XB0), true);
  b.name('quarterPane').mat(GLASS, 0.5, 'glass'); cells(SG, (i, j) => (j === 1 || j === 2) && i >= sIdx(XB1) && i < sIdx(XQ), true);
  b.name('buttress').mat(PAINT, GLOSS, 'paint'); cells(SG, (i, j) => i >= sIdx(XQ) || (i >= sIdx(XB1) && j === 3), true);
  // the screen: rows from its bowed foot (the top's last row) up to the roof's front edge, at the side's stations
  const roofCols = (x: number): number[] => { const yi = YRI(x); return [0, yi * 0.3, yi * 0.6, yi * 0.83, yi, YRL]; };
  const sTop: V[] = roofCols(XR0).map((y, j) => j === 5 ? railAt(XR0) : [roofX(y), y, roofZ(roofX(y), y)] as V), sFoot = CH[iA]!.slice(0, K + 1);
  const SCR: V[][] = SF.slice(iA, at(XR0) + 1).map(s => { const v = (s - XA) / (XR0 - XA); return sFoot.map((p, j) => { if (j === K) return railAt(s); const q = mix(p, sTop[j]!, v), bl = 14 * 4 * v * (1 - v) * (1 - (j / 5) ** 2); return [q[0] - bl * 0.35, q[1], q[2] + bl * 0.94] as V; }); });
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); cells(SCR, (_i, j) => j < T4);
  b.name('aPillar').mat(PAINT, GLOSS, 'paint'); cells(SCR, (_i, j) => j === T4);
  // the roof: rows at the stations, its front edge the screen's top, its rail the side's top edge
  const RFG: V[][] = SF.slice(at(XR0), iR1 + 1).map(s => { const w = (s - XR0) / (XR1 - XR0); return roofCols(s).map((y, j) => { if (j === 5) return railAt(s); const x = lerp(roofX(y), XR1, w); return [x, y, roofZ(x, y)] as V; }); });
  b.name('roof').mat(PAINT, GLOSS, 'paint'); cells(RFG);
  // the flying buttresses: the top from the outer edge in, the inner face down to the gutter
  const BTG: V[][] = SF.slice(iR1, iSt + 1).map(s => { const ri = RFG[RFG.length - 1]![4]!, zi = BT(s) + 4 + (ri[2] - BT(XR1) - 4) * (1 - sm(XR1, 2900, s)); return [railAt(s), [s, YBI(s), zi], CH[at(s)]![T4]!]; });
  b.name('buttress').mat(PAINT, GLOSS, 'paint'); cells(BTG, () => true, true);
  both((sg, m) => { const e = BTG[BTG.length - 1]!, k = CH[iSt]!; fan(b, [m(k[K]!), m(e[0]!), m(e[1]!), m(e[2]!)], [1, 0, 0.3]); });
  // the upright rear glass sunk between the buttresses, from the roof's back edge down to the shelf
  { const tp = RFG[RFG.length - 1]!.slice(0, 5), ft = tp.map(p => [2900, Math.min(p[1] * 1.01, BF(2900) + 4), ZCV(2900) + 3] as V);
    b.name('rearPane').mat(GLASS, 0.3, 'glass'); cells([tp, tp.map((p, j) => mix(p, ft[j]!, 0.5)), ft]); }

  // ---- the louvred engine cover: two rows of slots round a raised centre panel; a dark bay under it ----
  { const SLOT = Array.from({ length: 12 }, (_, k) => 3085 + 77 * k), XS2 = [XC0, 2990, 3045, ...SLOT.flatMap(x => [x, x + 36]), XC1];
    const ycol = (x: number) => [0, 95, 190, 450, CE(x)], zc = (x: number, y: number) => ZCV(x) - crown(y);
    const CVG: V[][] = XS2.map(x => ycol(x).map(y => [x, y, zc(x, y)] as V)), hole = (i: number, j: number) => j === 2 && i >= 3 && (i - 3) % 2 === 0 && i < 3 + 24;
    b.name('engineCover').mat(PAINT, GLOSS, 'paint'); cells(CVG, (i, j) => !hole(i, j));
    b.name('louvre').mat(DARK, 0.1); for (let i = 3; i < 27; i += 2) { const p = CVG[i]!, q = CVG[i + 1]!; both((_sg, m) => tube(b, [m(p[2]!), m(q[2]!), m(q[3]!), m(p[3]!)], [0, 0, -26])); }
    // the raised centre panel
    const ring = (lift: number, k: number) => Array.from({ length: 16 }, (_, t) => { const a = t / 16 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a), x = 3390 + 190 * k * Math.sign(c) * Math.abs(c) ** 0.6, y = 220 * k * Math.sign(s2) * Math.abs(s2) ** 0.6; return [x, y, zc(x, Math.abs(y)) + lift] as V; });
    b.name('coverPanel').mat(PAINT, GLOSS, 'paint').loft([ring(-6, 1), ring(10, 0.97), ring(17, 0.88)]);
    // the bay: a dark tub from the cabin's back to the tail
    const yb = 520, zf = 190, x0 = XB1 + 2, x1 = XC1 + 8, zt = (x: number) => ZCV(x) - 30;
    b.name('engineBay').mat(DARK, 0.05); face(b, [x0, -yb, zf], [x1, -yb, zf], [x1, yb, zf], [x0, yb, zf], UPV); face(b, [x1, -yb, zf], [x1, yb, zf], [x1, yb, zt(x1)], [x1, -yb, zt(x1)], FWD);
    face(b, [XC0, -yb, zf], [XC0, yb, zf], [XC0, yb, zt(XC0)], [XC0, -yb, zt(XC0)], BACK);
    both((sg, m) => face(b, m([x0, yb, zf]), m([x1, yb, zf]), m([x1, CE(x1) - 10, zt(x1)]), m([x0, CE(x0) - 10, zt(x0)]), [0, -sg, 0]));
    addEngine(b, ENGINES.f355!, [3800, 0, 418], { dir: '-x', box: { len: 600, wid: 900, hgt: 560 }, detail: 2 }); }

  // ---- the pop-up head lamps: the cover hinges up about its back edge; a dark well under it, the lamps on its front ----
  { const ang = lamps * 24 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), hg = CH[3]![T3]!, ox = hg[0], oz = hg[2];
    const up = (p: V): V => { const dx = p[0] - ox, dz = p[2] - oz; return [ox + dx * ca + dz * sa, p[1], oz - dx * sa + dz * ca]; };
    const CV: V[][] = CH.slice(0, 4).map(r => r.slice(T2, T4 + 1).map(up));
    b.name('lampLid').mat(PAINT, GLOSS, 'paint'); cells(CV);
    const rim = (i0: number, i1: number): V[] => [...CH.slice(i0, i1 + 1).map(r => r[T2]!), ...CH.slice(i0, i1 + 1).reverse().map(r => r[T4]!)];
    b.name('lampWell'); both((_sg, m) => { b.mat(DARK, 0.05); tube(b, rim(0, 3).map(m), [0, 0, -70]); fan(b, rim(0, 3).map(p => add(m(p), [0, 0, -70])), UPV); });
    if (lamps > 0.02) both((sg, m) => { const f0 = m(CV[0]![0]!), f1 = m(CV[0]![2]!), g0 = m(CH[0]![T2]!), g1 = m(CH[0]![T4]!), h0 = m(CH[3]![T2]!), h1 = m(CH[3]![T4]!), fwd: V = [-1, 0, 0.15];
      b.name('lampPod').mat(PAINT, GLOSS, 'paint'); tri(b, f0, g0, h0, [0, -sg, 0]); tri(b, f1, g1, h1, [0, sg, 0]);
      b.name('lampPod').mat(FRAME, 0.25); face(b, f0, f1, g1, g0, fwd);
      const P = (u: number, v: number): V => { const p = mix(mix(f0, f1, u), mix(g0, g1, u), v); return [p[0] - 4, p[1], p[2]]; }, rz = Math.min(48, Math.abs(f0[2] - g0[2]) * 0.38);
      b.name('headlamp').mat(LENS, 0.7, 'lens'); for (const u of [0.3, 0.72]) { const c = P(u, 0.5); fan(b, Array.from({ length: 12 }, (_, k) => [c[0], c[1] + Math.cos(k / 12 * Math.PI * 2) * rz, c[2] + Math.sin(k / 12 * Math.PI * 2) * rz] as V), FWD); } }); }

  // ---- the nose: the oval grille with the horse, the lamp slots, round fog lamps; the bonnet's vents and shut lines ----
  { const nf = (lift: number) => (y: number, z: number) => onEnd(false, y, z, lift)[0];
    b.name('grilleSurround').mat(FRAME, 0.3); patch(b, nf(4), 0, 384, 412, 82, 20, 2.6, FWD);
    b.name('grille').mat(DARK, 0.05); patch(b, nf(7), 0, 384, 396, 70, 20, 2.6, FWD);
    b.name('grille').mat(FRAME, 0.2); for (const z of [330, 357, 384, 411, 438]) { const w = 396 * Math.sqrt(1 - Math.abs((z - 384) / 72) ** 2.6) - 10; b.bar(onEnd(false, -w, z, 9), onEnd(false, w, z, 9), 6, 4); }
    b.name('badge').mat(SILVER, 0.8, 'metal'); fan(b, [[-30, 385], [-10, 420], [12, 418], [22, 380], [8, 352], [-14, 350]].map(([y, z]) => onEnd(false, y!, z!, 13)), FWD);
    both((sg, m) => { b.name('turnLamp').mat(FRAME, 0.3); fan(b, ringAt(nf(1.5), sg * 615, 427, 150, 34, 16, 3.2), FWD);
      b.name('turnLamp').mat('#f2c98a', 0.75); fan(b, ringAt(nf(3), sg * 560, 427, 76, 24, 12, 3.2), FWD);
      b.name('sideLamp').mat(AMBER, 0.6); fan(b, ringAt(nf(3), sg * 690, 427, 40, 20, 10, 3), FWD);
      b.name('fogLamp').mat(FRAME, 0.3); fan(b, ringAt(nf(1.5), sg * 455, 283, 56, 56, 14), FWD);
      b.name('fogLamp').mat('#3a3d44', 0.8); fan(b, ringAt(nf(3), sg * 455, 283, 40, 40, 12), FWD);
      void m; });
    // the bonnet's two vents at its back edge, the shut lines, the badge on its nose
    const onTop = (x: number, y: number, lift: number): V => [x, y, zTop(x, Math.abs(y)) + lift];
    b.name('bonnetVent').mat(DARK, 0.05); both((sg, m) => { face(b, m(onTop(1004, 40, 2)), m(onTop(1004, 405, 2)), m(onTop(1046, 405, 2)), m(onTop(1046, 40, 2)), UPV); void sg; });
    const seam = (pts: V[], w = 8) => { for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i]!, q = pts[i + 1]!, d = un(sub(q, p)), sd = un(cross(UPV, d)), o = (v: V, k: number): V => [v[0] + sd[0] * w * k, v[1] + sd[1] * w * k, v[2] + 2.5];
      both((_sg, m) => face(b, m(o(p, -0.5)), m(o(q, -0.5)), m(o(q, 0.5)), m(o(p, 0.5)), UPV)); } };
    b.name('seam').mat(SEAM, 0.1);
    seam(CH.slice(0, iW + 1).map(r => r[T2]!).filter(p => p[0] >= 190).map(p => [p[0], p[1] - 6, p[2]] as V));
    seam([onTop(194, 0, 0), onTop(194, 426, 0)]); seam([onTop(XW - 4, 0, 0), onTop(XW - 4, 426, 0)]);
    if (lamps < 0.02) { seam([...CH.slice(0, 4).map(r => r[T4]!), ...CH.slice(0, 4).reverse().map(r => r[T2]!)].map(p => [p[0], p[1], p[2]] as V)); seam([CH[0]![T2]!, CH[0]![T4]!]); }
    b.name('badge').mat(PAINT, 0.7); face(b, onTop(222, -22, 3), onTop(222, 22, 3), onTop(262, 18, 3), onTop(262, -18, 3), UPV);
    b.name('badge').mat(BLACK, 0.5); face(b, onTop(228, -8, 4), onTop(228, 8, 4), onTop(254, 6, 4), onTop(254, -6, 4), UPV); }

  // ---- the door shut lines and pull, the side repeater ----
  { const sideSeam = (pts: [number, number][], sgs = [1, -1]) => { const P = pts.map(([x, z]) => surf(x, z)); for (const sg of sgs) for (let i = 0; i + 1 < P.length; i++) { const p = P[i]!, q = P[i + 1]!, d = un(sub(q, p)), n: V = [0, 1, 0], sd = un(cross(n, d)), o = (v: V, k: number): V => [v[0] + sd[0] * 4 * k, v[1] + 2.5, v[2] + sd[2] * 4 * k];
      face(b, mir(o(p, -1), sg), mir(o(q, -1), sg), mir(o(q, 1), sg), mir(o(p, 1), sg), [0, sg, 0]); } };
    b.name('seam').mat(SEAM, 0.1);
    sideSeam([[XD + 3, 785], [XD + 3, 600], [XD + 3, 300], [XD + 3, 150]]); sideSeam([[XB1 - 4, 822], [XB1, 700], [XB1 - 10, 560]]); sideSeam([[2690, 330], [2672, 250], [2655, 150]]);
    b.name('handle').mat(FRAME, 0.4); both((sg, m) => { const c = surf(2590, 700); fan(b, Array.from({ length: 8 }, (_, k) => m([c[0] + 14 * Math.cos(k * Math.PI / 4), c[1] + 3, c[2] + 14 * Math.sin(k * Math.PI / 4)])), [0, sg, 0]); });
    b.name('repeater').mat(AMBER, 0.7); both((sg, m) => { const c = surf(1430, 598); fan(b, Array.from({ length: 8 }, (_, k) => m([c[0] + 22 * Math.cos(k * Math.PI / 4), c[1] + 3, c[2] + 12 * Math.sin(k * Math.PI / 4)])), [0, sg, 0]); }); }

  // ---- the tail: the black slot with the script, four round lamps, the horse; the bumper's plate recess, black line, lower grille and exhausts ----
  { const tf = (lift: number) => (y: number, z: number) => onEnd(true, y, z, lift)[0];
    const strip = (y0: number, y1: number, z0: number, z1: number, lift: number, n = 8) => { for (let k = 0; k < n; k++) { const ya = lerp(y0, y1, k / n), yb = lerp(y0, y1, (k + 1) / n); face(b, onEnd(true, ya, z0, lift), onEnd(true, yb, z0, lift), onEnd(true, yb, z1, lift), onEnd(true, ya, z1, lift), BACK); } };
    b.name('tailSlot').mat(BLACK, 0.4); strip(-610, 610, 802, 846, 2, 12);
    b.name('script').mat('#9a9ca0', 0.6, 'metal'); strip(380, 560, 818, 834, 3, 3);
    b.name('badge').mat(BLACK, 0.5); fan(b, [[-26, 680], [-8, 735], [16, 738], [28, 690], [8, 660], [-12, 662]].map(([y, z]) => onEnd(true, y!, z!, 3)), BACK);
    both((sg) => { for (const [y, red] of [[730, true], [565, false]] as const) { b.name(red ? 'tailLamp' : 'fogLampR').mat(CHROME, 0.7, 'metal'); fan(b, ringAt(tf(2), sg * y, 707, 80, 80, 16), BACK);
      if (red) b.name('tailLamp').mat(RED, 0.7, 'lens'); else b.name('fogLampR').mat(SMOKE, 0.7); fan(b, ringAt(tf(4.5), sg * y, 707, 69, 69, 14), BACK); } });
    b.name('bumperLine').mat(BLACK, 0.3); strip(-755, 755, 404, 414, 1.5, 10);
    b.name('plateRecess').mat('#8a6d00', 0.3); patch(b, tf(1.5), 0, 485, 290, 66, 16, 6, BACK);   // the recess drawn as a shaded panel (the skin is not cut)
    b.name('plate').mat(WHITE, 0.3); patch(b, tf(4), 0, 485, 255, 50, 12, 8, BACK);
    b.name('lowerGrille').mat(DARK, 0.05, 'grille'); both(sg => strip(sg * 330, sg * 515, 238, 332, 1.5, 3));
    b.name('valance').mat(DARK, 0.08); strip(-760, 760, 196, 236, 1.5, 10);
    b.name('exhaust').mat(CHROME, 0.85, 'metal'); for (const y of [-490, -360, 360, 490]) b.lathe('x', [0, y, 272], [[4150, 40], [4238, 40], [4238, 33], [4200, 33]], 10, false);
    b.name('exhaust').mat(DARK, 0.05); for (const y of [-490, -360, 360, 490]) fan(b, Array.from({ length: 10 }, (_, k) => [4202, y + 33 * Math.cos(k * Math.PI / 5), 272 + 33 * Math.sin(k * Math.PI / 5)] as V), BACK); }

  // ---- the under-side: the nose's floor, a flat floor, the tail's; the wheel wells ----
  { b.name('chassis').mat(DARK, 0.05);
    for (let i = 0; i + 1 < NG.length; i++) both((_sg, m) => tri(b, m(NG[i]![U]!), m(NG[i + 1]![U]!), [XN, 0, 140], [0, 0, -1]));
    for (let i = 0; i + 1 < TG.length; i++) both((_sg, m) => tri(b, m(TG[i]![U]!), m(TG[i + 1]![U]!), [XT, 0, 185], [0, 0, -1]));
    for (const [x0, x1, y, z0, z1] of [[XN, FX - RAF, YINF, 140, 132], [FX - RAF, FX + RAF, YINF, 132, 120], [FX + RAF, RX - RAR, 820, 118, 112], [RX - RAR, RX + RAR, YINR, 112, 168], [RX + RAR, XT, 760, 168, 185]] as const)
      face(b, [x0, -y, z0], [x0, y, z0], [x1, y, z1], [x1, -y, z1], [0, 0, -1]);
    both((sg, m) => { for (const [hx, ra, yin] of [[FX, RAF, YINF], [RX, RAR, YINR]] as const) { const i0 = at(hx - ra), i1 = at(hx + ra), inn = (i: number): V => m([SF[i]!, yin, CH[i]![U]![2]]);
      for (let i = i0; i < i1; i++) { face(b, m(CH[i]![U]!), m(CH[i + 1]![U]!), inn(i + 1), inn(i), [0, 0, -1]); tri(b, m([hx, yin, 120]), inn(i), inn(i + 1), [0, sg, 0]); } } }); }

  // ---- the cabin behind the glass: dash, tunnel, two tan seats, a wheel ----
  { const FL = 215;
    b.name('dash').mat(TRIM, 0.15); face(b, [1480, -700, 790], [1480, 700, 790], [1620, 700, 760], [1620, -700, 760], UPV); face(b, [1620, -700, 760], [1620, 700, 760], [1620, 700, 470], [1620, -700, 470], BACK);
    b.name('steering').mat(FRAME, 0.2).lathe('x', [0, -370, 700], [[1700, 150], [1692, 174], [1712, 174], [1706, 150]], 10, false).bar([1600, -370, 690], [1700, -370, 700], 34);
    both((sg) => { const y0 = sg * 130, y1 = sg * 600, lo = Math.min(y0, y1) + 20, hi = Math.max(y0, y1) - 20;
      b.name('seat').mat(TAN, 0.25, 'leather').box(2080, 2470, lo, hi, FL, 330).loft(([[2420, 330], [2510, 600], [2580, 860], [2620, 945]] as const).map(([x, z]) => [[x, lo, FL], [x, hi, FL], [x, hi, z], [x, lo, z]] as V[]));
      b.name('seat').mat(TAN2, 0.15); for (const y of [y0 + sg * 150, y0 + sg * 320]) b.bar([2100, y, 332], [2410, y, 332], 8).bar([2514, y, 602], [2580, y, 858], 8); });
    b.name('bulkhead').mat(DARK, 0.08); face(b, [XB1 + 1, -700, FL], [XB1 + 1, 700, FL], [XB1 + 1, 700, 900], [XB1 + 1, -700, 900], FWD); }

  // ---- the fittings: mirrors on stalks, wipers ----
  both((sg, m) => { const hs = (y: number, k: number, dx = 0): V[] => ([[1660, 880], [1700, 846], [1800, 838], [1838, 900], [1830, 962], [1730, 972]] as const).map(([x, z]) => m([1760 + (x - 1760) * k + dx, y, 905 + (z - 905) * k]));
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([hs(850, 0.55, -30), hs(880, 0.95, -8), hs(985, 1), hs(1008, 0.8)]);
    b.name('mirror').mat(FRAME, 0.3).bar(m([1540, 760, 800]), m([1720, 860, 880]), 30, 18);
    b.name('mirrorGlass').mat(SILVER, 0.9, 'metal'); face(b, m([1836, 885, 860]), m([1836, 985, 860]), m([1840, 985, 948]), m([1840, 885, 948]), [1, 0, 0]); void sg; });
  { const onScr = (y: number, lift: number): V => { const row = SCR[1]!, a = Math.abs(y); let j = 0; while (j + 2 < row.length && row[j + 1]![1] < a) j++; const p = mix(row[j]!, row[j + 1]!, (a - row[j]![1]) / (row[j + 1]![1] - row[j]![1])); return [p[0] - lift * 0.4, y, p[2] + lift * 0.92]; };
    b.name('wiper').mat(FRAME, 0.15); for (const [ya, yb] of [[-600, -80], [20, 520]] as const) { const mid = (ya + yb) / 2; b.bar(onScr(ya, 12), onScr(mid, 14), 14, 10).bar(onScr(mid, 14), onScr(yb, 12), 14, 10); } }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }


export const mesh = f355Mesh;
