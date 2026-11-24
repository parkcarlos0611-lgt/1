// Which cells of the shared grids each body panel takes: the panels' borders as stations and section points, read
// from the spec (so the panels' own functions stay free of any car's numbers).
import type { Ctx } from '../ctx';
import { FLANK, TOP } from '../section';

export interface Zones {
  /** front top cells: the dark cowl under the screen's foot; the pop-up lamp's cover */
  isCowl(i: number, j: number): boolean; isCover(i: number, j: number): boolean;
  iCW: number; iC0: number; iC1: number;
  /** flank cells (chain i, point k): the door; the sill; the side intake's opening */
  isDoor(i: number, k: number): boolean; isSill(i: number, k: number): boolean; isIntake(i: number, k: number): boolean;
  iD0: number; iD1: number; iI0: number; iI1: number; iFA: number; iRA: number;
}
export function zones(x: Ctx): Zones {
  const { L, k } = x, iCW = x.topRow(k.bonnet.cowl), iC0 = x.topRow(k.popup.from), iC1 = x.topRow(k.popup.to);
  const iD0 = L.at(k.door.from), iD1 = L.at(k.door.to), iI0 = L.at(k.intake.from), iI1 = L.at(k.intake.to), iFA = L.at(L.arches.f.x + L.arches.f.r), iRA = L.at(L.arches.r.x - L.arches.r.r);
  const [c0, c1] = [TOP.COVER[0], TOP.COVER[TOP.COVER.length - 1]];
  return { iCW, iC0, iC1, iD0, iD1, iI0, iI1, iFA, iRA,
    isCowl: (i, j) => j < k.bonnet.cowlCols && (i > iCW || (i === iCW && j < TOP.SHUT)),
    isCover: (i, j) => i >= iC0 && i < iC1 && j >= c0 && j < c1,
    isDoor: (i, q) => i >= iD0 && q < FLANK.SILL && (q < FLANK.H ? i < iD1 : i < iI0),
    isSill: (i, q) => q >= FLANK.SILL && i >= iFA && i < iRA,
    isIntake: (i, q) => i >= iI0 && i < iI1 && q >= FLANK.H && q < FLANK.SILL };
}
