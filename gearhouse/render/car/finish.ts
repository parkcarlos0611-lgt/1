// What each part of a car is made of and how it is finished (review 36): the base (steel of a gauge, aluminium, wood,
// cloth, rubber, glass, plated brass) and the coats on it from the inside out. Bodywork reads it: wire wool goes
// through the coats one by one and then reaches the base; only bases that rust can rust, only steel takes lead.
// Kept per car (data/cars/<id>_finish.json) because finishes differ by maker, year and price class.

export type BaseKind = 'steel' | 'aluminium' | 'wood' | 'cloth' | 'rubber' | 'glass' | 'brass' | 'iron';
export interface Base { kind: BaseKind; gauge_mm?: number; colour: string; rusts: boolean; takesLead: boolean }
export type CoatKind = 'primer' | 'surfacer' | 'lacquer' | 'enamel' | 'japan' | 'nickel' | 'chrome' | 'varnish' | 'dressing';
/** one coat: µm thick, how hard it is to rub through (1 = lacquer), how glossy (0..1), its colour (or 'paint' / 'paint2', the car's own) */
export interface Coat { kind: CoatKind; colour: string; um: number; hardness: number; gloss: number }
export interface Finish { name: string; base: Base; coats: Coat[]; note?: string }
export interface FinishSheet { car: string; source: string; finishes: Record<string, Finish>; parts: Record<string, string>; fallback: string }

/** the finish of a part, its colours resolved against the car's paint */
export function finishOf(sheet: FinishSheet, partId: string, paint: string, paint2: string): Finish {
  const f = sheet.finishes[sheet.parts[partId.replace('~', '')] ?? sheet.fallback]!;
  return { ...f, coats: f.coats.map(c => ({ ...c, colour: c.colour === 'paint' ? paint : c.colour === 'paint2' ? paint2 : c.colour })) };
}
/** total thickness of the coats, µm */
export const coatTotal = (f: Finish) => f.coats.reduce((a, c) => a + c.um, 0);
/** which coat shows when `worn` µm have been rubbed off the top (null: the base shows) */
export function coatAt(f: Finish, worn: number): { coat: Coat | null; into: number } {
  let left = worn; for (let k = f.coats.length - 1; k >= 0; k--) { const c = f.coats[k]!; if (left < c.um) return { coat: c, into: left / c.um }; left -= c.um; } return { coat: null, into: 1 };
}
