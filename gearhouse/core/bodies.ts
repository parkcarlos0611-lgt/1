// The bodies the game offers (docs/systems/113 V0): one list. The other bodies' code, data and tests stay; the game
// filters through this list (the builder's base choices, the garage's cards, the car picker, the race's field, the title
// car), as the settings' LOOKS_ON does for the looks. A body comes back (or a new one is added) by adding it here.
import type { BodyBase, Design } from './design';
import { fromPreset, currentDesign, savedDesigns, type KeyStore } from './designstore';

/** the bodies switched on in the game, in the order offered */
export const ENABLED_BODIES: readonly BodyBase[] = ['p959'];
/** a body on the list (a design on any other is an old one: shown greyed, not driven, raced or opened) */
export const isEnabledBody = (b: unknown): b is BodyBase => (ENABLED_BODIES as readonly unknown[]).includes(b);
/** a design whose body is on the list */
export const enabledDesign = (d: Design | null | undefined): boolean => !!d && isEnabledBody(d.body.base);
/** the body a new design starts on */
export const DEFAULT_BODY: BodyBase = ENABLED_BODIES[0]!;
/** a new design on the default body (a fresh id, a new plate) */
export const starterDesign = (name?: string): Design => fromPreset(DEFAULT_BODY, name);

/** the 959 as it left the works: its own design and one id (its runs are kept under it), its own plate and swaps */
let stock: Design | null = null;
export function stockP959(): Design { if (!stock) { const d = fromPreset('p959', '포르쉐 959');
    stock = { ...d, id: 'p959stock', body: { ...d.body, model: { bumperF: 'std', bumperR: 'std', lamp: 'round', wheel: 'hollow5', plate: '08루 0959' } } }; }
  return structuredClone(stock); }

/** the design to show and go on with, from the enabled ones: the one on the bench, else the last saved, else the stock 959 */
export function recentEnabled(s: KeyStore | null): Design { const cur = currentDesign(s); if (cur && enabledDesign(cur)) return cur;
  return savedDesigns(s).find(enabledDesign) ?? stockP959(); }
