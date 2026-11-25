// The engine library (docs/systems/101 1-1 and 1-2 ⑧, task M2): engines kept apart from the cars, each a family (what
// the block and its castings fix: the layout, the block's metal, the bore/stroke and the displacements the block takes,
// the valves a cylinder) and a variant of it (what one engine of the family is: its displacement within the family's
// range, its red line, its cams, its intake, its compression, its lubrication, its turbos with their boost and
// intercooler, its development grade, each part's quality). A design's engine (core/design.ts) is a family and a
// variant put together; an engine taken from the library into a car is copied in (the car keeps its own, the library
// its own). Also the technologies' years (1-2 ⑦): shown as information in 0.12, a "연도 제한" setting off by default.
// Pure: the storage is passed in, and one that throws (a private window, storage refused) keeps nothing and reads empty.
import { BLOCKS, COMPRESSIONS, GRADES, INTAKES, LAYOUTS, LIMITS, QUALITY_PARTS, SUMPS, BS_DEFAULT, NO_QUALITY, normalise, DESIGN_F355, DESIGN_P959, DESIGN_BNR33,
  type Block, type Design, type EngineQuality, type Layout, type Valves } from './design';
import type { KeyStore } from './designstore';
import { ENGINE_599, ENGINE_N33 } from './names';

export interface EngineFamily { layout: Layout; block: Block; valves: Valves; /** the bore over the stroke */ bs: number;
  /** the displacements the block takes (cc): its bores from the smallest liner to the thinnest wall */ cc: [number, number] }
export type EngineVariant = Omit<Design['engine'], 'layout' | 'block' | 'valves' | 'bs'>;
/** an engine kept in the library */
export interface SavedEngine { v: 1; id: string; name: string; family: EngineFamily; variant: EngineVariant; /** when it was saved (ms) */ at: number }
export const ENGINES_KEY = 'gearhouse.engines.v1';

/** a family's displacement range around one displacement: the bore taken 10 % down and 8 % up at the same stroke
 *  (cc goes with the bore's square), inside the design's limits, rounded to 50 cc */
export function familyRange(cc: number): [number, number] {
  const r = (x: number) => Math.round(Math.min(LIMITS.cc[1], Math.max(LIMITS.cc[0], x)) / 50) * 50;
  return [r(cc * 0.9 ** 2), r(cc * 1.08 ** 2)]; }
/** a design's engine as a family and a variant (the family's range around its displacement unless one is given) */
export function splitEngine(e: Design['engine'], cc?: [number, number]): { family: EngineFamily; variant: EngineVariant } {
  const { layout, block, valves, bs, ...variant } = structuredClone(e);
  return { family: { layout, block, valves, bs, cc: cc ?? familyRange(e.cc) }, variant }; }
/** a family and a variant as a design's engine: the variant's displacement kept inside the family's range, then
 *  brought inside what the grade allows (normalise, on a carrier car) */
export function joinEngine(f: EngineFamily, v: EngineVariant, carrier: Design = DESIGN_F355): Design['engine'] {
  const cc = Math.min(f.cc[1], Math.max(f.cc[0], v.cc));
  return normalise({ ...carrier, engine: { ...structuredClone(v), cc, layout: f.layout, block: f.block, valves: f.valves, bs: f.bs } }).engine; }
/** the engine put into a car (the car's own engine replaced) */
export const withEngine = (d: Design, e: Design['engine']): Design => normalise({ ...d, engine: structuredClone(e) });

/** the stock cars' engines as families and variants, listed in the workshop's library beside the saved ones (opened,
 *  not deleted): the 599's flat six, and the N33's straight six (docs/systems/117 R4: an iron block bored 86 x 73.7, the
 *  family 2.4 to 2.8 l as the block took in its tuned versions, the variant at 2,568 cc on two turbos at about 0.6 bar) */
export const STOCK_ENGINES: readonly SavedEngine[] = [engineEntry(DESIGN_P959.engine, ENGINE_599, undefined, 'stock-599'), engineEntry(DESIGN_BNR33.engine, ENGINE_N33, [2350, 2800], 'stock-n33')];

// ---- a saved engine checked: a stored list may hold anything ----
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
const one = <T>(v: unknown, of: readonly T[], d: T): T => of.includes(v as T) ? v as T : d;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const newEngineId = () => 'e' + Date.now().toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
/** any value made into a saved engine: its fields where they are right, the rest the F355's engine's; null when it has no family or variant */
export function asEngine(x: unknown): SavedEngine | null {
  const o = obj(x); if (!o.family || !o.variant) return null;
  const f = obj(o.family), v = obj(o.variant), P = splitEngine(DESIGN_F355.engine), q = obj(v.quality), cc = Array.isArray(f.cc) ? f.cc : [];
  const lo = Math.round(num(cc[0], P.family.cc[0])), hi = Math.round(num(cc[1], P.family.cc[1]));
  const family: EngineFamily = { layout: one(f.layout, LAYOUTS, P.family.layout), block: one(f.block, BLOCKS, P.family.block), valves: one(f.valves, [2, 3, 4, 5] as const, P.family.valves),
    bs: Math.min(LIMITS.bs[1], Math.max(LIMITS.bs[0], num(f.bs, BS_DEFAULT))),
    cc: [Math.max(LIMITS.cc[0], Math.min(lo, hi)), Math.min(LIMITS.cc[1], Math.max(lo, hi))] };
  const variant: EngineVariant = { grade: one(v.grade, GRADES, P.variant.grade), cc: num(v.cc, P.variant.cc), redline: num(v.redline, P.variant.redline), intake: one(v.intake, INTAKES, P.variant.intake),
    compression: one(v.compression, COMPRESSIONS, P.variant.compression), sump: one(v.sump, SUMPS, P.variant.sump), turbo: one(v.turbo, [0, 1, 2, 3, 4] as const, P.variant.turbo),
    boost: num(v.boost, P.variant.boost), intercooler: typeof v.intercooler === 'boolean' ? v.intercooler : P.variant.intercooler, vtec: typeof v.vtec === 'boolean' ? v.vtec : P.variant.vtec,
    quality: Object.fromEntries(QUALITY_PARTS.map(k => [k, num(q[k], NO_QUALITY[k])])) as EngineQuality };
  // the variant as the grade and the family allow it
  const e = joinEngine(family, variant), { variant: ok } = splitEngine(e, family.cc);
  return { v: 1, id: typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : newEngineId(), name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : '이름 없는 엔진',
    family, variant: ok, at: num(o.at, 0) }; }

// ---- the library in this browser ----
const read = (s: KeyStore | null): string | null => { try { return s ? s.getItem(ENGINES_KEY) : null; } catch { return null; } };
const write = (s: KeyStore | null, v: string): boolean => { try { if (!s) return false; s.setItem(ENGINES_KEY, v); return true; } catch { return false; } };
/** every saved engine, the last saved first */
export function savedEngines(s: KeyStore | null): SavedEngine[] {
  let all: unknown; try { all = JSON.parse(read(s) ?? '[]'); } catch { return []; }
  return Array.isArray(all) ? all.map(asEngine).filter((e): e is SavedEngine => !!e) : []; }
/** an engine saved (replacing one of its id, put first); false when the storage keeps nothing */
export function saveEngine(s: KeyStore | null, e: SavedEngine, now = Date.now()): boolean {
  const rest = savedEngines(s).filter(x => x.id !== e.id); return write(s, JSON.stringify([{ ...e, at: now }, ...rest].slice(0, 100))); }
export function deleteEngine(s: KeyStore | null, id: string): boolean { return write(s, JSON.stringify(savedEngines(s).filter(x => x.id !== id))); }
/** a copy of a saved engine under a new id and name, saved; null when the storage keeps nothing */
export function duplicateEngine(s: KeyStore | null, id: string, now = Date.now()): SavedEngine | null {
  const e = savedEngines(s).find(x => x.id === id); if (!e) return null;
  const c: SavedEngine = { ...structuredClone(e), id: newEngineId(), name: `${e.name} 사본`.slice(0, 40) }; return saveEngine(s, c, now) ? c : null; }
/** a new saved engine from a design's engine */
export function engineEntry(e: Design['engine'], name: string, cc?: [number, number], id = newEngineId()): SavedEngine {
  const { family, variant } = splitEngine(e, cc); return { v: 1, id, name: name.slice(0, 40) || '이름 없는 엔진', family, variant, at: 0 }; }

// ---- the technologies' years (1-2 ⑦): when each came into road cars; 0.20's research begins from these ----
export type Tech = 'efi' | 'vvt' | 'itb' | 'variable' | 'turbo' | 'multiTurbo' | 'intercooler' | 'dry' | 'fiveValve' | 'fourValve' | 'magnesium' | 'aluminium' | 'f1Gearbox' | 'flat' | 'v10';
/** the year and what it was (Korean): fuel injection's electronic control in the 1980s (Bosch's Motronic, 1979, common
 *  by the mid-1980s), variable valve timing (Honda's VTEC, 1989), a throttle a cylinder (racing's, on road cars from the
 *  1960s), a resonance intake (the 1980s), turbos (the 1962 Oldsmobile Jetfire, the 1973 BMW 2002 turbo in Europe),
 *  sequential twin and quad turbos (the 1991 EB110's four), intercoolers (1970s racing, 1980s road cars), dry sumps
 *  (1950s racing), five valves (Yamaha's 1985, Ferrari's F355 1994), four valves (1912 Peugeot racing, road cars from
 *  the 1960s), magnesium castings (the 1990s' racing engines), aluminium blocks (the 1930s), the F1 gearbox (the 1997
 *  F355 F1), flat engines (the 1930s), the V10 (the 1990s' Formula 1) */
export const TECH_YEAR: Record<Tech, { year: number; name: string }> = {
  efi: { year: 1982, name: '전자식 연료 분사' }, vvt: { year: 1989, name: '가변 밸브 타이밍' }, itb: { year: 1965, name: '개별 스로틀' }, variable: { year: 1984, name: '가변 흡기' },
  turbo: { year: 1962, name: '터보' }, multiTurbo: { year: 1991, name: '3~4 터보' }, intercooler: { year: 1978, name: '인터쿨러' }, dry: { year: 1952, name: '드라이 섬프' },
  fiveValve: { year: 1985, name: '실린더당 5밸브' }, fourValve: { year: 1966, name: '실린더당 4밸브' }, magnesium: { year: 1992, name: '마그네슘 블록' }, aluminium: { year: 1932, name: '알루미늄 블록' },
  f1Gearbox: { year: 1997, name: 'F1 변속기' }, flat: { year: 1934, name: '수평대향 배열' }, v10: { year: 1989, name: 'V10 배열' } };
/** the technologies an engine (and its car's gearbox) uses, the latest first */
export function engineTechs(e: Design['engine'], gearbox?: 'manual' | 'f1'): Tech[] {
  const t: Tech[] = ['efi'];
  if (e.vtec) t.push('vvt'); if (e.intake === 'itb') t.push('itb'); if (e.intake === 'variable') t.push('variable');
  if (e.turbo) t.push('turbo'); if (e.turbo >= 3) t.push('multiTurbo'); if (e.turbo && e.intercooler) t.push('intercooler'); if (e.sump === 'dry') t.push('dry');
  if (e.valves === 5) t.push('fiveValve'); if (e.valves === 4) t.push('fourValve'); if (e.block === 'magnesium') t.push('magnesium'); if (e.block === 'aluminium') t.push('aluminium');
  if (e.layout[0] === 'F') t.push('flat'); if (e.layout === 'V10') t.push('v10'); if (gearbox === 'f1') t.push('f1Gearbox');
  return t.sort((a, b) => TECH_YEAR[b].year - TECH_YEAR[a].year); }
/** the earliest year all of an engine's technologies were about */
export const engineYear = (e: Design['engine'], gearbox?: 'manual' | 'f1') => Math.max(...engineTechs(e, gearbox).map(k => TECH_YEAR[k].year));
