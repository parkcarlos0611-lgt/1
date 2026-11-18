// Writes the three prototype-1 bodies to data/cars/*.json. The numbers below only seed the control points:
// once written, every panel is plain point data that the editor can reshape freely.
// npx tsx tools/makePresets.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import type { CarDesign, Feature, Panel, Pt, WheelSpec } from '../render/car/types';

interface Saloon { name: string; year: number; len: number; fx: number; wb: number; r: number; hoodEnd: number; roof: number; belt: number; sill: number;
  cabRear: number; trunk: [number, number]; windows: [number, number][]; paint: string; paint2: string; wheel: Partial<WheelSpec>; spare?: number; trim?: boolean }

function saloon(o: Saloon): CarDesign {
  const rx = o.fx + o.wb, R = o.r, archR = R + 65, fa = (cx: number): Pt[] => [[cx - archR * 1.0, 540], [cx - archR * 0.82, 540 + archR * 0.45], [cx - archR * 0.45, R + archR * 0.88], [cx, R + archR], [cx + archR * 0.45, R + archR * 0.88], [cx + archR * 0.82, 540 + archR * 0.45]];
  const top = R + archR + 270, hz = o.belt + 80, cowl = o.hoodEnd;
  const panels: Panel[] = [
    { id: 'frame', material: 'shadow', surface: 'flat', z: 2, pts: [[o.fx + archR - 60, 430, 1], [rx - archR + 60, 430, 1], [rx - archR + 60, 545, 1], [o.fx + archR - 60, 545, 1]] },
    { id: 'wellF', material: 'shadow', surface: 'flat', z: 1, pts: [[o.fx - archR, 420, 1], ...fa(o.fx).slice(1), [o.fx + archR, 420, 1]] },
    { id: 'wellR', material: 'shadow', surface: 'flat', z: 1, pts: [[rx - archR, 420, 1], ...fa(rx).slice(1), [rx + archR, 420, 1]] },
    { id: 'hood', material: 'paint', surface: 'hood', z: 10, group: 'body', pts: [[260, 640, 1], [260, hz + 10], [600, hz + 30], [cowl - 20, hz], [cowl, o.belt, 1], [cowl, 700, 1], [900, 640, 1]] },
    { id: 'body', material: 'paint', surface: 'side', z: 10, group: 'body', pts: [[cowl, o.sill, 1], [cowl, o.belt, 1], [(cowl + o.cabRear) / 2, o.belt + 12], [o.cabRear, o.belt], [o.cabRear + 250, o.belt - 60], [o.cabRear + 380, o.belt - 220], [o.cabRear + 400, 700], [o.cabRear + 330, o.sill, 1]] },
    { id: 'cabin', material: 'paint2', surface: 'roof', z: 11, group: 'body', pts: [[cowl + 60, o.belt, 1], [cowl + 140, o.roof - 60], [cowl + 260, o.roof], [o.cabRear - 300, o.roof + 6], [o.cabRear - 60, o.roof - 70], [o.cabRear + 160, o.belt + 260], [o.cabRear + 230, o.belt, 1]] },
    { id: 'trunk', material: 'paint', surface: 'side', z: 12, group: 'body', pts: [[o.trunk[0], 640, 1], [o.trunk[0], o.belt - 40], [o.trunk[0] + 120, o.belt - 20], [o.trunk[1] - 60, o.belt - 50], [o.trunk[1], o.belt - 150], [o.trunk[1], 700], [o.trunk[1] - 60, 640, 1]] },
    { id: 'grille', material: 'chrome', surface: 'side', z: 12, pts: [[150, 600, 1], [158, hz + 40], [200, hz + 80], [272, hz + 45], [272, 620, 1]] },
    { id: 'fenderF', material: 'paint2', surface: 'fender', z: 20, group: 'fF', pts: [[70, 470], [120, 640], [230, 820], [o.fx - archR * 0.6, top - 40], [o.fx, top], [o.fx + archR * 0.7, top - 60], [o.fx + archR * 1.35, 760], [cowl - 80, 600], [cowl + 30, 545], [cowl + 40, 515, 1], [cowl - 150, 515], ...fa(o.fx).reverse(), [240, 520, 1]] },
    { id: 'fenderR', material: 'paint2', surface: 'fender', z: 20, group: 'fR', pts: [[rx - archR - 80, 525, 1], [rx - archR * 0.9, 760], [rx - archR * 0.45, top - 70], [rx + 40, top - 40], [rx + archR * 0.7, top - 110], [rx + archR * 1.2, 760], [rx + archR * 1.45, 560], [rx + archR * 1.5, 515, 1], [rx + archR * 1.05, 515], ...fa(rx).reverse()] },
    { id: 'board', material: 'rubber', surface: 'flat', z: 19, pts: [[cowl - 60, 515, 1], [cowl - 60, 552, 1], [rx - archR - 40, 552, 1], [rx - archR - 40, 515, 1]] },
    { id: 'bumperF', material: 'chrome', surface: 'side', z: 25, pts: [[-10, 445, 1], [-10, 545], [100, 545], [100, 445, 1]] },
    { id: 'bumperR', material: 'chrome', surface: 'side', z: 25, pts: [[o.len - 110, 455, 1], [o.len - 110, 550], [o.len, 550], [o.len, 455, 1]] },
    { id: 'bracketF', material: 'black', surface: 'flat', z: 3, pts: [[60, 475, 1], [o.fx - R, 475, 1], [o.fx - R, 505, 1], [60, 505, 1]] },
    { id: 'bracketR', material: 'black', surface: 'flat', z: 3, pts: [[rx + R, 480, 1], [o.len - 60, 480, 1], [o.len - 60, 510, 1], [rx + R, 510, 1]] },
    { id: 'shield', material: 'glass', surface: 'side', z: 13, pts: [[cowl + 70, o.belt + 10, 1], [cowl + 140, o.roof - 90, 1], [cowl + 175, o.roof - 90, 1], [cowl + 105, o.belt + 10, 1]] },
    ...o.windows.map(([a, b], k): Panel => ({ id: 'glass' + k, material: 'glass', surface: 'side', z: 13, pts: k === o.windows.length - 1
      ? [[a, o.belt + 45, 1], [a, o.roof - 95, 1], [b - 90, o.roof - 110], [b, o.belt + 230], [b + 10, o.belt + 45, 1]]
      : [[a, o.belt + 45, 1], [a, o.roof - 95, 1], [b, o.roof - 95, 1], [b, o.belt + 45, 1]] })),
  ];
  const doorXs = [cowl + 40, ...o.windows.slice(0, -1).map(w => w[1] + 30)];
  const features: Feature[] = [
    ...doorXs.map((x): Feature => ({ kind: 'seam', pts: [[x, o.sill + 20], [x + 4, o.roof - 80]] })),
    { kind: 'seam', pts: [[doorXs[0]!, o.sill + 20], [doorXs.at(-1)! + (o.windows.at(-1)![0] - doorXs.at(-1)!) * 0 + 780, o.sill + 20]] },
    { kind: 'louvres', x0: 650, x1: cowl - 180, z0: 860, z1: hz - 90, n: Math.round((cowl - 830) / 62), slant: 0.1 },
    { kind: 'seam', pts: [[280, hz - 25], [cowl - 10, hz - 35]] },
    { kind: 'trim', pts: [[cowl + 150, o.roof - 55], [(cowl + o.cabRear) / 2, o.roof - 50], [o.cabRear - 80, o.roof - 80]], width: 1 },
    ...(o.trim ? [{ kind: 'trim', pts: [[260, hz - 5], [cowl, o.belt - 5], [o.cabRear, o.belt - 5], [o.cabRear + 300, o.belt - 120]] } as Feature] : []),
    ...doorXs.map((x, k): Feature => ({ kind: 'handle', at: [k % 2 ? x + 40 : x + 90, o.belt - 70], len: 100 })),
    ...doorXs.slice(0, 1).flatMap((x): Feature[] => [{ kind: 'hinge', at: [x - 12, o.belt - 140] }, { kind: 'hinge', at: [x - 12, o.sill + 160] }]),
    { kind: 'lamp', at: [430, top - 60], r: 115, facing: 'front' },
    { kind: 'lamp', at: [o.trunk[1] - 60, 760], r: 55, facing: 'rear' },
    { kind: 'cap', at: [200, hz + 80], h: 70 },
    ...[0.3, 0.55, 0.8].map((t): Feature => ({ kind: 'bolt', at: [o.fx - archR + archR * 2 * t, top - 140 - Math.abs(t - 0.55) * 300] })),
  ];
  const wheel = (x: number): WheelSpec => ({ x, r: R, rim: 0.6, style: 'wire', spokes: 36, rimMaterial: 'chrome', zOrder: 5, ...o.wheel });
  const wheels: WheelSpec[] = [wheel(o.fx), wheel(rx)];
  if (o.spare) wheels.push({ ...wheel(o.spare), z: R + 470, spare: true, zOrder: 21, style: 'disc', rimMaterial: 'paint', whitewall: 0, rim: 0.82 });   // sidemount in a body-colour cover
  return { name: o.name, year: o.year, length: o.len, height: o.roof + 120, paint: o.paint, paint2: o.paint2, panels, features, wheels };
}

function roadster(): CarDesign {
  const fx = 650, rx = 3450, R = 350, archR = 440, belt = 1060, cowl = 1900;
  const fa = (cx: number): Pt[] => [[cx - archR, 540], [cx - archR * 0.82, 540 + archR * 0.45], [cx - archR * 0.45, R + archR * 0.88], [cx, R + archR], [cx + archR * 0.45, R + archR * 0.88], [cx + archR * 0.82, 540 + archR * 0.45]];
  const panels: Panel[] = [
    { id: 'frame', material: 'shadow', surface: 'flat', z: 2, pts: [[fx + archR - 60, 430, 1], [rx - archR + 60, 430, 1], [rx - archR + 60, 545, 1], [fx + archR - 60, 545, 1]] },
    { id: 'wellF', material: 'shadow', surface: 'flat', z: 1, pts: [[fx - archR, 420, 1], ...fa(fx).slice(1), [fx + archR, 420, 1]] },
    { id: 'wellR', material: 'shadow', surface: 'flat', z: 1, pts: [[rx - archR, 420, 1], ...fa(rx).slice(1), [rx + archR, 420, 1]] },
    { id: 'hood', material: 'paint', surface: 'hood', z: 10, group: 'body', pts: [[250, 640, 1], [250, 1140], [600, 1165], [cowl - 20, 1150], [cowl, belt + 40, 1], [cowl, 700, 1], [900, 640, 1]] },
    { id: 'body', material: 'paint', surface: 'side', z: 10, group: 'body', pts: [[cowl, 540, 1], [cowl, belt + 40, 1], [2250, belt + 20], [2400, belt - 60], [2950, belt - 70], [3300, belt - 20], [3750, belt - 40], [4050, 930], [4180, 760], [4150, 600], [4050, 540, 1]] },
    { id: 'top', material: 'canvas', surface: 'roof', z: 14, pts: [[2850, belt - 60], [2920, belt + 120], [3150, belt + 175], [3420, belt + 150], [3560, belt + 70], [3530, belt - 50]] },
    { id: 'seat', material: 'black', surface: 'roof', z: 9, pts: [[2300, belt - 40], [2380, belt + 160], [2520, belt + 190], [2600, belt + 150], [2620, belt - 40]] },
    { id: 'frameW', material: 'chrome', surface: 'side', z: 15, pts: [[cowl - 10, belt + 40, 1], [cowl + 60, 1520, 1], [cowl + 100, 1520, 1], [cowl + 30, belt + 40, 1]] },
    { id: 'shield', material: 'glass', surface: 'side', z: 14, pts: [[cowl + 30, belt + 60, 1], [cowl + 95, 1490, 1], [cowl + 125, 1490, 1], [cowl + 60, belt + 60, 1]] },
    { id: 'grille', material: 'chrome', surface: 'side', z: 12, pts: [[140, 580, 1], [180, 1180], [230, 1205], [295, 1175], [262, 600, 1]] },
    { id: 'fenderF', material: 'paint2', surface: 'fender', z: 20, group: 'fF', pts: [[100, 520], [220, 760], [430, 960], [fx, 1030], [900, 975], [1150, 840], [1500, 660], [1880, 565], [2000, 520, 1], [1600, 520], [1180, 590], ...fa(fx).reverse(), [240, 520, 1]] },
    { id: 'fenderR', material: 'paint2', surface: 'fender', z: 20, group: 'fR', pts: [[2880, 525, 1], [3040, 760], [3280, 925], [3470, 965], [3720, 905], [3920, 740], [4040, 560], [4060, 515, 1], [3900, 515], ...fa(rx).reverse()] },
    { id: 'board', material: 'rubber', surface: 'flat', z: 19, pts: [[1950, 495, 1], [1950, 550, 1], [2940, 550, 1], [2940, 495, 1]] },
    { id: 'bumperF', material: 'chrome', surface: 'side', z: 25, pts: [[-10, 445, 1], [-10, 545], [100, 545], [100, 445, 1]] },
    { id: 'bumperR', material: 'chrome', surface: 'side', z: 25, pts: [[4090, 455, 1], [4090, 550], [4200, 550], [4200, 455, 1]] },
  ];
  const features: Feature[] = [
    { kind: 'seam', pts: [[2380, 560], [2385, belt - 60]] }, { kind: 'seam', pts: [[2950, 560], [2955, belt - 70]] },
    { kind: 'seam', pts: [[280, 1120], [cowl - 10, 1110]] }, { kind: 'louvres', x0: 800, x1: 1700, z0: 830, z1: 1060, n: 20, slant: 0.1 },
    { kind: 'trim', pts: [[250, 1095], [cowl, 1085], [2380, belt - 40], [3700, belt - 70], [4100, 880]] },
    { kind: 'handle', at: [2860, belt - 120], len: 90 }, { kind: 'hinge', at: [2390, belt - 160] }, { kind: 'hinge', at: [2390, 700] },
    { kind: 'lamp', at: [360, 1010], r: 115, facing: 'front' }, { kind: 'lamp', at: [4020, 820], r: 50, facing: 'rear' }, { kind: 'cap', at: [215, 1205], h: 80 },
  ];
  const wheel = (x: number): WheelSpec => ({ x, r: R, rim: 0.62, style: 'wire', spokes: 40, rimMaterial: 'chrome', whitewall: 0.28, zOrder: 5 });
  return { name: '1934 roadster', year: 1934, length: 4200, height: 1620, paint: '#8c2a24', paint2: '#211d1e', panels, features,
    wheels: [wheel(fx), wheel(rx), { ...wheel(1420), z: R + 440, spare: true, zOrder: 21, style: 'disc', rimMaterial: 'paint', whitewall: 0, rim: 0.82 }] };
}

const cars: CarDesign[] = [
  saloon({ name: '1932 sedan', year: 1932, len: 4620, fx: 700, wb: 2900, r: 360, hoodEnd: 1680, roof: 1700, belt: 1170, sill: 540, cabRear: 3560,
    trunk: [3900, 4560], windows: [[1850, 2520], [2620, 3290], [3370, 3700]], paint: '#2f3a4a', paint2: '#1d1c20', wheel: { style: 'artillery', spokes: 12, rimMaterial: 'paint', rim: 0.62 } }),
  roadster(),
  saloon({ name: '1936 coachbuilt limousine', year: 1936, len: 5650, fx: 760, wb: 3700, r: 380, hoodEnd: 2150, roof: 1780, belt: 1210, sill: 560, cabRear: 4600,
    trunk: [4880, 5560], windows: [[2330, 3000], [3100, 3700], [3780, 4330], [4410, 4740]], paint: '#5c1c27', paint2: '#1b1a1f', wheel: { style: 'disc', rim: 0.6, rimMaterial: 'paint', whitewall: 0.3 }, spare: 1700, trim: true }),
];
mkdirSync('data/cars', { recursive: true });
for (const c of cars) writeFileSync(`data/cars/${c.name.replace(/\s+/g, '_')}.json`, JSON.stringify(c, null, 1));
console.log('wrote', cars.map(c => c.name).join(', '));
