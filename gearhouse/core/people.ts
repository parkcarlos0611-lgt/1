// People (system design 05): one data shape for founder, employees and applicants; names from data;
// skills that grow with the hours worked; what the player knows of a person narrows as they work together.
import type { Rng } from './rng';
import type { DateStr } from './calendar';
import { parts } from './calendar';

export type Skills = Record<string, number>;
export interface Person {
  id: string; given: string; initial: string; family: string; sex: 'm' | 'f'; background: string; born: number;
  portrait: { face: number; hair: number; extra: number };
  skills: Skills;
  /** hidden: the most each skill can reach */
  potential: Skills;
  traits: string[];
  /** hidden: the age this person lives to (system design 05; death itself is switched off in the slice) */
  lifespan: number;
}
export interface Employee {
  personId: string; hired: DateStr; wage: number; assignedTo?: string;
  /** what the player knows: a range per skill that narrows with time */
  known: Record<string, [number, number]>;
}
export interface NameData { backgrounds: Record<string, { weight: number; surnames: string[]; male: string[]; female: string[] }>; middleInitials: string }
export interface PeopleData { skills: string[]; founderBackgrounds: Record<string, { skills: Skills; cash: number }>; traits: string[]; employeeHoursPerDay: number;
  wages: Record<string, unknown>; lifespan: { min: number; max: number; betaA: number; betaB: number; earlyShare: number } }

const pick = <T>(rng: Rng, a: T[]): T => a[rng.int(0, a.length - 1)]!;
function weighted<T>(rng: Rng, items: [T, number][]): T { let t = rng.float() * items.reduce((s, i) => s + i[1], 0); for (const [v, w] of items) { t -= w; if (t <= 0) return v; } return items[items.length - 1]![0]; }

export function makeName(rng: Rng, names: NameData, sex: 'm' | 'f'): { given: string; initial: string; family: string; background: string } {
  const bg = weighted(rng, Object.entries(names.backgrounds).map(([k, v]) => [k, v.weight] as [string, number])), b = names.backgrounds[bg]!, ini = names.middleInitials.split(' ');
  return { given: pick(rng, sex === 'm' ? b.male : b.female), initial: rng.float() < 0.6 ? pick(rng, ini) : '', family: pick(rng, b.surnames), background: bg };
}
/** Beta(a, b) for whole a and b: the a-th smallest of a + b - 1 uniform draws */
function beta(rng: Rng, a: number, b: number): number { const u = Array.from({ length: a + b - 1 }, () => rng.float()).sort((p, q) => p - q); return u[a - 1]!; }
export function drawLifespan(rng: Rng, L: PeopleData['lifespan'], ageNow: number): number {
  const full = L.min + beta(rng, L.betaA, L.betaB) * (L.max - L.min);
  if (rng.float() >= L.earlyShare) return Math.max(full, ageNow + 1);
  return ageNow + 1 + rng.float() * Math.max(0, full - ageNow - 1);                       // the unlucky fifth: some point between now and that age
}
export function makePerson(rng: Rng, names: NameData, data: PeopleData, year: number, o: { age?: number; sex?: 'm' | 'f'; level?: number; best?: string } = {}): Person {
  const sex = o.sex ?? (rng.float() < 0.93 ? 'm' : 'f'), age = o.age ?? rng.int(16, 58), n = makeName(rng, names, sex), level = o.level ?? rng.int(15, 70);
  const skills: Skills = {}, potential: Skills = {}, best = o.best ?? pick(rng, data.skills.slice(0, 7));
  for (const s of data.skills) { const v = Math.max(3, Math.min(95, Math.round((s === best ? level : level * (0.25 + rng.float() * 0.5)) * Math.min(1, 0.45 + (age - 16) / 25))));
    skills[s] = v; potential[s] = Math.min(100, Math.round(v + (100 - v) * (0.15 + rng.float() * 0.6))); }
  const traits = [pick(rng, data.traits)]; if (rng.float() < 0.5) { const t = pick(rng, data.traits); if (!traits.includes(t)) traits.push(t); }
  if (traits.includes('gifted')) potential[best] = Math.max(potential[best]!, 92);
  return { id: 'p' + rng.next().toString(36) + rng.next().toString(36), ...n, sex, born: year - age, portrait: { face: rng.int(0, 999), hair: rng.int(0, 999), extra: rng.int(0, 999) }, skills, potential, traits, lifespan: drawLifespan(rng, data.lifespan, age) };
}
export function makeFounder(rng: Rng, names: NameData, data: PeopleData, year: number, o: { background: string; age: number; sex?: 'm' | 'f'; given?: string; family?: string }): Person {
  const b = data.founderBackgrounds[o.background]; if (!b) throw new Error('unknown background ' + o.background);
  const p = makePerson(rng, names, data, year, { age: o.age, sex: o.sex ?? 'm' });
  // older founders know more; younger ones have longer to grow
  const k = 0.8 + Math.min(0.25, (o.age - 22) / 92); p.skills = {}; for (const s of data.skills) { p.skills[s] = Math.round((b.skills[s] ?? 20) * k); p.potential[s] = Math.min(100, Math.round(p.skills[s]! + (100 - p.skills[s]!) * (0.35 + rng.float() * 0.5))); }
  if (o.given) p.given = o.given; if (o.family) p.family = o.family; p.traits = [];
  return p;
}
export const fullName = (p: Person) => `${p.given} ${p.initial ? p.initial + '. ' : ''}${p.family}`;
export const ageOn = (p: Person, date: DateStr) => parts(date).year - p.born;

/** how fast a skill gets work done: 20 -> 0.6, 50 -> 1.0, 100 -> 1.6 (system design 04) */
export const skillRate = (s: number) => (s <= 50 ? 0.6 + (Math.max(0, s) - 20) / 30 * 0.4 : 1 + (s - 50) / 50 * 0.6);
/** an hour of work teaches a little: fastest far below one's potential and between 20 and 35 years old */
export function learn(p: Person, skill: string, hours: number, age: number): number {
  const s = p.skills[skill] ?? 0, cap = p.potential[skill] ?? s, room = Math.max(0, 1 - s / Math.max(1, cap)), young = age <= 35 ? 1 : Math.max(0.3, 1 - (age - 35) / 40);
  const gain = hours * 0.012 * room * young * (p.traits.includes('ambitious') ? 1.25 : 1); p.skills[skill] = Math.min(cap, s + gain); return gain;
}
/** the first look at someone: wide ranges around the truth */
export function firstImpression(rng: Rng, p: Person, skills: string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}; for (const s of skills) { const w = 18 + rng.int(0, 12), lo = Math.max(0, Math.round(p.skills[s]! - w * rng.float())); out[s] = [lo, Math.min(100, lo + w)]; } return out;
}
/** working together narrows what is known (per week worked) */
export function narrow(e: Employee, p: Person, manage: number): void {
  const k = 0.12 + manage / 400; for (const [s, r] of Object.entries(e.known)) { const v = p.skills[s]!; r[0] = Math.round(r[0] + (v - r[0]) * k); r[1] = Math.round(r[1] + (v - r[1]) * k); if (r[1] - r[0] < 2) { r[0] = r[1] = Math.round(v); } }
}
