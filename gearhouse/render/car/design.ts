// A car's design (core/design.ts) made into the car kit's assembly spec and its mesh (docs/systems/98_alpha_interface_and_builder_plan.md,
// B1). The body is a base (a platform of the kit: render/car/cars/<id>.kit.ts, its lines and its panels sized for it) with
// the swap patches for the chosen kinds laid over it; a kind that is the base's own needs no patch. The paint goes into
// the colours, the wheelbase and the width into the lines' tweak, the tyres' widths and the rims' size into the wheels.
import type { BaseId, Design, FrontKind, NoseKind, TailKind, WheelKind } from '../../core/design';
import { FRONTS, NOSES, TAILS, WHEELS } from '../../core/design';
import type { Mesh } from './mesh';
import { assemble } from './kit/assemble';
import type { Tweak } from './kit/lines';
import type { CarKit } from './kit/spec';
import { F355_DISC_WHEEL, F355_FIVE_SPOKE, F355_FRAME_TAIL, F355_KIT, F355_PLAIN_FRONT, F355_ROUND_NOSE, F355_ROUND_TAIL } from './cars/f355.kit';
import { NSX_DISC_WHEEL, NSX_DUCKTAIL, NSX_KIT, NSX_POINTED_NOSE, NSX_ROUND_TAIL, NSX_STAR_WHEEL, NSX_SUNK_FRONT } from './cars/nsx.kit';

/** a base: its kit, its own kinds and rim (in), and the patch for every other kind */
interface Base {
  kit: CarKit; rim: number;
  nose: Record<NoseKind, Partial<CarKit> | null>; front: Record<FrontKind, Partial<CarKit> | null>;
  tail: Record<TailKind, Partial<CarKit> | null>; wheel: Record<WheelKind, Partial<CarKit> | null>;
}
const BASE: Record<BaseId, Base> = {
  nsx: { kit: NSX_KIT, rim: 16, nose: { round: null, pointed: NSX_POINTED_NOSE }, front: { plain: null, sunk: NSX_SUNK_FRONT },
    tail: { frame: null, roundLamps: NSX_ROUND_TAIL, ducktail: NSX_DUCKTAIL }, wheel: { fiveSpoke: null, disc: NSX_DISC_WHEEL, star: NSX_STAR_WHEEL } },
  f355: { kit: F355_KIT, rim: 18, nose: { round: F355_ROUND_NOSE, pointed: null }, front: { plain: F355_PLAIN_FRONT, sunk: null },
    tail: { frame: F355_FRAME_TAIL, roundLamps: F355_ROUND_TAIL, ducktail: null }, wheel: { fiveSpoke: F355_FIVE_SPOKE, disc: F355_DISC_WHEEL, star: null } },
};

/** a colour darkened toward black (the shut lines' shadow in the paint) */
function darken(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16), ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
  return Number.isNaN(n) ? hex : `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** the design's body as the kit's assembly spec and the tweak to its lines */
export function designKit(d: Design): { kit: CarKit; tweak: Tweak } {
  const B = BASE[d.body.base], b = d.body; if (!B) throw new Error(`design: no base ${b.base}`);
  let kit: CarKit = { ...B.kit };
  for (const p of [B.nose[b.nose], B.front[b.front], B.tail[b.tail], B.wheel[b.wheel]]) if (p) kit = { ...kit, ...p };
  // the paint: its own shut lines' shadow unless it is the base's own colour
  const c = B.kit.colours;
  kit.colours = { ...c, paint: b.paint, gloss: b.gloss, seam: b.paint.toLowerCase() === c.paint.toLowerCase() ? c.seam : darken(b.paint, 0.3) };
  // the wheels: the tyres' widths, the rims scaled from the base's own size (the tyres' outer radius kept)
  const W = kit.lines.wheels, rk = d.kit.rim / B.rim, [tf, tr] = d.kit.tyres;
  if (rk !== 1 || tf !== W.f.w || tr !== W.r.w) kit.lines = { ...kit.lines, wheels: { f: { ...W.f, w: tf, rim: Math.round(W.f.rim * rk) }, r: { ...W.r, w: tr, rim: Math.round(W.r.rim * rk) } } };
  const tweak: Tweak = {}; if (b.wheelbase) tweak.wheelbase = b.wheelbase; if (b.width) tweak.halfWidth = b.width;
  return { kit, tweak };
}

/** the design's car; `spin` turns the wheels, `lamps` 0..1 raises the head lamps */
export function designMesh(d: Design, spin = 0, lamps = 0): Mesh {
  const { kit, tweak } = designKit(d); return assemble(kit, { spin, lamps, tweak }).mesh;
}

/** the kinds the builder offers on a base: every one closes on both bases (tests/car_design.test.ts tries every combination) */
export function designChoices(base: BaseId): { nose: NoseKind[]; front: FrontKind[]; tail: TailKind[]; wheel: WheelKind[] } {
  const B = BASE[base]; if (!B) throw new Error(`design: no base ${base}`);
  return { nose: NOSES.filter(k => k in B.nose), front: FRONTS.filter(k => k in B.front), tail: TAILS.filter(k => k in B.tail), wheel: WHEELS.filter(k => k in B.wheel) };
}
