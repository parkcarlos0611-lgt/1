// The parts builder's steps (docs/systems/98 section 11; alpha 0.13, docs/systems/102 section 6: the suspension a step
// of its own; alpha 0.2, docs/systems/115 §6, F1: eight, the body's lump first, its glass second, its parts third; the
// class is no step but the chip at the rail's head): their order and names, the step each fit check answers to, and a
// kept step read back whatever the builder that kept it had (an id of the eight or of the seven before them, or a
// number counted in the six steps before alpha 0.13). Pure.
import type { FitResult } from '../race/fit';

export type StepId = 'frame' | 'glass' | 'parts' | 'engine' | 'susp' | 'kit' | 'paint' | 'check';
export const STEPS: [StepId, string][] = [['frame', '차체 덩어리'], ['glass', '창문'], ['parts', '부품'], ['engine', '엔진·구동계'], ['susp', '서스펜션'], ['kit', '장비'], ['paint', '칠·마감'], ['check', '검사·시험 주행']];
/** the seven steps' ids that are gone (alpha 0.13 to 0.2): the chassis is the lump's step now, the body's shapes the parts' */
export const OLD_STEP: Record<string, StepId> = { chassis: 'frame', body: 'parts' };
/** the six steps before alpha 0.13, in their order (a kept number counts in these), as the eight name them */
export const STEPS_06: StepId[] = ['frame', 'engine', 'parts', 'kit', 'paint', 'check'];
/** the step each fit check answers to: the engine bay, its mounts and the gearbox the engine's and the drive's, the
 *  arches the tyres', the ground's clearance the lump's (its ride height; its fixes may reach into other steps: a longer
 *  wheelbase, a wider body) */
export const FIT_STEP: Record<FitResult['part'], StepId> = { bayLength: 'engine', bayWidth: 'engine', bayHeight: 'engine', gearboxPlace: 'engine', mount: 'engine', gearbox: 'engine', archF: 'kit', archR: 'kit', clearance: 'frame', cooling: 'parts' };
export const stepNo = (id: StepId): number => STEPS.findIndex(s => s[0] === id);
export const isStep = (x: unknown): x is StepId => STEPS.some(s => s[0] === x);
/** a kept step read back: an id as it is (a gone one as the step that took it over); a number as the six steps' (the old
 *  builder's ③ 차체 형태 is now ③ 부품); else none */
export function stepFrom(x: unknown): StepId | null {
  if (isStep(x)) return x;
  if (typeof x === 'string' && OLD_STEP[x]) return OLD_STEP[x]!;
  if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < STEPS_06.length) return STEPS_06[x]!;
  return null; }
/** the steps a design was seen at, read back the same way (unknown ones dropped, each once) */
export const seenFrom = (xs: unknown): StepId[] => Array.isArray(xs) ? [...new Set(xs.map(stepFrom).filter((s): s is StepId => !!s))] : [];
/** the circled number a step goes by on the page (① .. ⑧) */
export const stepMark = (id: StepId): string => '①②③④⑤⑥⑦⑧'[stepNo(id)] ?? '';
