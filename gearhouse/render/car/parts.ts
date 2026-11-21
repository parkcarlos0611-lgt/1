// The part library (review 18, 3-1): a part is a form and a few measured values; the library turns it into the
// panels and inner structure the renderer draws. One form serves every car that has such a part, so swapping
// parts between cars or giving a maker a house style is a matter of values.
import type { CarDesign, Panel, Pt, Slot } from './types';

type XZ = [number, number];
export type PartSpec =
  /** a radiator grille seen from the side: a band behind its front edge, slats following the edge */
  | { kind: 'grille'; form: 'band'; slot?: Slot; front: XZ[]; depth: number; pitch?: number; shell?: number }
  /** a head lamp: in a body-colour pod faired into the catwalk, a chrome bullet on a stand, or set into the fender */
  | { kind: 'lamp'; form: 'pod' | 'bullet' | 'flush'; slot?: Slot; at: XZ; d: number; len?: number; facing?: 'front' | 'rear'; stand?: boolean }
  /** a bumper seen end-on: the bar, an over-rider standing on it, the iron back to the frame */
  | { kind: 'bumper'; form: 'bar'; slot?: Slot; end: number; inner: number; z: number; h: number; guard?: { w: number; h: number; inset?: number; pair?: number }; iron?: number }
  /** a tail lamp: round on a stalk, or set into the fender */
  | { kind: 'tail'; form: 'stalk' | 'flush'; slot?: Slot; at: XZ; d: number; stalk?: number }
  // ---- seen from the front or the rear: x across the car, z up ----
  /** a grille face: straight sides from the top down to a shoulder, then narrowing to its foot; upright bars and a chrome surround */
  | { kind: 'grille'; form: 'face'; slot?: Slot; at: XZ; top: number; half: number; foot: number; shoulder: number; pitch?: number }
  /** a round lamp or tail lamp seen head-on: a chrome rim and the glass */
  | { kind: 'lamp' | 'tail'; form: 'round'; slot?: Slot; at: XZ; d: number }
  /** a bumper bar across the car with its over-riders (u: their distance from the centre line); dip: how far the middle drops */
  | { kind: 'bumper'; form: 'across'; slot?: Slot; at: XZ; half: number; h: number; dip?: number; guards?: number[] };

const ell = (cx: number, cz: number, rx: number, rz: number, n = 24): Pt[] => Array.from({ length: n }, (_, k) => [Math.round(cx + Math.cos(k / n * 6.2832) * rx), Math.round(cz + Math.sin(k / n * 6.2832) * rz)] as Pt);
const sharp = (p: XZ[]): Pt[] => p.map(([x, z]) => [Math.round(x), Math.round(z), 1] as Pt);

export function partPanels(s: PartSpec, n: number): Panel[] {
  const id = (t: string) => `${s.kind}${n}_${t}`;
  if (s.form === 'face' || s.form === 'round' || s.form === 'across') return faceOn(s, id);
  switch (s.kind) {
    case 'grille': { const back = [...s.front].reverse().map(([x, z]) => [x + s.depth, z] as XZ), top = s.front.at(-1)!;
      return [{ id: id('band'), pts: sharp([...s.front, [top[0] + s.depth, top[1]], ...back.slice(1)]), material: 'black', surface: 'flat', z: 15, slot: s.slot ?? 'grille', detail: { kind: 'grille', pitch: s.pitch ?? 30, shell: s.shell ?? 20 } }]; }
    case 'lamp': { const [x, z] = s.at, r = s.d / 2, dir = (s.facing ?? 'front') === 'front' ? -1 : 1, slot = s.slot ?? 'lamp', len = s.len ?? s.d;
      const lens: Panel = { id: id('lens'), pts: ell(x + dir * r * 0.05, z, r * 0.3, r * 0.8), material: 'lens', surface: 'flat', z: 28, slot, rigid: true, detail: { kind: 'flutes', pitch: 20 } };
      if (s.form === 'pod') return [{ id: id('pod'), pts: ell(x - dir * len * 0.55, z, len * 0.6, r * 0.95), material: 'paint', surface: 'fender', z: 27, slot, rigid: true, bevel: 6 },
        { id: id('rim'), pts: ell(x, z, r * 0.5, r), material: 'chrome', surface: 'fender', z: 27.5, slot, rigid: true, bevel: 2 }, lens];
      if (s.form === 'bullet') return [...(s.stand === false ? [] : [{ id: id('stand'), pts: sharp([[x - dir * len * 0.4 - 25, z - r], [x - dir * len * 0.4 + 25, z - r], [x - dir * len * 0.4 + 25, z - r - 180], [x - dir * len * 0.4 - 25, z - r - 180]]), material: 'chrome', surface: 'side', z: 26.5, slot, rigid: true } as Panel]),
        { id: id('shell'), pts: ell(x - dir * len * 0.45, z, len * 0.55, r), material: 'chrome', surface: 'fender', z: 27, slot, rigid: true, bevel: 6 }, lens];
      return [{ id: id('rim'), pts: ell(x, z, r * 0.45, r), material: 'chrome', surface: 'fender', z: 27, slot, rigid: true, bevel: 2 }, lens]; }
    case 'bumper': { const out = Math.sign(s.end - s.inner), lo = s.z - s.h / 2, hi = s.z + s.h / 2, e = s.end, i = s.inner, round = Math.min(45, s.h * 0.4), slot = s.slot ?? (out < 0 ? 'bumperF' : 'bumperR');      // out: the way the bumper faces, -1 at the front
      const ps: Panel[] = [{ id: id('bar'), pts: sharp([[e, lo + round], [e - out * round, lo], [i, lo + 8], [i, hi - 8], [e - out * round, hi], [e, hi - round]]), material: 'chrome', surface: 'side', z: 25, slot, bevel: 3, detail: { kind: 'bar' } }];
      if (s.iron) ps.unshift({ id: id('iron'), pts: sharp([[i, s.z - 25], [i - out * s.iron, s.z - 25], [i - out * s.iron, s.z + 25], [i, s.z + 25]]), material: 'black', surface: 'flat', z: 24, slot });
      if (s.guard?.pair) { const gx = e - out * ((s.guard.inset ?? 20) + s.guard.pair), g0 = s.z - s.guard.h / 2 + 15, g1 = s.z + s.guard.h / 2 - 15, gw = s.guard.w * 0.8;   // the far over-rider, seen past the near one
        ps.push({ id: id('guard2'), pts: sharp([[gx, g0 + 15], [gx - out * gw, g0 + 15], [gx - out * gw, g1 - 15], [gx, g1 - 15]]), material: 'chrome', surface: 'side', z: 24.5, slot, bevel: 2 }); }
      if (s.guard) { const gx = e - out * (s.guard.inset ?? 20), g0 = s.z - s.guard.h / 2, g1 = s.z + s.guard.h / 2, gw = s.guard.w;
        ps.push({ id: id('guard'), pts: sharp([[gx, g0 + 20], [gx - out * 10, g0], [gx - out * (gw - 10), g0], [gx - out * gw, g0 + 30], [gx - out * gw, g1 - 25], [gx - out * (gw - 15), g1], [gx - out * 10, g1], [gx, g1 - 20]]), material: 'chrome', surface: 'side', z: 25.5, slot, bevel: 2 }); }
      return ps; }
    case 'tail': { const [x, z] = s.at, r = s.d / 2, slot = s.slot ?? 'tail', ps: Panel[] = [];
      if (s.form === 'stalk') ps.push({ id: id('stalk'), pts: sharp([[x - (s.stalk ?? 70), z - 20], [x, z - 20], [x, z + 20], [x - (s.stalk ?? 70), z + 20]]), material: 'black', surface: 'flat', z: 27, slot, rigid: true });
      ps.push({ id: id('bezel'), pts: ell(x, z, r * 0.6, r), material: 'chrome', surface: 'fender', z: 28, slot, rigid: true, bevel: 2 }, { id: id('lens'), pts: ell(x + r * 0.12, z, r * 0.36, r * 0.74), material: 'lensR', surface: 'flat', z: 28.5, slot, rigid: true });
      return ps; }
  }
}
function faceOn(s: Extract<PartSpec, { form: 'face' | 'round' | 'across' }>, id: (t: string) => string): Panel[] {
  if (s.form === 'face') { const [c, foot] = s.at, H = s.top, slot = s.slot ?? 'grille';
    return [{ id: id('face'), pts: sharp([[c, foot], [c + s.foot, foot + (s.shoulder - foot) * 0.35], [c + s.half, s.shoulder], [c + s.half, H - 30], [c + s.half - 30, H], [c - s.half + 30, H], [c - s.half, H - 30], [c - s.half, s.shoulder], [c - s.foot, foot + (s.shoulder - foot) * 0.35]]), material: 'black', surface: 'flat', z: 15, slot, detail: { kind: 'vbars', pitch: s.pitch ?? 24 } }]; }
  if (s.form === 'round') { const [x, z] = s.at, r = s.d / 2, slot = s.slot ?? s.kind;
    return [{ id: id('rim'), pts: ell(x, z, r, r), material: 'chrome', surface: 'fender', z: 27, slot, rigid: true, bevel: 2 },
      { id: id('glass'), pts: ell(x, z, r * 0.78, r * 0.78), material: s.kind === 'tail' ? 'lensR' : 'lens', surface: 'flat', z: 28, slot, rigid: true, ...(s.kind === 'lamp' ? { detail: { kind: 'flutes' as const, pitch: 20 } } : {}) }]; }
  const [c, z] = s.at, h2 = s.h / 2, dp = s.dip ?? 0, hf = s.half, slot = s.slot ?? 'bumperF';
  const ps: Panel[] = [{ id: id('bar'), pts: sharp([[c - hf, z - h2 + 15], [c - hf + 30, z - h2], [c - hf * 0.3, z - h2], [c, z - h2 - dp], [c + hf * 0.3, z - h2], [c + hf - 30, z - h2], [c + hf, z - h2 + 15], [c + hf, z + h2 - 15], [c + hf - 30, z + h2], [c + hf * 0.3, z + h2], [c, z + h2 - dp], [c - hf * 0.3, z + h2], [c - hf + 30, z + h2], [c - hf, z + h2 - 15]]), material: 'chrome', surface: 'side', z: 25, slot, bevel: 3, detail: { kind: 'bar' } }];
  for (const u of s.guards ?? []) for (const sd of [1, -1]) ps.push({ id: id(`guard${sd}${u}`), pts: sharp([[c + sd * u - 22, z - h2 - 70], [c + sd * u + 22, z - h2 - 70], [c + sd * u + 26, z + h2 + 90], [c + sd * u, z + h2 + 120], [c + sd * u - 26, z + h2 + 90]]), material: 'chrome', surface: 'fender', z: 25.5, slot, bevel: 3 });
  return ps; }
/** the design with its parts turned into panels, ready to draw */
export function expandParts(d: CarDesign): CarDesign { if (!d.parts?.length) return d; return { ...d, panels: [...d.panels, ...d.parts.flatMap((p, k) => partPanels(p, k))] }; }
