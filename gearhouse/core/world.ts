// Puts the slice together: one place that loads the data files and plugs every system into a Simulation.
// Tests, tools and (later) the screens all start a game through here.
import holidays from '../data/calendar/us.json';
import names from '../data/names/us.json';
import peopleData from '../data/people/us_1930.json';
import finance from '../data/finance/us_1930.json';
import partsData from '../data/parts/us_1930.json';
import suppliers from '../data/suppliers/us_slice.json';
import buildData from '../data/build/steps.json';
import salesData from '../data/sales/us_1930.json';
import economy from '../data/economy/us_1930.json';
import fiction from '../data/news/fictional_ko.json';
import realNews from '../data/news/real_us_1930s.json';
import mediaData from '../data/media/us_slice.json';
import letters from '../data/text/ko/inquiry_letter.json';
import { Simulation } from './sim';
import { newGame, type GameState } from './state';
import { makeFounder, type PeopleData } from './people';
import { financeSystem } from './ledger';
import { Supply, type PartsData, type SupplyData } from './supply';
import { Shop, type BuildData } from './build';
import { Sales, type SalesData } from './sales';
import { Media, type MediaData } from './media';
import type { TextSet } from './text';
import type { FictionData, RealData } from './news';

export const DATA = { holidays, names, people: peopleData as unknown as PeopleData, finance, parts: partsData as unknown as PartsData, suppliers: suppliers as SupplyData, build: buildData as unknown as BuildData, sales: salesData as unknown as SalesData, economy, fiction: fiction as unknown as FictionData, real: realNews as unknown as RealData, media: mediaData as unknown as MediaData };
export interface World { sim: Simulation; supply: Supply; shop: Shop; sales: Sales; media: Media }
export interface FounderChoice { background: string; age: number; given?: string; family?: string }

/** a running game from a saved state, or a new one when a founder is given */
export function openWorld(g: GameState, founder?: FounderChoice): World {
  const sim = new Simulation(g, DATA.holidays).use(financeSystem(DATA.finance)), supply = new Supply(sim, DATA.suppliers, DATA.parts), shop = new Shop(sim, DATA.build, supply);
  const sales = new Sales(sim, DATA.sales, DATA.economy, DATA.names, DATA.people, shop, letters as TextSet, { town: '밀브룩', paper: '밀브룩 쿠리어' });
  const media = new Media(sim, DATA.media, DATA.fiction, DATA.real, DATA.names, supply, Object.fromEntries(DATA.suppliers.suppliers.map(s => [s.id, s.name])), '밀브룩');
  sim.use(supply.system()).use(shop.system()).use(sales.system()).use(media.system());
  if (founder && !g.founderId) sim.setFounder(makeFounder(sim.rng, DATA.names, DATA.people, 1930, founder), DATA.people.founderBackgrounds[founder.background]!.cash);
  return { sim, supply, shop, sales, media };
}
export const newWorld = (seed: number, founder: FounderChoice): World => openWorld(newGame(seed), founder);
