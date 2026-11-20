// What the drawing board lets the player change, and how far (review 32): the era sets what the cars of the day were
// built like (lamps on a bar or in the fenders, fenders bolted on or part of the body), the company's size sets how
// far its drawing office dares to go. The screen shows only the handles the table holds.
export type Era = '1920s' | '1930s' | 'late30s';
export type NumKey = 'wb' | 'door' | 'roof' | 'lift' | 'lampX' | 'lampZ' | 'grilleX' | 'grille' | 'bumper' | 'fender';
export interface Range { min: number; max: number; step: number }
export interface Rules { era: Era; size: number; label: string; r: Record<NumKey, Range | null>; fendersOff: boolean; bumpersOff: boolean; rearDoorMin: number; cabinMin: number }
type Row = [number, number, number] | null;
const ERA: Record<Era, { name: string; r: Record<NumKey, Row>; fendersOff: boolean; bumpersOff: boolean }> = {
  '1920s': { name: '1920년대', fendersOff: true, bumpersOff: true, r: { wb: [-500, 400, 50], door: [-100, 280, 20], roof: [-100, 200, 25], lift: [-50, 100, 25], lampX: [-150, 150, 25], lampZ: [-100, 150, 25], grilleX: [-150, 150, 25], grille: [-15, 25, 5], bumper: [-20, 20, 5], fender: [-10, 15, 5] } },
  '1930s': { name: '1930년대 중반', fendersOff: false, bumpersOff: false, r: { wb: [-400, 400, 50], door: [-60, 200, 20], roof: [-75, 150, 25], lift: [-50, 75, 25], lampX: [-75, 75, 25], lampZ: [-75, 100, 25], grilleX: [-100, 100, 25], grille: [-15, 35, 5], bumper: [-15, 25, 5], fender: [-5, 25, 5] } },
  'late30s': { name: '1930년대 말', fendersOff: false, bumpersOff: false, r: { wb: [-300, 400, 50], door: [-40, 160, 20], roof: [-50, 100, 25], lift: [-25, 50, 25], lampX: null, lampZ: [-50, 50, 25], grilleX: [-50, 50, 25], grille: [-10, 40, 5], bumper: [-10, 30, 5], fender: [0, 30, 5] } } };
export const ERAS = Object.keys(ERA) as Era[];
export const eraName = (e: Era) => ERA[e].name;
const SIZE = [{ k: 0.5, name: '소규모 공방' }, { k: 0.75, name: '설계실' }, { k: 1, name: '설계 부서' }, { k: 1.15, name: '대기업 설계 본부' }];
/** the table for one era and company size (size 0..3: workshop, drawing office, design department, large firm) */
export function rules(era: Era, size: number): Rules {
  const E = ERA[era], k = SIZE[size]!.k, r = {} as Record<NumKey, Range | null>;
  for (const key of Object.keys(E.r) as NumKey[]) { const row = E.r[key]; if (!row) { r[key] = null; continue; } const [lo, hi, step] = row;
    r[key] = { min: Math.round(lo * k / step) * step, max: Math.round(hi * k / step) * step, step }; }
  return { era, size, label: `${E.name} · ${SIZE[size]!.name}`, r, fendersOff: E.fendersOff, bumpersOff: E.bumpersOff, rearDoorMin: 540, cabinMin: 900 };
}
