// Designs, builds and cars (system design 04, the slice's core). A design is drawn in hours that grow with how far
// it departs from its base car; a car is built in nine steps that wait for the step before and for materials;
// each step ends with a quality from the hands and the materials that made it, and may leave a defect behind.
import type { DateStr } from './calendar';
import type { Api, Simulation, System } from './sim';
import type { Supply } from './supply';
import type { Task } from './state';

export type OrderType = 'body_only' | 'bought' | 'built';
export interface StepData { id: string; skill: string; /** cannot be done on a rainy day */ noRain?: boolean; hours: Record<OrderType, number>; sized?: boolean; after: string[]; needs: Partial<Record<OrderType | 'all', Record<string, number>>>; visible: number; hidden: number; defects: string[] }
export interface BuildData { toolLevel: number; /** a step below this quality may leave a fault; the chance grows over the span */ defect: { below: number; span: number }; repeatFactor: number[]; design: { baseHours: Record<OrderType, number>; perProportion: number; perPart: number; perPanel: number; mockupHours: number }; steps: StepData[] }
export interface Design { id: string; name: string; baseCar: string; orderType: OrderType; /** a working vehicle (delivery van, pickup, official car) rather than a private car */ use?: 'passenger' | 'utility';
  /** body size against a mid-size car (1 = mid-size) */
  size: number;
  /** how far the body departs from its base car: proportions 0..1, parts swapped, panels reshaped by hand */
  effort: { proportion: number; parts: number; panels: number };
  state: 'drawing' | 'ready'; mockupDone: boolean; built: number }
export interface Defect { step: string; kind: string; severity: number; found: boolean; fixed: boolean }
export interface BuildStep { step: string; taskId: string; quality?: number; material?: number; cost: number; shortTold?: boolean; heldTold?: boolean }
export interface Build { id: number; designId: string; orderId?: number; started: DateStr; steps: BuildStep[]; state: 'building' | 'done' }
export interface Car { id: number; buildId: number; designId: string; built: DateStr; quality: { visible: number; hidden: number }; defects: Defect[];
  /** money actually spent on it: materials and employees' wages for their hours; the founder's own hours are counted apart */
  cost: number; ownHours: number }
export interface ShopState { designs: Record<string, Design>; builds: Build[]; cars: Car[]; nextId: number; /** better tools than the shop began with (bought at auctions) */ toolBonus?: number }

export class Shop {
  constructor(private sim: Simulation, private data: BuildData, private supply: Supply) {}
  private get S() { return this.sim.g.shop; }

  designHours(d: Pick<Design, 'orderType' | 'effort'>): number { const D = this.data.design; return Math.round(D.baseHours[d.orderType] * (1 + d.effort.proportion * D.perProportion + d.effort.parts * D.perPart + d.effort.panels * D.perPanel)); }
  /** hours of each step for one more car of this design */
  stepHours(d: Design, st: StepData): number { const rf = this.data.repeatFactor, k = rf[Math.min(d.built, rf.length - 1)]!; return Math.round(st.hours[d.orderType] * (st.sized ? d.size * (1 + d.effort.panels * 0.04) : 1) * k); }
  buildHours(d: Design): number { return this.data.steps.reduce((t, st) => t + this.stepHours(d, st), 0) + (d.mockupDone ? 0 : this.data.design.mockupHours); }
  /** sets of each part one car of this design takes */
  bom(d: Design): Record<string, number> { const out: Record<string, number> = {}; for (const st of this.data.steps) for (const [part, n] of Object.entries({ ...st.needs.all, ...st.needs[d.orderType] })) out[part] = (out[part] ?? 0) + n * (st.sized ? d.size : 1); return out; }

  /** a design the founder already has (starting designs) */
  addDesign(d: Omit<Design, 'state' | 'mockupDone' | 'built'>, ready = true): Design { const full: Design = { ...d, state: ready ? 'ready' : 'drawing', mockupDone: ready, built: 0 }; this.S.designs[d.id] = full; return full; }
  /** start drawing a new design: a task in design hours */
  startDesign(d: Omit<Design, 'state' | 'mockupDone' | 'built'>): Design { const full = this.addDesign(d, false);
    this.sim.addTask({ id: 'design:' + d.id, label: 'design ' + d.name, skill: 'design', hoursNeeded: this.designHours(full), quiet: true }); return full; }

  /** start one car: the steps become tasks that wait for their turn and their materials */
  startBuild(designId: string, orderId?: number): Build { const d = this.S.designs[designId]; if (!d || d.state !== 'ready') throw new Error('design not ready: ' + designId);
    const b: Build = { id: this.S.nextId++, designId, orderId, started: this.sim.g.clock.date, steps: [], state: 'building' };
    if (!d.mockupDone) { const id = `build:${b.id}:mockup`; this.sim.addTask({ id, label: 'mock-up and formers', skill: 'wood', hoursNeeded: this.data.design.mockupHours, quiet: true }); b.steps.push({ step: 'mockup', taskId: id, cost: 0 }); }
    for (const st of this.data.steps) { const id = `build:${b.id}:${st.id}`, h = this.stepHours(d, st);
      this.sim.addTask({ id, label: st.id, skill: st.skill, hoursNeeded: Math.max(h, 0.001), quiet: true, blocked: true }); if (h === 0) { const t = this.sim.g.tasks[id]!; t.done = true; t.hoursDone = t.hoursNeeded; }
      b.steps.push(h === 0 ? { step: st.id, taskId: id, cost: 0, quality: -1 } : { step: st.id, taskId: id, cost: 0 }); }
    this.S.builds.push(b); return b; }

  system(): System { return { id: 'shop', morning: a => { this.release(a); this.hold(a); }, evening: a => { this.finish(a); this.release(a); } }; }

  /** better tools come into the shop (an auction, a purchase), up to a ceiling */
  improveTools(by: number, max: number): number { this.S.toolBonus = Math.min(max, (this.S.toolBonus ?? 0) + by); return this.S.toolBonus; }
  /** paint does not dry in the rain: the step waits, and the customer is not told the car is late for those days */
  private hold(a: Api): void { const rain = a.g.weather?.today === 'rain';
    for (const b of this.S.builds) { if (b.state !== 'building') continue; for (const bs of b.steps) { const st = this.data.steps.find(s => s.id === bs.step), t = a.g.tasks[bs.taskId]; if (!st?.noRain || !t || t.done || t.blocked) continue;
        if (!rain) { delete t.held; continue; } t.held = 'rain'; if (a.workday) a.bus.emit('work_held', { buildId: b.id, orderId: b.orderId, reason: 'rain' });
        if (!bs.heldTold) { bs.heldTold = true; a.raise('paint_held', 'notice', { buildId: b.id, step: st.id, orderId: b.orderId }); } } } }

  /** let steps start whose earlier steps are done and whose materials are in the store */
  private release(a: Api): void { const tasks = a.g.tasks;
    for (const b of this.S.builds) { if (b.state !== 'building') continue; const d = this.S.designs[b.designId]!, done = (s: string) => { const x = b.steps.find(q => q.step === s); return !x || tasks[x.taskId]!.done; };
      for (const bs of b.steps) { const t = tasks[bs.taskId]!, st = this.data.steps.find(s => s.id === bs.step); if (!st || !t.blocked || t.done) continue;
        if (!(done('mockup') && st.after.every(done))) continue;
        const needs = Object.entries({ ...st.needs.all, ...st.needs[d.orderType] }).map(([part, n]) => [part, n * (st.sized ? d.size : 1)] as [string, number]), short = needs.find(([part, n]) => this.supply.stock(part) < n - 1e-9);
        if (short) { if (!bs.shortTold) { bs.shortTold = true; a.bus.emit('stock_short', { buildId: b.id, step: st.id, part: short[0] }); a.raise('stock_short', 'notice', { buildId: b.id, step: st.id, part: short[0] }); } continue; }
        let q = 0, n = 0; for (const [part, qty] of needs) { const got = this.supply.take(part, qty)!; q += got.quality; n++; bs.cost += got.cost; }
        bs.material = n ? q / n : undefined; t.blocked = false; } } }

  /** steps and designs finished today: their quality, their defects, and the car when the last step is done */
  private finish(a: Api): void { const g = a.g;
    for (const d of Object.values(this.S.designs)) if (d.state === 'drawing' && g.tasks['design:' + d.id]?.done) { d.state = 'ready'; a.bus.emit('design_finalized', { designId: d.id }); a.raise('design_finalized', 'notice', { designId: d.id, buildHours: this.buildHours(d), bom: this.bom(d) }); }
    for (const b of this.S.builds) { if (b.state !== 'building') continue; const d = this.S.designs[b.designId]!;
      for (const bs of b.steps) { const t = g.tasks[bs.taskId]!; if (!t.done || bs.quality != null) continue;
        if (bs.step === 'mockup') { bs.quality = -1; d.mockupDone = true; a.raise('build_step_done', 'notice', { buildId: b.id, step: 'mockup' }); continue; }
        const st = this.data.steps.find(s => s.id === bs.step)!, q = this.stepQuality(a, t, st, bs); bs.quality = q; bs.cost += this.wageCost(t);
        a.bus.emit('build_step_done', { buildId: b.id, step: st.id, quality: q }); a.raise('build_step_done', 'notice', { buildId: b.id, step: st.id, quality: q }); }
      if (b.steps.every(s => s.quality != null)) this.complete(a, b, d); } }

  private stepQuality(a: Api, t: Task, st: StepData, bs: BuildStep): number { const g = a.g; let hours = 0, skill = 0;
    for (const [who, h] of Object.entries(t.by ?? {})) { const p = g.people[who === 'founder' ? g.founderId ?? '' : who]; hours += h; skill += h * (p?.skills[st.skill] ?? 50); }
    const s = hours ? skill / hours : 50, tired = g.founder.fatigue > 0 ? 5 : 0;
    return Math.round(Math.max(5, Math.min(99, s * 0.6 + (bs.material ?? 65) * 0.3 + Math.min(95, this.data.toolLevel + (a.g.shop.toolBonus ?? 0)) * 0.1 - tired + (a.rng.float() - 0.5) * 12))); }
  private wageCost(t: Task): number { const g = this.sim.g; let c = 0; for (const [who, h] of Object.entries(t.by ?? {})) { const e = g.employees.find(x => x.personId === who); if (e) c += h * e.wage / (this.sim.employeeHours * 6); } return Math.round(c * 100) / 100; }

  private complete(a: Api, b: Build, d: Design): void { const g = a.g, defects: Defect[] = []; let vis = 0, vw = 0, hid = 0, hw = 0, cost = 0, own = 0;
    for (const bs of b.steps) { const st = this.data.steps.find(s => s.id === bs.step), t = g.tasks[bs.taskId]!; cost += bs.cost; own += t.by?.[g.founderId ?? 'founder'] ?? t.by?.founder ?? 0; if (!st || bs.quality == null || bs.quality < 0) continue;
      vis += bs.quality * st.visible; vw += st.visible; hid += bs.quality * st.hidden; hw += st.hidden;
      // poor work leaves faults behind: the lower the quality, the likelier and the worse
      const chance = Math.max(0.02, Math.min(0.8, (this.data.defect.below - bs.quality) / this.data.defect.span)); if (st.defects.length && a.rng.float() < chance) { const kind = st.defects[a.rng.int(0, st.defects.length - 1)]!, severity = bs.quality < 45 ? 3 : bs.quality < 60 ? 2 : 1;
        defects.push({ step: st.id, kind, severity, found: false, fixed: false }); a.bus.emit('defect_created', { buildId: b.id, step: st.id, kind, severity }); } }
    const car: Car = { id: this.S.nextId++, buildId: b.id, designId: d.id, built: a.date, quality: { visible: Math.round(vis / Math.max(1, vw)), hidden: Math.round(hid / Math.max(1, hw)) }, defects, cost: Math.round(cost * 100) / 100, ownHours: Math.round(own) };
    b.state = 'done'; d.built++; this.S.cars.push(car); for (const bs of b.steps) delete g.tasks[bs.taskId];
    a.bus.emit('car_built', { carId: car.id, buildId: b.id, designId: d.id }); a.raise('car_built', 'notice', { carId: car.id, quality: car.quality, cost: car.cost, ownHours: car.ownHours }); }
}
