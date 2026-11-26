// The bodies the game offers (docs/systems/113 V0): one list. The other bodies' code, data and tests stay; the game
// filters through this list (the builder's base choices, the garage's cards, the car picker, the race's field, the title
// car), as the settings' LOOKS_ON does for the looks. A body comes back (or a new one is added) by adding it here.
import type { BodyBase, Design } from './design';
import { fromPreset, newDesign, currentDesign, savedDesigns, type KeyStore } from './designstore';
import { CAR_599, CAR_N33 } from './names';

/** the bodies switched on in the game, in the order offered (the first is a new design's; the race field stays the
 *  599's one-make, race/onemake.ts: the N33 is the player's to pick and drive, docs/systems/117 R4) */
export const ENABLED_BODIES: readonly BodyBase[] = ['p959', 'bnr33'];
/** the bodies a player's design may stand on beyond those (a frame's body picked in the builder's first step, offered
 *  nowhere else until it joins the list above); none now that the N33 has (R4) */
export const FRAME_ONLY_BODIES: readonly BodyBase[] = [];
/** a body on the lists (a design on any other is an old one: shown greyed, not driven, raced or opened) */
export const isEnabledBody = (b: unknown): b is BodyBase => (ENABLED_BODIES as readonly unknown[]).includes(b) || (FRAME_ONLY_BODIES as readonly unknown[]).includes(b);
/** a design whose body is on the list */
export const enabledDesign = (d: Design | null | undefined): boolean => !!d && isEnabledBody(d.body.base);
/** the body a new design starts on */
export const DEFAULT_BODY: BodyBase = ENABLED_BODIES[0]!;
/** a new design on the default body (a fresh id, a new plate; a model body as its lump: docs/systems/115 F1) */
export const starterDesign = (name?: string): Design => newDesign(DEFAULT_BODY, name);

/** the 959 as it left the works: its own design and one id (its runs are kept under it), its own plate and swaps */
let stock: Design | null = null;
export function stockP959(): Design { if (!stock) { const d = fromPreset('p959', CAR_599);
    stock = { ...d, id: 'p959stock', body: { ...d.body, model: { bumperF: 'std', bumperR: 'std', lamp: 'round', wheel: 'hollow5', plate: '08루 0599' } } }; }
  return structuredClone(stock); }

/** the N33 as it left the works (docs/systems/117 R4): its own design and one id, its lump with the stock glass and
 *  interior sets (B), its plates at their stock places (both on: the lump's are off), its stock paint */
let stockN: Design | null = null;
export function stockN33(): Design { if (!stockN) { const d = fromPreset('bnr33', CAR_N33);
    // its own parts (R3): the lump's stock set of free and hole parts put on at their places as the mesh is built
    // (`stock`: render/car/bodies.ts), its own 17 inch five-spoke wheel
    const { plateF: _f, plateR: _r, ...model } = d.body.model!; void _f; void _r;
    stockN = { ...d, id: 'n33stock', body: { ...d.body, glass: 'stock', model: { ...model, wheel: 'n5', stock: true, plate: '33너 3300' } }, interior: { set: 'stock', trim: 'black' } }; }
  return structuredClone(stockN!); }

/** the design to show and go on with, from the enabled ones: the one on the bench, else the last saved, else the stock 959 */
export function recentEnabled(s: KeyStore | null): Design { const cur = currentDesign(s); if (cur && enabledDesign(cur)) return cur;
  return savedDesigns(s).find(enabledDesign) ?? stockP959(); }
