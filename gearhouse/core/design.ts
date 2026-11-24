// A car's design (docs/systems/98_alpha_interface_and_builder_plan.md): what the parts builder edits and saves, one
// JSON value per car. Data only; the body is made from it by render/car/design.ts (designKit, the car kit), the
// physics by race/design.ts (designSpec). The body is a base (a platform of the car kit whose panels are sized for it)
// with its panels' kinds swapped; the machinery is chosen freely.

/** the kit's platforms (each a car built from the kit: its lines and its panels' measurements) */
export type BaseId = 'nsx' | 'f355';
export type NoseKind = 'round' | 'pointed';
export type FrontKind = 'plain' | 'sunk';
export type TailKind = 'frame' | 'roundLamps' | 'ducktail';
export type WheelKind = 'fiveSpoke' | 'disc' | 'star';
export type Layout = 'V6' | 'V8' | 'V12';
export type Material = 'steel' | 'aluminium';

export interface Design {
  /** the format's version */ v: 1;
  id: string; name: string;
  body: { base: BaseId; nose: NoseKind; front: FrontKind; tail: TailKind; wheel: WheelKind;
    /** mm added between the arches (-150..+250) and to half the width (-40..+60) */ wheelbase: number; width: number;
    paint: string; gloss: number; material: Material };
  engine: { layout: Layout; /** cc */ cc: number; /** valves a cylinder */ valves: 2 | 3 | 4 | 5;
    /** the red line (rpm) */ redline: number; turbo: 0 | 1 | 2; /** two cam profiles */ vtec: boolean };
  drive: { gears: 5 | 6; gearbox: 'manual' | 'f1'; /** the final drive's ratio; 0: chosen for the top speed */ final: number; lsd: boolean; awd: boolean };
  kit: { abs: boolean; tcs: boolean; steering: 'manual' | 'hydraulic' | 'electric'; dampers: 'fixed' | 'adaptive'; wing: boolean; diffuser: boolean;
    /** tyres' widths front and rear (mm) and the rims (in) */ tyres: [number, number]; rim: 16 | 17 | 18 };
}

export const BASES: BaseId[] = ['nsx', 'f355'];
export const NOSES: NoseKind[] = ['round', 'pointed'];
export const FRONTS: FrontKind[] = ['plain', 'sunk'];
export const TAILS: TailKind[] = ['frame', 'roundLamps', 'ducktail'];
export const WHEELS: WheelKind[] = ['fiveSpoke', 'disc', 'star'];
export const LIMITS = { wheelbase: [-150, 250], width: [-40, 60], cc: [2000, 6500], redline: [6000, 9000], tyre: [195, 335], final: [2.8, 4.8] } as const;

/** the two cars the kit was made from, as designs (the generators are checked against their real figures) */
export const DESIGN_NSX: Design = { v: 1, id: 'nsx', name: 'NSX', body: { base: 'nsx', nose: 'round', front: 'plain', tail: 'frame', wheel: 'fiveSpoke', wheelbase: 0, width: 0, paint: '#b0121b', gloss: 0.6, material: 'aluminium' },
  engine: { layout: 'V6', cc: 2977, valves: 4, redline: 8000, turbo: 0, vtec: true }, drive: { gears: 5, gearbox: 'manual', final: 4.062, lsd: true, awd: false },
  kit: { abs: true, tcs: true, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [205, 225], rim: 16 } };
export const DESIGN_F355: Design = { v: 1, id: 'f355', name: 'F355', body: { base: 'f355', nose: 'pointed', front: 'sunk', tail: 'ducktail', wheel: 'star', wheelbase: 0, width: 0, paint: '#f5c300', gloss: 0.6, material: 'steel' },
  engine: { layout: 'V8', cc: 3496, valves: 5, redline: 8500, turbo: 0, vtec: false }, drive: { gears: 6, gearbox: 'manual', final: 4.1, lsd: true, awd: false },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'adaptive', wing: false, diffuser: true, tyres: [225, 265], rim: 18 } };

const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
/** a design brought inside the limits (a loaded file, a slider's value) */
export function normalise(d: Design): Design {
  return { ...d, body: { ...d.body, wheelbase: clamp(d.body.wheelbase, LIMITS.wheelbase), width: clamp(d.body.width, LIMITS.width), gloss: clamp(d.body.gloss, [0, 1]) },
    engine: { ...d.engine, cc: clamp(d.engine.cc, LIMITS.cc), redline: clamp(d.engine.redline, LIMITS.redline) },
    drive: { ...d.drive, final: d.drive.final ? clamp(d.drive.final, LIMITS.final) : 0 },
    kit: { ...d.kit, tyres: [clamp(d.kit.tyres[0], LIMITS.tyre), clamp(d.kit.tyres[1], LIMITS.tyre)] } };
}
