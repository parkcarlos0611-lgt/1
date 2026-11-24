// The parts builder (docs/systems/98_alpha_interface_and_builder_plan.md, B3 and B4): a car's design (core/design.ts)
// edited on a studio turntable. The live renderer (render/live/renderer.ts, as the drive page and the photo mode use it:
// its sun and shadows, the photographed sky, the PBR textures, the looks) draws the design's car (render/car/design.ts),
// built again only when the body's fields change and a moment after a slider rests. Left: the choices in six steps,
// taken in a guided order with any step open at any time (docs/systems/98 section 11: the base, the engine and drive,
// the body's shapes, the kit, the paint, then the check and the test drive; the engine's details greyed out, with the
// reason, where its development grade does not allow them; a step marked where a fit check concerning it is not
// clean, so a change upstream shows what it broke further on); right: the figures
// worked out from the design (race/design.ts) as it changes, its class from them, its cost and reliability
// (placeholders until B5), the fit of its parts (race/fit.ts: each check's verdict and the fixes, applied by a click),
// and what the drive page measured of it. Designs are kept in this browser, carried as JSON files, and sent to
// the drive page in its link ("시험 주행"), which drives them with the physics made from them and records its runs.
import { LiveRenderer } from '../render/live/renderer';
import { loadSky } from '../render/live/groundtex';
import { studioFloor } from '../render/live/studio';
import type { Mesh } from '../render/car/mesh';
import { designMesh, designChoices, withoutParts } from '../render/car/design';
import { designSpec, designFigures, type DesignFigures } from '../race/design';
import type { FitResult } from '../race/fit';
import { LIMITS, GRADE_NAME, GRADES, gradeLock, gradeBoost, gradeRedline, normalise, applyPatch, type BaseId, type Design, type NoseKind, type FrontKind, type TailKind, type WheelKind,
  type Grade, type Structure, type Panels, type Intake, type Compression, type Sump, type Block, type Turbos, type Interior } from '../core/design';
import { currentDesign, keepCurrent, savedDesigns, saveDesign, deleteDesign, fromPreset, encodeDesign, designJson, parseDesign, measured, designSig, newId, KEYS, type KeyStore } from '../core/designstore';
import texAlb from '../assets/textures/pbr/albedo.jpg';
import texNor from '../assets/textures/pbr/normal.jpg';
import texRgh from '../assets/textures/pbr/rough.jpg';
import texMeta from '../assets/textures/pbr/pbr.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const store: KeyStore | null = (() => { try { return localStorage; } catch { return null; } })();
let D: Design = currentDesign(store) ?? fromPreset('nsx');

// ---- the names on the page ----
const BASE_NAME: Record<BaseId, string> = { nsx: 'NSX 바탕', f355: 'F355 바탕' };
const KIND_NAME: Record<string, string> = { round: '둥근 코', pointed: '뾰족한 코', plain: '평평한 앞면', sunk: '램프가 들어간 앞면', frame: '테두리 꼬리', roundLamps: '둥근 램프 꼬리', ducktail: '덕테일',
  fiveSpoke: '5스포크', disc: '디스크', star: '스타' };
const PAINTS = ['#b0121b', '#f5c300', '#1d3f8f', '#f2f0ea', '#151515', '#2f6b3a', '#9aa1a6', '#d8661c'];

// ---- the controls: each reads its value from the design and writes it back; all are refreshed when a design is loaded ----
const syncs: (() => void)[] = [];
const field = (label: string, el: HTMLElement, out?: HTMLElement) => { const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('label'); l.textContent = label; if (out) l.append(out); r.append(l, el); return r; };
/** a choice of buttons; `lock` greys a value out with its reason (shown under the buttons: a phone has no hover) */
function seg<T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, lock?: (v: T) => string | null): HTMLElement {
  const box = document.createElement('div'); box.className = 'seg'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  const bs = opts.map(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.addEventListener('click', () => { if (lock?.(v)) return; set(v); changed(); }); box.append(b); return [v, t, b] as const; });
  const why = document.createElement('small'); why.className = 'lock';
  syncs.push(() => { const locked: string[] = [];
    for (const [v, t, b] of bs) { const L = lock?.(v) ?? null; b.setAttribute('aria-pressed', String(v === get())); b.disabled = !!L; b.title = L ?? ''; if (L) locked.push(`${t}: ${L}`); }
    why.textContent = locked.join(' · '); why.hidden = !locked.length; });
  const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.className = 'lab'; l.textContent = label; r.append(l, box, why); return r; }
function range(label: string, [a, b]: readonly [number, number], step: number, get: () => number, set: (v: number) => void, show: (v: number) => string, id?: string): HTMLElement {
  const i = document.createElement('input'); i.type = 'range'; i.min = String(a); i.max = String(b); i.step = String(step); if (id) i.id = id; const v = document.createElement('span'); v.className = 'v';
  i.addEventListener('input', () => { set(+i.value); v.textContent = show(+i.value); changed(); }); syncs.push(() => { i.value = String(get()); v.textContent = show(get()); }); return field(label, i, v); }
function check(label: string, get: () => boolean, set: (v: boolean) => void, id?: string): HTMLElement {
  const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; if (id) i.id = id; l.append(i, ` ${label}`);
  i.addEventListener('change', () => { set(i.checked); changed(); }); syncs.push(() => { i.checked = get(); }); return l; }
function select<T extends string>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, id?: string): HTMLElement {
  const s = document.createElement('select'); if (id) s.id = id; for (const [v, t] of opts) s.add(new Option(t, v)); s.addEventListener('change', () => { set(s.value as T); changed(); }); syncs.push(() => { s.value = get(); }); return field(label, s); }
const note = (t: string) => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; return p; };
const h2 = (t: string) => { const h = document.createElement('h2'); h.textContent = t; return h; };
const sign = (v: number, u: string) => `${v > 0 ? '+' : ''}${v} ${u}`;

// ---- the steps: the design in a guided order (going back always allowed, and so is going ahead); the saved designs
// and the files on a page of their own, opened from the bar at the top ----
type StepId = 'chassis' | 'engine' | 'body' | 'kit' | 'paint' | 'check';
const STEPS: [StepId, string][] = [['chassis', '차대'], ['engine', '엔진·구동계'], ['body', '차체 형태'], ['kit', '장비'], ['paint', '칠·마감'], ['check', '검사·시험 주행']];
/** the step each fit check answers to: the engine bay, its mounts and the gearbox the engine's and the drive's, the
 *  arches the tyres' (their fixes may reach into other steps: a longer wheelbase, a wider body) */
const FIT_STEP: Record<FitResult['part'], StepId> = { bayLength: 'engine', bayWidth: 'engine', bayHeight: 'engine', gearboxPlace: 'engine', mount: 'engine', gearbox: 'engine', archF: 'kit', archR: 'kit' };
const stepNo = (id: StepId) => STEPS.findIndex(s => s[0] === id);
const pane = new Map<string, HTMLElement>(), stepBtn = new Map<StepId, HTMLButtonElement>();
for (const id of [...STEPS.map(s => s[0]), 'files']) { const p = document.createElement('section'); p.className = 'pane'; p.dataset.tab = id; $('panes').append(p); pane.set(id, p); }
for (const [id, name] of STEPS) { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.dataset.step = id;
  b.innerHTML = `<span class="n">${stepNo(id) + 1}</span><span class="t">${name.replace('·', '·<wbr>')}</span><span class="badge" hidden></span>`;
  b.addEventListener('click', () => go(id)); li.append(b); $('steps').append(li); stepBtn.set(id, b); }
const add = (tab: string, ...els: HTMLElement[]) => pane.get(tab)!.append(...els);
/** where each design was left (its step, the steps seen), kept in this browser */
const STEP_KEY = 'gearhouse.builder.step.v1';
let step: StepId = 'chassis', onFiles = false, seen = new Set<StepId>(['chassis']);
const isStep = (x: unknown): x is StepId => STEPS.some(s => s[0] === x);
function keptSteps(): Record<string, { step: StepId; seen: StepId[] }> { try { const o: unknown = JSON.parse(store?.getItem(STEP_KEY) ?? '{}'); return o && typeof o === 'object' ? o as Record<string, { step: StepId; seen: StepId[] }> : {}; } catch { return {}; } }
function keepStep() { try { const rest = Object.entries(keptSteps()).filter(([k]) => k !== D.id).slice(0, 99); store?.setItem(STEP_KEY, JSON.stringify(Object.fromEntries([[D.id, { step, seen: [...seen] }], ...rest]))); } catch { /* not kept */ } }
/** the step a design was left at (a new one starts at the first) */
function restoreStep() { const k = keptSteps()[D.id]; step = k && isStep(k.step) ? k.step : 'chassis'; seen = new Set([...(Array.isArray(k?.seen) ? k.seen.filter(isStep) : []), step]); onFiles = false; showStep(); }
function go(id: StepId | 'files') { if (id === 'files') onFiles = true; else { onFiles = false; step = id; seen.add(id); keepStep(); } showStep(); $('panes').scrollTop = 0; }
function showStep() { const at = onFiles ? 'files' : step;
  for (const [k, q] of pane) q.classList.toggle('on', k === at);
  for (const [id, b] of stepBtn) { const now = !onFiles && id === step, done = seen.has(id) && !now;
    if (now) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); b.classList.toggle('done', done); b.classList.toggle('unseen', !seen.has(id)); b.dataset.state = now ? '지금 단계' : done ? '본 단계' : '아직 안 본 단계'; label(id); }
  const i = stepNo(step), prev = $<HTMLButtonElement>('prev'), next = $<HTMLButtonElement>('next');
  prev.textContent = onFiles ? '◀ 설계로 돌아가기' : '◀ 이전'; prev.disabled = !onFiles && i === 0; next.hidden = onFiles || i === STEPS.length - 1;
  $('stepof').textContent = onFiles ? '저장·불러오기' : `${i + 1} / ${STEPS.length} · ${STEPS[i]![1]}`;
  $('openFiles').setAttribute('aria-pressed', String(onFiles));
  // the step in sight in its bar (the bar scrolls by itself on a narrow drawer)
  const bar = $('steps'), b = stepBtn.get(step)!.parentElement!; if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2; }
/** a step's name for a screen reader: its number, its state and its fit marks */
function label(id: StepId) { const b = stepBtn.get(id)!, badge = b.querySelector<HTMLElement>('.badge')!; b.setAttribute('aria-label', `${stepNo(id) + 1}단계 ${STEPS[stepNo(id)]![1]} (${b.dataset.state}${badge.hidden ? '' : `, ${badge.title}`})`); }
$('prev').addEventListener('click', () => { if (onFiles) go(step); else go(STEPS[Math.max(0, stepNo(step) - 1)]![0]); });
$('next').addEventListener('click', () => go(STEPS[Math.min(STEPS.length - 1, stepNo(step) + 1)]![0]));
$('openFiles').addEventListener('click', () => { if (onFiles) go(step); else { go('files'); drawer(true); } });

// 차대: the base, its stretch, its structure
add('chassis', seg<BaseId>('바탕 차대', [['nsx', BASE_NAME.nsx], ['f355', BASE_NAME.f355]], () => D.body.base, v => { if (v === D.body.base) return;
    // the tyres and the rims follow the base where they were its own
    const was = fromPreset(D.body.base), to = fromPreset(v); if (D.kit.tyres[0] === was.kit.tyres[0] && D.kit.tyres[1] === was.kit.tyres[1]) D.kit.tyres = [...to.kit.tyres]; if (D.kit.rim === was.kit.rim) D.kit.rim = to.kit.rim; D.body.base = v; }),
  note('바탕은 차체 패널의 치수를 정합니다. 코·앞면·꼬리·휠은 두 바탕 모두에 끼울 수 있습니다.'),
  range('휠베이스', LIMITS.wheelbase, 10, () => D.body.wheelbase, v => { D.body.wheelbase = v; }, v => sign(v, 'mm'), 'wheelbase'),
  range('폭 (한쪽)', LIMITS.width, 5, () => D.body.width, v => { D.body.width = v; }, v => sign(v, 'mm'), 'width'),
  seg<Structure>('구조 소재 (모노코크·프레임)', [['steel', '강철'], ['hss', '고장력강'], ['aluminium', '알루미늄'], ['honeycomb', '알루미늄 허니콤'], ['cfrp', '탄소섬유']], () => D.body.structure, v => { D.body.structure = v; }),
  note('같은 강성에서 강철 대비 무게: 고장력강 0.9, 알루미늄 0.6, 허니콤 0.5, 탄소섬유 0.45. 가벼울수록 비싸고, 탄소섬유는 수작업입니다.'),
  seg<Panels>('패널 소재', [['steel', '강철'], ['aluminium', '알루미늄'], ['frp', 'FRP'], ['cfrp', '탄소섬유']], () => D.body.panels, v => { D.body.panels = v; }),
  note('패널 무게: 알루미늄 0.55, FRP 0.6 (소량 생산에 싸다), 탄소섬유 0.4. 강철은 수리가 쉽습니다.'),
  seg<Interior>('실내 사양', [['light', '경량 (얇은 유리, 가벼운 시트)'], ['standard', '표준'], ['luxury', '고급 (가죽, 에어컨)']], () => D.kit.interior, v => { D.kit.interior = v; }));
// ③ 차체 형태: the panels' kinds; ⑤ 칠·마감: the paint
{ const ch = designChoices('nsx'), kinds = <T extends string>(ks: T[]) => ks.map(k => [k, KIND_NAME[k] ?? k] as [T, string]);
  add('body', seg<NoseKind>('코', kinds(ch.nose), () => D.body.nose, v => { D.body.nose = v; }), seg<FrontKind>('앞면', kinds(ch.front), () => D.body.front, v => { D.body.front = v; }),
    seg<TailKind>('꼬리', kinds(ch.tail), () => D.body.tail, v => { D.body.tail = v; }), seg<WheelKind>('휠', kinds(ch.wheel), () => D.body.wheel, v => { D.body.wheel = v; }));
  const sw = document.createElement('div'); sw.className = 'swatches'; const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'paint'; pick.setAttribute('aria-label', '직접 고르기');
  const bs = PAINTS.map(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c); b.addEventListener('click', () => { D.body.paint = c; changed(); }); sw.append(b); return [c, b] as const; });
  pick.addEventListener('input', () => { D.body.paint = pick.value; changed(); }); sw.append(pick);
  syncs.push(() => { pick.value = D.body.paint; for (const [c, b] of bs) b.setAttribute('aria-pressed', String(c === D.body.paint.toLowerCase())); });
  add('paint', field('도장 색', sw), range('광택', [0, 1], 0.05, () => D.body.gloss, v => { D.body.gloss = v; }, v => v.toFixed(2), 'gloss')); }
// ② 엔진·구동계: the grade first; the details it does not allow greyed out with the reason
{ const E = () => D.engine, lk = <K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo'>(k: K) => (v: Design['engine'][K]) => gradeLock(E().grade, k, v);
  const boost = range('부스트', LIMITS.boost, 0.05, () => E().boost, v => { E().boost = v; }, v => `${v.toFixed(2)} bar`, 'boost'), redline = range('레드라인', LIMITS.redline, 100, () => E().redline, v => { E().redline = v; }, v => `${v.toLocaleString()} rpm`, 'redline');
  const vtec = check('VTEC (두 가지 캠 프로필)', () => E().vtec, v => { E().vtec = v; }, 'vtec'), ic = check('인터쿨러', () => E().intercooler, v => { E().intercooler = v; }, 'intercooler');
  const gradeNote = note('');
  add('engine', h2('엔진'), seg<Grade>('개발 등급', GRADES.map(g => [g, `${g} ${GRADE_NAME[g]}`] as [Grade, string]), () => E().grade, v => { E().grade = v; D = normalise(D); }), gradeNote,
    seg('배열', [['V6', 'V6'], ['V8', 'V8'], ['V12', 'V12']], () => E().layout, v => { E().layout = v; }),
    range('배기량', LIMITS.cc, 50, () => E().cc, v => { E().cc = v; }, v => `${v.toLocaleString()} cc`, 'cc'),
    seg('실린더당 밸브', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], () => E().valves, v => { E().valves = v; }, lk('valves')), redline,
    seg<Intake>('흡기', [['single', '단일 스로틀'], ['variable', '가변 흡기'], ['itb', '개별 스로틀']], () => E().intake, v => { E().intake = v; }, lk('intake')),
    seg<Compression>('압축비', [['low', '낮음 (8.5)'], ['mid', '보통 (10)'], ['high', '높음 (11+)']], () => E().compression, v => { E().compression = v; }, lk('compression')),
    seg<Sump>('윤활', [['wet', '웨트 섬프'], ['dry', '드라이 섬프']], () => E().sump, v => { E().sump = v; }, lk('sump')),
    seg<Block>('블록 소재', [['iron', '주철'], ['aluminium', '알루미늄'], ['magnesium', '마그네슘']], () => E().block, v => { E().block = v; }, lk('block')),
    seg<Turbos>('터보', [[0, '없음'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], () => E().turbo, v => { E().turbo = v; }, lk('turbo')), boost, ic, vtec,
    note('등급이 높으면 고회전에서 출력이 크게 늘지만 저속 토크가 약해지고, 비싸지고, 정비 주기가 짧아집니다. 압축비가 높은 과급 엔진은 부스트를 많이 올리면 노킹이 나서 출력이 거의 늘지 않습니다.'));
  syncs.push(() => { const g = E().grade, R = gradeRedline(g), Bm = gradeBoost(g), ri = redline.querySelector('input')!, bi = boost.querySelector('input')!;
    ri.max = String(R); bi.max = String(Bm); bi.disabled = !E().turbo; (ic.querySelector('input')!).disabled = !E().turbo;
    const vi = vtec.querySelector('input')!, vl = gradeLock(g, 'vtec', true); vi.disabled = !!vl; vtec.title = vl ?? '';
    gradeNote.textContent = `${g}등급: 레드라인 ${R.toLocaleString()} rpm, 부스트 ${Bm.toFixed(1)} bar까지${vl ? ` · VTEC는 ${vl.replace(' 고를 수 있습니다', '')}` : ''}`; }); }
// ② (on): the drive
{ const fin = range('종감속비', LIMITS.final, 0.01, () => D.drive.final || designSpec(D).final, v => { D.drive.final = v; }, v => v.toFixed(2), 'final');
  add('engine', h2('구동계'), seg('기어', [[5, '5단'], [6, '6단']], () => D.drive.gears, v => { D.drive.gears = v; }),
    seg('변속기', [['manual', '수동'], ['f1', 'F1 (반자동)']], () => D.drive.gearbox, v => { D.drive.gearbox = v; }),
    check('종감속 자동 (최고 속도가 출력 정점에서 나오게)', () => !D.drive.final, v => { D.drive.final = v ? 0 : +designSpec(D).final.toFixed(2); }, 'autofinal'), fin,
    check('LSD (차동 제한)', () => D.drive.lsd, v => { D.drive.lsd = v; }, 'lsd'), check('4륜 구동 (점성 센터 커플링, 앞 30 %)', () => D.drive.awd, v => { D.drive.awd = v; }, 'awd'));
  syncs.push(() => { (fin.querySelector('input') as HTMLInputElement).disabled = !D.drive.final; }); }
// ④ 장비
add('kit', check('ABS', () => D.kit.abs, v => { D.kit.abs = v; }, 'abs'), check('TCS (트랙션 컨트롤)', () => D.kit.tcs, v => { D.kit.tcs = v; }, 'tcs'),
  select('스티어링', [['manual', '수동'], ['hydraulic', '유압 파워'], ['electric', '전동 파워']], () => D.kit.steering, v => { D.kit.steering = v; }, 'steering'),
  seg('댐퍼', [['fixed', '고정'], ['adaptive', '가변 (두 가지 모드)']], () => D.kit.dampers, v => { D.kit.dampers = v; }),
  check('리어 윙', () => D.kit.wing, v => { D.kit.wing = v; }, 'wing'), check('언더트레이 + 디퓨저', () => D.kit.diffuser, v => { D.kit.diffuser = v; }, 'diffuser'),
  h2('타이어와 휠'),
  range('앞 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[0], v => { D.kit.tyres = [v, D.kit.tyres[1]]; }, v => `${v} mm`, 'tyreF'),
  range('뒤 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[1], v => { D.kit.tyres = [D.kit.tyres[0], v]; }, v => `${v} mm`, 'tyreR'),
  seg('림', [[16, '16″'], [17, '17″'], [18, '18″']], () => D.kit.rim, v => { D.kit.rim = v; }),
  note('윙과 디퓨저는 아직 차체에 그려지지 않고 물리(다운포스, 공기 저항)에만 들어갑니다.'));
// ⑥ 검사·시험 주행: the fit's checks with their fixes and the step each belongs to, the class, the cost and the
// reliability, what was measured, the test drive and the save
{ const div = (id: string, cls: string) => { const d = document.createElement('div'); d.id = id; d.className = cls; return d; };
  const drv = document.createElement('a'); drv.id = 'drive6'; drv.className = 'btn main'; drv.target = '_blank'; drv.rel = 'opener'; drv.textContent = '시험 주행 ▶'; drv.href = 'drive.html';
  const b = (t: string, f: () => void, id: string) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn'; x.id = id; x.textContent = t; x.addEventListener('click', f); return x; };
  const row = document.createElement('div'); row.className = 'btns'; row.append(drv, b('저장', saveNow, 'save6'), b('저장·불러오기', () => go('files'), 'files6'));
  add('check', note('앞 단계를 바꾸면 이 검사는 바로 다시 계산됩니다. 문제가 생긴 단계는 위 단계 표시에 ⚠️·⛔로 나옵니다.'),
    h2('장착 검사'), div('fit6', 'fit6'), h2('차종'), div('cls6', 'cls6'), h2('원가와 신뢰성'), div('cost6', 'sumfig'), div('meas6', 'meas6'), row); }
// 저장·불러오기: the saved designs, new ones, files
{ const list = document.createElement('ul'); list.className = 'list'; list.id = 'list';
  const btn = (t: string, f: () => void, cls = 'btn') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = t; b.addEventListener('click', f); return b; };
  const row = (...els: HTMLElement[]) => { const d = document.createElement('div'); d.className = 'btns'; d.append(...els); return d; };
  const ta = document.createElement('textarea'); ta.id = 'json'; ta.placeholder = '설계 JSON을 여기에 붙여넣거나, "JSON 보기"로 지금 설계를 꺼냅니다'; ta.setAttribute('aria-label', '설계 JSON');
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.id = 'file';
  file.addEventListener('change', () => { const f = file.files?.[0]; if (!f) return; void f.text().then(t => { const d = parseDesign(t); if (d) { use(d); flash(`불러옴: ${d.name}`); } else flash('설계 파일이 아닙니다'); file.value = ''; }); });
  add('files', h2('저장된 설계'), list,
    h2('새 설계'), row(btn('NSX 바탕으로', () => { use(fromPreset('nsx')); flash('새 설계 (NSX 바탕)'); }), btn('F355 바탕으로', () => { use(fromPreset('f355')); flash('새 설계 (F355 바탕)'); }), btn('지금 설계 복사', () => { use({ ...structuredClone(D), id: newId(), name: `${D.name} 사본`.slice(0, 40) }); flash('사본을 만들었습니다 (아직 저장 전)'); })),
    h2('파일'), row(btn('JSON 파일 받기', download), btn('파일 열기', () => file.click()), btn('JSON 보기', () => { ta.value = designJson(D); ta.select(); try { void navigator.clipboard?.writeText(ta.value).catch(() => {}); } catch { /* no clipboard */ } }),
      btn('붙여넣은 JSON 불러오기', () => { const d = parseDesign(ta.value); if (d) { use(d); flash(`불러옴: ${d.name}`); } else flash('JSON이 설계가 아닙니다'); })), ta, file,
    note('설계는 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 JSON 파일을 받거나 복사하세요.')); }
function download() { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([designJson(D)], { type: 'application/json' })); a.href = url; a.download = `${D.name.replace(/[^\w가-힣-]+/g, '_') || 'design'}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showList() { const list = $('list'), all = savedDesigns(store); list.textContent = '';
  if (!all.length) { const li = document.createElement('li'); li.innerHTML = '<span>아직 저장한 설계가 없습니다</span>'; list.append(li); return; }
  for (const d of all) { const li = document.createElement('li'); if (d.id === D.id) li.className = 'me'; const s = document.createElement('span'); s.textContent = d.name; const sm = document.createElement('small'); sm.textContent = `${BASE_NAME[d.body.base]} · ${d.engine.layout} ${(d.engine.cc / 1000).toFixed(1)}`;
    const load = document.createElement('button'); load.type = 'button'; load.className = 'btn'; load.textContent = '열기'; load.addEventListener('click', () => { use(d); flash(`열림: ${d.name}`); });
    const del = document.createElement('button'); del.type = 'button'; del.className = 'btn'; del.textContent = '삭제'; del.setAttribute('aria-label', `${d.name} 삭제`); del.addEventListener('click', () => { if (confirm(`"${d.name}" 설계를 지울까요?`)) { deleteDesign(store, d.id); showList(); savedState(); } });
    li.append(s, sm, load, del); list.append(li); } }

// ---- the design changed: kept, the figures, the car (when its body changed), the link ----
const bodyKey = (d: Design) => JSON.stringify([d.body.base, d.body.nose, d.body.front, d.body.tail, d.body.wheel, d.body.wheelbase, d.body.width, d.body.paint, d.body.gloss, d.kit.tyres, d.kit.rim]);
let meshT = 0, figT = 0;
function changed() { D = normalise(D); for (const s of syncs) s(); keepCurrent(store, D); savedState(); driveLink();
  clearTimeout(figT); figT = setTimeout(figures, 40) as unknown as number;
  if (bodyKey(D) !== meshKey) { clearTimeout(meshT); meshT = setTimeout(rebuild, 150) as unknown as number; } }
/** another design on the bench */
function use(d: Design) { D = structuredClone(d); $<HTMLInputElement>('name').value = D.name; lastFigs = null; restoreStep(); changed(); showList(); }
let flashT = 0; function flash(t: string) { $('saved').textContent = t; clearTimeout(flashT); flashT = setTimeout(savedState, 2500) as unknown as number; }
function savedState() { const had = savedDesigns(store).find(x => x.id === D.id); $('saved').textContent = !had ? '저장 안 됨' : JSON.stringify(had) === JSON.stringify(D) ? '저장됨' : '바뀐 내용 저장 안 됨'; }
$<HTMLInputElement>('name').addEventListener('input', e => { D.name = (e.target as HTMLInputElement).value.slice(0, 40) || '이름 없는 설계'; keepCurrent(store, D); savedState(); driveLink(); });
function saveNow() { flash(saveDesign(store, D) ? `저장했습니다: ${D.name}` : '이 브라우저는 저장을 허락하지 않습니다'); showList(); }
$('save').addEventListener('click', saveNow);
// the test drive (B4): the drive page opened with this design in its link
function driveLink() { for (const id of ['drive', 'drive6']) $<HTMLAnchorElement>(id).href = `drive.html?design=${encodeDesign(D)}`; }
for (const id of ['drive', 'drive6']) $(id).addEventListener('click', () => { keepCurrent(store, D); try { store?.setItem(KEYS.testDrive, encodeDesign(D)); } catch { /* not kept: the link carries it */ } });

// ---- the figures ----
let lastFigs: DesignFigures | null = null, fitOpen: boolean | null = null;
const fmtLap = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
type NumKey = { [K in keyof DesignFigures]: DesignFigures[K] extends number ? K : never }[keyof DesignFigures];
const ICON = { ok: '✅', modified: '⚠️', blocked: '⛔' } as const;
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
function figures() { const f = designFigures(D), s = designSpec(D), was = lastFigs; lastFigs = f;
  /** a figure, marked when it moved since the last change: better (up) or worse (down); `more`: is more better */
  const cell = (k: NumKey, text: string, more: boolean | null) => { const a = was?.[k], b = f[k], moved = more !== null && a !== undefined && Math.abs(b - a) > 1e-9; return `<dd${moved ? ` class="${(b > a) === more ? 'up' : 'down'}"` : ''}>${text}</dd>`; };
  $('figs').innerHTML = `<dt>무게</dt>${cell('mass', `${f.mass.toLocaleString()} <small>kg</small>`, false)}`
    + `<dt>출력</dt>${cell('hp', `${f.hp} <small>hp<span class="rpm"> · ${s.hpRpm.toLocaleString()}</span></small>`, true)}`
    + `<dt>토크</dt>${cell('torque', `${f.torque} <small>Nm<span class="rpm"> · ${s.torqueRpm.toLocaleString()}</span></small>`, true)}`
    + `<dt>마력당 무게</dt>${cell('kgPerHp', `${f.kgPerHp.toFixed(2)} <small>kg/hp</small>`, false)}`
    + `<dt>앞 배분</dt>${cell('front', `${Math.round(f.front * 100)} <small>%</small>`, null)}`
    + `<dt>최고 속도</dt>${cell('topKmh', `${f.topKmh} <small>km/h</small>`, true)}`
    + `<dt>0→100</dt>${cell('zeroTo100', `${f.zeroTo100.toFixed(1)} <small>s</small>`, false)}`
    + `<dt>종감속</dt><dd>${s.final.toFixed(2)}${D.drive.final ? '' : ' <small>자동</small>'}</dd>`
    + `<dt>원가 지수</dt>${cell('cost', `${f.cost} <small>NSX=100</small>`, false)}`
    + `<dt>신뢰성</dt>${cell('reliability', `${f.reliability} <small>· ${(f.serviceKm / 1000).toLocaleString()}천 km</small>`, true)}`;
  $('cls').innerHTML = $('cls6').innerHTML = `<b>${esc(f.perfLabel)}</b> <small>· ${esc(f.form)}</small>`;
  $('cost6').innerHTML = `<dl><dt>원가 지수</dt><dd>${f.cost} <small>NSX=100</small></dd><dt>신뢰성</dt><dd>${f.reliability}</dd><dt>정비 주기</dt><dd>${(f.serviceKm / 1000).toLocaleString()}천 <small>km</small></dd>`
    + `<dt>무게</dt><dd>${f.mass.toLocaleString()} <small>kg</small></dd><dt>출력</dt><dd>${f.hp} <small>hp</small></dd><dt>최고 속도</dt><dd>${f.topKmh} <small>km/h</small></dd></dl>`;
  showFit(f.fit); stepMarks(f.fit); meas(); }
/** each step marked with the fit checks that concern it and are not clean */
function stepMarks(r: FitResult[]) { for (const [id, b] of stepBtn) { const mine = r.filter(x => FIT_STEP[x.part] === id), nb = mine.filter(x => x.verdict === 'blocked').length, nm = mine.filter(x => x.verdict === 'modified').length, badge = b.querySelector<HTMLElement>('.badge')!;
  badge.hidden = !nb && !nm; badge.className = `badge${nb ? ' blocked' : ''}`; badge.textContent = nb ? `⛔${nb > 1 ? nb : ''}` : `⚠️${nm > 1 ? nm : ''}`;
  badge.title = [nb ? `장착 불가 ${nb}` : '', nm ? `개조 필요 ${nm}` : ''].filter(Boolean).join(', '); label(id); } }
/** the fit's checks: the ones needing work or blocked first, each with its fixes as buttons that apply them */
function showFit(r: FitResult[]) {
  const bad = r.filter(x => x.verdict !== 'ok').sort((a, b) => (a.verdict === 'blocked' ? 0 : 1) - (b.verdict === 'blocked' ? 0 : 1)), ok = r.filter(x => x.verdict === 'ok');
  const nb = bad.filter(x => x.verdict === 'blocked').length, nm = bad.length - nb, el = $('fit');
  const open = fitOpen ?? (nb > 0 || (nm > 0 && innerWidth > 760));
  // in ⑥ each check also names its step, a button that goes there
  const item = (x: FitResult, toStep = false) => `<li class="${x.verdict}"><span class="ic" aria-hidden="true">${ICON[x.verdict]}</span><div><b>${esc(x.name)}</b> <span>${esc(x.reason)}</span>`
    + (x.fixes.length || (toStep && x.verdict !== 'ok') ? `<div class="fixes">${x.fixes.map((fx, i) => `<button type="button" class="btn fix" data-part="${x.part}" data-i="${i}">${esc(fx.label)}</button>`).join('')}`
      + (toStep && x.verdict !== 'ok' ? `<button type="button" class="btn go" data-step="${FIT_STEP[x.part]}">${stepNo(FIT_STEP[x.part]) + 1}단계 ${STEPS[stepNo(FIT_STEP[x.part])]![1]}로 ◀</button>` : '') + '</div>' : '') + '</div></li>';
  el.innerHTML = `<details${open ? ' open' : ''}><summary>장착 검사 <span class="sum">${nb ? `⛔ ${nb} ` : ''}${nm ? `⚠️ ${nm} ` : ''}${!bad.length ? '✅ 모두 장착' : `✅ ${ok.length}`}</span></summary>`
    + `<ul>${bad.map(x => item(x)).join('')}${ok.map(x => item(x)).join('')}</ul></details>`;
  const el6 = $('fit6'); el6.innerHTML = `<p class="note">${nb ? `⛔ 장착 불가 ${nb} · ` : ''}${nm ? `⚠️ 개조 필요 ${nm} · ` : ''}✅ 장착 ${ok.length}</p><ul>${bad.map(x => item(x, true)).join('')}${ok.map(x => item(x)).join('')}</ul>`;
  const d = el.querySelector('details')!; d.querySelector('summary')!.addEventListener('click', () => { fitOpen = !d.open; dirty = true; });
  for (const b of [...Array.from(el.querySelectorAll<HTMLButtonElement>('button.fix')), ...Array.from(el6.querySelectorAll<HTMLButtonElement>('button.fix'))]) b.addEventListener('click', () => {
    const fx = r.find(x => x.part === b.dataset.part)?.fixes[+b.dataset.i!]; if (!fx) return; D = applyPatch(D, fx.patch); changed(); flash(`적용: ${fx.label}`); });
  for (const b of Array.from(el6.querySelectorAll<HTMLButtonElement>('button.go'))) b.addEventListener('click', () => { if (isStep(b.dataset.step)) go(b.dataset.step); }); }
/** what the drive page measured (its runs recorded under the design's id) */
function meas() { const m = measured(store, D.id), put = (h: string) => { $('meas').innerHTML = h; $('meas6').innerHTML = h; };
  if (!m) { put('<div class="lab">측정</div><p class="note">시험 주행을 하면 낸 최고 속도와 랩 타임이 여기 기록됩니다.</p>'); return; }
  if (m.sig !== designSig(D)) { put('<div class="lab">측정</div><p class="note">설계가 바뀐 뒤로는 아직 측정이 없습니다 (전 설계의 기록은 시험 주행을 다시 하면 지워집니다).</p>'); return; }
  const laps = Object.values(m.laps).map(l => `<dt>${l.track.replace(/\s*\(.*$/, '')}</dt><dd>${fmtLap(l.t)}</dd>`).join('');
  put(`<div class="lab">측정 (시험 주행)</div><dl><dt>낸 최고 속도</dt><dd>${m.topKmh || '-'} <small>km/h</small></dd>${laps || '<dt>최고 랩</dt><dd>-</dd>'}</dl>`); }
addEventListener('storage', e => { if (e.key === KEYS.measure(D.id)) meas(); }); addEventListener('focus', meas); document.addEventListener('visibilitychange', () => { if (!document.hidden) meas(); });

// ---- the view: the live renderer on the studio floor ----
const cv = $<HTMLCanvasElement>('view'); let L: LiveRenderer | null = null;
try { L = new LiveRenderer(cv); L.setGround(studioFloor()); L.setTrack(1, 30, 12, 0); const L0 = L; void loadSky(L0).then(() => { dirty = true; }).catch(e => console.warn('sky', e));
  const im = [texAlb, texNor, texRgh].map(src => { const i = new Image(); i.src = src; return i; });
  void Promise.all(im.map(i => i.decode())).then(() => { L0.setTextures(im[0]!, im[1]!, im[2]!, (texMeta as { layers: { size_m: number; luma_mean: number; rough_mean: number }[] }).layers); dirty = true; }).catch(e => console.warn('textures', e)); }
catch (e) { console.warn('live renderer unavailable', e); L = null; const p = document.createElement('p'); p.className = 'nogl'; p.textContent = '이 브라우저는 WebGL2가 없어 3D 미리보기를 띄울 수 없습니다. 설계와 수치는 그대로 쓸 수 있습니다.'; document.body.append(p); }
/** the parts lifted off for the engine view: the deck's lids and its glass */
const DECK = ['bootLid', 'engineCover', 'rearPane'];
let meshKey = '', down: Mesh | null = null, up: Mesh | null = null, onGpu: Mesh | null = null, builds = 0;
const open = new WeakMap<Mesh, Mesh>();
const view = { spin: false, lamps: false, engine: false, look: 2, yaw: 0, ang: 0, pitch: 0, zoom: 1 };
let dirty = true, g: ReturnType<LiveRenderer['car']> | null = null;
function rebuild() { const key = bodyKey(D); if (key === meshKey && down) return; const t0 = performance.now(); meshKey = key; down = designMesh(D, 0, 0); up = null; builds++; dirty = true; console.info(`design mesh ${D.body.base}: ${down.n} triangles, ${Math.round(performance.now() - t0)} ms`); }
function shown(): Mesh { let M = view.lamps ? (up ??= designMesh(D, 0, 1)) : down!; if (view.engine) { let o = open.get(M); if (!o) { o = withoutParts(M, DECK); open.set(M, o); } M = o; } return M; }
const home = () => { view.ang = Math.PI - 0.7; view.pitch = 17; view.zoom = 1; view.yaw = 0; dirty = true; }; home();
const press = (id: string, k: 'spin' | 'lamps' | 'engine') => $(id).addEventListener('click', () => { view[k] = !view[k]; $(id).setAttribute('aria-pressed', String(view[k])); dirty = true; });
press('spin', 'spin'); press('lamps', 'lamps'); press('engine', 'engine');
$('engine').addEventListener('click', () => { if (view.engine) { view.ang = view.yaw + 0.6; view.pitch = 42; view.zoom = 0.8; } });   // the engine bay seen from behind and above
$<HTMLSelectElement>('look').addEventListener('change', e => { view.look = +(e.target as HTMLSelectElement).value; dirty = true; });
$('home').addEventListener('click', home); cv.addEventListener('dblclick', home);
{ const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); } });
  cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { view.ang -= dx * 0.007; view.pitch = Math.max(6, Math.min(85, view.pitch + dy * 0.25)); dirty = true; }
    else if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y); view.zoom = Math.max(0.35, Math.min(3, view.zoom * pinch / d)); pinch = d; dirty = true; } });
  const off = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; }; cv.addEventListener('pointerup', off); cv.addEventListener('pointercancel', off);
  cv.addEventListener('wheel', e => { e.preventDefault(); view.zoom = Math.max(0.35, Math.min(3, view.zoom * (e.deltaY > 0 ? 1.12 : 1 / 1.12))); dirty = true; }, { passive: false }); }
addEventListener('resize', () => { dirty = true; });
let last = performance.now(), frames = 0;
function frame(now: number) { const el = Math.min(0.1, (now - last) / 1000); last = now;
  if (view.spin) { view.yaw += el * 0.35; dirty = true; }
  if (L && down && dirty) { dirty = false; frames++;
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(2, Math.round(cv.clientWidth * dpr)), H = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const M = shown(); if (M !== onGpu) { g = onGpu ? L.swapCar(onGpu, M) : L.car(M); onGpu = M; }
    // the free middle between the panels (a phone: the strip above, the drawer below when open): the car framed in it
    const r = cv.getBoundingClientRect(), phone = innerWidth <= 760, sideR = phone ? 0 : $('side').getBoundingClientRect().right, figs = $('figs').closest('section')!.getBoundingClientRect(), figL = phone ? r.width : figs.left;
    // on a phone the band between the figures' strip and the drawer (or the view's buttons)
    const top = phone ? figs.bottom : 0, bottom = phone ? (document.body.classList.contains('open') ? $('side').getBoundingClientRect().top : r.height - 60) : r.height;
    const free = Math.max(160, figL - sideR) * dpr, band = Math.max(120, bottom - top) * dpr, shift = ((sideR + figL) / 2 - r.width / 2) * dpr, len = M.length;
    const mm = Math.max(len * 1.3 / free, len * 0.62 / band) * view.zoom, ox = -shift * mm / 1000;
    const rx = Math.sin(view.ang), ry = -Math.cos(view.ang);   // the screen's right, in the world
    L.render({ x: rx * ox, y: ry * ox, z: 0.55, ang: view.ang, pitch: view.pitch, mm, W, H, cy: phone ? (top + bottom) / 2 / r.height : 0.55 },
      [{ g: g!, x: 0, y: 0, z: -0.015, yaw: view.yaw, roll: 0, pitch: 0, steerL: 0.14, steerR: 0.12, spin: 0, player: true, lamps: view.lamps ? 1 : 0 }], [], [],
      { look: view.look, glass: 0.8, rays: true, bloomK: 1, reflK: 1.3, dof: 0, outW: 0.5, outK: 0.6 }); }
  requestAnimationFrame(frame); }
// the phone's drawer
function drawer(on: boolean) { if (on === document.body.classList.contains('open')) return; document.body.classList.toggle('open', on); $('toggle').setAttribute('aria-expanded', String(on)); $('toggle').textContent = on ? '✕ 닫기' : '⚙ 설계'; dirty = true; if (on) showStep(); }
$('toggle').addEventListener('click', () => drawer(!document.body.classList.contains('open')));

$<HTMLInputElement>('name').value = D.name; for (const s of syncs) s(); restoreStep(); rebuild(); figures(); showList(); savedState(); driveLink(); requestAnimationFrame(frame);
(globalThis as { __builder?: unknown }).__builder = { get design() { return D; }, use, get builds() { return builds; }, get frames() { return frames; }, get triangles() { return onGpu?.n ?? 0; }, get step() { return onFiles ? 'files' : step; }, go };   // for the page tests (tools)
