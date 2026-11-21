// The house's own state (review 42): what the player has left on, open or warm. Saved with the game, so the kitchen
// is as it was left: the lamp burning, the window up, the kettle cooling on the stove. Things that happen by the
// second (a kettle coming to the boil, a window fogging) run on real seconds, as animation does (review 35); a night's
// sleep or hours away let them settle.
export interface KitchenState {
  lamp: boolean;
  /** the lower sash: 0 shut .. 1 up as far as it goes */
  window: number; windowWanted: 0 | 1;
  burner: boolean;
  /** water in the kettle, degrees Celsius */
  kettle: number;
  /** steam on the glass 0..1 */
  fog: number;
}
/** what is in the larder (tea and coffee for customers, review 33) */
export interface Pantry { tea: number; coffee: number }
/** the telephone directory as the player has left it: entries ringed in pencil, the page it lies open at */
export interface BookState { marks: string[]; page: number }
export interface HouseState { kitchen: KitchenState; pantry?: Pantry; book?: BookState;
  /** the garage doors left open; letters waiting in the mailbox */
  garageOpen?: boolean; mail?: number;
  /** a customer sitting at the kitchen table */
  visitor?: boolean;
  /** the repair job whose car stands at the kerb */
  car?: number }
export const newHouse = (): HouseState => ({ kitchen: { lamp: false, window: 0, windowWanted: 0, burner: false, kettle: 46, fog: 0 } });

export const BOIL = 100;
/** a kettle on a gas ring: about 15 s from cold to the boil on screen; off the flame it cools towards the room */
export function stepKitchen(k: KitchenState, sec: number, room: number, outdoors: number): void {
  if (k.burner) k.kettle = Math.min(BOIL, k.kettle + sec * 5.5); else k.kettle += (room - k.kettle) * (1 - Math.exp(-sec / 240));
  const step = sec * 0.9; k.window += Math.max(-step, Math.min(step, k.windowWanted - k.window));
  const steaming = k.kettle >= 96 && k.window < 0.1 && outdoors < 16;
  k.fog = Math.max(0, Math.min(1, k.fog + (steaming ? sec * 0.035 : -sec * (k.window > 0.1 ? 0.05 : 0.008))));
}
/** hours away (asleep, at the garage all day): the kettle is cold, the glass clear */
export function settleKitchen(k: KitchenState, minutes: number, room: number): void {
  if (minutes < 30) return; k.burner = false; k.kettle = room + (k.kettle - room) * Math.exp(-minutes / 40); k.fog = 0; }
