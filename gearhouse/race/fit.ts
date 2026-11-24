// The fit of a design's parts (docs/systems/99 part 2, C2): whether its engine goes into its base's engine bay, its
// torque into the base's mounts and gearbox, its tyres under the arches. Each check gives one of three verdicts (doc 99
// 2-4): 'ok' (it fits), 'modified' (it fits with work: the work's cost, mass and reliability go into the car's
// figures, race/design.ts), 'blocked' (it cannot be built so) — and the fixes that would make it fit, each a change to
// the design the builder can apply (DesignPatch) with its rough cost. Pure; the fixes are found by trying them (the
// fit itself says when a change resolves a check), so a fix offered always does what it says.
//   The bays: each base's engine bay from its sheet (data/cars/spec/<id>.json engineBay.box, the space an engine and its
//   gearbox may fill). The NSX's is across the car: its C30A V6 sits transversely behind the seats with its gearbox at the
//   car's left end (the sheet; Honda's own cutaways); the F355's lengthwise: its F129B V8 longitudinal, the gearbox
//   behind it under the tail. A longer wheelbase lengthens the bay by as much (the stretch is between the arches, the
//   cabin kept: the bay takes it); a wider body widens it by twice the half-width added.
//   Across the car (a transverse bay): the engine's crank length and its gearbox at its end must fit across; with the
//   gearbox at the end the final drive sits half the engine's length off the centre line, and the base's half-shafts
//   take that only to 0.45 m (a V6's or a V8's; a V12's is 0.5-0.55). Past it the engine needs the Miura's arrangement
//   (Lamborghini's transverse V12, 1966): the gearbox behind the engine in its sump's casting, a bespoke transaxle:
//   'modified' (its cost, mass, reliability), the engine's crank length alone across the bay; 'blocked' when even that
//   does not fit across.
//   The arches: the room a tyre has is its base's own car's tyre (render/car/cars/<id>.kit.ts wheels, the same as its
//   design's: tests/fit.test.ts holds them together) plus 40 mm, plus the half-width added (the arches' lips go out
//   with the body: flared); its radius against the arch's (the sheet's arches, which the kit's lines use) with 15 mm
//   left for the suspension's travel. A tyre a little past either takes flared or rolled arches ('modified').
//   The mounts and the gearbox: each base's transaxle and engine mounts take its own engine's torque with a margin;
//   past it they are reinforced (an uprated gearbox: a little heavier, dearer, less durable the further past), up to
//   twice; past that no reinforcement in the kit takes it ('blocked').
import { LIMITS, applyPatch, gradeFor, DESIGN_NSX, DESIGN_F355, type BaseId, type Design, type DesignPatch } from '../core/design';
import { enginePackage, engineFigures, tyreR } from './designparts';
import nsxSheet from '../data/cars/spec/nsx.json';
import f355Sheet from '../data/cars/spec/f355.json';

export type Verdict = 'ok' | 'modified' | 'blocked';
export interface Fix { /** what it does (Korean) */ label: string; patch: DesignPatch; /** rough cost (the car's cost index points, race/design.ts) */ cost: number }
export interface FitResult {
  part: 'bayLength' | 'bayWidth' | 'bayHeight' | 'gearboxPlace' | 'mount' | 'gearbox' | 'archF' | 'archR';
  /** the part checked (Korean) */ name: string; verdict: Verdict; /** why (Korean) */ reason: string; fixes: Fix[];
  /** what a 'modified' verdict's work adds: kg (at `at`), the cost index, reliability points lost, drag area (m²) */
  mass: number; at: 'engine' | 'front' | 'rear'; cost: number; reliability: number; cdA: number }

type Orient = 'mid-longitudinal' | 'mid-transverse';
interface Bay { orient: Orient; length: number; width: number; height: number; /** Nm: the mounts', the gearbox's */ mount: number; gearbox: number }
const box = (s: { engineBay: { box: { x: number[]; y: number[]; z: number[] } } }) => { const b = s.engineBay.box; return { length: (b.x[1]! - b.x[0]!) / 1000, width: (b.y[1]! - b.y[0]!) / 1000, height: (b.z[1]! - b.z[0]!) / 1000 }; };
/** the bases' bays (m) and torque limits: the NSX's transaxle (its own 284 Nm) to 360, its mounts 400; the F355's
 *  (363 Nm) to 430, its mounts 450 [~: margins of the kind such parts carry, no maker's figure] */
export const BAYS: Record<BaseId, Bay> = {
  nsx: { orient: 'mid-transverse', ...box(nsxSheet), mount: 400, gearbox: 360 },
  f355: { orient: 'mid-longitudinal', ...box(f355Sheet), mount: 450, gearbox: 430 } };
/** the arches' radii (m), front and rear, from the sheets (the kit's lines take theirs from the same place) */
export const ARCHES: Record<BaseId, [number, number]> = {
  nsx: [nsxSheet.arches.front.radius / 1000, nsxSheet.arches.rear.radius / 1000], f355: [f355Sheet.arches.front.radius / 1000, f355Sheet.arches.rear.radius / 1000] };
/** the base's own car's tyres (mm): the room under its arches is set by them */
export const OWN_TYRES: Record<BaseId, [number, number]> = { nsx: DESIGN_NSX.kit.tyres, f355: DESIGN_F355.kit.tyres };
/** how much wider than its base's own tyre a tyre fits before the arch is flared (mm); the travel left above a tyre (m) */
export const ARCH_ROOM = 40, ARCH_TRAVEL = 0.015;
/** how far past its room a part may be and still be fitted with work (the engine's bay 10 %, a tyre 30 mm, the torque
 *  twice its limit) */
const OVER_BAY = 0.1, OVER_TYRE = 30, OVER_DIA = 0.03, OVER_TORQUE = 2;
/** a final drive at the end of a transverse engine sits this far off the centre line at most (m) */
const HALF_SHAFT = 0.45;

const mm = (m: number) => Math.round(m * 1000);
const none = { mass: 0, at: 'engine' as const, cost: 0, reliability: 0, cdA: 0 };
const worst = (a: Verdict, b: Verdict): Verdict => a === 'blocked' || b === 'blocked' ? 'blocked' : a === 'modified' || b === 'modified' ? 'modified' : 'ok';
const rank = { ok: 0, modified: 1, blocked: 2 } as const;

/** the engine's footprint in the bay (m): along the car, across it, its height; whether it needs the Miura's gearbox */
function footprint(d: Design) {
  const P = enginePackage(d), B = BAYS[d.body.base];
  if (B.orient === 'mid-longitudinal') return { along: P.length + P.box, across: P.width, height: P.height, miura: false, P };
  const miura = P.length / 2 + 0.1 > HALF_SHAFT;
  return { along: P.width + (miura ? 0.25 : 0), across: P.length + (miura ? 0 : P.boxEnd), height: P.height, miura, P }; }
/** the bay as the design stretches it (m) */
const bayOf = (d: Design) => { const B = BAYS[d.body.base]; return { length: B.length + d.body.wheelbase / 1000, width: B.width + 2 * d.body.width / 1000, height: B.height }; };
const overVerdict = (need: number, room: number): Verdict => need <= room ? 'ok' : need <= room * (1 + OVER_BAY) ? 'modified' : 'blocked';

/** every check, without the fixes */
function checks(d: Design): Omit<FitResult, 'fixes'>[] {
  const out: Omit<FitResult, 'fixes'>[] = [], F = footprint(d), bay = bayOf(d), B = BAYS[d.body.base], across = B.orient === 'mid-transverse';
  const orientName = across ? '가로 배치' : '세로 배치';
  // the bay: along the car, across, up
  { const v = overVerdict(F.along, bay.length), over = F.along - bay.length;
    out.push({ part: 'bayLength', name: '엔진룸 길이', verdict: v, ...none,
      reason: v === 'ok' ? `엔진${across ? '' : '과 변속기'} ${mm(F.along)} mm, 엔진룸 ${mm(bay.length)} mm (${orientName})` : `엔진${across ? '' : '과 변속기'}가 엔진룸보다 ${mm(over)} mm 깁니다 (${mm(F.along)} / ${mm(bay.length)} mm)${v === 'modified' ? ': 격벽을 깎고 배기를 다시 짜서 넣습니다' : ''}`,
      ...(v === 'modified' ? { mass: 10, cost: 6 + 60 * over / bay.length, reliability: 4 } : {}) }); }
  { const v = overVerdict(F.across, bay.width), over = F.across - bay.width, what = across ? `엔진${F.miura ? '' : '과 끝의 변속기'}` : '엔진 폭';
    out.push({ part: 'bayWidth', name: '엔진룸 폭', verdict: v, ...none,
      reason: v === 'ok' ? `${what} ${mm(F.across)} mm, 엔진룸 ${mm(bay.width)} mm` : `${what}가 엔진룸 폭보다 ${mm(over)} mm 넓습니다 (${mm(F.across)} / ${mm(bay.width)} mm)${v === 'modified' ? ': 휠하우스 안쪽을 깎아 넣습니다' : ''}`,
      ...(v === 'modified' ? { mass: 8, cost: 6 + 60 * over / bay.width, reliability: 3 } : {}) }); }
  { const v = overVerdict(F.height, bay.height), over = F.height - bay.height;
    out.push({ part: 'bayHeight', name: '엔진룸 높이', verdict: v, ...none,
      reason: v === 'ok' ? `엔진 높이 ${mm(F.height)} mm, 엔진룸 ${mm(bay.height)} mm` : `엔진이 엔진 덮개보다 ${mm(over)} mm 높습니다${v === 'modified' ? ': 덮개에 돌출부(스쿠프)를 냅니다' : ''}`,
      ...(v === 'modified' ? { mass: 3, cost: 3, reliability: 1, cdA: 0.01 } : {}) }); }
  if (across) out.push({ part: 'gearboxPlace', name: '변속기 배치', verdict: F.miura ? 'modified' : 'ok', ...none,
    reason: F.miura ? `가로 엔진이 길어(${mm(F.P.length)} mm) 끝에 변속기를 달면 종감속기가 중심에서 너무 멉니다: 미우라처럼 엔진 뒤 섬프 안에 변속기를 넣는 전용 변속기를 씁니다` : '변속기를 엔진 끝에 답니다 (NSX와 같은 배치)',
    ...(F.miura ? { mass: 20, cost: 10, reliability: 4 } : {}) });
  // the torque
  const T = engineFigures(d).torquePeak;
  for (const [part, name, limit] of [['mount', '엔진 마운트', B.mount], ['gearbox', '변속기', B.gearbox]] as const) {
    const r = T / limit, v: Verdict = r <= 1 ? 'ok' : r <= OVER_TORQUE ? 'modified' : 'blocked';
    out.push({ part, name, verdict: v, ...none,
      reason: v === 'ok' ? `최대 토크 ${Math.round(T)} Nm, 한계 ${limit} Nm` : `최대 토크 ${Math.round(T)} Nm가 바탕의 ${name} 한계 ${limit} Nm를 ${Math.round((r - 1) * 100)} % 넘습니다${v === 'modified' ? (part === 'mount' ? ': 마운트를 보강합니다' : ': 강화 변속기(기어·케이스·클러치)를 씁니다') : `: 한계의 ${OVER_TORQUE}배를 넘는 보강은 없습니다`}`,
      ...(v === 'modified' ? part === 'mount' ? { mass: 4, cost: 2 + 4 * (r - 1), reliability: 1 + 2 * (r - 1) } : { mass: 10 + 20 * (r - 1), cost: 4 + 20 * (r - 1), reliability: 2 + 8 * (r - 1) } : {}) }); }
  // the tyres under the arches
  const own = OWN_TYRES[d.body.base], archR = ARCHES[d.body.base];
  for (const [i, part, name, at] of [[0, 'archF', '앞 휠아치', 'front'], [1, 'archR', '뒤 휠아치', 'rear']] as const) {
    const w = d.kit.tyres[i], room = own[i] + ARCH_ROOM + d.body.width, over = w - room, vw: Verdict = over <= 0 ? 'ok' : over <= OVER_TYRE ? 'modified' : 'blocked';
    const r = tyreR(w, d.kit.rim), short = ARCH_TRAVEL - (archR[i] - r), vd: Verdict = short <= 0 ? 'ok' : short <= OVER_DIA ? 'modified' : 'blocked', v = worst(vw, vd);
    const why: string[] = [];
    if (vw !== 'ok') why.push(`타이어 ${w} mm가 아치의 여유(${room} mm)보다 ${over} mm 넓습니다`);
    if (vd !== 'ok') why.push(`타이어 반지름 ${mm(r)} mm가 아치(${mm(archR[i])} mm)에 서스펜션이 움직일 틈을 ${mm(short)} mm 덜 남깁니다`);
    out.push({ part, name, verdict: v, ...none, at,
      reason: v === 'ok' ? `타이어 ${w} mm (여유 ${room} mm), 반지름 ${mm(r)} mm (아치 ${mm(archR[i])} mm)` : why.join('; ') + (v === 'modified' ? `: ${vw !== 'ok' ? '펜더를 넓히고(오버펜더)' : ''}${vd !== 'ok' ? '아치 가장자리를 말아 올려' : ''} 넣습니다` : ''),
      ...(v === 'modified' ? { mass: (vw !== 'ok' ? 3 : 0) + (vd !== 'ok' ? 1 : 0), cost: (vw !== 'ok' ? 2 : 0) + (vd !== 'ok' ? 1.5 : 0), reliability: 0, cdA: vw !== 'ok' ? 0.004 : 0 } : {}) }); }
  return out; }

/** the first change of a series that brings a check to `want` (or better); null when none does */
function search(d: Design, part: FitResult['part'], want: Verdict, steps: Iterable<DesignPatch>): DesignPatch | null {
  for (const p of steps) { const c = checks(applyPatch(d, p)).find(x => x.part === part); if (c && rank[c.verdict] <= rank[want]) return p; }
  return null; }
function* range(a: number, b: number, step: number) { for (let v = a; step > 0 ? v <= b : v >= b; v += step) yield v; }

/** the fixes for a check that is not 'ok': to 'ok', and for a 'blocked' one also to 'modified' where that is cheaper */
function fixesFor(d: Design, c: Omit<FitResult, 'fixes'>): Fix[] {
  if (c.verdict === 'ok') return [];
  const out: Fix[] = [], targets: Verdict[] = c.verdict === 'blocked' ? ['ok', 'modified'] : ['ok'];
  const add = (f: Fix | null) => { if (f && !out.some(x => JSON.stringify(x.patch) === JSON.stringify(f.patch))) out.push(f); };
  const B = d.body;
  for (const want of targets) {
    const tag = want === 'ok' ? '' : ' (개조 장착)';
    if (c.part === 'bayLength') {
      const p = search(d, c.part, want, (function* () { for (const v of range(B.wheelbase + 10, LIMITS.wheelbase[1], 10)) yield { body: { wheelbase: v } }; })());
      if (p) add({ label: `휠베이스 +${p.body!.wheelbase! - B.wheelbase} mm${tag}`, patch: p, cost: 0.012 * (p.body!.wheelbase! - B.wheelbase) }); }
    if (c.part === 'bayWidth') {
      const p = search(d, c.part, want, (function* () { for (const v of range(B.width + 5, LIMITS.width[1], 5)) yield { body: { width: v } }; })());
      if (p) add({ label: `차체 폭 한쪽 +${p.body!.width! - B.width} mm${tag}`, patch: p, cost: 0.03 * (p.body!.width! - B.width) }); }
    if (c.part === 'bayHeight') {
      if (d.engine.sump === 'wet' && gradeFor('sump', 'dry') <= d.engine.grade) add(search(d, c.part, want, [{ engine: { sump: 'dry' } }]) ? { label: `드라이 섬프 (엔진을 70 mm 낮춤)${tag}`, patch: { engine: { sump: 'dry' } }, cost: 3 } : null);
      if (d.engine.intake !== 'single') add(search(d, c.part, want, [{ engine: { intake: 'single' } }]) ? { label: `단일 스로틀 흡기 (낮은 흡기)${tag}`, patch: { engine: { intake: 'single' } }, cost: 0 } : null); }
    if (c.part === 'mount' || c.part === 'gearbox') {
      if (d.engine.turbo) { const p = search(d, c.part, want, (function* () { for (const v of range(Math.round((d.engine.boost - 0.05) * 100) / 100, LIMITS.boost[0], -0.05)) yield { engine: { boost: Math.round(v * 100) / 100 } }; })());
        if (p) add({ label: `부스트 ${p.engine!.boost!.toFixed(2)} bar로 낮춤${tag}`, patch: p, cost: 0 }); }
      const p = search(d, c.part, want, (function* () { for (const v of range(d.engine.cc - 100, LIMITS.cc[0], -100)) yield { engine: { cc: v } }; })());
      if (p) add({ label: `배기량 ${p.engine!.cc!.toLocaleString()} cc로 줄임${tag}`, patch: p, cost: 0 }); }
    if (c.part === 'archF' || c.part === 'archR') {
      const i = c.part === 'archF' ? 0 : 1, T = d.kit.tyres, tyre = (w: number): DesignPatch => ({ kit: { tyres: (i ? [T[0], w] : [w, T[1]]) as [number, number] } });
      const n = search(d, c.part, want, (function* () { for (const w of range(T[i] - 5, LIMITS.tyre[0], -5)) yield tyre(w); })());
      if (n) add({ label: `${i ? '뒤' : '앞'} 타이어 ${n.kit!.tyres![i]} mm로${tag}`, patch: n, cost: 0 });
      const p = search(d, c.part, want, (function* () { for (const v of range(B.width + 5, LIMITS.width[1], 5)) yield { body: { width: v } }; })());
      if (p) add({ label: `차체 폭 한쪽 +${p.body!.width! - B.width} mm (아치가 함께 넓어짐)${tag}`, patch: p, cost: 0.03 * (p.body!.width! - B.width) });
      const r = search(d, c.part, want, ([16, 17, 18] as const).filter(x => x !== d.kit.rim).map(x => ({ kit: { rim: x } })));
      if (r) add({ label: `${r.kit!.rim}″ 림${tag}`, patch: r, cost: 0 }); }
    // another base whose bay takes the engine as it is
    if (c.part === 'bayLength' || c.part === 'bayWidth' || c.part === 'gearboxPlace') {
      const other: BaseId = B.base === 'nsx' ? 'f355' : 'nsx', p = { body: { base: other } }, o = checks(applyPatch(d, p)).filter(x => x.part.startsWith('bay') || x.part === 'gearboxPlace');
      if (o.every(x => rank[x.verdict] <= rank[want])) add({ label: `${other === 'nsx' ? 'NSX' : 'F355'} 바탕 (${BAYS[other].orient === 'mid-transverse' ? '가로' : '세로'} 엔진룸)${tag}`, patch: p, cost: 0 }); }
  }
  return out.slice(0, 4); }

/** the design's fit, every check (the 'ok' ones too), each with its fixes */
export function fit(d: Design): FitResult[] { return checks(d).map(c => ({ ...c, fixes: fixesFor(d, c) })); }
/** the worst verdict of a design's fit */
export const fitVerdict = (r: FitResult[]): Verdict => r.reduce<Verdict>((a, x) => worst(a, x.verdict), 'ok');
/** what the 'modified' checks' work adds all told: kg (each at its place), the cost index, reliability points, drag area */
export function fitPenalty(d: Design): { mass: { m: number; at: FitResult['at'] }[]; cost: number; reliability: number; cdA: number } {
  const c = checks(d).filter(x => x.verdict === 'modified');
  return { mass: c.map(x => ({ m: x.mass, at: x.at })), cost: c.reduce((s, x) => s + x.cost, 0), reliability: c.reduce((s, x) => s + x.reliability, 0), cdA: c.reduce((s, x) => s + x.cdA, 0) }; }
