// The 1933 Napier-Railton as a low-polygon mesh (docs/systems/70_mesh_car_rules.md): John Cobb's Brooklands outer-circuit
// record car, built by Thomson & Taylor round the 24-litre Napier Lion twelve (three banks of four, a broad arrow).
// No sheet for this car: the sizes are the real ones (wheelbase 3302, length 4724, track about 1500 [estimated], 21 in
// wire wheels on thin racing tyres), the shapes read from photographs: a tall upright radiator cowl, a very long bonnet
// with a blister over each outer bank and its exhaust pipe below, the cockpit far back, a pointed tail.
import { Build, section, type Mesh, type V } from './mesh';

const PAINT = '#b8c4cc', SEAM = '#77828a', CHROME = '#c9cbcf', PIPE = '#6a625c', LEATHER = '#8a4630', LEATHER2 = '#6c3524', GLASS = '#a9c2cc', RUBBER = '#26242b', DARK = '#1c1b20', FRAME = '#2b2d31';
const FX = 470, RX = FX + 3302, R = 445, WY = 750, TW = 180, L = 4724;   // the axles, the tyre's radius (7.00-21), half the track, the tyre's width
const RAIL = 420, FLOOR = 560, CX0 = 2860, CX1 = 3440;                   // the frame rails' distance from the centre; the cockpit's floor, front and back
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body along the car: half-width (plan), top and bottom (side view), how square its upper half is
const HALF: [number, number][] = [[40, 262], [75, 300], [200, 318], [600, 355], [1400, 410], [2200, 455], [2900, 480], [3400, 468], [3800, 400], [4150, 290], [4450, 160], [4640, 70], [4724, 22]];
const TOP: [number, number][] = [[40, 1130], [75, 1178], [160, 1198], [300, 1200], [2600, 1205], [2858, 1195], [3440, 1150], [3800, 1085], [4150, 985], [4450, 880], [4724, 770]];
const BOT: [number, number][] = [[40, 450], [75, 415], [300, 365], [3600, 360], [4150, 420], [4450, 480], [4724, 545]];
const SQ: [number, number][] = [[40, 5], [300, 4.2], [2600, 3.6], [3440, 3.2], [4724, 2.4]];
const BELT: [number, number][] = [[CX0, 1150], [2950, 1120], [3300, 1110], [CX1, 1140]];   // the cockpit's cut-down sides
/** the skin's height at y across the body at x (its upper half) */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), n = at(SQ, x), u = Math.min(1, Math.abs(y) / w); return (zb + zt) / 2 + (zt - zb) / 2 * (1 - u ** n) ** (1 / n); };
/** a round pipe through points; one radius or one a point */
function tube(b: Build, pts: V[], r: number | number[], seg = 8, caps = true) { const n = pts.length;
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(n - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), v = cross(d, u), rr = typeof r === 'number' ? r : r[i]!;
    return Array.from({ length: seg }, (_, k) => { const t = k / seg * Math.PI * 2, c = Math.cos(t) * rr, s = Math.sin(t) * rr; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); }), caps); }
/** a profile turned about the upright axis through o: [height above o, radius] pairs */
function turn(b: Build, o: V, prof: [number, number][], seg = 10, caps = true) { b.loft(prof.map(([a, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [o[0] + Math.cos(t) * r, o[1] + Math.sin(t) * r, o[2] + a] as V; })), caps); }

/** a racing wire wheel: a thin tall tyre on a 21 in well-base rim, two rows of tangent spokes, a knock-off cap */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 286, f = s * (TW / 2);
  b.name(x === FX ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 60], [-TW / 2 + 45, R], [TW / 2 - 45, R], [TW / 2, R - 60], [TW / 2, rim]], 24, false);
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[-f * 0.5, 0], [-f * 0.5, rim]], 24, false);                     // the dark behind the spokes
  b.name('rim').mat('#8f959b', 0.5, 'metal').lathe('y', o, [[f, rim + 8], [f * 0.6, rim - 26]], 24, false).lathe('y', o, [[-f, rim + 8], [-f * 0.6, rim - 26]], 24, false);
  if (x === RX) b.name('drum').mat('#3a3a3e', 0.3, 'metal').lathe('y', o, [[-f * 0.9, 205], [-f * 1.75, 205], [-f * 1.75, 0]], 16, false);   // brakes on the back wheels only
  b.name('spoke').mat('#c3c5c9', 0.6, 'metal'); for (let row = 0; row < 2; row++) for (let k = 0; k < 18; k++) { const a = spin + (k + row * 0.5) / 18 * Math.PI * 2, lean = (k % 2 ? 1 : -1) * 0.5, b0 = a + lean, rr = rim - 22;
    const yin = s * WY + f * (row ? 1.05 : 0.2), yout = s * WY + f * (row ? 0.6 : 0.45); b.bar([x + Math.cos(a) * 60, yin, R + Math.sin(a) * 60], [x + Math.cos(b0) * rr, yout, R + Math.sin(b0) * rr], 8); }
  b.name('hub').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 0.1, 66], [f * 1.05, 62], [f * 1.2, 44], [f * 1.26, 0]], 12, false);   // the hub shell and its knock-off cap
  for (const e of [0, Math.PI]) { const a = spin + e; b.bar([x + Math.cos(a) * 30, s * WY + f * 1.22, R + Math.sin(a) * 30], [x + Math.cos(a) * 92, s * WY + f * 1.18, R + Math.sin(a) * 92], 22, 14); }   // its two ears
}

export function napierMesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: the radiator cowl's flat face, the long bonnet, the cockpit cut down, the tail drawn to a point ----
  b.name('body').mat(PAINT, 0.5, 'paint');
  const xs = [40, 75, 160, 300, 600, 1000, 1400, 1800, 2200, 2600, CX0 - 2, CX0, CX1, CX1 + 2, 3600, 3800, 3980, 4150, 4300, 4450, 4560, 4640, 4724];
  b.loft(xs.map(x => { const cockpit = x >= CX0 && x <= CX1; return section(x, at(HALF, x), at(BOT, x), cockpit ? FLOOR : at(TOP, x), cockpit ? 8 : at(SQ, x), 6); }));
  // the cockpit's sides either side of the hollow, with a padded leather roll along their tops
  for (const s of [1, -1]) b.loft([CX0 + 1, 2950, 3100, 3300, CX1 - 1].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 60), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 16], [x, s * (w - 24), zt], [x, s * (w - 60), zt - 8]] as V[]; }));
  b.name('cockpitRoll').mat(LEATHER2, 0.2, 'leather'); for (const s of [1, -1]) tube(b, [CX0 + 10, 2950, 3100, 3300, CX1 - 10].map(x => [x, s * (at(HALF, x) - 30), at(BELT, x) + 4] as V), 26, 6);
  b.name('cockpit').mat(DARK, 0.05).box(CX0 + 2, CX1 - 2, -430, 430, FLOOR - 10, FLOOR + 4);                       // the floor of the hollow
  b.name('cockpit').mat('#33363a', 0.15).box(CX0, CX0 + 16, -410, 410, FLOOR, 1140);                                // the dash: the scuttle's back face
  b.name('cockpit').mat('#d8d2bf', 0.4); for (const y of [-240, -80, 80, 240]) b.lathe('x', [0, y, 1040], [[CX0 + 16, 0], [CX0 + 20, y === 80 ? 62 : 44]], 10, false);   // its dials, the big rev counter before the driver
  // the one seat, in the middle: a cushion and a tall back against the tank
  b.name('seat').mat(LEATHER, 0.25, 'leather').box(3080, 3400, -260, 260, FLOOR, 700).loft(([[3340, 700], [3385, 880], [3420, 1040], [CX1 - 2, 1120]] as const).map(([x, z]) => [[x, -280, FLOOR], [x, 280, FLOOR], [x, 280, z], [x, -280, z]] as V[]));
  b.name('seat').mat(LEATHER2, 0.1); for (const y of [-130, 0, 130]) b.bar([3090, y, 702], [3340, y, 702], 8).bar([3388, y, 885], [3424, y, 1040], 8);   // its pleats
  // the headrest's fairing down the tail, its pad facing the driver
  const head: [number, number, number][] = [[CX1 - 4, 185, 1250], [3600, 170, 1232], [3800, 135, 1180], [4000, 95, 1105], [4180, 55, 1030], [4300, 18, 975]];
  b.name('headFairing').mat(PAINT, 0.5, 'paint').loft(head.map(([x, w, zt]) => section(x, w, at(TOP, x) - 90, zt, 2.4, 6, 12)));
  b.name('headrest').mat(LEATHER, 0.25, 'leather').loft([section(CX1 - 22, 150, 1075, 1238, 2.4, 2.4, 12), section(CX1 - 4, 165, 1065, 1246, 2.4, 2.4, 12)]);
  // ---- the nose: the tall narrow radiator opening, its mesh, the bright surround ----
  b.name('core').mat(DARK, 0.05, 'grille').box(30, 44, -165, 165, 500, 1085);
  b.name('shell').mat(CHROME, 0.9, 'metal').loft([section(46, 190, 478, 1108, 4, 6, 16), section(26, 190, 478, 1108, 4, 6, 16), section(26, 164, 500, 1086, 4, 6, 16), section(46, 164, 500, 1086, 4, 6, 16)], false);
  b.name('coreBar').mat(CHROME, 0.9, 'metal').box(24, 34, -7, 7, 500, 1086);                                       // the centre bar
  // ---- the bonnet: a blister over each outer bank of the engine, the centre hinge, the louvres, two straps ----
  for (const s of [1, -1]) { b.name('hood').mat(PAINT, 0.5, 'paint');
    b.loft(([[330, 30], [520, 92], [900, 112], [1900, 118], [2350, 100], [2560, 34]] as const).map(([x, r]) => section(x, r, 1010 - r, 1010 + r * 1.15, 2.2, 2.2, 10).map(p => [p[0], p[1] + s * (at(HALF, x) - 78), p[2]] as V))); }
  b.name('hood').mat(SEAM, 0.3).bar([110, 0, at(TOP, 110) + 2], [2700, 0, at(TOP, 2700) + 2], 12, 8);             // the hinge along the top
  b.name('hood').mat(SEAM, 0.1); for (const s of [1, -1]) { for (let k = 0; k < 26; k++) { const x = 640 + k * 62, y = s * (at(HALF, x) + 2); b.quad([x, y, 560], [x + 12, y, 560], [x + 12, y, 790], [x, y, 790]); }   // louvres low on the sides
    for (const x of [300, 2720]) { const y = s * (at(HALF, x) + 2); b.quad([x, y, 430], [x + 9, y, 430], [x + 9, y, 1090], [x, y, 1090]); } }   // the bonnet's front and back edges
  b.name('strap').mat(LEATHER2, 0.2, 'leather'); for (const x of [470, 2480]) { const pts: V[] = []; for (let k = -8; k <= 8; k++) { const y = k / 8 * (at(HALF, x) - 4); pts.push([x, y, skinZ(x, y) + 5]); } for (let i = 0; i + 1 < pts.length; i++) b.bar(pts[i]!, pts[i + 1]!, 34, 9); }
  // ---- the aero screen: one small pane before the driver in a bright frame ----
  { const f0: V = [2796, -200, 1196], f1: V = [2796, 200, 1196], t0: V = [2856, -175, 1298], t1: V = [2856, 175, 1298];
    b.name('screenPane').mat(GLASS, 0.5, 'glass').quad(f0, f1, t1, t0);
    b.name('screenFrame').mat(CHROME, 0.9, 'metal').bar(f0, f1, 20).bar(f0, t0, 16).bar(f1, t1, 16).bar(t0, t1, 14); }
  // ---- the fuel filler on the tail, behind the fairing ----
  b.name('filler').mat(CHROME, 0.9, 'metal'); turn(b, [4390, 0, at(TOP, 4390) - 6], [[0, 46], [26, 46], [34, 58], [48, 58], [56, 30]], 10);
  // ---- either side: the exhaust, the frame rail and its springs, the wheels ----
  for (const s of [1, -1] as const) {
    // four stubs out of the blister into one long pipe, which runs back along the body and ends in a fishtail
    b.name('exhaust').mat(PIPE, 0.5, 'metal'); const py = (x: number) => s * (at(HALF, x) + 92), pz = (x: number) => x < 2500 ? 880 : 880 - (x - 2500) * 0.32;
    for (let k = 0; k < 4; k++) { const x = 760 + k * 410; tube(b, [[x, s * (at(HALF, x) - 20), 965], [x + 50, s * (at(HALF, x) + 50), 935], [x + 150, py(x + 150), pz(x + 150)]], 34, 6, false); }
    tube(b, [820, 1200, 1700, 2200, 2500, 2800, 3100, 3260].map(x => [x, py(x), pz(x)] as V), [38, 48, 52, 54, 54, 54, 54, 54], 8);
    b.loft([[3250, 54, 54], [3400, 80, 26]].map(([x, h, w]) => section(x!, w!, pz(x!) - h!, pz(x!) + h!, 2.4, 2.4, 8).map(p => [p[0], p[1] + py(Math.min(x!, 3260)), p[2]] as V)));   // the fishtail
    b.name('chassis').mat(FRAME, 0.1).loft(([[0, 505, 560], [120, 480, 580], [600, 470, 590], [3300, 450, 580], [3950, 470, 560]] as const).map(([x, z0, z1]) => [[x, s * (RAIL - 26), z0], [x, s * (RAIL + 26), z0], [x, s * (RAIL + 26), z1], [x, s * (RAIL - 26), z1]] as V[]));   // the rail, its dumb iron at the front
    b.name('spring').mat(DARK, 0.1).loft(([[20, 505, 22], [245, 462, 44], [FX, 440, 62], [700, 462, 44], [930, 500, 22]] as const).map(([x, z, h]) => [[x, s * (RAIL - 30), z - h / 2], [x, s * (RAIL + 30), z - h / 2], [x, s * (RAIL + 30), z + h / 2], [x, s * (RAIL - 30), z + h / 2]] as V[]));   // the front leaf spring
    b.name('damper').mat(FRAME, 0.2).lathe('y', [FX + 190, s * (RAIL + 30), 520], [[0, 0], [0, 70], [s * 34, 70], [s * 34, 0]], 10, false).bar([FX + 190, s * (RAIL + 48), 520], [FX + 20, s * (RAIL + 48), 455], 22, 12);   // the friction damper and its arm
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across the car: the dumb irons' cross tube, the front beam axle and its track rod, the back axle ----
  b.name('chassis').mat(FRAME, 0.1).bar([22, -RAIL, 540], [22, RAIL, 540], 44);
  b.name('axle').mat('#3c3f44', 0.3, 'metal').bar([FX, -WY + 60, R], [FX, WY - 60, R], 62, 54).bar([FX + 150, -WY + 110, R - 40], [FX + 150, WY - 110, R - 40], 26).bar([RX, -WY + 60, R], [RX, WY - 60, R], 90);
  return b.mesh(L); }
export const mesh = napierMesh;
