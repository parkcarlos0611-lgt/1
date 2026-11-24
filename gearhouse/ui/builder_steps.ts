// The parts builder's steps (docs/systems/98 section 11; alpha 0.13, docs/systems/102 section 6: the suspension a step
// of its own, so seven): their order and names, the step each fit check answers to, and a kept step read back whatever
// the builder that kept it had (an id, or a number counted in the six steps before alpha 0.13). Pure.
import type { FitResult } from '../race/fit';

export type StepId = 'chassis' | 'engine' | 'susp' | 'body' | 'kit' | 'paint' | 'check';
export const STEPS: [StepId, string][] = [['chassis', '차대'], ['engine', '엔진·구동계'], ['susp', '서스펜션'], ['body', '차체 형태'], ['kit', '장비'], ['paint', '칠·마감'], ['check', '검사·시험 주행']];
/** the six steps before alpha 0.13, in their order (a kept number counts in these) */
export const STEPS_06: StepId[] = ['chassis', 'engine', 'body', 'kit', 'paint', 'check'];
/** the step each fit check answers to: the engine bay, its mounts and the gearbox the engine's and the drive's, the
 *  arches the tyres', the ground's clearance the chassis' (its fixes may reach into other steps: a longer wheelbase, a
 *  wider body) */
export const FIT_STEP: Record<FitResult['part'], StepId> = { bayLength: 'engine', bayWidth: 'engine', bayHeight: 'engine', gearboxPlace: 'engine', mount: 'engine', gearbox: 'engine', archF: 'kit', archR: 'kit', clearance: 'chassis' };
export const stepNo = (id: StepId): number => STEPS.findIndex(s => s[0] === id);
export const isStep = (x: unknown): x is StepId => STEPS.some(s => s[0] === x);
/** a kept step read back: an id as it is; a number as the six steps' (the old builder's ③ 차체 형태 is now ④); else none */
export function stepFrom(x: unknown): StepId | null {
  if (isStep(x)) return x;
  if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < STEPS_06.length) return STEPS_06[x]!;
  return null; }
/** the steps a design was seen at, read back the same way (unknown ones dropped, each once) */
export const seenFrom = (xs: unknown): StepId[] => Array.isArray(xs) ? [...new Set(xs.map(stepFrom).filter((s): s is StepId => !!s))] : [];
/** the circled number a step goes by on the page (① .. ⑦) */
export const stepMark = (id: StepId): string => '①②③④⑤⑥⑦'[stepNo(id)] ?? '';
