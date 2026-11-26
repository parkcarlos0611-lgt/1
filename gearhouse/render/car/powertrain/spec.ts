// What a powertrain is built from (docs/systems/101, part 1-3): the engine's layout and details, the gearbox and the
// drive, as plain data. A design gives one (core/design.ts, the builder's cars), and so does an engine's short
// specification (render/car/enginemesh.ts ENGINES, the registered kit cars: their colours and labels kept).
import { CYLINDERS, BANKS, type Design, type Grade } from '../../../core/design';
import type { EngineSpec } from '../enginemesh';

export type Detail = 0 | 1 | 2;
export interface PowertrainColours { block: string; heads: string; covers: string; plenum: string; accent: string; label: string; pipes: string }
export interface PowertrainSpec {
  layout: 'I' | 'V' | 'flat'; cylinders: number; /** between the banks (V only) */ bankDeg: number; litres: number;
  /** valves a cylinder: two or three give one cam cover a bank, four or five two */ valves: 2 | 3 | 4 | 5;
  /** the development grade: 1 cast manifolds and bare covers .. 3 and over tubular headers, coloured covers, carbon intakes */
  grade: Grade;
  /** one throttle and a plenum (a plenum a bank on eight cylinders and over), a variable-length intake (a deep ribbed
   *  plenum, long runners, its actuator), a throttle and a trumpet a cylinder (under a plenum a bank with turbos) */
  intake: 'single' | 'variable' | 'itb';
  /** a wet sump's deep pan, or a dry sump's shallow one with its pump and tank: the crank sits lower */
  sump: 'wet' | 'dry';
  block: 'iron' | 'aluminium' | 'magnesium';
  turbos: 0 | 1 | 2 | 3 | 4; intercooler: boolean;
  gears: 4 | 5 | 6; gearbox: 'manual' | 'f1' | 'auto'; lsd: boolean; awd: boolean;
  /** a transverse engine too long for a gearbox at its end: the gearbox behind it, under the crank (the Miura's) */
  gearboxBehind?: boolean;
  colours: PowertrainColours; /** a crinkle finish on the covers and the intake */ crinkle: boolean; label?: string;
}

const BLOCK = { iron: '#5f6266', aluminium: '#a9acb0', magnesium: '#8d8a72' } as const;
/** the look a grade gives: bare cast covers, black crinkle, red crinkle; cast, black, then carbon intakes */
export function gradeColours(grade: Grade, block: PowertrainSpec['block']): PowertrainColours {
  const covers = grade <= 1 ? '#8e9195' : grade === 2 ? '#1b1b1e' : '#a8191c', plenum = grade <= 1 ? '#a3a6aa' : grade <= 3 ? (grade === 3 ? '#a8191c' : '#1c1c1f') : '#17181a';
  return { block: BLOCK[block], heads: block === 'iron' ? '#9a9da1' : '#b0b3b7', covers, plenum, accent: grade >= 3 ? '#1a1a1a' : '#c4202a', label: '#d9d8d0', pipes: grade <= 1 ? '#4f4a46' : '#7e7468' }; }

/** an engine's short specification as a powertrain's: its look kept, the details the short form does not say taken as given */
export function fromEngineSpec(e: EngineSpec): PowertrainSpec {
  const grade = e.grade ?? 2, block = e.block ?? 'aluminium';
  return { layout: e.layout, cylinders: e.cylinders, bankDeg: e.layout === 'V' ? e.bankDeg ?? 90 : e.layout === 'flat' ? 180 : 0, litres: e.litres, valves: e.valves ?? 4, grade,
    intake: e.intake ?? 'single', sump: e.sump ?? 'wet', block, turbos: Math.max(0, Math.min(4, e.turbos ?? 0)) as PowertrainSpec['turbos'], intercooler: e.intercooler ?? true,
    gears: e.gears ?? 5, gearbox: e.gearbox ?? 'manual', lsd: e.lsd ?? true, awd: e.awd ?? false,
    colours: { ...gradeColours(grade, block), ...e.colours }, crinkle: e.crinkle ?? grade >= 2, ...(e.label ? { label: e.label } : {}) }; }

/** a design's powertrain; `own` the base's own engine (its bank angle is kept for the same number of cylinders). A V8
 *  or V6 stands at 90 degrees, a V10 at 72 (its even firing), a V12 at 60; an in-line engine one bank, a flat one two at 180 */
export function fromDesign(d: Design, own?: EngineSpec): PowertrainSpec {
  const E = d.engine, D = d.drive, n = CYLINDERS[E.layout], kind = BANKS(E.layout);
  const bankDeg = kind === 'I' ? 0 : kind === 'flat' ? 180 : own && own.layout === 'V' && own.cylinders === n ? own.bankDeg ?? 90 : n === 8 ? 90 : n === 10 ? 72 : 60;
  return { layout: kind, cylinders: n, bankDeg, litres: Math.round(E.cc / 10) / 100,
    valves: E.valves, grade: E.grade, intake: E.intake, sump: E.sump, block: E.block, turbos: E.turbo, intercooler: E.intercooler,
    gears: D.gears, gearbox: D.gearbox, lsd: D.lsd, awd: D.awd, colours: gradeColours(E.grade, E.block), crinkle: E.grade >= 2 }; }
