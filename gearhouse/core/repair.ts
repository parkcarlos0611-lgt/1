// Repair jobs (version one, step 2; reviews 33, 39). A customer brings a cheap car with damage on its parts: rust,
// a dented fender, a broken headlamp, a torn roof. Some of it shows; some (rust under the paint) only comes out in
// talk or under the wire wool. The job is agreed at the kitchen table (a price and a day), the car stays in the garage,
// the work there gives a result per part, and the customer pays when they collect. Work done badly comes back: rust
// left under paint bubbles through in a few months and the customer complains; good work brings friends.
import { addDays, type DateStr } from './calendar';
import type { Api, Simulation, System } from './sim';
import { post } from './ledger';
import { fullName, makePerson, type NameData, type PeopleData } from './people';
import type { Field } from './sales';
import finishJson from '../data/cars/sedan29_finish.json';
import { Rng } from './rng';

export interface RepairData { arrivalsPerWeek: number; labourRate: number; cars: { id: string; name: string; value: number; colours: string[] }[];
  damage: { kind: string; name: string; weight: number; rustingOnly?: boolean; parts?: string[]; hours: [number, number]; materials: number; hiddenChance: number }[];
  budgetSpread: [number, number]; wantDays: [number, number]; patience: [number, number]; maxConsults: number; complaintDays: [number, number]; pleasedAt: number }
export interface Damage { part: string; kind: string; severity: number; hidden: boolean }
/** what the garage made of each part (the bodywork scene's inspection, summed per part) */
export interface PartResult { hiddenRust: number; pits: number; bare: number }
export interface JobResult { satisfaction: number; backChance: number; hours: number; parts?: Record<string, PartResult> }
export interface RepairJob { id: number; personId: string; car: { model: string; colour: string }; damages: Damage[]; budget: [number, number]; wantDays: number; patience: number; temper: number;
  received: DateStr; state: 'asked' | 'agreed' | 'ready' | 'collected' | 'lost'; revealed: { budget: boolean; hidden: boolean }; consults: number;
  price?: number; due?: DateStr; result?: JobResult; satisfaction?: number; source: 'walk_in' | 'referral' }
export interface RepairState { jobs: RepairJob[]; nextId: number; later: { due: DateStr; jobId: number; kind: 'complaint' | 'referral' }[]; rng?: string }
export const newRepairState = (): RepairState => ({ jobs: [], nextId: 1, later: [] });
const FINISH = finishJson as unknown as { finishes: Record<string, { base: { rusts: boolean } }>; parts: Record<string, string> };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Repair {
  /** its own random stream, so adding repairs does not shift what the older systems draw (saved with the jobs) */
  private rng: Rng;
  constructor(private sim: Simulation, private data: RepairData, private names: NameData, private people: PeopleData) { sim.g.repair ??= newRepairState(); this.rng = new Rng((sim.g.seed * 7919 + 104729) >>> 0); if (sim.g.repair.rng) this.rng.load(sim.g.repair.rng); }
  private saveRng() { this.R.rng = this.rng.save(); }
  private get R(): RepairState { return this.sim.g.repair!; }
  job(id: number): RepairJob { const j = this.R.jobs.find(x => x.id === id); if (!j) throw new Error('no repair job ' + id); return j; }

  system(): System { return { id: 'repair', morning: a => this.morning(a) }; }
  private morning(a: Api) { const r = this.rng, M = a.g.market;
    // walk-ins: more as the town gets to know the shop
    const perDay = this.data.arrivalsPerWeek / 7 * (0.6 + M.awareness.town / 60); if (a.workday && r.float() < perDay) this.arrive(a, 'walk_in');
    // what comes back of jobs done months ago
    const due = this.R.later.filter(l => l.due <= a.date); this.R.later = this.R.later.filter(l => l.due > a.date);
    for (const l of due) { const j = this.job(l.jobId), who = fullName(a.g.people[j.personId]!);
      if (l.kind === 'complaint') { this.pull(a, 'trust', -40, 0.12); this.pull(a, 'quality', -40, 0.08); a.raise('repair_complaint', 'notice', { jobId: j.id, customer: who, text: `${who} 씨가 찾아왔다. 고친 자리의 칠이 들뜨고 녹이 다시 올라왔다고 한다.` }); }
      else this.arrive(a, 'referral', who); }
    this.saveRng();
    // a customer whose car is late
    for (const j of this.R.jobs) if (j.state === 'agreed' && j.due && j.due < a.date && j.due >= addDays(a.date, -1)) { this.pull(a, 'trust', -30, 0.05); a.raise('repair_late', 'notice', { jobId: j.id, customer: fullName(a.g.people[j.personId]!) }); } }

  /** a customer drives up with a damaged car (in the game: a car at the kerb at some hour of the day) */
  arrive(a: Api, source: RepairJob['source'], referredBy?: string): RepairJob { const r = this.rng, D = this.data, car = D.cars[r.int(0, D.cars.length - 1)]!, year = Number(a.date.slice(0, 4));
    const p = makePerson(r, this.names, this.people, year, { age: r.int(24, 66), sex: r.float() < 0.85 ? 'm' : 'f' }); a.g.people[p.id] = p;
    const rusting = Object.entries(FINISH.parts).filter(([, f]) => FINISH.finishes[f]?.base.rusts && !['frame', 'axleF', 'axleR', 'crossF'].includes(f)).map(([id]) => id).filter(id => ['body', 'fenderF', 'fenderR', 'hood', 'cowl', 'apron', 'splash'].includes(id));
    const damages: Damage[] = []; for (let n = r.int(1, 3); n > 0; n--) { const w = D.damage.reduce((s, d) => s + d.weight, 0); let x = r.float() * w; const kind = D.damage.find(d => (x -= d.weight) <= 0) ?? D.damage[0]!;
      const pool = kind.rustingOnly ? rusting : kind.parts ?? rusting, part = pool[r.int(0, pool.length - 1)]!; if (damages.some(d => d.part === part && d.kind === kind.kind)) continue;
      damages.push({ part, kind: kind.kind, severity: Math.round((0.25 + r.float() * 0.75) * 100) / 100, hidden: r.float() < kind.hiddenChance }); }
    const fair = this.fairPrice(damages), spread = D.budgetSpread, budget: [number, number] = [Math.round(fair * spread[0]), Math.round(fair * (spread[0] + (spread[1] - spread[0]) * (0.4 + r.float() * 0.6)))];
    const j: RepairJob = { id: this.R.nextId++, personId: p.id, car: { model: car.id, colour: car.colours[r.int(0, car.colours.length - 1)]! }, damages, budget, wantDays: r.int(D.wantDays[0], D.wantDays[1]), patience: r.int(D.patience[0], D.patience[1]), temper: r.float(),
      received: a.date, state: 'asked', revealed: { budget: false, hidden: false }, consults: 0, source };
    this.R.jobs.push(j);
    const minute = 9 * 60 + r.int(0, 7 * 60); a.g.agenda?.push({ id: (a.g.time ? a.g.time.nextId++ : 0), date: a.date, minute, kind: 'repair_visit', ref: j.id });   // when the car pulls up
    a.bus.emit('repair_inquiry', { jobId: j.id, source }); a.raise('repair_inquiry', 'decision', { jobId: j.id, customer: fullName(p), car: car.name, referredBy, minute }, j.patience); this.saveRng(); return j; }
  /** labour and materials at the shop's rate: what a fair price looks like */
  fairPrice(damages: Damage[]): number { const D = this.data; return Math.round(damages.reduce((s, d) => { const k = D.damage.find(x => x.kind === d.kind)!; return s + ((k.hours[0] + (k.hours[1] - k.hours[0]) * d.severity) * D.labourRate + k.materials * (0.5 + d.severity)); }, 0) * 4) / 4 + 2; }
  /** what the shop knows about a job */
  view(id: number) { const j = this.job(id); return { name: fullName(this.sim.g.people[j.personId]!), car: this.data.cars.find(c => c.id === j.car.model)!.name, colour: j.car.colour, damages: j.damages.filter(d => !d.hidden || j.revealed.hidden),
    budget: j.revealed.budget ? j.budget : undefined, wantBy: addDays(j.received, j.wantDays), state: j.state, price: j.price, due: j.due }; }
  /** talk at the table: the budget, and damage the customer had kept quiet about (or not seen), may come out */
  consult(id: number): { budget: boolean; hidden: boolean } { const j = this.job(id), g = this.sim.g, r = this.rng, sales = g.founderId ? g.people[g.founderId]!.skills.sales ?? 30 : 30;
    if (j.state !== 'asked') throw new Error('the job is not open for talks'); if (j.consults >= this.data.maxConsults) throw new Error('the customer has said all they will say for now'); j.consults++;
    const before = { ...j.revealed }; if (r.float() < 0.4 + sales / 160) j.revealed.budget = true; if (j.damages.some(d => d.hidden) && r.float() < 0.35 + sales / 200) j.revealed.hidden = true;
    this.saveRng(); return { budget: j.revealed.budget && !before.budget, hidden: j.revealed.hidden && !before.hidden }; }
  /** a price and a day, said across the table: the customer answers at once */
  offer(id: number, price: number, days: number): boolean { const j = this.job(id), a = this.sim.api(), M = a.g.market; if (j.state !== 'asked') throw new Error('the job is not open');
    const over = price / j.budget[1], late = (days - j.wantDays) / 10, rep = (M.reputation.trust + M.reputation.value) / 400, p = clamp(0.85 - Math.max(0, over - 0.9) * 2.6 - Math.max(0, late) * 0.3 + rep, 0.02, 0.97);
    const roll = this.rng.float(); this.saveRng(); if (roll >= p) { j.consults = Math.max(j.consults, this.data.maxConsults - 1); return false; }
    j.state = 'agreed'; j.price = price; j.due = addDays(a.date, days); a.bus.emit('repair_agreed', { jobId: j.id, price }); return true; }
  decline(id: number): void { this.job(id).state = 'lost'; }
  /** the work is done: what the inspection found, per part */
  finish(id: number, result: JobResult): void { const j = this.job(id); if (j.state !== 'agreed') throw new Error('no agreed job to finish'); j.result = result; j.state = 'ready'; this.sim.bus.emit('repair_ready', { jobId: id }); }
  /** the customer collects and pays; how they feel decides what comes back in a few months */
  collect(id: number): { satisfaction: number; paid: number } { const j = this.job(id), a = this.sim.api(), r = this.rng; if (j.state !== 'ready' || !j.result || j.price === undefined) throw new Error('nothing to collect');
    const late = j.due && a.date > j.due ? (Date.parse(a.date) - Date.parse(j.due)) / 86400000 : 0, value = clamp((j.budget[1] - j.price) / Math.max(1, j.budget[1]) * 60, -30, 20);
    let s = j.result.satisfaction + value - late * 4 * (0.5 + j.temper); s = Math.round(clamp(s, -100, 100)); j.satisfaction = s; j.state = 'collected';
    post(a, 'repair', j.price, 'repair ' + j.id);
    this.pull(a, 'quality', clamp(j.result.satisfaction * 1.2 - 20, -100, 100), 0.1); this.pull(a, 'trust', late > 0 ? -40 : 50, 0.08); this.pull(a, 'value', value * 3, 0.06);
    a.g.market.awareness.town = clamp(a.g.market.awareness.town + 1, 0, 100);
    if (r.float() < j.result.backChance) this.R.later.push({ due: addDays(a.date, r.int(this.data.complaintDays[0], this.data.complaintDays[1])), jobId: j.id, kind: 'complaint' });
    else if (s >= this.data.pleasedAt) this.R.later.push({ due: addDays(a.date, r.int(10, 60)), jobId: j.id, kind: 'referral' });
    this.saveRng(); a.bus.emit('repair_collected', { jobId: j.id, satisfaction: s, price: j.price }); return { satisfaction: s, paid: j.price }; }
  private pull(a: Api, f: Field, toward: number, share: number) { const M = a.g.market; M.reputation[f] = clamp(M.reputation[f] + (toward - M.reputation[f]) * share, -100, 100); a.bus.emit('reputation_changed', { field: f, value: Math.round(M.reputation[f]) }); }
}
