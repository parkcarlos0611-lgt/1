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
import bodies from '../data/news/bodies_ko.json';
import registerData from '../data/register/us_slice.json';
import weatherData from '../data/weather/us_midwest.json';
import { weatherLinks, weatherSystem, newWeather, type WeatherData } from './weather';
import bankData from '../data/bank/us_1930.json';
import { Bank, newBank, type BankData } from './bank';
import handover from '../data/text/ko/handover.json';
import type { HandoverText } from './sales';
import chanceData from '../data/chances/us_slice.json';
import { Chances, type ChanceData } from './chances';
import mediaData from '../data/media/us_slice.json';
import letters from '../data/text/ko/inquiry_letter.json';
import { Simulation } from './sim';
import { Repair, type RepairData } from './repair';
import { Clock } from './clock';
import repairData from '../data/repair/us_1930.json';
import { newGame, type GameState } from './state';
import { makeFounder, type PeopleData } from './people';
import { financeSystem } from './ledger';
import { Supply, type PartsData, type SupplyData } from './supply';
import { Shop, type BuildData } from './build';
import { Sales, type SalesData } from './sales';
import { Media, type MediaData } from './media';
import type { TextSet } from './text';
import type { FictionData, RealData } from './news';
import type { BodyData } from './newsBody';
import type { RegisterData } from './register';

export const DATA = { holidays, names, people: peopleData as unknown as PeopleData, finance, parts: partsData as unknown as PartsData, suppliers: suppliers as SupplyData, build: buildData as unknown as BuildData, sales: salesData as unknown as SalesData, economy, fiction: fiction as unknown as FictionData, real: realNews as unknown as RealData, bodies: bodies as unknown as BodyData, register: registerData as unknown as RegisterData, media: mediaData as unknown as MediaData, chances: chanceData as unknown as ChanceData, weather: weatherData as unknown as WeatherData, bank: bankData as unknown as BankData };
export interface World { clock: Clock; repair: Repair; sim: Simulation; supply: Supply; shop: Shop; sales: Sales; media: Media; chances: Chances; bank: Bank }
export interface FounderChoice { background: string; age: number; given?: string; family?: string }

/** a running game from a saved state, or a new one when a founder is given */
export function openWorld(g: GameState, founder?: FounderChoice): World {
  g.weather ??= newWeather(); g.bank ??= newBank(); const sim = new Simulation(g, DATA.holidays).use(weatherSystem(DATA.weather)).use(financeSystem(DATA.finance)), supply = new Supply(sim, DATA.suppliers, DATA.parts), shop = new Shop(sim, DATA.build, supply);
  const sales = new Sales(sim, DATA.sales, DATA.economy, DATA.names, DATA.people, shop, letters as TextSet, { town: '밀브룩', paper: '밀브룩 쿠리어' });
  const media = new Media(sim, DATA.media, DATA.fiction, DATA.real, DATA.names, supply, Object.fromEntries(DATA.suppliers.suppliers.map(s => [s.id, s.name])), '밀브룩', DATA.bodies, DATA.register, d => (DATA.economy.demand as Record<string, number>)[d.slice(0, 4)] ?? 1, DATA.weather);
  sales.returnDays = DATA.weather.returnDays; sales.handoverText = handover as unknown as HandoverText; weatherLinks(sim);
  sales.banks = { pick: rng => { const b = media.register.alive('bank'); return b.length ? b[rng.int(0, b.length - 1)]!.id : undefined; }, closed: id => media.register.get(id)?.status === 'closed' };
  g.media.chances ??= []; const chances = new Chances(sim, DATA.chances, sales, supply, shop, (i, h, id) => media.note(i, h, id));
  const bank = new Bank(sim, DATA.bank, { list: () => media.register.alive('bank').map(e => ({ id: e.id, name: e.name })), status: id => media.register.get(id)?.status, name: id => media.register.get(id)?.name ?? id }, d => (DATA.economy.demand as Record<string, number>)[d.slice(0, 4)] ?? 1);
  sim.use(supply.system()).use(shop.system()).use(sales.system()).use(media.system()).use(chances.system()).use(bank.system());
  if (founder && !g.founderId) sim.setFounder(makeFounder(sim.rng, DATA.names, DATA.people, 1930, founder), DATA.people.founderBackgrounds[founder.background]!.cash);
  const repair = new Repair(sim, repairData as unknown as RepairData, DATA.names as never, DATA.people), clock = new Clock(sim); sim.use(repair.system());
  return { sim, supply, shop, sales, media, chances, bank, repair, clock };
}
export const newWorld = (seed: number, founder: FounderChoice): World => openWorld(newGame(seed), founder);
