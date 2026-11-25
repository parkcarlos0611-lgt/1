// The interior's parts (docs/systems/109 section 4), in the drift games' manner: plain, clean shapes for the volumes
// and the silhouettes, and the sheet's pictures (render/car/interior/atlas.ts) for the flat detail. Each part is built
// in its own frame about its socket (a seat about the hip point, the wheel about its centre, the dash about its front
// plane), so the assembly (index.ts) places it by a cabin's anchors. The originals are the 911 and 959 of the 1980s
// (docs/reference/interior): five dials under one hood, a flat dash with a dark face band, a four-spoke wheel with a
// big pad, pleated sport seats, a tall lever; and the drift cars' swaps: a dished three-spoke wheel, bucket seats, a
// short lever, a hydraulic handbrake, a cage.
import type { V } from '../mesh';
import { InteriorBuild, add, sub, mul, dot, cross, unit, len, lerp, ring, leaning, within, at, dir, type Frame } from './build';
import type { CabinAnchors, Trim } from './anchors';
import type { DialBone, GaugeFace } from './gauges';

const RAD = Math.PI / 180;
/** a half outline (from the middle round one side to the middle again) made whole by its mirror */
const whole = (h: [number, number][]): [number, number][] => [...h, ...h.slice(1, -1).reverse().map(([a, b]) => [-a, b] as [number, number])];
/** the middle joint of a two-bone limb from a to c (lengths l1, l2), bent toward `pole` */
function joint(a: V, c: V, l1: number, l2: number, pole: V): V { const d0 = len(sub(c, a)), d = Math.min(d0, l1 + l2 - 1), u = unit(sub(c, a)), x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)); return add(add(a, mul(u, x)), mul(unit(sub(pole, mul(u, dot(pole, u)))), h)); }

// ---- seats: the frame's origin the hip point; x back, y left, z up ----
export type SeatStyle = 'sport' | 'bucket';
interface SeatShape { /** the cushion's stations: x, top, bottom, bolster's height, half width, the middle panel's half width */ cushion: number[][]; /** the back's stations: height up the back, half width, bolster's depth, thickness, the panel's half width */ back: number[][]; pleatS: [number, number]; region: 'seatPleat' | 'seatBucket' }
const SEATS: Record<SeatStyle, SeatShape> = {
  sport: { cushion: [[-455, -98, -172, 5, 232, 140], [-420, -72, -200, 22, 250, 150], [-200, -88, -205, 42, 255, 150], [40, -100, -205, 48, 250, 150], [110, -110, -200, 30, 240, 150]],
    back: [[0, 245, 30, 120, 150], [110, 255, 66, 125, 150], [330, 250, 56, 115, 150], [480, 240, 42, 105, 150], [580, 208, 24, 98, 130], [680, 172, 12, 90, 95], [790, 150, 8, 82, 75], [856, 128, 4, 66, 50], [884, 92, 0, 40, 20]], pleatS: [110, 480], region: 'seatPleat' },
  bucket: { cushion: [[-440, -92, -160, 10, 225, 130], [-400, -72, -190, 48, 245, 135], [-150, -90, -200, 78, 250, 135], [60, -100, -200, 86, 250, 135], [110, -105, -195, 80, 245, 135]],
    back: [[0, 250, 88, 80, 135], [150, 250, 104, 76, 135], [330, 242, 90, 70, 135], [450, 262, 78, 66, 135], [540, 280, 86, 62, 135], [620, 242, 62, 60, 135], [710, 190, 46, 58, 110], [830, 172, 44, 56, 95], [892, 138, 12, 44, 60]], pleatS: [330, 830], region: 'seatBucket' } };
/** how high a seat's back stands along its lean (the cage and the driver go by it) */
export const seatBackTop = (style: SeatStyle): number => SEATS[style].back[SEATS[style].back.length - 1]![0]!;
export function seat(b: InteriorBuild, f: Frame, style: SeatStyle, name: string, colour: string, recline: number, floorDz: number, metal: string): void { const S = SEATS[style], th = recline * RAD;
  b.frame(f).part(name, colour, style === 'bucket' ? 0.1 : 0.22, style === 'bucket' ? 'canvas' : 'leather');
  b.loft(S.cushion.map(([x, zc, zb, bol, hw, pw]) => whole([[0, zc!], [pw!, zc!], [hw! - 62, zc! + bol! * 0.45], [hw! - 30, zc! + bol!], [hw!, zc! + bol! * 0.6], [hw! + 4, Math.max(zb! + 20, zc! - 45)], [hw! - 12, zb!], [0, zb!]]).map(([y, z]) => [x!, y, z] as V)));
  const c1 = S.cushion[1]!, c3 = S.cushion[3]!, pw = c1[5]!; if (style === 'sport') b.paint('seatPleat', [(c1[0]! + c3[0]!) / 2, 0, -85], [0, -1, 0], [-1, 0, 0], pw * 2 + 2, c3[0]! - c1[0]! + 2, [0, 0, 1]);
  // the back: sections up its lean from a pivot behind the hip; the front face lies about 110 mm behind the hip point
  const U: V = [Math.sin(th), 0, Math.cos(th)], Bk: V = [Math.cos(th), 0, -Math.sin(th)], pv: V = [70, 0, -125], P = (s: number, y: number, d: number): V => add(add(pv, mul(U, s)), add([0, y, 0], mul(Bk, d)));
  b.loft(S.back.map(([s, hw, bol, T, pw0]) => { const p = Math.min(pw0!, hw! - 75); return whole([[0, 0], [p, 0], [hw! - 62, -bol! * 0.45], [hw! - 28, -bol!], [hw!, -bol! * 0.5], [hw!, T! * 0.55], [hw! - 45, T!], [0, T!]]).map(([y, d]) => P(s!, y, d)); }));
  const [s0, s1] = S.pleatS, pb = S.back[1]![4]!; b.paint(S.region, P((s0 + s1) / 2, 0, 0), [0, 1, 0], U, pb * 2 + 2, s1 - s0 + 2, mul(Bk, -1));
  b.line('trim', [P(S.back[1]![0]!, pb, -2), P(s1, pb, -2), P(s1, -pb, -2), P(S.back[1]![0]!, -pb, -2)], { w: 0.7 });
  b.part(`${name}Rail`, metal, 0.5); for (const y of [-185, 185]) b.box(-390, 70, y - 16, y + 16, floorDz, -198); }

// ---- the dash: the frame's origin on its front plane at its top, on the centre line ----
export interface DashOut { dials: DialBone[] }
/** the dash's options: the drift cars' pods and stickers; the N33's (docs/systems/117 R2): four dials under the hood, three round
 *  gauges in the centre stack under the middle vent (boost, oil, water), a boost gauge in a pod on the driver's A pillar */
export interface DashOpts { pods?: boolean; stickers?: boolean; binnacle?: 'five' | 'four'; consoleGauges?: boolean; pillarPod?: boolean }
export function dash(b: InteriorBuild, A: CabinAnchors, T: Trim, faces: GaugeFace[], o: DashOpts): DashOut { const f: Frame = { o: [A.dashX, 0, A.dashTopZ], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, hw = A.doorIn ? A.doorIn[A.doorIn.length - 1]![1] - 20 : A.half + 8, s = A.side;
  const cx = A.screenFoot[0] - A.dashX, cz = A.screenFoot[1] - A.dashTopZ, prof: [number, number][] = [[cx, cz], [-22, 10], [0, -6], [9, -32], [15, -150], [42, -162], [50, -198], [30, -228], [-120, -244], [cx, -244]];
  // the dash's front edge follows the screen's foot where the cabin gives its bow (the N33's: no gap under the glass)
  const cowlAt = (y: number): number => { const C = A.cowl; if (!C) return cx; const q = Math.abs(y); for (let i = 1; i < C.length; i++) if (q <= C[i]![0]) { const [y0, x0] = C[i - 1]!, [y1, x1] = C[i]!; return x0 + (x1 - x0) * (q - y0) / (y1 - y0) - A.dashX; } return C[C.length - 1]![1] - A.dashX; };
  b.frame(f).part('dash', T.dash, 0.18, 'leather').loft((A.cowl ? [-1, -0.88, -0.72, -0.55, -0.36, -0.18, 0, 0.18, 0.36, 0.55, 0.72, 0.88, 1] : [-1, -0.55, 0, 0.55, 1]).map(k => prof.map(([x, z], i) => [i === 0 || i === prof.length - 1 ? cowlAt(k * hw) : x, k * hw, z + (i < 2 ? 7 * (1 - k * k) : 0)] as V)));
  b.line('trim', [[2, -hw, -8], [2, hw, -8]], { w: 0.7 }).line('trim', [[44, -hw, -163], [44, hw, -163]], { w: 0.7 });
  b.part('dashFace', T.face, 0.12).box(11, 19, -hw + 6, hw - 6, -148, -36);
  // the pictures on the face band: vents at both ends and in the middle, the radio and the switches toward the passenger
  const R: V = [0, -1, 0], Uz: V = [0, 0, 1], N: V = [1, 0, 0], py = (y: number) => -s * y;   // py: a distance toward the passenger
  b.part('dashVent', '#141416', 0.2); for (const y of [hw - 62, -(hw - 62)]) b.plate([24, y, -121], R, Uz, N, 100, 46, 6, 'vent');
  if (!o.consoleGauges) { b.plate([24, 0, -92], R, Uz, N, 122, 76, 6, 'vent');
    b.part('dashRadio', '#141416', 0.2).plate([24, py(172), -74], R, Uz, N, 184, 69, 6, 'radio'); b.part('dashSwitches', '#141416', 0.2).plate([23, py(172), -128], R, Uz, N, 96, 36, 5, 'console'); }
  b.part('dashSwitches', '#141416', 0.2).plate([24, py(372), -92], R, Uz, N, 188, 86, 6, 'switches');
  b.line('trim', [[20, py(480), -44], [20, py(hw - 130), -44], [20, py(hw - 130), -140], [20, py(480), -140]], { closed: true, w: 0.7 });   // the glove box's lid
  if (o.stickers) b.part('dashSticker', '#e8e4d8', 0.1).plate([21, py(560), -92], R, Uz, N, 150, 60, 2, 'stickerA'); else b.part('dashPlaque', '#9a9ca0', 0.4).plate([21, py(560), -64], R, Uz, N, 72, 36, 2, 'plaque');
  // ---- the binnacle: one hood over five dials, tipped up toward the driver's eyes ----
  const g = within(f, leaning([10, A.wheel[1], 0], -8)), hood = whole([[0, 48], [95, 44], [185, 30], [255, 6], [292, -38], [298, -106], [0, -106]]), hr = (x: number, k: number, dz = 0): V[] => hood.map(([y, z]) => [x, y * k, (z + 30) * k - 30 + dz] as V);
  b.frame(g).part('dashBinnacle', T.dash, 0.18, 'leather').loft([hr(-80, 0.96, -14), hr(64, 1), hr(64, 0.93), hr(24, 0.93)]);
  b.part('gaugePanel', T.plastic, 0.1).fan([26, 0, -30], hr(26, 0.925), [1, 0, 0]);
  const four = o.binnacle === 'four', ys = four ? [178, 64, -62, -172] : [216, 120, 0, -122, -224], zs = four ? [-44, -32, -34, -44] : [-46, -44, -30, -42, -46], dials: DialBone[] = []; let bone = 0;
  faces.forEach((F, i) => { const y = ys[i]!, z = zs[i]!, seg = F.R > 58 ? 14 : 12, c: V = [26, y, z];
    b.onBone(0).part(`gaugeBezel${i}`, '#222225', 0.3).turn(c, [1, 0, 0], [[0, F.R + 7], [12, F.R + 4], [3, F.R]], seg, { loop: true });
    b.part(`gaugeFace${i}`, '#0c0c0e', 0.3).fan([29, y, z], ring([29, y, z], [0, 1, 0], [0, 0, 1], F.R, seg), [1, 0, 0]).paint(F.region, [29, y, z], R, Uz, F.R * 2 / 0.985, F.R * 2 / 0.985);
    for (const sc of F.scales) { bone++; const pv: V = [33, y - sc.c[0] * F.R, z + sc.c[1] * F.R], a = sc.a0 * RAD, d: V = [0, -Math.sin(a), Math.cos(a)], q: V = [0, -Math.cos(a), -Math.sin(a)], L = sc.r * F.R * 0.96, w = sc.r < 0.5 ? 2.6 : 4.2, hub = F.R * (sc.r < 0.5 ? 0.055 : 0.105);
      b.onBone(bone).part(`gaugeNeedle_${sc.id}`, '#f24a12', 0.3).panel([[add(pv, add(mul(d, -L * 0.16), mul(q, w / 2))), add(pv, add(mul(d, L), mul(q, 0.8)))], [add(pv, add(mul(d, -L * 0.16), mul(q, -w / 2))), add(pv, add(mul(d, L), mul(q, -0.8)))]], [1, 0, 0]);
      b.part(`gaugeHub_${sc.id}`, '#0a0a0b', 0.5).fan(add(pv, [1.5, 0, 0]), ring(add(pv, [1.5, 0, 0]), [0, 1, 0], [0, 0, 1], hub, 6), [1, 0, 0]);
      dials.push({ id: sc.id, bone, pivot: at(g, pv), right: unit(dir(g, R)), up: unit(dir(g, Uz)), min: sc.min, max: sc.max, a0: sc.a0, a1: sc.a1, rest: sc.rest, tau: sc.tau }); } });
  b.onBone(0).part('gaugeLamps', '#101012', 0.3).picture([27.5, four ? 0 : 60, 14], R, Uz, N, 20, 20, 'lampA').picture([27.5, four ? -122 : -62, 16], R, Uz, N, 20, 20, 'lampB');
  // the drift cars' extra gauges: three pods on the dash's top, turned to the driver (painted faces: they are dress, not instruments)
  if (o.pods) { b.frame(f); ([['podA', 150], ['podB', 235], ['podC', 320]] as const).forEach(([r, y], i) => { const c: V = [-90, py(y), 62], ax = unit([1, s * 0.22 * (i + 1) * 0.6, 0.12]), [u, v] = [unit(cross([0, 0, 1], ax)), [0, 0, 1] as V], up = unit(cross(ax, u)); void v;
      b.part(`gaugePod${i}`, '#161618', 0.5).turn(c, ax, [[-58, 16], [-28, 31], [0, 33], [-6, 28]], 8); b.part(`gaugePodFace${i}`, '#0c0c0e', 0.3).picture(add(c, mul(ax, -5)), mul(u, -1), up, ax, 58, 58, r);
      b.part(`gaugePodFoot${i}`, '#161618', 0.4).box(c[0] - 50, c[0] - 20, c[1] - 9, c[1] + 9, 0, 40); }); }
  // the N33's centre stack (docs/reference/bnr33/interior): a dark panel standing proud of the face band and running on
  // under the dash; on it from the top two vents, the row of three round buttons, three round gauges (the voltmeter,
  // oil pressure, boost: the boost nearest the driver), the climate panel and the radio
  if (o.consoleGauges) { b.frame(f).onBone(0); const sw = 128, sx = 57;
    b.part('dashStack', '#1c1c1f', 0.15).loft([-sw, sw].map(y => ([[14, -30], [sx - 5, -34], [sx, -44], [sx, -300], [14, -312]] as const).map(([x, z]) => [x, y, z] as V)));
    b.line('trim', [[sx + 0.5, -sw, -44], [sx + 0.5, sw, -44]], { w: 0.7 });
    b.part('dashVent', '#141416', 0.2); for (const y of [-59, 59]) b.plate([sx + 4, y, -66], R, Uz, N, 110, 46, 4, 'vent');
    b.part('dashStackButtons', '#141416', 0.2).plate([sx + 3, 0, -104], R, Uz, N, 128, 32, 3, 'stackButtons');
    ([['podV', 68], ['podB', 0], ['podA', -68]] as const).forEach(([r, y0], i) => { const c: V = [sx + 2, -s * y0, -148], ax = unit([1, s * 0.12, 0.05]), u = unit(cross([0, 0, 1], ax)), up = unit(cross(ax, u));
      b.part(`gaugeConsole${i}`, '#161618', 0.4).turn(c, ax, [[-6, 31], [4, 31], [6, 27]], 12); b.part(`gaugeConsoleFace${i}`, '#0c0c0e', 0.3).fan(add(c, mul(ax, 6.8)), ring(add(c, mul(ax, 6.8)), u, up, 27, 12), ax).paint(r, add(c, mul(ax, 6.8)), mul(u, -1), up, 54.8, 54.8); });
    b.part('dashClimate', '#141416', 0.2).plate([sx + 3, 0, -206], R, Uz, N, 168, 63, 3, 'climate');
    b.part('dashRadio', '#141416', 0.2).plate([sx + 3, 0, -268], R, Uz, N, 150, 56, 3, 'radio'); }
  // a boost gauge in a pod on the driver's A pillar, turned to the driver's eyes
  if (o.pillarPod) { b.frame(f).onBone(0); const p: V = [A.screenFoot[0] - A.dashX + 70, s * (A.screenHalf[0] - 70), A.screenFoot[1] - A.dashTopZ + 120], eye: V = [A.hip[0] - A.dashX, A.hip[1], A.hip[2] + 700 - A.dashTopZ], ax = unit(sub(eye, p)), u = unit(cross([0, 0, 1], ax)), up = unit(cross(ax, u));
    b.part('gaugePillarPod', '#161618', 0.5).turn(p, ax, [[-46, 14], [-22, 34], [0, 36], [-5, 31]], 10); b.part('gaugePillarFace', '#0c0c0e', 0.3).picture(add(p, mul(ax, -4)), mul(u, -1), up, ax, 62, 62, 'podA'); }
  return { dials }; }

// ---- the steering wheel: the frame's origin its centre; x up the column toward the driver, y left, z up in its plane ----
/** 'four': the N33's own (docs/systems/117 R2): the stock rim and pad on four spokes, two across and two down to the corners */
export type WheelStyle = 'stock' | 'drift' | 'four';
export function steeringWheel(b: InteriorBuild, A: CabinAnchors, T: Trim, style: WheelStyle, bone: number): { dial: DialBone; rimR: number; f: Frame } { const f = leaning(A.wheel, -A.rake), Yv: V = [0, 1, 0], Zv: V = [0, 0, 1], Rt: V = [0, -1, 0], rimR = style === 'drift' ? 168 : 186;
  b.frame(f).onBone(bone);
  if (style !== 'drift') { b.part('steerWheelRim', T.wheel, 0.25, 'leather').tube(ring([0, 0, 0], Yv, Zv, rimR, 24), 15, 6, { loop: true });
    const pad = (x: number, k: number): V[] => ([[98, 40], [82, 56], [-82, 56], [-98, 40], [-98, -40], [-82, -56], [82, -56], [98, -40]] as const).map(([y, z]) => [x, y * k, z * k - 8] as V);
    b.part('steerWheelPad', T.wheel, 0.2, 'leather').loft([pad(-44, 0.94), pad(-8, 1), pad(2, 0.9)]).paint('padStock', [2, 0, -8], Rt, Zv, 196 * 0.9, 112 * 0.9, [1, 0, 0]);
    b.part('steerWheelSpokes', T.wheel, 0.2, 'leather'); for (const sg of [-1, 1]) { if (style === 'four') { b.slab([-16, sg * 90, -4], [-2, sg * 178, -14], Zv, 30, 12, 26); b.slab([-16, sg * 52, -50], [-2, sg * 112, -146], [1, 0, 0], 12, 30, 12); } else { b.slab([-16, sg * 86, 16], [-2, sg * 178, 26], Zv, 36, 13, 30); b.slab([-16, sg * 66, -52], [-2, sg * 126, -134], [1, 0, 0], 13, 32, 13); } } }
  else { b.part('steerWheelRim', '#1d1d20', 0.08, 'leather').tube(ring([0, 0, 0], Yv, Zv, rimR, 20), 17, 6, { loop: true });
    b.part('steerWheelSpokes', '#2b2c2f', 0.55); for (const d of [[0, 1, 0], [0, -1, 0], [0, 0, -1]] as V[]) { const side = unit(cross(d, [1, 0, 0])); b.slab(add([-72, 0, 0], mul(d, 26)), add([-5, 0, 0], mul(d, rimR - 8)), side, 58, 5, 34).paint('spokePrint', [-38, 0, 0], Rt, Zv, 340, 340, [1, 0, 0]); }
    b.part('steerWheelHorn', '#e9c014', 0.4).turn([-74, 0, 0], [1, 0, 0], [[-6, 40], [6, 40], [8, 30]], 10).paint('hornButton', [-66, 0, 0], Rt, Zv, 62, 62, [1, 0, 0]);
    b.part('steerWheelHub', '#8d8f93', 0.6).turn([0, 0, 0], [-1, 0, 0], [[78, 38], [104, 38], [108, 48], [142, 48], [146, 32]], 8); }
  b.onBone(0).part('steerWheelColumn', T.plastic, 0.15).turn([0, 0, 0], [-1, 0, 0], style !== 'drift' ? [[40, 30], [98, 32], [104, 54], [350, 58]] : [[146, 30], [200, 32], [206, 54], [350, 58]], 8);
  b.part('steerWheelStalks', T.plastic, 0.15); for (const sg of [-1, 1]) b.slab([-230, sg * 50, 6], [-205, sg * 168, 14], [1, 0, 0], 16, 11, 12);
  return { dial: { id: 'steer', bone, pivot: A.wheel, right: unit(dir(f, Rt)), up: unit(dir(f, Zv)), min: -8, max: 8, a0: 0, a1: 0, rest: 0, tau: 0 }, rimR, f }; }

// ---- on the tunnel: the lever, the handbrake; and the pedals ----
export function shifter(b: InteriorBuild, o: V, T: Trim, style: 'tall' | 'short'): void { b.frame({ o, x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
  const sq = (z: number, h: number): V[] => [[-h, -h, z], [h, -h, z], [h, h, z], [-h, h, z]];
  if (style === 'tall') { const top: V = [30, 0, 262], ax = unit(sub(top, [0, 0, 50])); b.part('shifterBoot', T.seat2, 0.2, 'leather').loft([sq(0, 46), sq(12, 44), sq(62, 15)]);
    b.part('shifterLever', T.metal, 0.6).tube([[6, 0, 56], top], 6.5, 6); b.part('shifterKnob', '#1b1b1d', 0.35).turn(top, ax, [[-14, 10], [0, 17], [22, 23], [42, 21], [54, 12], [58, 0]], 8); }
  else { const top: V = [14, 0, 128], ax = unit(sub(top, [0, 0, 10])); b.part('shifterBase', T.metal, 0.6).loft([sq(0, 52), sq(10, 50), sq(26, 20)]);
    b.part('shifterLever', T.metal, 0.6).tube([[2, 0, 22], top], 8, 6); b.part('shifterKnob', '#eeeae0', 0.5).turn(top, ax, [[-10, 11], [2, 22], [22, 27], [42, 22], [51, 0]], 8); } }
export function handbrake(b: InteriorBuild, o: V, T: Trim, style: 'lever' | 'hydro'): void { b.frame({ o, x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
  if (style === 'lever') { const a: V = [40, 0, 24], e: V = [-215, 0, 82], m = lerp(a, e, 0.42); b.part('handbrakeLeverBase', T.plastic, 0.15).box(-30, 70, -24, 24, 0, 26);
    b.part('handbrakeLever', T.metal, 0.6).tube([a, m], 9, 6); b.part('handbrakeLeverGrip', '#1b1b1d', 0.2).tube([m, lerp(a, e, 0.97)], 14, 6); b.part('handbrakeLeverButton', T.metal, 0.6).tube([lerp(a, e, 0.97), lerp(a, e, 1.04)], 7, 6); }
  else { const a: V = [0, 0, 30], e: V = [58, 0, 345], m = lerp(a, e, 0.62); b.part('handbrakeLeverBase', T.metal, 0.6).box(-60, 40, -26, 26, 0, 34); b.part('handbrakeLeverCylinder', '#2b2c2f', 0.5).tube([[-20, 0, 34], [-120, 0, 60]], 15, 6);
    b.part('handbrakeLever', T.metal, 0.6).tube([a, m], 9, 6); b.part('handbrakeLeverGrip', '#e9c014', 0.3).tube([m, e], 15, 6); } }
export function pedals(b: InteriorBuild, o: V, T: Trim): { clutch: V; throttle: V } { const f: Frame = { o, x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, n = unit([0.85, 0, 0.52]), up = unit([-0.52, 0, 0.85]), R: V = [0, -1, 0];
  b.frame(f); for (const [nm, y, z, w, h] of [['Clutch', 95, 150, 52, 66], ['Brake', 0, 150, 56, 66], ['Throttle', -100, 105, 42, 150]] as const) { const c: V = [0, y, z];
    b.part(`pedal${nm}`, '#18181a', 0.2).plate(c, R, up, n, w, h, 10, 'pedal'); b.part(`pedalArm${nm}`, T.metal, 0.5).slab([28, y, 0], add(c, mul(n, -10)), [0, 1, 0], 16, 9); }
  return { clutch: at(f, [30, 95, 150]), throttle: at(f, [30, -100, 120]) }; }

// ---- the cabin's fixed trim: tunnel, floor, the rear, door cards (the last three stand in for the body's own until it is fitted) ----
export function tunnel(b: InteriorBuild, A: CabinAnchors, T: Trim): void { const th = A.tunnelHalf, sec = (x: number, top: number): V[] => [[x, -th, A.floorZ], [x, -th + 18, top], [x, th - 18, top], [x, th, A.floorZ]];
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }).part('tunnel', T.tunnel, 0.12).loft([sec(A.screenFoot[0] + 30, A.tunnelZ + 60), sec(A.dashX + 60, A.tunnelZ), sec(A.rearX, A.tunnelZ)]);
  b.part('tunnelConsole', '#141416', 0.2).plate([A.hip[0] - 245, 0, A.tunnelZ + 7], [0, -1, 0], [-1, 0, 0], [0, 0, 1], 118, 74, 7, 'console'); }
export function floorAndRear(b: InteriorBuild, A: CabinAnchors, T: Trim): void { const x0 = A.screenFoot[0], h = A.half, xw = Math.min(A.rearX, A.wellX ?? A.rearX), hr = A.rearHalf ?? h;
  // the floor to the rear wheels' wells at the full width, between them behind (the 959's: its rear seats sit between the wells)
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }).part('cabinFloor', T.carpet, 0.05).box(x0, xw, -h, h, A.floorZ - 14, A.floorZ); if (xw < A.rearX) b.box(xw, A.rearX, -hr, hr, A.floorZ - 14, A.floorZ);
  b.part('cabinFirewall', T.carpet, 0.05).loft([[[x0 - 12, -h, A.floorZ], [x0 - 12, h, A.floorZ], [x0 - 12, h, A.dashTopZ - 200], [x0 - 12, -h, A.dashTopZ - 200]], [[x0 + 90, -h, A.floorZ], [x0 + 90, h, A.floorZ], [x0 + 8, h, A.dashTopZ - 200], [x0 + 8, -h, A.dashTopZ - 200]]]);
  for (const sg of [-1, 1]) b.part(sg > 0 ? 'cabinSillL' : 'cabinSillR', T.carpet, 0.05).box(x0, xw, sg * (h - 34), sg * h, A.floorZ, A.sillZ);
  if (A.rear) { rearSeats(b, A, T); return; }
  // the rear: the small seats' bases and their backs as one step up to the shelf
  const sx = A.rearX - 300, sz = A.floorZ + 215; const step = [[sx, sz], [sx + 30, sz + 22], [A.rearX - 40, sz + 8], [A.rearX + 70, A.shelfZ], [A.rearX + 330, A.shelfZ], [A.rearX + 330, A.floorZ], [sx, A.floorZ]];
  b.part('cabinRear', T.seat2, 0.15, 'leather').loft([-hr, hr].map(y => step.map(([x, z]) => [x!, y, z!] as V))); }
/** a 2+2's rear (docs/systems/117 R2, the N33's): two shaped seats (a cushion with raised sides, a leaning back with
 *  bolsters, pleated middles) either side of the tunnel's hump, the shelf from the backs' top to the rear screen's foot,
 *  and the trim panels on the body's sides behind the doors (the door skin's profile carried back to the seat backs) */
export function rearSeats(b: InteriorBuild, A: CabinAnchors, T: Trim): void { const R = A.rear!, [x0, x1] = R.seatX, [bx, bz] = R.backTop, [sx, sz, sh] = R.shelf, hr = A.rearHalf ?? A.half, th = A.tunnelHalf, zc = A.floorZ + 225, fz = A.floorZ;
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
  const y0 = th + 16, y1 = hr - 6, ym = (y0 + y1) / 2, hw = (y1 - y0) / 2, foot: V = [x1 - 6, 0, zc - 22], top: V = [bx, 0, bz], L = len(sub(top, foot)), U = unit(sub(top, foot)), Bk: V = [U[2], 0, -U[0]];
  for (const sg of [-1, 1]) { const nm = sg > 0 ? 'seatRearL' : 'seatRearR', Y = (dy: number) => sg * (ym + dy);
    const cush: [number, number, number][] = [[x0, zc - 70, 0], [x0 + 22, zc + 2, 12], [x0 + 130, zc + 12, 26], [x1 - 60, zc - 12, 22], [x1 + 40, zc - 34, 6]];
    b.part(nm, T.seat, 0.22, 'leather').loft(cush.map(([x, z, bol]) => ([[-hw, fz], [-hw, z + bol * 0.6], [-hw + 28, z + bol], [-hw + 58, z + bol * 0.4], [-hw + 84, z], [hw - 84, z], [hw - 58, z + bol * 0.4], [hw - 28, z + bol], [hw, z + bol * 0.6], [hw, fz]] as const).map(([dy, zz]) => [x, Y(dy), zz] as V)));
    b.paint('seatPleat', [(x0 + x1) / 2 + 30, Y(0), zc], [0, -1, 0], [-1, 0, 0], (hw - 84) * 2 + 2, x1 - x0 - 100, [0, 0, 1]);
    const P = (t: number, dy: number, d: number): V => add(add(foot, mul(U, t * L)), add([0, Y(dy), 0], mul(Bk, d)));
    const back: [number, number, number, number][] = [[0, 1, 10, 90], [0.1, 1, 26, 96], [0.5, 1, 30, 90], [0.86, 0.985, 22, 76], [0.97, 0.95, 8, 60], [1, 0.88, 0, 40]];
    b.loft(back.map(([t, k, bol, th2]) => ([[-hw * k, th2], [-hw * k, -bol * 0.5], [-hw * k + 28, -bol], [-hw * k + 60, -bol * 0.45], [-hw * k + 88, 0], [hw * k - 88, 0], [hw * k - 60, -bol * 0.45], [hw * k - 28, -bol], [hw * k, -bol * 0.5], [hw * k, th2]] as const).map(([dy, d]) => P(t, dy, d))));
    b.paint('seatPleat', P(0.48, 0, 0), [0, 1, 0], U, (hw - 88) * 2 + 2, L * 0.72, mul(Bk, -1));
    b.line('trim', [P(0.12, hw - 88, -2), P(0.84, hw - 88, -2), P(0.84, -(hw - 88), -2), P(0.12, -(hw - 88), -2)], { w: 0.7 });
    // the side trim behind the door, to the seat back: the door card's own profile carried back
    const D = A.doorIn; if (D) { const ring = (x: number, k: number) => [...D.map(([z, w]) => [x, sg * (w - 16) * k, z] as V), ...[...D].reverse().map(([z, w]) => [x, sg * (w + 2) * k, z] as V)];
      b.part(sg > 0 ? 'cabinQuarterL' : 'cabinQuarterR', T.door, 0.15, 'leather').loft([ring(A.doorX[1] + 4, 1), ring(Math.min(A.wellX ?? x1, x1), 1), ring(bx + 60, 0.97)]); } }
  // the hump between the seats and the backs' middle, set back a little
  b.part('seatRearMid', T.seat2, 0.15, 'leather').box(x0 + 14, x1 + 30, -y0 - 2, y0 + 2, fz, zc - 30);
  b.loft([0, 0.5, 1].map(t => [[-y0 - 2, 16], [y0 + 2, 16], [y0 + 2, 80 - 40 * t], [-y0 - 2, 80 - 40 * t]].map(([y, d]) => add(add(foot, mul(U, t * L * 0.98)), add([0, y!, 0], mul(Bk, d!))))));
  // the shelf: from the backs' top to under the rear screen's foot, narrowing with the body
  b.part('cabinShelf', T.tunnel, 0.1).loft([[bx + 20, hr, bz - 6], [(bx + sx) / 2, (hr + sh) / 2 + 8, (bz + sz) / 2], [sx, sh, sz]].map(([x, h, z]) => [[x!, -h!, z!], [x!, h!, z!], [x!, h!, z! - 24], [x!, -h!, z! - 24]] as V[]));
  b.part('cabinRear', T.carpet, 0.05).box(x1 + 30, bx + 30, -hr, hr, fz, zc - 60); }
export function doorCards(b: InteriorBuild, A: CabinAnchors, T: Trim, which: 'both' | 'L' | 'R' | 'none' = 'both'): void { const [d0, d1] = A.doorX, h = A.half;
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
  // the card's face at a height: the door skin's inside less the card's thickness where the cabin has its profile
  const P = A.doorIn, face = (z: number) => { if (!P) return h; if (z <= P[0]![0]) return P[0]![1] - 16; for (let i = 1; i < P.length; i++) if (z <= P[i]![0]) { const [z0, w0] = P[i - 1]!, [z1, w1] = P[i]!; return w0 + (w1 - w0) * (z - z0) / (z1 - z0) - 16; } return P[P.length - 1]![1] - 16; };
  for (const sg of [-1, 1]) { if (which === 'none' || which === (sg > 0 ? 'R' : 'L')) continue; const nm = sg > 0 ? 'doorCardL' : 'doorCardR', yz = (d: number, z: number) => sg * (face(z) - d), y = (d: number) => sg * (h - d);
    if (A.doorIn) { const P = A.doorIn, out = P.map(([z, w]) => [sg * w, z] as const), inn = [...P].reverse().map(([z, w]) => [sg * (w - 16), z] as const), ring = (x: number) => [...out, ...inn].map(([yy, z]) => [x, yy, z] as V);
      // its front edge leans back over the belt's last 170 mm, 290 mm back at the top (the door's top starts at the A pillar, behind the wing's crown)
      const LN = A.doorLean ?? 290, lean = (x: number) => (p: V): V => [x + Math.max(0, p[2] - (A.beltZ - 170)) / 170 * LN, p[1], p[2]];
      b.part(nm, T.door, 0.15, 'leather').loft([ring(d0).map(lean(d0)), ring(d1)]); }   // the card following the door skin's inside, 16 mm thick
    else b.part(nm, T.door, 0.15, 'leather').box(d0, d1, y(0), y(-14), A.sillZ, A.beltZ);
    const rz = A.beltZ, az = A.beltZ - 250, pz0 = A.sillZ + 22, pz1 = A.sillZ + 232;
    b.part(`${nm}Roll`, T.dash, 0.18, 'leather').loft([P ? d0 + (A.doorLean ?? 290) : d0, d1].map(x => ([[0, 0], [-26, -4], [-34, -30], [-26, -58], [0, -64]] as const).map(([dy, dz]) => [x, P ? yz(-dy - 10, rz) : y(-dy), rz + dz] as V)));
    b.part(`${nm}Armrest`, T.door, 0.15, 'leather').loft([d0 + 300, d0 + 380, d1 - 250, d1 - 200].map((x, i) => { const k = i === 0 || i === 3 ? 0.35 : 1; return ([[0, 0], [62 * k, -6], [70 * k, -34], [40 * k, -62], [0, -70]] as const).map(([dy, dz]) => [x, P ? yz(dy, az) : y(dy), az + dz] as V); }));
    const px0 = d0 + 110, px1 = d1 - 110, py = (d: number) => P ? yz(d, pz1) : y(d); b.part(`${nm}Pocket`, T.door, 0.15, 'leather').box(px0, px1, py(0), py(42), pz0, pz1).paint('doorPleat', [(px0 + px1) / 2, py(42), (pz0 + pz1) / 2], [-sg, 0, 0], [0, 0, 1], px1 - px0 + 2, pz1 - pz0 + 2, [0, -sg, 0]);
    b.part(`${nm}Pull`, T.metal, 0.6).slab([d0 + 180, P ? yz(20, rz - 150) : y(20), rz - 150], [d0 + 290, P ? yz(20, rz - 150) : y(20), rz - 150], [0, 0, 1], 16, 10); } }

// ---- the driver: helmet, a plain body, the hands on the wheel, the feet at the pedals. The frame is the seat's ----
export function driver(b: InteriorBuild, f: Frame, o: { recline: number; wheel: Frame; rimR: number; feet: { clutch: V; throttle: V }; suit: string; helmet: string; gloves: string }): void { const th = (o.recline - 2) * RAD, U: V = [Math.sin(th), 0, Math.cos(th)], Fw: V = [-Math.cos(th), 0, Math.sin(th)], Yv: V = [0, 1, 0];
  const inv = (p: V): V => { const d = sub(p, f.o); return [dot(d, f.x), dot(d, f.y), dot(d, f.z)]; };   // a point of the car in the seat's frame
  b.frame(f).part('driver', o.suit, 0.1, 'canvas').loft(([[-75, 150, 105], [60, 150, 100], [230, 172, 112], [375, 192, 104], [438, 150, 84], [468, 72, 62]] as const).map(([s, w, d]) => ring(mul(U, s), Yv, Fw, w, 10, d, 0.5)));
  b.paint('suit', add(mul(U, 215), mul(Fw, 100)), [0, 1, 0], U, 300, 430, Fw, 0.35);
  const neck = mul(U, 468), head = add(neck, [-28, 0, 150]), hax: V = [0, 0, 1];
  b.part('driverNeck', '#1b1b1d', 0.1).tube([add(neck, [0, 0, -20]), add(head, [10, 0, -120])], 52, 6);
  b.part('driverHelmet', o.helmet, 0.55).turn(head, hax, [[-150, 92], [-118, 120], [-55, 135], [0, 139], [55, 133], [100, 110], [130, 68], [144, 30], [147, 0]], 14, { hint: [1, 0, 0], turn: 0.5 }).paint('visor', add(head, [-140, 0, 0]), [0, 1, 0], [0, 0, 1], 290, 114, [-1, 0, 0], 0.2);
  b.line('trim', [add(head, [-128, -62, -52]), add(head, [-141, 0, -54]), add(head, [-128, 62, -52])], { w: 0.8 });
  for (const sg of [-1, 1]) { const sh = add(mul(U, 392), [0, sg * 188, 0]), a = 18 * RAD, hand = inv(at(o.wheel, [10, sg * o.rimR * Math.cos(a), o.rimR * Math.sin(a)])), el = joint(sh, hand, 325, 300, [0.2, sg * 0.8, -1]);
    b.part(sg > 0 ? 'driverArmL' : 'driverArmR', o.suit, 0.1, 'canvas').tube([add(sh, [0, -sg * 30, -10]), sh, el, lerp(el, hand, 0.86)], [50, 54, 42, 31], 8);
    const tan = unit(sub(inv(at(o.wheel, [10, sg * o.rimR * Math.cos(a + 0.2), o.rimR * Math.sin(a + 0.2)])), inv(at(o.wheel, [10, sg * o.rimR * Math.cos(a - 0.2), o.rimR * Math.sin(a - 0.2)]))));
    b.part(sg > 0 ? 'driverGloveL' : 'driverGloveR', o.gloves, 0.15).turn(hand, tan, [[-48, 0], [-40, 31], [40, 33], [50, 0]], 6);
    const hipJ: V = [-5, sg * 88, -12], foot = inv(sg > 0 ? o.feet.clutch : o.feet.throttle), ankle = add(foot, [45, 0, 10]), knee = joint(hipJ, ankle, 440, 430, [0, sg * 0.35, 1]);
    b.part(sg > 0 ? 'driverLegL' : 'driverLegR', o.suit, 0.1, 'canvas').tube([hipJ, knee, ankle], [84, 62, 44], 8);
    b.part(sg > 0 ? 'driverShoeL' : 'driverShoeR', '#1b1b1d', 0.15).slab(add(ankle, [38, 0, -52]), add(ankle, [-70, 0, 82]), [0, 1, 0], 84, 52, 70); } }

// ---- the roll cage (an option): tubes along the cabin's corners, from its anchors ----
export function cage(b: InteriorBuild, A: CabinAnchors, colour: string): void { const r = 21, hx = Math.min(A.rearX - 30, A.hip[0] + 450), top = A.roofZ - 55, P: Record<string, V> = {}, hh = A.wellX !== undefined && hx > A.wellX - 40 ? Math.min(A.half, (A.rearHalf ?? A.half) + 40) : A.half;
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }).part('cage', colour, 0.45);
  for (const [k, sg] of [['L', 1], ['R', -1]] as const) { P[`hf${k}`] = [hx, sg * (hh - 48), A.floorZ]; P[`hk${k}`] = [hx, sg * (hh - 62), A.roofZ - 270]; P[`hc${k}`] = [hx, sg * (A.roofHalf - 75), top];
    P[`ff${k}`] = [A.doorX[0] + 60, sg * (A.half - 44), A.floorZ]; P[`fd${k}`] = [A.screenFoot[0] + 75, sg * (A.screenHalf[0] + 8), A.screenFoot[1] + 34]; P[`ft${k}`] = [A.screenTop[0] + 35, sg * (A.screenHalf[1] - 12), A.screenTop[1] - 34]; P[`rs${k}`] = [A.rearX + 320, sg * (A.roofHalf - 130), A.shelfZ + 24]; }
  const on = (a: V, c: V, z: number): V => lerp(a, c, (z - a[2]) / (c[2] - a[2]));
  b.tube([P.hfL!, P.hkL!, P.hcL!, P.hcR!, P.hkR!, P.hfR!], r, 8);   // the main hoop
  for (const k of ['L', 'R']) { b.tube([P[`ff${k}`]!, P[`fd${k}`]!, P[`ft${k}`]!, P[`hc${k}`]!], r, 8); b.tube([P[`hc${k}`]!, P[`rs${k}`]!], r, 8);   // the front leg up the screen pillar and back along the roof; the rear stay
    b.tube([on(P[`ff${k}`]!, P[`fd${k}`]!, A.sillZ + 70), on(P[`hf${k}`]!, P[`hk${k}`]!, A.sillZ + 250)], r * 0.9, 8); b.tube([on(P[`ff${k}`]!, P[`fd${k}`]!, A.sillZ + 300), on(P[`hf${k}`]!, P[`hk${k}`]!, A.sillZ + 90)], r * 0.9, 8); }   // the door bars, crossed
  b.tube([P.ftL!, P.ftR!], r, 8); b.tube([P.hfR!, P.hcL!], r * 0.9, 8); b.tube([on(P.hfL!, P.hkL!, A.hip[2] + 330), on(P.hfR!, P.hkR!, A.hip[2] + 330)], r * 0.9, 8); }

/** a plain cabin shell for the pictures (not a part of the interior): sills, pillars, a roof frame and a windscreen, so
 *  the interior is judged through glass and a door opening before the body is fitted */
export function previewShell(b: InteriorBuild, A: CabinAnchors, paint: string): void { const h = A.half + 40, sf = A.screenFoot, st = A.screenTop, bx = Math.min(A.rearX - 30, A.hip[0] + 450) + 70, rz = A.roofZ + 20;
  b.frame({ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }).part('bodyShell', paint, 0.5, 'paint');
  for (const sg of [-1, 1]) { b.box(sf[0] - 260, A.rearX + 340, sg * (h - 26), sg * (h + 34), A.floorZ - 40, A.sillZ);
    const a: V = [sf[0] - 20, sg * (A.screenHalf[0] + 62), sf[1] + 6], c: V = [st[0], sg * (A.screenHalf[1] + 52), st[1] + 32], d: V = [bx, sg * (A.roofHalf + 30), rz], e: V = [bx + 30, sg * (h + 4), A.beltZ];
    b.slab(a, c, [0, 1, 0], 60, 50); b.slab(c, d, [0, 1, 0], 60, 44); b.slab(d, e, [1, 0, 0], 110, 50); b.slab([sf[0] - 20, sg * (h + 4), A.sillZ], [sf[0] - 20, sg * (A.screenHalf[0] + 62), sf[1] + 6], [1, 0, 0], 90, 50); }
  b.slab([st[0], -(A.screenHalf[1] + 52), st[1] + 32], [st[0], A.screenHalf[1] + 52, st[1] + 32], [1, 0, 0], 60, 44); b.slab([bx, -(A.roofHalf + 30), rz], [bx, A.roofHalf + 30, rz], [1, 0, 0], 110, 44);
  const scuttle = [[sf[0] - 260, sf[1] - 60], [sf[0] - 20, sf[1] + 4], [sf[0] - 20, A.floorZ - 40], [sf[0] - 260, A.floorZ - 40]]; b.loft([-(h + 30), h + 30].map(y => scuttle.map(([x, z]) => [x!, y, z!] as V)));
  b.part('windscreen', '#9fb4c0', 0.9, 'glass').panel([[[sf[0] - 14, -(A.screenHalf[0] + 40), sf[1] + 8], [sf[0] - 14, A.screenHalf[0] + 40, sf[1] + 8]], [[st[0] + 4, -(A.screenHalf[1] + 30), st[1] + 26], [st[0] + 4, A.screenHalf[1] + 30, st[1] + 26]]], [-1, 0, 1]); }
