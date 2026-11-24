// The engine designer, 엔진 공방 (docs/systems/101 1-1 and 1-2, task M2): an engine on a workshop stand in the studio,
// drawn by the shared renderer (render/car/powertrain/stand.ts: the design's own powertrain meshes) and turned with the
// pointer; its family (the block: layout, metal, bore/stroke, the displacements it takes, the valves) and its variant (the
// displacement, the red line, the cams, the intake, the compression, the lubrication, the turbos, the grade) in tabs on the
// left, each part's quality (-3..+3) and the engine library beside them; on the right the dyno (the driving physics' own
// torque, race/dyno.ts, drawn as a sweep from idle to the red line with its peaks marked) and the engine's sheet, the
// technologies' years, and the rev control: the engine's own voice (ui/sound.ts designVoice) revved on the stand by a
// held button or a throttle slider, after a tap (a browser lets sound start only then) and only with the game's sound on.
// The model is built again a moment after a choice rests; the exploded view spreads the parts, and a part pointed at or
// tapped shows its name and what of the design it carries.
// Opened from the garage (a new engine from the car on the turntable, or one from the library) or from the builder's step
// ② with that car's engine: "빌더에 적용" hands the engine back to the builder.
import type { Screen, Move } from './router';
import type { ShellCtx } from './ctx';
import { el, button, chips, slider, toggle, tabs, dialog, toast } from './ui';
import { studioFloor } from '../../render/live/studio';
import type { LiveRenderer } from '../../render/live/renderer';
import type { Mesh } from '../../render/car/mesh';
import { standModel, exploded, pickPart, partName, PART_INFO, type StandModel } from '../../render/car/powertrain/stand';
import { LAYOUTS, LAYOUT_NAME, LIMITS, GRADES, GRADE_NAME, QUALITY_PARTS, INTAKES, COMPRESSIONS, SUMPS, BLOCKS, CYLINDERS, gradeLock, gradeBoost, gradeRedline, normalise,
  type Design, type Grade, type Intake, type Compression, type Sump, type Block, type Valves, type Turbos, type Layout, type QualityPart } from '../../core/design';
import { savedEngines, saveEngine, deleteEngine, duplicateEngine, engineEntry, joinEngine, withEngine, familyRange, engineTechs, engineYear, TECH_YEAR, type SavedEngine } from '../../core/engines';
import { designSpec } from '../../race/design';
import { torqueAt, type RaceSpec } from '../../race/cars';
import { dynoCurve, engineSheet, type DynoCurve, type EngineSheet } from '../../race/dyno';
import { QUALITY } from '../../race/designparts';
import { Sound, designVoice, type Voice } from '../sound';

export interface EngineParams { /** the car whose engine is edited (else the car on the turntable carries a new engine) */ design?: Design;
  /** an engine of the library to open */ entry?: SavedEngine; /** the builder's: the edited engine handed back */ onApply?: (e: Design['engine']) => void }

const KO = {
  block: { iron: '주철', aluminium: '알루미늄', magnesium: '마그네슘' } as Record<Block, string>,
  intake: { single: '단일 스로틀', variable: '가변 흡기', itb: '개별 스로틀' } as Record<Intake, string>,
  compression: { low: '낮음 (8.5)', mid: '보통 (10)', high: '높음 (11+)' } as Record<Compression, string>,
  sump: { wet: '웨트 섬프', dry: '드라이 섬프' } as Record<Sump, string> };
const yr = (k: keyof typeof TECH_YEAR) => ` · ${TECH_YEAR[k].year}`;

/** the design's figures as the part pointed at carries them (Korean) */
function partSpec(n: string, d: Design, s: EngineSheet): string {
  const E = d.engine, q = PART_INFO[n]?.q, qs = q && (q !== 'turbo' || E.turbo) ? ` · 품질 ${E.quality[q] > 0 ? '+' : ''}${E.quality[q]}` : '';
  const line = (() => { switch (PART_INFO[n]?.q) {
    case 'block': return n === 'engineBlock' ? `${LAYOUT_NAME[E.layout]} · ${KO.block[E.block]} · 보어 ${s.bore} × 행정 ${s.stroke} mm · ${E.cc.toLocaleString()} cc` : KO.sump[E.sump];
    case 'head': return `실린더당 ${E.valves}밸브 · ${E.valves >= 4 ? 'DOHC' : 'SOHC'} · 캠 ${E.vtec ? '두 프로필' : '일반'} · 레드라인 ${E.redline.toLocaleString()} rpm`;
    case 'intake': return `${KO.intake[E.intake]} · 압축비 ${KO.compression[E.compression]}`;
    case 'exhaust': return `${E.grade >= 2 ? '등장 헤더' : '주철 매니폴드'} · ${E.turbo ? '터빈으로' : '촉매로'}`;
    case 'turbo': return `터보 ${E.turbo}개 · ${E.boost.toFixed(2)} bar · 인터쿨러 ${E.intercooler ? '있음' : '없음'}`;
    default: return n === 'stand' ? '작업대: 엔진을 플랜지로 붙잡습니다' : '보조 장치'; } })();
  return line + qs; }

let styled = false;
function style() { if (styled) return; styled = true; const s = document.createElement('style'); s.dataset.screen = 'engine'; s.textContent = `
  .gh-eng { display: grid; grid-template-columns: minmax(300px, 340px) minmax(0, 1fr) minmax(320px, 390px); grid-template-rows: auto minmax(0, 1fr); overflow: hidden; background: transparent; }
  .gh-eng > .gh-bar { grid-column: 1 / -1; }
  .gh-eng-side, .gh-eng-info { overflow-y: auto; background: var(--gh-panel); padding: 12px 14px 18px; display: grid; gap: 12px; align-content: start; min-height: 0; }
  .gh-eng-side { border-right: 1px solid var(--gh-line); } .gh-eng-info { border-left: 1px solid var(--gh-line); }
  .gh-eng-view { position: relative; min-width: 0; min-height: 0; touch-action: none; cursor: grab; }
  .gh-eng-view:active { cursor: grabbing; }
  .gh-eng-tools { position: absolute; left: 10px; top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
  .gh-eng-tools .gh-btn { min-height: 34px; padding: 5px 11px; font-size: 0.84rem; background: var(--gh-panel); }
  .gh-eng-tools .gh-btn[aria-pressed="true"] { border-color: var(--gh-accent); color: var(--gh-accent); font-weight: 600; }
  .gh-eng-tip { position: absolute; pointer-events: none; background: var(--gh-solid); border: 1px solid var(--gh-accent); border-radius: 8px; padding: 6px 10px; font-size: 0.8rem; max-width: min(300px, 80%); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  .gh-eng-tip b { display: block; font-size: 0.9rem; }
  .gh-eng-tip[hidden] { display: none; }
  .gh-eng-hint { position: absolute; left: 10px; bottom: 8px; font-size: 0.74rem; color: #e9e4d8; text-shadow: 0 1px 3px #000; }
  .gh-dyno { width: 100%; aspect-ratio: 16 / 10; display: block; border-radius: 6px; background: var(--gh-solid); border: 1px solid var(--gh-line); }
  .gh-rev { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; }
  .gh-rev .gh-btn { touch-action: none; user-select: none; -webkit-user-select: none; }
  .gh-rev .gh-btn.gh-held { background: var(--gh-accent); color: var(--gh-accent-ink); }
  .gh-tach { font-family: var(--gh-display); font-size: 1.4rem; font-variant-numeric: tabular-nums; letter-spacing: 0.03em; }
  .gh-tach small { font-family: var(--gh-body); font-size: 0.72rem; color: var(--gh-soft); }
  .gh-sheet { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0; font-size: 0.86rem; font-variant-numeric: tabular-nums; }
  .gh-sheet dt { color: var(--gh-soft); } .gh-sheet dd { margin: 0; text-align: right; } .gh-sheet small { color: var(--gh-soft); }
  .gh-techs { display: flex; flex-wrap: wrap; gap: 5px; }
  .gh-tech { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--gh-line); color: var(--gh-soft); white-space: nowrap; }
  .gh-tech.gh-late { border-color: var(--gh-warn); color: var(--gh-warn); }
  .gh-lock { font-size: 0.74rem; color: var(--gh-soft); margin: -2px 0 0; } .gh-lock:empty { display: none; }
  .gh-q { display: grid; gap: 4px; } .gh-q .gh-note { margin-top: -2px; }
  .gh-elist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .gh-elist li { border: 1px solid var(--gh-line); border-radius: 8px; padding: 8px 10px; display: grid; gap: 6px; background: var(--gh-solid); }
  .gh-elist li.gh-me { border-color: var(--gh-accent); }
  .gh-elist .gh-actions .gh-btn { min-height: 34px; padding: 4px 10px; font-size: 0.82rem; }
  .gh-name { font: inherit; font-size: 0.95rem; padding: 7px 10px; border: 1px solid var(--gh-line); border-radius: 6px; background: var(--gh-solid); color: var(--gh-ink); width: 100%; }
  .gh-chip:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (max-width: 760px) {
    .gh-eng { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 40vh minmax(0, 1fr); }
    .gh-eng-view { grid-row: 2; }
    .gh-eng-scroll { grid-row: 3; overflow-y: auto; min-height: 0; }
    .gh-eng-side, .gh-eng-info { overflow: visible; border: 0; border-top: 1px solid var(--gh-line); }
  }
  @media (min-width: 761px) { .gh-eng-scroll { display: contents; } .gh-eng-side { grid-column: 1; grid-row: 2; } .gh-eng-view { grid-column: 2; grid-row: 2; } .gh-eng-info { grid-column: 3; grid-row: 2; } }`; document.head.append(s); }

export function engineScreen(ctx: ShellCtx): Screen<EngineParams> & { readonly api: unknown } {
  const root = el('section', 'gh-screen gh-eng'); root.dataset.screen = 'engine';
  // ---- what is on the bench ----
  let car: Design = ctx.recent(), start = '', entry: { id: string; name: string } | null = null, range: [number, number] = familyRange(car.engine.cc), onApply: EngineParams['onApply'] = undefined;
  let spec: RaceSpec = designSpec(car), curve: DynoCurve = dynoCurve(car), sheet: EngineSheet = engineSheet(car, curve), on = false;
  const E = () => car.engine, sig = () => JSON.stringify([car.engine, range]);
  const syncs: (() => void)[] = [];

  // ---- the controls (each reads the engine and writes it back; all synced after any change) ----
  /** a choice with its locked values greyed out, the reason written under it */
  function pick<T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, lock?: (v: T) => string | null): HTMLElement {
    const c = chips(label, opts, get(), v => { if (lock?.(v)) { c.set(get()); return; } set(v); changed(); }), why = el('p', 'gh-lock'), bs = Array.from(c.querySelectorAll<HTMLButtonElement>('.gh-chip'));
    syncs.push(() => { c.set(get()); const locked: string[] = []; opts.forEach(([v, t], i) => { const L = lock?.(v) ?? null; bs[i]!.disabled = !!L; bs[i]!.title = L ?? ''; if (L) locked.push(`${t.replace(/ · \d+$/, '')}: ${L}`); }); why.textContent = locked.join(' · '); });
    c.append(why); return c; }
  function range_(label: string, lim: () => readonly [number, number], step: number, get: () => number, set: (v: number) => void, show: (v: number) => string, disabled?: () => boolean): HTMLElement {
    const r = slider(label, [lim()[0], lim()[1], step], get(), v => { set(v); changed(); }, show), i = r.querySelector('input')!, out = r.querySelector('.gh-val')!;
    syncs.push(() => { const [a, b] = lim(); i.min = String(a); i.max = String(b); i.value = String(get()); out.textContent = show(get()); i.disabled = !!disabled?.(); }); return r; }
  function check(label: string, get: () => boolean, set: (v: boolean) => void, disabled?: () => boolean, note?: string): HTMLElement {
    const t = toggle(label, get(), v => { set(v); changed(); }, note), i = t.querySelector('input')!; syncs.push(() => { i.checked = get(); i.disabled = !!disabled?.(); }); return t; }
  const lk = <K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo'>(k: K) => (v: Design['engine'][K]) => gradeLock(E().grade, k, v);
  const note = (t: string) => el('p', 'gh-note', t), h = (t: string) => el('h3', 'gh-h2', t);

  const bsShow = (v: number) => { const n = CYLINDERS[E().layout], st = Math.cbrt(E().cc / n / (Math.PI / 4 * v ** 2)) * 10; return `${v.toFixed(2)} · 보어 ${(v * st).toFixed(1)} × 행정 ${st.toFixed(1)} mm`; };
  const family = el('div', 'gh-form',
    note('계열은 블록과 주물이 정하는 것입니다. 한 계열에서 변형을 여러 개 만들어 여러 차에 씁니다.'),
    pick<Layout>('배열', LAYOUTS.map(l => [l, LAYOUT_NAME[l] + (l[0] === 'F' ? yr('flat') : l === 'V10' ? yr('v10') : '')]), () => E().layout, v => { E().layout = v; }),
    pick<Block>('블록 소재', BLOCKS.map(b => [b, KO.block[b] + (b === 'magnesium' ? yr('magnesium') : '')]), () => E().block, v => { E().block = v; }, lk('block')),
    pick<Valves>('실린더당 밸브', [[2, '2'], [3, '3'], [4, `4${yr('fourValve')}`], [5, `5${yr('fiveValve')}`]], () => E().valves, v => { E().valves = v; }, lk('valves')),
    range_('보어/행정 비', () => LIMITS.bs, 0.01, () => E().bs, v => { E().bs = v; }, bsShow),
    note('1보다 크면 보어가 큰 단행정(고회전에 유리), 작으면 장행정(저속 토크가 조금 많음). 피스톤 속도가 등급 한계를 넘으면 고회전 출력이 꺾입니다.'),
    range_('배기량 범위: 최소', () => LIMITS.cc, 50, () => range[0], v => { range = [Math.min(v, range[1]), range[1]]; }, v => `${v.toLocaleString()} cc`),
    range_('배기량 범위: 최대', () => LIMITS.cc, 50, () => range[1], v => { range = [range[0], Math.max(v, range[0])]; }, v => `${v.toLocaleString()} cc`));
  const gradeNote = note(''); syncs.push(() => { const g = E().grade; gradeNote.textContent = `${g}등급(${GRADE_NAME[g]}): 레드라인 ${gradeRedline(g).toLocaleString()} rpm, 부스트 ${gradeBoost(g).toFixed(1)} bar까지${gradeLock(g, 'vtec', true) ? ' · 두 프로필 캠은 2등급부터' : ''}`; });
  const variant = el('div', 'gh-form',
    pick<Grade>('개발 등급', GRADES.map(g => [g, `${g} ${GRADE_NAME[g]}`]), () => E().grade, v => { E().grade = v; }), gradeNote,
    range_('배기량', () => range, 10, () => E().cc, v => { E().cc = v; }, v => `${v.toLocaleString()} cc`),
    range_('레드라인', () => [LIMITS.redline[0], gradeRedline(E().grade)], 100, () => E().redline, v => { E().redline = v; }, v => `${v.toLocaleString()} rpm`),
    pick<'one' | 'two'>('캠', [['one', '일반 프로필'], ['two', `두 프로필 (가변 밸브)${yr('vvt')}`]], () => E().vtec ? 'two' : 'one', v => { E().vtec = v === 'two'; }, v => v === 'two' ? gradeLock(E().grade, 'vtec', true) : null),
    pick<Intake>('흡기', INTAKES.map(i => [i, KO.intake[i] + (i === 'itb' ? yr('itb') : i === 'variable' ? yr('variable') : '')]), () => E().intake, v => { E().intake = v; }, lk('intake')),
    pick<Compression>('압축비', COMPRESSIONS.map(c => [c, KO.compression[c]]), () => E().compression, v => { E().compression = v; }, lk('compression')),
    pick<Sump>('윤활', SUMPS.map(s => [s, KO.sump[s] + (s === 'dry' ? yr('dry') : '')]), () => E().sump, v => { E().sump = v; }, lk('sump')),
    pick<Turbos>('터보', [[0, '없음'], [1, `1${yr('turbo')}`], [2, '2'], [3, `3${yr('multiTurbo')}`], [4, '4']], () => E().turbo, v => { E().turbo = v; }, lk('turbo')),
    range_('부스트', () => [LIMITS.boost[0], gradeBoost(E().grade)], 0.05, () => E().boost, v => { E().boost = v; }, v => `${v.toFixed(2)} bar`, () => !E().turbo),
    check(`인터쿨러${yr('intercooler')}`, () => E().intercooler, v => { E().intercooler = v; }, () => !E().turbo),
    note('높은 등급은 고회전 출력이 크게 늘지만 비싸고 정비 주기가 짧습니다. 압축비가 높은 과급 엔진은 부스트를 많이 올리면 노킹 때문에 출력이 거의 늘지 않습니다.'));
  const qNote = (k: QualityPart) => { const Q = QUALITY[k]; return `한 칸마다: 출력 ${(Q.power * 100).toFixed(1)} %, 신뢰성 ${Q.reliability}, 엔진 원가 ${(Q.cost * 12).toFixed(1)} %`; };
  const quality = el('div', 'gh-form', note('개발 등급은 엔진 전체의 수준입니다. 그 위에서 부품마다 품질을 −3 ~ +3으로 조절합니다. 높이면 신뢰성과 출력이 오르고 원가가 오릅니다.'),
    ...QUALITY_PARTS.map(k => el('div', 'gh-q', range_(QUALITY[k].name, () => LIMITS.quality, 1, () => E().quality[k], v => { E().quality[k] = v; }, v => `${v > 0 ? '+' : ''}${v}`, () => k === 'turbo' && !E().turbo), note(qNote(k)))),
    el('div', 'gh-actions', button('품질 모두 0으로', () => { for (const k of QUALITY_PARTS) E().quality[k] = 0; changed(); })));
  // the library
  const nameIn = el('input', 'gh-name'); nameIn.type = 'text'; nameIn.maxLength = 40; nameIn.setAttribute('aria-label', '엔진 이름');
  nameIn.addEventListener('input', () => { if (entry) entry.name = nameIn.value.trim().slice(0, 40) || '이름 없는 엔진'; });
  const list = el('ul', 'gh-elist');
  const save = (asNew: boolean) => { const name = nameIn.value.trim() || `${LAYOUT_NAME[E().layout]} ${(E().cc / 1000).toFixed(1)}`, e = engineEntry(E(), name, range, !asNew && entry ? entry.id : undefined);
    if (!saveEngine(ctx.store, e)) { toast('이 브라우저는 저장을 허락하지 않습니다'); return; } entry = { id: e.id, name: e.name }; nameIn.value = e.name; start = sig(); toast(`보관함에 저장했습니다: ${e.name}`); fillList(); };
  const open = (s: SavedEngine) => { car = withEngine(car, joinEngine(s.family, s.variant, car)); range = [...s.family.cc]; entry = { id: s.id, name: s.name }; nameIn.value = s.name; start = sig(); changed(); toast(`열었습니다: ${s.name}`); };
  function fillList() { list.textContent = ''; const all = savedEngines(ctx.store);
    if (!all.length) list.append(el('li', '', el('span', 'gh-note', '아직 저장한 엔진이 없습니다. 위에서 이름을 붙여 저장하세요.')));
    for (const s of all) { const e = joinEngine(s.family, s.variant, car), d = withEngine(car, e); let hp = ''; try { hp = ` · ${Math.round(designSpec(d).hp)} hp`; } catch { /* shown without */ }
      list.append(el('li', entry?.id === s.id ? 'gh-me' : '', el('b', '', s.name), el('span', 'gh-note', `${LAYOUT_NAME[e.layout]} ${e.cc.toLocaleString()} cc · ${e.grade}등급${e.turbo ? ` · 터보 ${e.turbo}` : ''}${hp} · 범위 ${s.family.cc[0].toLocaleString()}~${s.family.cc[1].toLocaleString()} cc`),
        el('div', 'gh-actions', button('열기', () => open(s), { kind: 'main' }), button('복제', () => { const c = duplicateEngine(ctx.store, s.id); toast(c ? `복제했습니다: ${c.name}` : '저장하지 못했습니다'); fillList(); }),
          button('삭제', () => void dialog('엔진 삭제', [`"${s.name}" 엔진을 보관함에서 지울까요? 이 엔진을 얹은 차는 그대로 남습니다.`], [['del', '삭제', { kind: 'danger' }], ['', '취소', { kind: 'ghost' }]]).then(v => { if (!v) return; deleteEngine(ctx.store, s.id); if (entry?.id === s.id) entry = null; toast('지웠습니다'); fillList(); }))))); } }
  const library = el('div', 'gh-form', el('label', 'gh-row', el('span', 'gh-label', '엔진 이름'), nameIn),
    el('div', 'gh-actions', button('보관함에 저장', () => save(false), { kind: 'main', id: 'gh-eng-save' }), button('새 엔진으로 저장', () => save(true))),
    note('엔진(계열과 변형)은 차와 따로 보관됩니다. 차 빌더 ② 단계에서 보관함의 엔진을 골라 얹을 수 있습니다.'), h('보관함'), list);
  const tb = tabs([['family', '계열', family], ['variant', '변형', variant], ['quality', '부품 품질', quality], ['library', '보관함', library]], 'variant');

  // ---- the right: the dyno, the rev control, the sheet, the years ----
  const dyno = el('canvas', 'gh-dyno'); dyno.setAttribute('role', 'img'); dyno.setAttribute('aria-label', '다이노: 회전수에 따른 토크와 출력');
  const tach = el('div', 'gh-tach'), revBtn = button('회전 올리기 (누르고 있기)', () => {}, { id: 'gh-rev' }), thr = el('input', 'gh-slider'); thr.type = 'range'; thr.min = '0'; thr.max = '1'; thr.step = '0.01'; thr.value = '0'; thr.setAttribute('aria-label', '스로틀');
  const soundRow = el('div'), sheetBox = el('dl', 'gh-sheet'), techs = el('div', 'gh-techs'), yearNote = note('');
  const info = el('div', 'gh-eng-info', el('h3', 'gh-h2', '다이노'), dyno, el('div', 'gh-rev', revBtn, tach, el('span', 'gh-label', '스로틀'), thr), soundRow,
    el('h3', 'gh-h2', '엔진 평가표'), sheetBox, el('h3', 'gh-h2', '기술과 연도'), techs, yearNote);
  // ---- the middle: the view ----
  const tip = el('div', 'gh-eng-tip'); tip.hidden = true;
  const exBtn = button('분해도', () => { view.explode = !view.explode; exBtn.setAttribute('aria-pressed', String(view.explode)); view.anim = performance.now(); dirty = true; }, { id: 'gh-explode' }); exBtn.setAttribute('aria-pressed', 'false');
  const homeBtn = button('시점 초기화', () => { home(); });
  const viewBox = el('div', 'gh-eng-view', el('div', 'gh-eng-tools', exBtn, homeBtn), tip, el('span', 'gh-eng-hint', '끌어서 돌리기 · 휠·두 손가락으로 확대 · 부품을 눌러 이름 보기'));
  const side = el('div', 'gh-eng-side', tb.el);
  const applyBtn = button('빌더에 적용 ◀', () => apply(), { kind: 'main', id: 'gh-eng-apply' });
  const bar = el('header', 'gh-bar', button('◀ 뒤로', () => ctx.router.back(), { kind: 'ghost', title: '뒤로 (Esc)' }), el('h1', 'gh-bar-t', '엔진 공방'), el('span', 'gh-grow'), applyBtn);
  root.append(bar, side, viewBox, info);
  // a phone: the view on top, the panels scrolling under it
  const scroll = el('div', 'gh-eng-scroll'); scroll.append(side, info); root.append(scroll);

  // ---- a change: the figures now, the model a moment after it rests ----
  let figT = 0, meshT = 0, meshKey = '';
  function changed() { car = normalise(car); range = [Math.min(range[0], car.engine.cc), Math.max(range[1], car.engine.cc)]; for (const s of syncs) s();
    clearTimeout(figT); figT = setTimeout(figures, 40) as unknown as number;
    const k = JSON.stringify([E().layout, E().cc, E().bs, E().valves, E().block, E().grade, E().intake, E().sump, E().turbo, E().intercooler]);
    if (k !== meshKey) { clearTimeout(meshT); meshT = setTimeout(() => { meshKey = k; rebuild(); }, 160) as unknown as number; }
    applyBtn.hidden = !onApply; voiceAgain(); }
  function figures() { spec = designSpec(car); curve = dynoCurve(car); sheet = engineSheet(car, curve); sweep = performance.now(); drawSheet(); drawTechs(); drawSoundRow(); dirtyDyno = true; }
  const dd = (t: string, v: string, u = '') => [el('dt', '', t), (() => { const x = el('dd', '', v); if (u) x.append(' ', el('small', '', u)); return x; })()];
  function drawSheet() { const s = sheet; sheetBox.textContent = '';
    sheetBox.append(...dd('최고 출력', `${s.hp}`, `hp · ${s.hpRpm.toLocaleString()} rpm`), ...dd('최대 토크', `${s.torque}`, `Nm · ${s.torqueRpm.toLocaleString()} rpm`), ...dd('리터당 출력', `${s.specific}`, 'hp/L'),
      ...dd('보어 × 행정', `${s.bore} × ${s.stroke}`, 'mm'), ...dd('무게 (보기류 포함)', `${s.mass}`, 'kg'), ...dd('크기 (길이·폭·높이)', `${s.length} · ${s.width} · ${s.height}`, 'mm'), ...dd('변속기 길이', `${s.box}`, 'mm'),
      ...dd('연비 추정 (90 · 120 km/h)', `${s.fuel90} · ${s.fuel120}`, 'L/100km'), ...dd('배출가스 등급 (임시)', s.emissions), ...dd('신뢰성', `${s.reliability}`, `· 정비 ${(s.serviceKm / 1000).toLocaleString()}천 km`),
      ...dd('엔진 원가 지수', `${s.cost}`, 'NSX C30A=100'), ...dd('개발 기간 (임시)', `${s.devMonths}`, '개월'));
    sheetBox.append(el('dt', '', '시험 차'), el('dd', '', el('small', '', `${car.name}: 연비는 이 차의 무게·공기 저항·기어로 셈합니다`))); }
  function drawTechs() { techs.textContent = ''; const limit = ctx.settings.sandbox.eraLimit, year = 1995, ts = engineTechs(E(), car.drive.gearbox);
    for (const t of ts) { const T = TECH_YEAR[t]; techs.append(el('span', `gh-tech${limit && T.year > year ? ' gh-late' : ''}`, `${T.name} ${T.year}`)); }
    yearNote.textContent = `이 엔진은 ${engineYear(E(), car.drive.gearbox)}년부터 만들 수 있습니다.` + (limit ? ` 연도 제한: ${year}년 기준으로 늦은 기술을 빨갛게 표시합니다(0.12에서는 막지 않습니다).` : ' 연도 제한은 꺼져 있습니다(설정 → 샌드박스).'); }

  // ---- the dyno: the curves drawn as the revs sweep up, the peaks marked; the rev control's needle ----
  let sweep = 0, dirtyDyno = true;
  const css = (n: string, d: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
  function drawDyno(now: number) { const c = dyno, dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(10, Math.round(c.clientWidth * dpr)), H = Math.max(10, Math.round(c.clientHeight * dpr)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); if (!g) return; const C = curve, ink = css('--gh-ink', '#222'), soft = css('--gh-soft', '#777'), line = css('--gh-line', '#ccc'), acc = css('--gh-accent', '#a0522d'), pw = css('--gh-good', '#3f7a3a');
    g.clearRect(0, 0, W, H); const L = 38 * dpr, R = W - 38 * dpr, T = 14 * dpr, B = H - 24 * dpr, r0 = 0, r1 = Math.ceil(C.redline / 1000) * 1000;
    const tMax = Math.ceil(Math.max(...C.torque) * 1.15 / 50) * 50, pMax = Math.ceil(Math.max(...C.hp) * 1.15 / 50) * 50;
    const X = (r: number) => L + (R - L) * (r - r0) / (r1 - r0), YT = (t: number) => B - (B - T) * t / tMax, YP = (p: number) => B - (B - T) * p / pMax;
    g.font = `${10 * dpr}px ${css('--gh-body', 'sans-serif')}`; g.lineWidth = dpr; g.strokeStyle = line; g.fillStyle = soft; g.textAlign = 'center';
    for (let r = 0; r <= r1; r += 1000) { g.beginPath(); g.moveTo(X(r), T); g.lineTo(X(r), B); g.stroke(); g.fillText(String(r / 1000), X(r), B + 14 * dpr); }
    g.textAlign = 'right'; for (let k = 0; k <= 4; k++) { const y = B - (B - T) * k / 4; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillStyle = acc; g.fillText(String(Math.round(tMax * k / 4)), L - 4 * dpr, y + 3 * dpr); g.textAlign = 'left'; g.fillStyle = pw; g.fillText(String(Math.round(pMax * k / 4)), R + 4 * dpr, y + 3 * dpr); g.textAlign = 'right'; }
    g.fillStyle = soft; g.textAlign = 'center'; g.fillText('×1000 rpm', (L + R) / 2, H - 2 * dpr); g.textAlign = 'left'; g.fillStyle = acc; g.fillText('토크 Nm', L, T - 3 * dpr); g.textAlign = 'right'; g.fillStyle = pw; g.fillText('출력 hp', R, T - 3 * dpr);
    // the red line's band
    g.fillStyle = 'rgba(200,40,30,0.12)'; g.fillRect(X(C.redline), T, R - X(C.redline), B - T);
    // the sweep: the revs rise from idle to the red line over 1.2 s (at once when the screen is to be calm)
    const calm = ctx.settings.screen.calm, k = calm ? 1 : Math.min(1, (now - sweep) / 1200), upTo = C.idle + (C.redline - C.idle) * (1 - (1 - k) ** 2);
    const path = (ys: number[], Y: (v: number) => number, col: string) => { g.strokeStyle = col; g.lineWidth = 2.5 * dpr; g.beginPath(); let first = true;
      for (let i = 0; i < C.rpm.length; i++) { if (C.rpm[i]! > upTo) break; const x = X(C.rpm[i]!), y = Y(ys[i]!); if (first) g.moveTo(x, y); else g.lineTo(x, y); first = false; } g.stroke(); };
    path(C.torque, YT, acc); path(C.hp, YP, pw);
    const mark = (r: number, y: number, col: string, text: string, right: boolean) => { if (r > upTo) return; g.fillStyle = col; g.beginPath(); g.arc(X(r), y, 4 * dpr, 0, Math.PI * 2); g.fill();
      g.font = `600 ${10.5 * dpr}px ${css('--gh-body', 'sans-serif')}`; g.textAlign = right ? 'right' : 'left'; g.fillStyle = ink; g.fillText(text, X(r) + (right ? -7 : 7) * dpr, y - 6 * dpr); };
    mark(C.peakTorque.rpm, YT(C.peakTorque.torque), acc, `${Math.round(C.peakTorque.torque)} Nm @ ${C.peakTorque.rpm.toLocaleString()}`, C.peakTorque.rpm > (r0 + r1) / 2);
    mark(C.peakHp.rpm, YP(C.peakHp.hp), pw, `${Math.round(C.peakHp.hp)} hp @ ${C.peakHp.rpm.toLocaleString()}`, true);
    // the cursor of the sweep, or the rev control's needle
    const needle = k < 1 ? upTo : rev.rpm > spec.idle * 1.05 || rev.thr > 0 ? rev.rpm : 0;
    if (needle) { g.strokeStyle = ink; g.lineWidth = 1.2 * dpr; g.setLineDash([4 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(X(needle), T); g.lineTo(X(needle), B); g.stroke(); g.setLineDash([]); }
    dirtyDyno = k < 1; }

  // ---- the rev control: a small engine model on the stand (its torque the physics', its own friction), the voice ----
  const rev = { rpm: 0, thr: 0, held: false, cut: 0 };
  let snd: Sound | null = null, voice: Voice | null = null, voiceKey = '';
  const wantSound = () => ctx.settings.sound.on;
  function voiceAgain() { if (!snd) return; const v = designVoice(E()), k = JSON.stringify(v); if (k === voiceKey) return; voiceKey = k; snd.dropVoices(new Set()); voice = snd.voice(k, v); }
  /** the sound started from a tap (a browser lets it start only then) */
  function startSound() { if (snd || !wantSound()) return; try { snd = new Sound({ scene: false }); snd.volume = ctx.settings.sound.volume; voiceKey = ''; voiceAgain(); } catch { snd = null; } }
  function stopSound() { snd?.close(); snd = null; voice = null; voiceKey = ''; }
  function drawSoundRow() { soundRow.textContent = ''; if (wantSound()) soundRow.append(el('p', 'gh-note', `엔진 소리: ${LAYOUT_NAME[E().layout]}${E().turbo ? `, 터보 ${E().turbo}` : ''}${E().intake === 'itb' ? ', 개별 스로틀 흡기음' : ''} · 음량은 설정 → 소리에서 바꿉니다`));
    else soundRow.append(toggle('엔진 소리 켜기 (게임 설정의 주행 소리)', false, v => { ctx.settings.sound.on = v; ctx.changed(); drawSoundRow(); if (v) startSound(); })); }
  const hold = (on: boolean) => { rev.held = on; revBtn.classList.toggle('gh-held', on); if (on) startSound(); };
  revBtn.addEventListener('pointerdown', e => { e.preventDefault(); revBtn.setPointerCapture(e.pointerId); hold(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) revBtn.addEventListener(ev, () => hold(false));
  revBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hold(true); } });
  revBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hold(false); });
  thr.addEventListener('input', () => { startSound(); });
  thr.addEventListener('pointerdown', () => startSound());
  function revStep(dt: number) { const s = spec, Tpk = s.torquePeak ?? torqueAt(s, s.torqueRpm), I = (s.inertia?.engine ?? 0.12) * 2.5;
    rev.thr = rev.held ? 1 : +thr.value; if (!on) return;
    if (rev.rpm <= 0) rev.rpm = s.idle;
    const fric = 0.06 * Tpk * (0.3 + 0.7 * rev.rpm / s.hpRpm) + 0.5 * (rev.rpm / 1000) ** 2;
    if (rev.rpm >= s.redline) rev.cut = 0.06; rev.cut -= dt;
    let Te = rev.cut > 0 ? 0 : rev.thr * torqueAt(s, rev.rpm);
    if (rev.rpm < s.idle) Te += fric + (s.idle - rev.rpm) * 0.08;   // the idle held
    rev.rpm = Math.max(s.idle * 0.9, rev.rpm + (Te - fric) / I * dt * 30 / Math.PI);
    if (voice) voice.set(rev.rpm, rev.cut > 0 ? 0 : rev.thr, 1, 0, true);
    if (snd) snd.volume = ctx.settings.sound.on ? ctx.settings.sound.volume : 0;
    tach.innerHTML = `${Math.round(rev.rpm / 10) * 10 | 0} <small>rpm · ${Math.round(torqueAt(s, rev.rpm) * rev.thr)} Nm</small>`;
    if (rev.thr > 0 || rev.rpm > s.idle * 1.02) dirtyDyno = true; }

  // ---- the 3D view: the stand on the studio floor, the orbit, the exploded view, the part pointed at ----
  const L = (): LiveRenderer | null => ctx.stage.L;
  let model: StandModel | null = null, onGpu: Mesh | null = null, g: ReturnType<LiveRenderer['car']> | null = null, dirty = true, raf = 0, last = 0;
  const view = { ang: Math.PI - 0.75, pitch: 22, zoom: 1, explode: false, anim: 0, k: 0 }; const home = () => { view.ang = Math.PI - 0.75; view.pitch = 22; view.zoom = 1; dirty = true; };
  const shownCache = new Map<number, Mesh>();
  function rebuild() { const t0 = performance.now(); try { model = standModel(car, 2); } catch (e) { console.warn('engine stand', e); return; } shownCache.clear(); dirty = true; tip.hidden = true;
    console.info(`engine stand ${E().layout}: ${model.mesh.n} triangles, ${Math.round(performance.now() - t0)} ms`); }
  const shown = (): Mesh | null => { if (!model) return null; const k = Math.round(view.k * 6) / 6; let M = shownCache.get(k); if (!M) { M = exploded(model.mesh, k); shownCache.set(k, M); } return M; };
  let lastView: { x: number; y: number; z: number; ang: number; pitch: number; mm: number; W: number; H: number; cy: number } | null = null;
  let frames = 0, draws = 0;
  function frame(now: number) { raf = requestAnimationFrame(frame); frames++; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    revStep(dt);
    const want = view.explode ? 1 : 0; if (view.k !== want) { const t = ctx.settings.screen.calm ? 1 : Math.min(1, (now - view.anim) / 450); view.k = want ? Math.max(view.k, t) : Math.min(view.k, 1 - t); dirty = true; }   // over 0.45 s, however slow the frames
    if (dirtyDyno) drawDyno(now);
    const R = L(), M = shown(); if (!R || !M || !dirty) return; dirty = false; draws++;
    const cv = ctx.stage.canvas, dpr = Math.min(1.75, devicePixelRatio || 1), W = Math.max(2, Math.round(cv.clientWidth * dpr)), H = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (M !== onGpu) { g = onGpu ? R.swapCar(onGpu, M) : R.car(M); onGpu = M; }
    // the engine framed in the view's box: its size (spread out, bigger), the box's middle
    const box = viewBox.getBoundingClientRect(), cr = cv.getBoundingClientRect(), b = model!, sz = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * (1 + 0.55 * view.k);
    const mm = Math.max(sz * 1.25 / Math.max(120, box.width * dpr), sz * 1.0 / Math.max(100, box.height * dpr)) * view.zoom;
    const cx = (box.left + box.width / 2 - cr.left) * dpr, cyPx = (box.top + box.height * 0.55 - cr.top) * dpr, shift = cx - W / 2, ox = -shift * mm / 1000;
    const rx = Math.sin(view.ang), ry = -Math.cos(view.ang), zc = ((b.min[2] + b.max[2]) / 2 + 120 * view.k) / 1000;
    lastView = { x: rx * ox, y: ry * ox, z: zc, ang: view.ang, pitch: view.pitch, mm, W, H, cy: cyPx / H };
    R.render(lastView, [{ g: g!, x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, steerL: 0, steerR: 0, spin: 0, player: true, lamps: 0 }], [], [],
      { look: ctx.settings.graphics.look === 'toon' ? 3 : ctx.settings.graphics.look === 'baked' ? 0 : ctx.settings.graphics.look === 'stepped' ? 1 : 2, glass: 0.8, rays: true, bloomK: 0.8, reflK: 1.2, dof: 0, outW: 0.5, outK: 0.6 }); }
  // the orbit: drag to turn, the wheel or two fingers to zoom; a tap (no drag) names the part under it, hovering too
  { const ptrs = new Map<number, { x: number; y: number; x0: number; y0: number }>(); let pinch = 0, hoverT = 0;
    const name = (cx: number, cy: number, pin: boolean) => { const M = shown(); if (!M || !lastView) return; const cv = ctx.stage.canvas.getBoundingClientRect(), dpr = lastView.W / Math.max(1, cv.width);
      const n = pickPart(M, lastView, (cx - cv.left) * dpr, (cy - cv.top) * dpr), box = viewBox.getBoundingClientRect();
      if (!n) { if (pin) tip.hidden = true; return; } tip.innerHTML = ''; tip.append(el('b', '', partName(n)), el('span', '', partSpec(n, car, sheet))); tip.hidden = false;
      tip.style.left = `${Math.min(box.width - 220, Math.max(6, cx - box.left + 14))}px`; tip.style.top = `${Math.max(46, cy - box.top - 10)}px`; tip.dataset.part = n; };
    viewBox.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('button')) return; viewBox.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); } });
    viewBox.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse' && !hoverT) hoverT = requestAnimationFrame(() => { hoverT = 0; name(e.clientX, e.clientY, false); }); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) { view.ang -= dx * 0.008; view.pitch = Math.max(4, Math.min(80, view.pitch + dy * 0.25)); dirty = true; tip.hidden = true; }
      else if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y); view.zoom = Math.max(0.4, Math.min(2.5, view.zoom * pinch / d)); pinch = d; dirty = true; } });
    const off = (e: PointerEvent) => { const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); pinch = 0; if (p && e.type === 'pointerup' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) name(e.clientX, e.clientY, true); };
    viewBox.addEventListener('pointerup', off); viewBox.addEventListener('pointercancel', off); viewBox.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) tip.hidden = true; });
    viewBox.addEventListener('wheel', e => { e.preventDefault(); view.zoom = Math.max(0.4, Math.min(2.5, view.zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1))); dirty = true; }, { passive: false }); }
  const onResize = () => { dirty = true; dirtyDyno = true; };

  // ---- the way back: to the builder with the engine, or away with the changes asked about ----
  function apply() { if (!onApply) return; onApply(structuredClone(E())); start = sig(); toast('빌더의 차에 엔진을 얹었습니다'); ctx.router.back(); }
  let asking = false;
  const api = { get design() { return car; }, get entry() { return entry; }, get curve() { return curve; }, get sheet() { return sheet; }, get rpm() { return rev.rpm; }, get triangles() { return onGpu?.n ?? 0; },
    get exploded() { return view.k; }, get frames() { return frames; }, get draws() { return draws; }, get on() { return on; }, set(f: (e: Design['engine']) => void) { f(E()); changed(); }, pick: (x: number, y: number) => { const M = shown(); return M && lastView ? pickPart(M, lastView, x, y) : null; }, get view() { return lastView; } };
  return { api,
    enter(p: EngineParams, how: Move) { style(); ctx.backdrop.stop(); ctx.stage.use('engine', true, R => { R.setGround(studioFloor()); R.setTrack(1, 30, 12, 0); });
      if (how !== 'back') { onApply = p?.onApply; const base = p?.design ?? ctx.recent(); car = normalise(structuredClone(base)); entry = null; range = familyRange(car.engine.cc);
        if (p?.entry) { car = withEngine(car, joinEngine(p.entry.family, p.entry.variant, car)); range = [...p.entry.family.cc]; entry = { id: p.entry.id, name: p.entry.name }; }
        nameIn.value = entry?.name ?? (p?.design ? `${car.name}의 엔진` : `${LAYOUT_NAME[car.engine.layout]} ${(car.engine.cc / 1000).toFixed(1)}`); start = sig(); meshKey = ''; rev.rpm = 0; view.explode = false; view.k = 0; exBtn.setAttribute('aria-pressed', 'false'); }
      document.title = `GEARHOUSE · 엔진 공방${onApply ? ` · ${car.name}` : ''}`;
      ctx.layer.append(root); on = true; changed(); figures(); drawSoundRow(); fillList(); dirty = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); addEventListener('resize', onResize);
      requestAnimationFrame(() => { if (!root.contains(document.activeElement)) (root.querySelector<HTMLElement>('.gh-tab[aria-selected="true"]'))?.focus({ preventScroll: true }); }); },
    leave() { on = false; cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', onResize); hold(false); stopSound(); root.remove(); tip.hidden = true; },
    /** the back press with changes not handed to the builder: asked first */
    back() { if (asking || !onApply || sig() === start) return false; asking = true;
      void dialog('엔진 공방 나가기', ['바꾼 엔진을 빌더의 차에 얹을까요?'], [['apply', '적용하고 나가기', { kind: 'main' }], ['drop', '버리고 나가기', { kind: 'danger' }], ['', '계속 편집', { kind: 'ghost' }]]).then(v => { asking = false;
        if (v === 'apply') apply(); else if (v === 'drop') { start = sig(); ctx.router.back(); } });
      return true; } }; }
