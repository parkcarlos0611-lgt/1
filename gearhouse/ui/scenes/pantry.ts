// What the house has in the pantry and what is on order, shared by the prototypes (kitchen, telephone). In the game
// this lives in the save; here it is kept in the browser so the telephone page's order reaches the kitchen page.
export interface Pantry { tea: number; coffee: number; orders: { item: string; qty: number; from: string; price: number }[] }
const KEY = 'gearhouse.proto.pantry';
let mem: Pantry = { tea: 1, coffee: 1, orders: [] };
/** read the pantry, or write it when given one */
export function pantry(p?: Pantry): Pantry {
  if (p) { mem = p; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window */ } return p; }
  try { const s = localStorage.getItem(KEY); if (s) mem = { ...mem, ...JSON.parse(s) as Pantry }; } catch { /* keep memory */ }
  return mem;
}
