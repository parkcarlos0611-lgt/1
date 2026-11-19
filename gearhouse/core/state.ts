// The whole game as plain data (system design 01). Nothing here knows about the screen; a save is this object as JSON.
import type { DateStr } from './calendar';
import type { Employee, Person } from './people';
import type { Ledger } from './ledger';
import type { SupplyState } from './supply';
import type { ShopState } from './build';
import { newMarket, type MarketState } from './sales';
import { newMedia, type MediaState } from './media';
import type { Condition } from './conditions';
import { newWeather, type WeatherState } from './weather';

export const SAVE_VERSION = 1;
export type Phase = 'morning' | 'day' | 'evening';
/** decision: always stops the game; notice: stops unless switched off; log: journal only */
export type Grade = 'decision' | 'notice' | 'log';

/** something that happened and may need the player (the design documents call it a 사건) */
export interface Incident {
  id: number; kind: string; grade: Grade; date: DateStr; phase: Phase;
  payload: Record<string, unknown>;
  /** last day it can still be answered; after it the incident expires */
  deadline?: DateStr;
  state: 'open' | 'resolved' | 'expired';
  choice?: string;
}
/** a piece of work that takes hours: a design stage, a build step, a repair job... */
export interface Task { id: string; label: string; skill: string; hoursNeeded: number; hoursDone: number; done: boolean;
  /** cannot be worked yet: an earlier step is unfinished or the materials have not come */
  blocked?: boolean;
  /** cannot be worked today for a passing reason (rain keeps paint from drying) */
  held?: string;
  /** hours each person put in (for the quality of the result) */
  by?: Record<string, number>;
  /** the owning system reports the end of this task itself */
  quiet?: boolean }
/** the weekly plan on the desk: tasks in order, each with an optional cap of hours per day */
export interface PlanSlot { taskId: string; maxHours?: number }

export interface GameState {
  version: number;
  seed: number;
  rng: string;
  clock: { date: DateStr; started: DateStr };
  settings: {
    /** weekdays off: 0 = Sunday ... 6 = Saturday */
    daysOff: number[];
    /** notice kinds the player has switched off (they go to the journal instead) */
    quietKinds: string[];
  };
  people: Record<string, Person>;
  founderId: string | null;
  employees: Employee[];
  ledger: Ledger;
  supply: SupplyState;
  shop: ShopState;
  market: MarketState;
  media: MediaState;
  founder: { hoursPerDay: number; overtimePerDay: number; overtimeThisWeek: number; fatigue: number };
  tasks: Record<string, Task>;
  plan: PlanSlot[];
  incidents: Incident[];
  nextIncidentId: number;
  journal: { date: DateStr; text: string }[];
  /** passing conditions the papers warned of (core/conditions.ts) */
  conditions: Condition[];
  weather: WeatherState;
}

export function newGame(seed: number, start: DateStr = '1930-01-01'): GameState {
  return { version: SAVE_VERSION, seed, rng: '', clock: { date: start, started: start }, settings: { daysOff: [0], quietKinds: [] },
    people: {}, founderId: null, employees: [], ledger: { cash: 0, entries: [] },
    supply: { suppliers: {}, pending: [], quotes: [], orders: [], lots: [], nextId: 1, phone: false }, shop: { designs: {}, builds: [], cars: [], nextId: 1 }, market: newMarket(), media: newMedia(),
    founder: { hoursPerDay: 10, overtimePerDay: 0, overtimeThisWeek: 0, fatigue: 0 }, tasks: {}, plan: [], incidents: [], nextIncidentId: 1, journal: [], conditions: [], weather: newWeather() };
}
export const save = (g: GameState): string => JSON.stringify(g);
/** load a save, converting older versions step by step */
export function load(json: string): GameState {
  const g = JSON.parse(json) as GameState; if (typeof g.version !== 'number' || g.version > SAVE_VERSION) throw new Error('save version ' + g.version + ' is not supported');
  // version converters go here: while (g.version < SAVE_VERSION) convert[g.version](g)
  g.conditions ??= []; g.weather ??= newWeather();
  return g;
}
