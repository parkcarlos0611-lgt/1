// A one-make race's field (docs/systems/113 V0): the opponents all 959s, each made from the 959's own design (core
// design DESIGN_P959) with its swaps (bumpers, head lamps, wheels), its colour from a 1980s palette, its plate and its
// driver's skill drawn from a seeded random, so that a race's field is the same for the same seed. Pure: the meshes are
// the drive's (render/car/fieldmesh.ts caches them by swaps and paints each car).
import { BUMPERS959, LAMPS959, WHEELS959, type Design } from '../core/design';
import { stockP959 } from '../core/bodies';
import { plateText } from '../render/car/p959/parts';
import { SKILL, type Skill } from './race';

/** the 1980s colours a 959 was sold in (and a few more of the time) */
export const PAINTS_1980S: readonly { name: string; hex: string }[] = [
  { name: '크림 화이트', hex: '#eeece4' }, { name: '실버', hex: '#b8bcc2' }, { name: '벽돌 레드', hex: '#b3201d' }, { name: '블랙', hex: '#141416' },
  { name: '시그널 레드', hex: '#d0161b' }, { name: '바다 블루', hex: '#1e3f7a' }, { name: '숲 그린', hex: '#2f4f3a' }, { name: '슬레이트 그레이', hex: '#5e6468' }, { name: '라이트 옐로', hex: '#e7c94a' }];
/** an opponent: its design (its id its own), and its driver's dare and pace */
export interface FieldCar { design: Design; dare: number; pace: number; paint: string }
/** the ids the field's cars race under (race/design.ts designSpec: 'design:' + the design's id) */
export const FIELD_PREFIX = 'p959field';

/** `n` opponents for a 959 one-make race, drawn from `seed`: each its swaps, colour, plate and skill within the race's
 *  skill (its dare and pace spread over that skill's range, a little past its ends, so the field strings out) */
export function oneMakeField(n: number, seed: number, skill: Skill = 'normal'): FieldCar[] {
  let s = (seed >>> 0) % 2147483647 || 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, of = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const base = stockP959(), K = SKILL[skill], out: FieldCar[] = [], used = new Map<string, number>();
  for (let k = 0; k < n; k++) { const paint = of(PAINTS_1980S), bumper = of(BUMPERS959), lamp = of(LAMPS959), wheel = of(WHEELS959), p = plateText(Math.floor(rnd() * 4294967295));
    const seen = (used.get(paint.name) ?? 0) + 1; used.set(paint.name, seen);
    const t = rnd(), spread = (r: [number, number]) => r[0] - (r[1] - r[0]) * 0.25 + t * (r[1] - r[0]) * 1.5;   // one draw for both: a bold driver presses on too
    const d: Design = { ...structuredClone(base), id: `${FIELD_PREFIX}${k + 1}`, name: `599 ${paint.name}${seen > 1 ? ` ${seen}` : ''}`,
      body: { ...structuredClone(base.body), paint: paint.hex, model: { bumperF: bumper, bumperR: bumper, lamp, wheel, plate: `${p.top} ${p.big}` } } };
    out.push({ design: d, paint: paint.hex, dare: Math.min(0.75, spread(K.dare)), pace: Math.min(1, spread(K.pace)) }); }
  return out; }
