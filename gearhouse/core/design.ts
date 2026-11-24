// A car's design (docs/systems/98_alpha_interface_and_builder_plan.md): what the parts builder edits and saves, one
// JSON value per car. Data only; the body is made from it by render/car/design.ts (designKit, the car kit), the
// physics by race/design.ts (designSpec), the fit of its parts by race/fit.ts. The body is a base (a platform of the car
// kit whose panels are sized for it) with its panels' kinds swapped; the machinery is chosen freely, within what the
// engine's development grade allows (docs/systems/99, section 6-1).
// Format 2 (review 177): the engine's development grade and its details (intake, compression, lubrication, block, up to
// four turbos with a boost and an intercooler), the structure's and the panels' materials apart. Format 1's designs
// (saved in browsers, carried in links) are brought to it by normalise().

/** the kit's platforms (each a car built from the kit: its lines and its panels' measurements) */
export type BaseId = 'nsx' | 'f355';
export type NoseKind = 'round' | 'pointed';
export type FrontKind = 'plain' | 'sunk';
export type TailKind = 'frame' | 'roundLamps' | 'ducktail';
export type WheelKind = 'fiveSpoke' | 'disc' | 'star';
export type Layout = 'V6' | 'V8' | 'V12';
/** the engine's development grade: 1 a mass-production engine, 2 a high-performance production one (the NSX's C30A, the
 *  F355's F129B), 3 a sporting (homologation) one (the Diablo's), 4 one derived from racing (the McLaren F1's S70/2,
 *  the XJ220's JRV-6), 5 a racing engine (Group C, Formula 1) */
export type Grade = 1 | 2 | 3 | 4 | 5;
/** one throttle, a variable-length (resonance) intake, a throttle a cylinder */
export type Intake = 'single' | 'variable' | 'itb';
/** about 8.5:1 (a turbo engine's), 10:1, 11:1 and over */
export type Compression = 'low' | 'mid' | 'high';
export type Sump = 'wet' | 'dry';
export type Block = 'iron' | 'aluminium' | 'magnesium';
export type Valves = 2 | 3 | 4 | 5;
export type Turbos = 0 | 1 | 2 | 3 | 4;
/** the structure (the monocoque or the frame): steel, high-strength steel, aluminium, aluminium honeycomb, carbon fibre */
export type Structure = 'steel' | 'hss' | 'aluminium' | 'honeycomb' | 'cfrp';
/** the panels hung on it: steel, aluminium, glass fibre, carbon fibre */
export type Panels = 'steel' | 'aluminium' | 'frp' | 'cfrp';
/** the interior: stripped for lightness, as the base's own car, luxurious */
export type Interior = 'light' | 'standard' | 'luxury';

export interface Design {
  /** the format's version */ v: 2;
  id: string; name: string;
  body: { base: BaseId; nose: NoseKind; front: FrontKind; tail: TailKind; wheel: WheelKind;
    /** mm added between the arches (-150..+300) and to half the width (-40..+80) */ wheelbase: number; width: number;
    paint: string; gloss: number; structure: Structure; panels: Panels };
  engine: { grade: Grade; layout: Layout; /** cc */ cc: number; /** valves a cylinder */ valves: Valves;
    /** the red line (rpm) */ redline: number; intake: Intake; compression: Compression; sump: Sump; block: Block;
    turbo: Turbos; /** the boost at full (bar), when there are turbos */ boost: number; intercooler: boolean;
    /** two cam profiles */ vtec: boolean };
  drive: { gears: 5 | 6; gearbox: 'manual' | 'f1'; /** the final drive's ratio; 0: chosen for the top speed */ final: number; lsd: boolean; awd: boolean };
  kit: { abs: boolean; tcs: boolean; steering: 'manual' | 'hydraulic' | 'electric'; dampers: 'fixed' | 'adaptive'; wing: boolean; diffuser: boolean;
    /** tyres' widths front and rear (mm) and the rims (in) */ tyres: [number, number]; rim: 16 | 17 | 18; interior: Interior };
}
/** format 1 (before review 177): one material for the whole body, a turbo count that fixed the boost, no grade */
export interface DesignV1 extends Omit<Design, 'v' | 'body' | 'engine' | 'kit'> {
  v: 1; kit: Omit<Design['kit'], 'interior'>; body: Omit<Design['body'], 'structure' | 'panels'> & { material: 'steel' | 'aluminium' };
  engine: { layout: Layout; cc: number; valves: Valves; redline: number; turbo: 0 | 1 | 2; vtec: boolean };
}
/** a change to a design, part by part (a fix offered by the fit check, race/fit.ts) */
export type DesignPatch = { [K in 'body' | 'engine' | 'drive' | 'kit']?: Partial<Design[K]> };
export const applyPatch = (d: Design, p: DesignPatch): Design =>
  normalise({ ...d, body: { ...d.body, ...p.body }, engine: { ...d.engine, ...p.engine }, drive: { ...d.drive, ...p.drive }, kit: { ...d.kit, ...p.kit } });

export const BASES: BaseId[] = ['nsx', 'f355'];
export const NOSES: NoseKind[] = ['round', 'pointed'];
export const FRONTS: FrontKind[] = ['plain', 'sunk'];
export const TAILS: TailKind[] = ['frame', 'roundLamps', 'ducktail'];
export const WHEELS: WheelKind[] = ['fiveSpoke', 'disc', 'star'];
export const GRADES: Grade[] = [1, 2, 3, 4, 5];
export const INTAKES: Intake[] = ['single', 'variable', 'itb'];
export const COMPRESSIONS: Compression[] = ['low', 'mid', 'high'];
export const SUMPS: Sump[] = ['wet', 'dry'];
export const BLOCKS: Block[] = ['iron', 'aluminium', 'magnesium'];
export const STRUCTURES: Structure[] = ['steel', 'hss', 'aluminium', 'honeycomb', 'cfrp'];
export const PANELS: Panels[] = ['steel', 'aluminium', 'frp', 'cfrp'];
export const INTERIORS: Interior[] = ['light', 'standard', 'luxury'];
/** the parts' physical ranges (no power cap: docs/systems/98 section 9). The wheelbase runs to +300 so the F355's
 *  platform can carry a long V12 (the McLaren F1's 2,718 mm, +268), the width to +80 a side (the Diablo's 2,040 mm) */
export const LIMITS = { wheelbase: [-150, 300], width: [-40, 80], cc: [1000, 8000], redline: [5000, 10000], tyre: [195, 335], final: [2.8, 4.8], boost: [0.3, 1.5] } as const;

// ---- the engine's grade and what it allows ----
export const GRADE_NAME: Record<Grade, string> = { 1: '양산', 2: '양산 고성능', 3: '스포츠', 4: '경주 파생', 5: '경주' };
/** what each grade allows: the details in order from the plainest (a detail the grade does not allow falls back to
 *  the best one it does), the most turbos, the boost and the red line it can take. A grade allows all a lower one does */
export const GRADE_RULES: Record<Grade, { intake: Intake[]; compression: Compression[]; sump: Sump[]; block: Block[]; valves: Valves[];
  turbo: Turbos; boost: number; redline: number; vtec: boolean }> = {
  1: { intake: ['single', 'variable'], compression: ['low', 'mid'], sump: ['wet'], block: ['iron', 'aluminium'], valves: [2, 3, 4], turbo: 1, boost: 0.7, redline: 7500, vtec: false },
  2: { intake: ['single', 'variable'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium'], valves: [2, 3, 4, 5], turbo: 2, boost: 1.0, redline: 9000, vtec: true },
  3: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.2, redline: 9500, vtec: true },
  4: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium', 'magnesium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.5, redline: 10000, vtec: true },
  5: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium', 'magnesium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.5, redline: 10000, vtec: true } };
/** the lowest grade that allows an engine detail's value */
export function gradeFor<K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo' | 'vtec'>(k: K, v: Design['engine'][K]): Grade {
  for (const g of GRADES) { const R = GRADE_RULES[g], a = R[k];
    if (Array.isArray(a) ? (a as unknown[]).includes(v) : typeof a === 'number' ? (v as number) <= a : !v || a) return g; }
  return 5; }
/** why the builder greys an engine detail's value out at this grade (Korean), null when the grade allows it */
export function gradeLock<K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo' | 'vtec'>(grade: Grade, k: K, v: Design['engine'][K]): string | null {
  const g = gradeFor(k, v); return g <= grade ? null : `${g}등급(${GRADE_NAME[g]})부터 고를 수 있습니다`; }
/** the highest boost and red line a grade takes */
export const gradeBoost = (g: Grade) => Math.min(LIMITS.boost[1], GRADE_RULES[g].boost);
export const gradeRedline = (g: Grade) => Math.min(LIMITS.redline[1], GRADE_RULES[g].redline);

/** the two cars the kit was made from, as designs (the generators are checked against their real figures). The NSX:
 *  an aluminium monocoque and panels, the C30A's variable intake, 10.2:1, a wet sump; the F355: a steel structure and
 *  panels, the F129B's 11:1, a dry sump */
export const DESIGN_NSX: Design = { v: 2, id: 'nsx', name: 'NSX', body: { base: 'nsx', nose: 'round', front: 'plain', tail: 'frame', wheel: 'fiveSpoke', wheelbase: 0, width: 0, paint: '#b0121b', gloss: 0.6, structure: 'aluminium', panels: 'aluminium' },
  engine: { grade: 2, layout: 'V6', cc: 2977, valves: 4, redline: 8000, intake: 'variable', compression: 'mid', sump: 'wet', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: true },
  drive: { gears: 5, gearbox: 'manual', final: 4.062, lsd: true, awd: false },
  kit: { abs: true, tcs: true, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [205, 225], rim: 16, interior: 'standard' } };
export const DESIGN_F355: Design = { v: 2, id: 'f355', name: 'F355', body: { base: 'f355', nose: 'pointed', front: 'sunk', tail: 'ducktail', wheel: 'star', wheelbase: 0, width: 0, paint: '#f5c300', gloss: 0.6, structure: 'steel', panels: 'steel' },
  engine: { grade: 2, layout: 'V8', cc: 3496, valves: 5, redline: 8500, intake: 'single', compression: 'high', sump: 'dry', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false },
  drive: { gears: 6, gearbox: 'manual', final: 4.1, lsd: true, awd: false },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'adaptive', wing: false, diffuser: true, tyres: [225, 265], rim: 18, interior: 'standard' } };

// ---- four more cars as designs: the figures' check (docs/systems/99, 1-8), not used to set them ----
// Each is built on one of the two bases (the base is only the body: its panels' shapes and sizes), stretched toward
// the real car's wheelbase and width; the machinery as the real car's. Real figures in race/cars.ts (NEW.diablo,
// NEW.eb110, NEW.xj220, with their sources) and, for the McLaren F1 (no RaceSpec), below.
/** the 1990 Lamborghini Diablo: 5.7 V12 four valves, 492 hp at 7,000, five speeds, rear drive; a tubular steel frame
 *  with aluminium and composite panels; 2,650 wheelbase, 2,040 wide; 245/40 ZR17 and 335/35 ZR17 */
export const DESIGN_DIABLO: Design = { v: 2, id: 'diablo', name: 'Diablo', body: { base: 'f355', nose: 'pointed', front: 'plain', tail: 'frame', wheel: 'star', wheelbase: 200, width: 70, paint: '#7a1fa2', gloss: 0.6, structure: 'steel', panels: 'aluminium' },
  engine: { grade: 3, layout: 'V12', cc: 5707, valves: 4, redline: 7300, intake: 'single', compression: 'mid', sump: 'wet', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false },
  drive: { gears: 5, gearbox: 'manual', final: 0, lsd: true, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [245, 335], rim: 17, interior: 'standard' } };
/** the 1991 Bugatti EB110 GT: 3.5 V12 five valves, four IHI turbos with intercoolers at about 1.05 bar, 553 hp at
 *  8,000, 7.5:1, a dry sump; six speeds, four-wheel drive; a carbon-fibre monocoque (Aérospatiale's) with aluminium
 *  panels; a luxurious interior (leather, air conditioning: heavy for its materials); 2,550 wheelbase, 1,940 wide;
 *  245/40 ZR18 and 325/30 ZR18; 1,620 kg; 342 km/h */
export const DESIGN_EB110: Design = { v: 2, id: 'eb110', name: 'EB110', body: { base: 'f355', nose: 'pointed', front: 'plain', tail: 'frame', wheel: 'disc', wheelbase: 100, width: 20, paint: '#1f5fbf', gloss: 0.6, structure: 'cfrp', panels: 'aluminium' },
  engine: { grade: 3, layout: 'V12', cc: 3499, valves: 5, redline: 8250, intake: 'single', compression: 'low', sump: 'dry', block: 'aluminium', turbo: 4, boost: 1.0, intercooler: true, vtec: false },
  drive: { gears: 6, gearbox: 'manual', final: 0, lsd: true, awd: true },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'fixed', wing: true, diffuser: false, tyres: [245, 325], rim: 18, interior: 'luxury' } };
/** the 1992 Jaguar XJ220: the JRV-6, a 3.5 V6 from the Group C engine, four valves, two Garrett turbos with
 *  intercoolers at about 1.0 bar, 8.3:1, a dry sump, 542 hp at 7,200; five speeds, rear drive; a bonded aluminium
 *  honeycomb tub and aluminium panels, underbody venturis; 2,640 wheelbase, 2,220 wide (here as wide as the NSX's base
 *  stretches, 1,970); 255/45 ZR17 and 345/35 ZR18 (here 335 on 18 at both ends: the builder's one rim size); 1,470 kg */
export const DESIGN_XJ220: Design = { v: 2, id: 'xj220', name: 'XJ220', body: { base: 'nsx', nose: 'round', front: 'plain', tail: 'roundLamps', wheel: 'disc', wheelbase: 110, width: 80, paint: '#9aa1a6', gloss: 0.6, structure: 'honeycomb', panels: 'aluminium' },
  engine: { grade: 4, layout: 'V6', cc: 3498, valves: 4, redline: 7800, intake: 'single', compression: 'low', sump: 'dry', block: 'aluminium', turbo: 2, boost: 1.0, intercooler: true, vtec: false },
  drive: { gears: 5, gearbox: 'manual', final: 0, lsd: true, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: true, tyres: [255, 335], rim: 18, interior: 'standard' } };
/** the 1994 McLaren F1, from McLaren's published figures (as quoted by Wikipedia's article and Road & Track's 1994
 *  test; Gordon Murray's design notes for the materials): BMW S70/2 6,064 cc 60-degree V12, four valves, a throttle a
 *  cylinder, 10.5:1, a dry sump, 627 hp (468 kW) at 7,400 rpm, 650 Nm at 5,600, the limiter about 7,500; six speeds,
 *  rear drive, no limited-slip differential; no ABS, no power steering, no traction control; a carbon-fibre monocoque
 *  and carbon panels, a stripped interior (Murray's weight budget: thin glass, light seats, no deadening); 2,718
 *  wheelbase, 1,820 wide (here 1,860: the F355's arches need the room for its 315 mm rears), 1,140 high; Cd 0.32; ground-effect venturis with fans (here the
 *  undertray); 235/45 ZR17 and 315/45 ZR17; kerb 1,138 kg (about 1,140); 372 km/h on its production limiter, 386 km/h
 *  (240 mph, Ehra-Lessien 1998) with it raised; 0-100 km/h 3.2 s */
export const DESIGN_MCLAREN_F1: Design = { v: 2, id: 'mclarenf1', name: 'McLaren F1', body: { base: 'f355', nose: 'pointed', front: 'plain', tail: 'frame', wheel: 'disc', wheelbase: 270, width: -20, paint: '#c9c3b6', gloss: 0.6, structure: 'cfrp', panels: 'cfrp' },
  engine: { grade: 4, layout: 'V12', cc: 6064, valves: 4, redline: 7500, intake: 'itb', compression: 'high', sump: 'dry', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false },
  drive: { gears: 6, gearbox: 'manual', final: 0, lsd: false, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: true, tyres: [235, 315], rim: 17, interior: 'light' } };

const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
/** a value the grade allows: the asked one, else the best allowed one below it in the list's order */
const allowed = <T>(v: T, order: readonly T[], ok: readonly T[]): T => { for (let i = order.indexOf(v); i >= 0; i--) if (ok.includes(order[i]!)) return order[i]!; return ok[0]!; };
/** a format-1 design in format 2: the structure and the panels of its one material; the grade a high-performance
 *  production engine's (format 1's figures were set by the NSX's and the F355's); the intake, the compression, the sump
 *  and the block its base's own car's, the compression a turbo engine's middle one; its turbos' boost what format 1
 *  fixed (one 0.8 bar, two 1.0) */
export function migrate(d: DesignV1): Design {
  const { material, ...body } = d.body, P = d.body.base === 'f355' ? DESIGN_F355 : DESIGN_NSX, E = d.engine;
  return { ...d, v: 2, body: { ...body, structure: material, panels: material }, kit: { ...d.kit, interior: 'standard' },
    engine: { grade: 2, layout: E.layout, cc: E.cc, valves: E.valves, redline: E.redline, intake: P.engine.intake, compression: E.turbo ? 'mid' : P.engine.compression,
      sump: P.engine.sump, block: P.engine.block, turbo: E.turbo, boost: E.turbo === 2 ? 1.0 : 0.8, intercooler: true, vtec: E.vtec } };
}
/** a design brought inside the limits and what its engine's grade allows (a loaded file, a slider's value); a format-1
 *  design is brought to format 2 first */
export function normalise(d0: Design | DesignV1): Design {
  const d = d0.v === 1 ? migrate(d0) : d0, E = d.engine, g: Grade = GRADES.includes(E.grade) ? E.grade : 2, R = GRADE_RULES[g];
  return { ...d, body: { ...d.body, wheelbase: clamp(d.body.wheelbase, LIMITS.wheelbase), width: clamp(d.body.width, LIMITS.width), gloss: clamp(d.body.gloss, [0, 1]) },
    engine: { ...E, grade: g, cc: clamp(E.cc, LIMITS.cc), redline: clamp(E.redline, [LIMITS.redline[0], gradeRedline(g)]),
      intake: allowed(E.intake, INTAKES, R.intake), compression: allowed(E.compression, COMPRESSIONS, R.compression), sump: allowed(E.sump, SUMPS, R.sump),
      block: allowed(E.block, BLOCKS, R.block), valves: allowed(E.valves, [2, 3, 4, 5] as Valves[], R.valves), turbo: Math.min(E.turbo, R.turbo) as Turbos,
      boost: Math.round(clamp(E.boost, [LIMITS.boost[0], gradeBoost(g)]) * 100) / 100, vtec: E.vtec && R.vtec },
    drive: { ...d.drive, final: d.drive.final ? clamp(d.drive.final, LIMITS.final) : 0 },
    kit: { ...d.kit, tyres: [clamp(d.kit.tyres[0], LIMITS.tyre), clamp(d.kit.tyres[1], LIMITS.tyre)] } };
}
