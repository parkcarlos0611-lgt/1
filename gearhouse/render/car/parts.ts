// The part library (review 18, 3-1): a part is a form and a few measured values; the library turns it into the
// panels and inner structure the renderer draws. One form serves every car that has such a part, so swapping
// parts between cars or giving a maker a house style is a matter of values.
import type { CarDesign, Panel, Pt, Slot } from './types';

type XZ = [number, number];
export type PartSpec =
  /** a radiator grille seen from the side: a band behind its front edge, slats following the edge */
  | { kind: 'grille'; form: 'band'; slot?: Slot; front: XZ[]; depth: number; pitch?: number; shell?: number }
  /** a head lamp: in a body-colour pod faired into the catwalk, a chrome bullet on a stand, or set into the fender */
  | { kind: 'lamp'; form: 'pod' | 'bullet' | 'flush'; slot?: Slot; at: XZ; d: number; len?: number; facing?: 'front' | 'rear' }
  /** a bumper seen end-on: the bar, an over-rider standing on it, the iron back to the frame */
  | { kind: 'bumper'; form: 'bar'; slot?: Slot; end: number; inner: number; z: number; h: number; guard?: { w: number; h: number; inset?: number }; iron?: number }
  /** a tail lamp: round on a stalk, or set into the fender */
  | { kind: 'tail'; form: 'stalk' | 'flush'; slot?: Slot; at: XZ; d: number; stalk?: number };

const ell = (cx: number, cz: number, rx: number, rz: number, n = 24): Pt[] => Array.from({ length: n }, (_, k) => [Math.round(cx + Math.cos(k / n * 6.2832) * rx), Math.round(cz + Math.sin(k / n * 6.2832) * rz)] as Pt);
const sharp = (p: XZ[]): Pt[] => p.map(([x, z]) => [Math.round(x), Math.round(z), 1] as Pt);

export function partPanels(s: PartSpec, n: number): Panel[] {
  const id = (t: string) => `${s.kind}${n}_${t}`;
  switch (s.kind) {
    case 'grille': { const back = [...s.front].reverse().map(([x, z]) => [x + s.depth, z] as XZ), top = s.front.at(-1)!;
      return [{ id: id('band'), pts: sharp([...s.front, [top[0] + s.depth, top[1]], ...back.slice(1)]), material: 'black', surface: 'flat', z: 15, slot: s.slot ?? 'grille', detail: { kind: 'grille', pitch: s.pitch ?? 30, shell: s.shell ?? 20 } }]; }
    case 'lamp': { const [x, z] = s.at, r = s.d / 2, dir = (s.facing ?? 'front') === 'front' ? -1 : 1, slot = s.slot ?? 'lamp', len = s.len ?? s.d;
      const lens: Panel = { id: id('lens'), pts: ell(x + dir * r * 0.05, z, r * 0.3, r * 0.8), material: 'lens', surface: 'flat', z: 28, slot, rigid: true, detail: { kind: 'flutes', pitch: 20 } };
      if (s.form === 'pod') return [{ id: id('pod'), pts: ell(x - dir * len * 0.55, z, len * 0.6, r * 0.95), material: 'paint', surface: 'fender', z: 27, slot, rigid: true, bevel: 6 },
        { id: id('rim'), pts: ell(x, z, r * 0.5, r), material: 'chrome', surface: 'fender', z: 27.5, slot, rigid: true, bevel: 2 }, lens];
      if (s.form === 'bullet') return [{ id: id('stand'), pts: sharp([[x - dir * len * 0.4 - 25, z - r], [x - dir * len * 0.4 + 25, z - r], [x - dir * len * 0.4 + 25, z - r - 180], [x - dir * len * 0.4 - 25, z - r - 180]]), material: 'chrome', surface: 'side', z: 26.5, slot, rigid: true },
        { id: id('shell'), pts: ell(x - dir * len * 0.45, z, len * 0.55, r), material: 'chrome', surface: 'fender', z: 27, slot, rigid: true, bevel: 6 }, lens];
      return [{ id: id('rim'), pts: ell(x, z, r * 0.45, r), material: 'chrome', surface: 'fender', z: 27, slot, rigid: true, bevel: 2 }, lens]; }
    case 'bumper': { const out = Math.sign(s.end - s.inner), lo = s.z - s.h / 2, hi = s.z + s.h / 2, e = s.end, i = s.inner, round = Math.min(25, s.h * 0.25), slot = s.slot ?? (out < 0 ? 'bumperF' : 'bumperR');      // out: the way the bumper faces, -1 at the front
      const ps: Panel[] = [{ id: id('bar'), pts: sharp([[e, lo + round], [e - out * round, lo], [i, lo + 8], [i, hi - 8], [e - out * round, hi], [e, hi - round]]), material: 'chrome', surface: 'side', z: 25, slot, bevel: 3, detail: { kind: 'bar' } }];
      if (s.iron) ps.unshift({ id: id('iron'), pts: sharp([[i, s.z - 25], [i - out * s.iron, s.z - 25], [i - out * s.iron, s.z + 25], [i, s.z + 25]]), material: 'black', surface: 'flat', z: 24, slot });
      if (s.guard) { const gx = e - out * (s.guard.inset ?? 20), g0 = s.z - s.guard.h / 2, g1 = s.z + s.guard.h / 2, gw = s.guard.w;
        ps.push({ id: id('guard'), pts: sharp([[gx, g0 + 20], [gx - out * 10, g0], [gx - out * (gw - 10), g0], [gx - out * gw, g0 + 30], [gx - out * gw, g1 - 25], [gx - out * (gw - 15), g1], [gx - out * 10, g1], [gx, g1 - 20]]), material: 'chrome', surface: 'side', z: 25.5, slot, bevel: 2 }); }
      return ps; }
    case 'tail': { const [x, z] = s.at, r = s.d / 2, slot = s.slot ?? 'tail', ps: Panel[] = [];
      if (s.form === 'stalk') ps.push({ id: id('stalk'), pts: sharp([[x - (s.stalk ?? 70), z - 20], [x, z - 20], [x, z + 20], [x - (s.stalk ?? 70), z + 20]]), material: 'black', surface: 'flat', z: 27, slot, rigid: true });
      ps.push({ id: id('bezel'), pts: ell(x, z, r * 0.6, r), material: 'chrome', surface: 'fender', z: 28, slot, rigid: true, bevel: 2 }, { id: id('lens'), pts: ell(x + r * 0.12, z, r * 0.36, r * 0.74), material: 'lensR', surface: 'flat', z: 28.5, slot, rigid: true });
      return ps; }
  }
}
/** the design with its parts turned into panels, ready to draw */
export function expandParts(d: CarDesign): CarDesign { if (!d.parts?.length) return d; return { ...d, panels: [...d.panels, ...d.parts.flatMap((p, k) => partPanels(p, k))] }; }
