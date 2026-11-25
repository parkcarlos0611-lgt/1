// The parts builder (docs/systems/98_alpha_interface_and_builder_plan.md, B3 and B4): a car's design (core/design.ts)
// edited on a studio turntable. The live renderer (render/live/renderer.ts, as the drive page and the photo mode use it:
// its sun and shadows, the photographed sky, the PBR textures, the looks) draws the design's car (render/car/design.ts),
// built again only when the body's fields change and a moment after a slider rests. Left: the choices in seven steps,
// taken in a guided order with any step open at any time (docs/systems/98 section 11: the base, the engine and drive,
// the suspension (alpha 0.13: docs/systems/102, its own step, with its small graphs and the suspension view on), the
// body's shapes, the kit, the paint, then the check and the test drive; the engine's details greyed out, with the
// reason, where its development grade does not allow them; a step marked where a fit check concerning it is not
// clean, so a change upstream shows what it broke further on); right: the figures
// worked out from the design (race/design.ts) as it changes, its class from them, its cost and reliability
// (placeholders until B5), the fit of its parts (race/fit.ts: each check's verdict and the fixes, applied by a click),
// and what the drive page measured of it. Designs are kept in this browser, carried as JSON files, and sent to
// the drive page in its link ("시험 주행"), which drives them with the physics made from them and records its runs.
import { LiveRenderer } from '../render/live/renderer';
import { freeGpu } from '../render/live/gpu';
import { loadSky } from '../render/live/groundtex';
import { studioFloor } from '../render/live/studio';
import type { Mesh } from '../render/car/mesh';
import { designMesh, designChoices, withoutParts, openParts } from '../render/car/design';
import { bareMesh, bounce } from '../render/car/suspension/view';
import { setPartStyle, partStyle, styleForLook } from '../render/car/powertrain';
import { designSpec, designFigures, designHeight, type DesignFigures } from '../race/design';
import { CLEARANCE, type FitResult } from '../race/fit';
import { tierOf, tierRoom, tierFloor, tierTopFloor, tierChevrons, roomText, tierFor, tierLock, tierById, outOfEra, ROAD_TIERS, TIER_GROUP_NAME, type Tier } from '../race/tiers';
import { chosenTier, withTier, freeHp, needOf, needText, sliderWall, wallStop, fitEngine, type Need, type CapField } from './builder_tier';
import { classPick } from './builder_classpick';
import { loadSettings } from './shell/settings';
import { BODY_NAME } from '../core/names';
import { LIMITS, BODY_BASES, isModelBase, MODEL_OWN, BUMPERS_ALL, LAMPS_ALL, WHEELS_ALL, LUMP_SWAPS, plateOk, type BodyBase, type ModelSwaps, BODY_LIMITS, DIMS, LAYOUTS, LAYOUT_NAME, type DimKey, GRADE_NAME, GRADES, gradeLock, gradeBoost, gradeRedline, normalise, applyPatch, type BaseId, type Design, type NoseKind, type TailKind, type WheelKind, FACE_KEYS, faceLock, type Face, type FaceKey,
  type Grade, type Structure, type Panels, type Intake, type Compression, type Sump, type Block, type Turbos, type Interior,
  SUSP_KINDS, SUSP_KIND_NAME, SUSP_LIMITS, SUSP_OWN, suspLock, suspFieldLock, type SuspKind, type RcPreset, type SuspAxle } from '../core/design';
import { STEPS, FIT_STEP, stepNo, isStep, stepFrom, seenFrom, type StepId } from './builder_steps';
import { suspFigures, suspPanel } from './builder_susp';
import { savedEngines, joinEngine, withEngine } from '../core/engines';
import { ENABLED_BODIES, enabledDesign, starterDesign } from '../core/bodies';
import { randomPlate, currentDesign, keepCurrent, savedDesigns, saveDesign, deleteDesign, fromPreset, newDesign, encodeDesign, designJson, parseDesign, measured, designSig, newId, KEYS, type KeyStore } from '../core/designstore';
import { installKit } from './kit/style';
import { installPick, pickCard, setCard, railTab } from './kit/pick';
import { statBar } from './kit/parts';
import { STATS, type StatDef } from './kit/logic';
import { icon } from './kit/icons';
import { stepIcon, STEP_SHORT, bumperPic, lampPic, wheelPic, basePic } from './builder_pics';
import { partThumbs, type ThumbSpec } from './builder_thumbs';
import { placeTool } from './builder_place';
import { viewRay } from '../render/car/skin';
import type { PlacedId } from '../core/placed';
import { FRAMES, FRAME_IDS, FRAME_DIMS, FRAME_DIM_NAME, NO_FRAME_DIMS, GLASS, GLASS_IDS, INTERIOR_SETS, INTERIOR_SET_IDS, TRIM_IDS, TRIM_NAME, interiorOfKit, type FrameId, type FrameDimKey, type GlassId, type InteriorSetId, type TrimId } from '../core/frames';
import texAlb from '../assets/textures/pbr/albedo.jpg';
import texNor from '../assets/textures/pbr/normal.jpg';
import texRgh from '../assets/textures/pbr/rough.jpg';
import texMeta from '../assets/textures/pbr/pbr.json';

/** what a page holding the builder gives it (the game's one page, ui/shell): the root its markup is in (found there even
 *  while it is taken off the page), the one renderer shared by the screens (its sky and textures loaded by the shell),
 *  the design to open, and what the test drive does (a screen of the same page instead of a new window). A page of its
 *  own (builder3d.page.html) gives nothing */
export interface BuilderHost { root?: ParentNode; renderer?: LiveRenderer | null; design?: Design; onTestDrive?: (d: Design) => void;
  /** step ④'s "엔진 공방에서 편집": the engine designer opened with this car (the game's page; it hands the engine back through use()) */
  onEngineShop?: (d: Design) => void;
  /** the toon glass's reflection, as the game's settings hold it now (0 off .. 1 as made; a page of its own: as made) */
  glassRefl?: () => number }
export interface BuilderApi { /** shown again (with another design, or as it was left: the same step) */ enter(d?: Design): void; /** hidden: it stops drawing */ leave(): void;
  readonly design: Design; readonly step: string; use(d: Design): void }
// The builder below is one function's body, mounted once on its markup; it is not indented, so its lines read as before.
export function mountBuilder(host: BuilderHost = {}): BuilderApi {
installKit(); installPick();   // the design system's parts (docs/systems/110 G2, G4): once a page
const R = host.root ?? document;
const $ = <T extends HTMLElement>(id: string) => (R === document ? document.getElementById(id) : R.querySelector(`#${id}`)) as T;
const store: KeyStore | null = (() => { try { return localStorage; } catch { return null; } })();
// the enabled bodies only (docs/systems/113 V0): a design on an old body is not opened; a new one starts on the 959
let D: Design = host.design && enabledDesign(host.design) ? structuredClone(host.design) : (() => { const c = currentDesign(store); return c && enabledDesign(c) ? c : starterDesign(); })();
// the class (docs/systems/115 C1): an older design (no class) takes the rung it reaches, so it opens as it was; a new one asks first
if (!D.fresh) D = withTier(D);
/** the sandbox's era lock opened (settings > 샌드박스 "시대 잠금 풀기"): the hyper rungs may be chosen. Read from the game's saved settings */
const eraOpen = (): boolean => { try { return loadSettings(store).sandbox.eraOpen; } catch { return false; } };

// ---- the names on the page ----
const BASE_NAME: Record<BodyBase, string> = { ...BODY_NAME };
const KIND_NAME: Record<string, string> = { round: '둥근 코', pointed: '뾰족한 코', mass: '덩어리 범퍼 코', capsule: '캡슐 꼬리', plain: '평평한 앞면', sunk: '램프가 들어간 앞면', frame: '테두리 꼬리', roundLamps: '둥근 램프 꼬리', ducktail: '덕테일',
  fiveSpoke: '5스포크', disc: '디스크', star: '스타' };
const PAINTS = ['#b0121b', '#f5c300', '#1d3f8f', '#f2f0ea', '#151515', '#2f6b3a', '#9aa1a6', '#d8661c'];

// ---- the controls: each reads its value from the design and writes it back; all are refreshed when a design is loaded ----
const syncs: (() => void)[] = [];
const field = (label: string, el: HTMLElement, out?: HTMLElement) => { const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('label'); l.textContent = label; if (out) l.append(out); r.append(l, el); return r; };
/** a choice of buttons; `lock` greys a value out with its reason (shown under the buttons: a phone has no hover) */
function seg<T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, lock?: (v: T) => string | null, need?: (v: T) => Need | null): HTMLElement {
  const box = document.createElement('div'); box.className = 'seg'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  const of = offerBox();
  const bs = opts.map(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-opt'; b.textContent = t;
    b.addEventListener('click', () => { if (lock?.(v)) return; const N = v === get() ? null : need?.(v); if (N) { of.show(`${label} ${t}`, N, () => set(v)); return; } set(v); changed(); }); box.append(b); return [v, t, b] as const; });
  const why = document.createElement('small'); why.className = 'lock';
  syncs.push(() => { const locked: string[] = [];
    for (const [v, t, b] of bs) { const L = lock?.(v) ?? null, N = L || v === get() ? null : need?.(v) ?? null; b.setAttribute('aria-pressed', String(v === get())); b.disabled = !!L; b.title = L ?? ''; markNeed(b, N);
      if (L) locked.push(`${t}: ${L}`); else if (N) locked.push(`${t}: ${needText(N)}`); }
    why.textContent = locked.join(' · '); why.hidden = !locked.length; });
  const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.className = 'lab'; l.textContent = label; r.append(l, box, why, of.el); return r; }
/** the class's wall on an option (docs/systems/115 §3): not greyed, but marked with the rung it needs in that rung's
 *  colour and a lock; pressed, it says why and offers the class up */
function markNeed(b: HTMLElement, N: Need | null) { for (const c of Array.from(b.classList)) if (c.startsWith('gk-tier-')) b.classList.remove(c);
  b.classList.toggle('gk-need', !!N); if (N) { b.classList.add(`gk-tier-${N.need.group}`); b.dataset.need = N.need.id; b.setAttribute('aria-disabled', 'true'); b.title = needText(N); }
  else { delete b.dataset.need; b.removeAttribute('aria-disabled'); } }
/** the reason a wall holds, and the way past it: the class up to the rung it needs (closed rungs said so), then the change */
const offers: HTMLElement[] = [];
function offerBox(): { el: HTMLElement; show(what: string, N: Need, apply?: () => void): void } {
  const o = document.createElement('div'); o.className = 'offer'; o.hidden = true; o.setAttribute('aria-live', 'polite'); offers.push(o);
  return { el: o, show(what, N, apply) { const key = `${what}|${N.need.id}`; if (!o.hidden && o.dataset.k === key) return; o.dataset.k = key; o.textContent = ''; o.hidden = false; const p = document.createElement('p'), t = chosenTier(D);
    p.textContent = `${what}: 출력 ${N.hp.toLocaleString()} hp로 ${t.id} 상한 ${t.hpMax.toLocaleString()} hp를 넘습니다. ${N.need.id} 필요.`; o.append(p);
    const row = document.createElement('div'), b = document.createElement('button'); row.className = 'btns'; b.type = 'button'; b.className = BTN_MAIN;
    b.textContent = N.locked ? `${N.need.id}: ${N.locked}` : apply ? `차급을 ${N.need.id}로 올리고 적용` : `차급을 ${N.need.id}로 올리기`; b.disabled = !!N.locked;
    b.addEventListener('click', () => { o.hidden = true; D.tier = N.need.id; apply?.(); changed(); flash(`차급을 ${N.need.id}로 올렸습니다`); });
    const x = document.createElement('button'); x.type = 'button'; x.className = BTN; x.textContent = '그대로 두기'; x.addEventListener('click', () => { o.hidden = true; });
    row.append(b, x); o.append(row); navigator.vibrate?.(12); } }; }
/** the parts library's way of a choice (docs/systems/110 G4): a grid of thumbnail cards, a picture and a name each; the
 *  chosen one green, a locked one grey with its lock and its reason written under the grid (a phone has no hover) */
/** the cards' rendered pictures (ui/builder_thumbs.ts): a card given a part (the fourth of its option) shows its drawn
 *  picture until the part's own is rendered, and its row gets the small toggle of the kind's view */
const TH = partThumbs();
function cards<T extends string | number>(label: string, opts: [T, string, string, ThumbSpec?][], get: () => T, set: (v: T) => void, lock?: (v: T) => string | null): HTMLElement {
  const box = document.createElement('div'); box.className = 'gk-cards'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  const bs = opts.map(([v, t, pic, part]) => { const b = pickCard({ pic, name: t }); b.dataset.v = String(v); b.addEventListener('click', () => { if (lock?.(v)) return; set(v); changed(); }); if (part) TH.want(b, part); box.append(b); return [v, t, b] as const; });
  const why = document.createElement('small'); why.className = 'lock';
  syncs.push(() => { const locked: string[] = [];
    for (const [v, t, b] of bs) { const L = lock?.(v) ?? null; setCard(b, v === get(), L); if (L) locked.push(`${t}: ${L}`); }
    why.textContent = locked.join(' · '); why.hidden = !locked.length; });
  const r = document.createElement('div'); r.className = 'row'; r.dataset.slot = label; const l = document.createElement('span'); l.className = 'lab'; l.textContent = label; const part = opts.find(o => o[3])?.[3]; if (part) l.append(TH.viewChips(part.kind)); r.append(l, box, why); return r; }
function range(label: string, [a, b]: readonly [number, number], step: number, get: () => number, set: (v: number) => void, show: (v: number) => string, id?: string, wall?: CapField): HTMLElement {
  const i = document.createElement('input'); i.type = 'range'; i.className = 'gk-range'; i.min = String(a); i.max = String(b); i.step = String(step); if (id) i.id = id; const v = document.createElement('span'); v.className = 'v';
  const of = wall ? offerBox() : null, wn = document.createElement('small'); wn.className = 'wallnote'; wn.hidden = true;
  i.addEventListener('input', () => { let x = +i.value;
    // the class's wall (docs/systems/115 §3): the handle stops at the last value under the cap, with a short buzz and the reason
    if (wall) { const w = wallOf(wall, step), y = wallStop(w, get(), x); if (y !== x) { i.value = String(y);
      if (w.need) { const t = chosenTier(D); flash(`${t.id} 상한 ${t.hpMax.toLocaleString()} hp: ${label} ${show(y)}까지`); of!.show(label, { need: w.need, hp: w.hp[w.values.indexOf(w.at!)] ?? 0, locked: tierLock(w.need, eraOpen()) }); } } x = y; }
    set(x); v.textContent = show(x); changed(); });
  syncs.push(() => { i.value = String(get()); v.textContent = show(get()); });
  if (wall) syncs.push(() => { const w = wallOf(wall, step), lo = +i.min, hi = +i.max; i.classList.toggle('gk-walled', w.at !== null && hi > lo);
    if (w.at !== null && w.need) { i.style.setProperty('--wall', `${Math.max(0, Math.min(100, (w.at - step / 2 - lo) / (hi - lo) * 100)).toFixed(1)}%`); i.style.setProperty('--beyond', `var(--gk-cls-${w.need.group.toLowerCase()}0)`);
      wn.textContent = `${show(w.at)}부터 ${w.need.id} 필요`; wn.dataset.need = w.need.id; wn.className = `wallnote gk-tier-${w.need.group}`; wn.hidden = false; } else wn.hidden = true; });
  const r = field(label, i, v); if (wall) r.append(wn, of!.el); return r; }
/** each engine slider's wall, kept while the rest of the engine and the class stay as they are (a drag computes it once) */
const walls = new Map<string, ReturnType<typeof sliderWall>>();
function wallOf(k: CapField, step: number) { const key = `${k}|${D.tier}|${JSON.stringify({ ...D.engine, [k]: 0 })}`; let w = walls.get(key);
  if (!w) { if (walls.size > 60) walls.clear(); w = sliderWall(D, k, step); walls.set(key, w); }
  // the wall above the value as it is now (the table holds every step; only "where it is" moves during a drag)
  const i0 = w.values.reduce((bi, x, j) => Math.abs(x - D.engine[k]) < Math.abs(w!.values[bi]! - D.engine[k]) ? j : bi, 0), lim = Math.max(w.cap, w.now); let at: number | null = null, need: Tier | null = null;
  for (let j = i0 + 1; j < w.values.length; j++) if (w.hp[j]! > lim) { at = w.values[j]!; need = tierFor(w.hp[j]!); break; }
  return { ...w, at, need }; }
/** an engine option's need (the class's wall), kept while the engine and the class stay as they are */
const needs = new Map<string, Need | null>();
function needFor(k: string, change: (e: Design['engine']) => void): Need | null { const key = `${k}|${D.tier}|${JSON.stringify(D.engine)}`;
  if (!needs.has(key)) { if (needs.size > 400) needs.clear(); needs.set(key, needOf(D, change, eraOpen())); } return needs.get(key)!; }
function check(label: string, get: () => boolean, set: (v: boolean) => void, id?: string, need?: () => Need | null): HTMLElement {
  const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; if (id) i.id = id; l.append(i, ` ${label}`);
  if (!need) { i.addEventListener('change', () => { set(i.checked); changed(); }); syncs.push(() => { i.checked = get(); }); return l; }
  // a switch the class's wall holds (turning it on would pass the cap): marked with the rung it needs, the reason when pressed
  const of = offerBox(), box = document.createElement('div'); box.className = 'checkrow'; box.append(l, of.el);
  i.addEventListener('change', () => { const N = i.checked ? need() : null; if (N) { i.checked = false; of.show(label, N, () => set(true)); return; } set(i.checked); changed(); });
  syncs.push(() => { i.checked = get(); markNeed(l, get() ? null : need()); }); return box; }
function select<T extends string>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, id?: string): HTMLElement {
  const s = document.createElement('select'); s.className = 'gk-field'; if (id) s.id = id; for (const [v, t] of opts) s.add(new Option(t, v)); s.addEventListener('change', () => { set(s.value as T); changed(); }); syncs.push(() => { s.value = get(); }); return field(label, s); }
/** the kit's buttons, the small size (docs/systems/110 G4): blue the secondary, yellow the main action */
const BTN = 'btn gk-btn gk-sm gk-b', BTN_MAIN = 'btn main gk-btn gk-sm gk-y';
const note = (t: string) => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; return p; };
const h2 = (t: string) => { const h = document.createElement('h2'); h.textContent = t; return h; };
const sign = (v: number, u: string) => `${v > 0 ? '+' : ''}${v} ${u}`;

// ---- the steps: the design in a guided order (going back always allowed, and so is going ahead); the saved designs
// and the files on a page of their own, opened from the bar at the top ----
// (the steps, their order and the fit checks' steps: ui/builder_steps.ts)
const pane = new Map<string, HTMLElement>(), stepBtn = new Map<StepId, HTMLButtonElement>();
for (const id of [...STEPS.map(s => s[0]), 'files']) { const p = document.createElement('section'); p.className = 'pane'; p.dataset.tab = id; $('panes').append(p); pane.set(id, p); }
// the steps on a rail of icon tabs (docs/systems/110 G4: a vertical rail at the left, a strip at the bottom on a phone,
// where a tab opens the drawer at its step and the current one closes it again)
for (const [id, name] of STEPS) { const li = document.createElement('li'), b = railTab({ pic: stepIcon(id), label: STEP_SHORT[id], n: stepNo(id) + 1 }); b.dataset.step = id; b.title = name;
  const badge = document.createElement('span'); badge.className = 'badge'; badge.hidden = true; b.append(badge);
  b.addEventListener('click', () => { const phone = innerWidth <= 760, open = document.body.classList.contains('open');
    if (phone && open && !onFiles && id === step) { drawer(false); return; } go(id); if (phone) drawer(true); });
  li.append(b); $('steps').append(li); stepBtn.set(id, b); }
const add = (tab: string, ...els: HTMLElement[]) => pane.get(tab)!.append(...els);
// the class chip (docs/systems/115 §3): the chosen rung at the rail's head (the phone's strip: its start); it opens the class pick
const chip = document.createElement('button'); chip.type = 'button'; chip.id = 'tierChip'; chip.className = 'gk-tchip';
{ const li = document.createElement('li'); li.className = 'tierchip'; li.append(chip); $('steps').prepend(li); }
chip.addEventListener('click', () => openPick(false));
/** the class pick (ui/builder_classpick.ts): a new design's first screen, and the chip's */
const picker = classPick($('tierPick'), {
  choose(t, fit) { const was = freeHp(D); D.tier = t.id; delete D.fresh; if (fit) D = fitEngine(D, t.hpMax); const now = freeHp(D);
    changed(); flash(now < was ? `차급 ${t.id}: 엔진을 ${now.toLocaleString()} hp로 맞췄습니다` : `차급 ${t.id} · ${TIER_GROUP_NAME[t.group]}: 출력 ${Number.isFinite(t.hpMax) ? `${t.hpMax.toLocaleString()} hp까지` : '상한 없음'}`); },
  cancel() { if (!D.fresh) return; delete D.fresh; D = withTier(D); changed(); } });
function openPick(fresh: boolean) { drawer(false); picker.open({ design: D, fresh, eraOpen: eraOpen() }); }
/** where each design was left (its step, the steps seen), kept in this browser (a step kept by the six-step builder
 *  before alpha 0.13 is read by stepFrom: by its id, or a number as the six steps') */
const STEP_KEY = 'gearhouse.builder.step.v1';
let step: StepId = 'frame', onFiles = false, seen = new Set<StepId>(['frame']);
function keptSteps(): Record<string, { step: StepId; seen: StepId[] }> { try { const o: unknown = JSON.parse(store?.getItem(STEP_KEY) ?? '{}'); return o && typeof o === 'object' ? o as Record<string, { step: StepId; seen: StepId[] }> : {}; } catch { return {}; } }
function keepStep() { try { const rest = Object.entries(keptSteps()).filter(([k]) => k !== D.id).slice(0, 99); store?.setItem(STEP_KEY, JSON.stringify(Object.fromEntries([[D.id, { step, seen: [...seen] }], ...rest]))); } catch { /* not kept */ } }
/** the step a design was left at (a new one starts at the first) */
function restoreStep() { const k = keptSteps()[D.id]; step = stepFrom(k?.step) ?? 'frame'; seen = new Set([...seenFrom(k?.seen), step]); onFiles = false; showStep(); }
function go(id: StepId | 'files') { if (id === 'files') onFiles = true; else { onFiles = false; step = id; seen.add(id); keepStep(); } showStep(); $('panes').scrollTop = 0; }
/** the suspension view put on by step ⑤ (and off again when it is left, unless the viewer had it on already) */
let suspAuto = false;
function showStep() { const at = onFiles ? 'files' : step;
  document.body.classList.toggle('at-check', at === 'check');   // the figures' own fit list folded away while ⑧ shows it in full
  if (at === 'susp' && !view.susp) { suspAuto = true; setSuspView(true); } else if (at !== 'susp' && suspAuto) { suspAuto = false; setSuspView(false); }
  if (at === 'susp') suspGraphs();
  if (at !== 'parts') place.end();
  for (const [k, q] of pane) q.classList.toggle('on', k === at);
  for (const [id, b] of stepBtn) { const now = !onFiles && id === step, done = seen.has(id) && !now;
    if (now) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); b.classList.toggle('gk-seen', done); b.classList.toggle('gk-unseen', !seen.has(id)); b.dataset.state = now ? '지금 단계' : done ? '본 단계' : '아직 안 본 단계'; label(id); }
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

// ① 차체 덩어리 (docs/systems/115 §4, F1): the lump's card, its dimensions (§4-4: the cage stretched; the physics reads
// them as the body's own), its structure. A kit base's own dimensions (the old bases, off in the game) stay below, hidden
const frameD = () => D.body.frame ?? { id: 'A959' as FrameId, dims: { ...NO_FRAME_DIMS } };
/** the interior set and its trim (an older design: its kit's as a set) */
const interiorD = () => D.interior ?? interiorOfKit(D.kit.interior);
add('frame', cards<FrameId>('차체 덩어리', FRAME_IDS.map(id => [id, `${FRAMES[id].name} · ${FRAMES[id].suits}`, basePic(), { kind: 'frame', v: id }] as [FrameId, string, string, ThumbSpec]), () => frameD().id, v => { D.body.frame = { ...frameD(), id: v }; }),
  note('차체 덩어리는 구멍이 하나도 없는 차체입니다. 바퀴 아치와 허브 자리, 엔진룸 크기, 앞면적이 여기서 정해집니다. 창문은 ②에서, 램프·범퍼·휠 같은 부품은 ③에서 고릅니다. 차급과는 무관하고, 카드의 "추천"은 꼬리표일 뿐입니다.'),
  ...frameSliders(), ...dimSliders(),
  seg<Structure>('구조 소재 (모노코크·프레임)', [['steel', '강철'], ['hss', '고장력강'], ['aluminium', '알루미늄'], ['honeycomb', '알루미늄 허니콤'], ['cfrp', '탄소섬유']], () => D.body.structure, v => { D.body.structure = v; }),
  note('같은 강성에서 강철 대비 무게: 고장력강 0.9, 알루미늄 0.6, 허니콤 0.5, 탄소섬유 0.45. 가벼울수록 비싸고, 탄소섬유는 수작업입니다.'),
  seg<Panels>('패널 소재', [['steel', '강철'], ['aluminium', '알루미늄'], ['frp', 'FRP'], ['cfrp', '탄소섬유']], () => D.body.panels, v => { D.body.panels = v; }),
  note('패널 무게: 알루미늄 0.55, FRP 0.6 (소량 생산에 싸다), 탄소섬유 0.4. 강철은 수리가 쉽습니다.'));
/** ① the lump's dimensions (§4-4): each within its frame's range, the measure the car then has beside the change */
function frameSliders(): HTMLElement[] { const o = () => FRAMES[frameD().id], d = () => frameD().dims, mm = (v: number) => sign(v, 'mm'), n = (v: number) => Math.round(v).toLocaleString();
  const SHOW: Record<FrameDimKey, (v: number) => string> = { overhangF: v => `${mm(v)} · 전장 ${n(o().own.length + d().overhangF + d().wheelbase + d().overhangR)} mm`, wheelbase: v => `${mm(v)} · ${n(o().own.wheelbase + v)} mm`,
    overhangR: v => `${mm(v)} · 전장 ${n(o().own.length + d().overhangF + d().wheelbase + d().overhangR)} mm`, width: v => `${mm(v)} · ${n(o().own.width + v)} mm (윤거도 함께)`, roof: v => `${mm(v)} · 전고 ${n(o().own.height + v + d().ride)} mm`,
    ride: v => `${mm(v)} · ${CLEARANCE[D.body.base] + v} mm` };
  const out: HTMLElement[] = [h2('치수')], modelOnly = (e: HTMLElement) => { syncs.push(() => { e.hidden = !isModelBase(D.body.base); }); return e; };
  for (const k of FRAME_DIMS) out.push(modelOnly(range(FRAME_DIM_NAME[k], FRAMES.A959.ranges[k], k === 'wheelbase' ? 10 : 5, () => d()[k], v => { D.body.frame = { ...frameD(), dims: { ...d(), [k]: v } }; }, SHOW[k], `frame-${k}`)));
  out.push(note('케이지를 구간별로 늘입니다: 앞 오버행은 코, 휠베이스는 지붕과 문, 뒤 오버행은 엔진 덮개와 꼬리. 바퀴 아치는 늘이지 않고 옮기기만 해서 둥근 모양을 지킵니다. 범위 양 끝에서 면이 늘어지거나 꺾이지 않는지 검사했습니다. 치수는 앞면적, 무게, 무게 배분, 엔진룸 크기(뒤 오버행)에 들어갑니다.'),
    btnRow('치수 원래대로', () => { D.body.frame = { ...frameD(), dims: { ...NO_FRAME_DIMS } }; changed(); }));
  modelOnly(out[0]!); modelOnly(out[out.length - 2]!); modelOnly(out[out.length - 1]!); return out; }
// ② 창문 (§4-2): a set of the lump's own cells (material only, no new faces); none: the cabin in body colour
add('glass', cards<GlassId | 'none'>('창문 세트', [['none', '고르지 않음 (차체 색)', basePic(), { kind: 'glass', v: 'none' }] as [GlassId | 'none', string, string, ThumbSpec],
    ...GLASS_IDS.map(g => [g, GLASS[g].name, basePic(), { kind: 'glass', v: g }] as [GlassId | 'none', string, string, ThumbSpec])], () => D.body.glass === undefined ? 'stock' : D.body.glass ?? 'none', v => { D.body.glass = v === 'none' ? null : v; }),
  note('창문 세트는 덩어리의 면을 그대로 두고 어느 칸이 유리인지만 정합니다(삼각형이 늘지 않습니다). 세트를 고르면 문·보닛·엔진 덮개의 패널선이 진해집니다. 유리 색은 나중에 칠·마감에서 고릅니다.'),
  ...GLASS_IDS.map(g => note(`${GLASS[g].name}: ${GLASS[g].note}`)));
/** a kit base's dimensions (the old bases, off in the game): against the base's own (core/design.ts BodyDims), each
 *  slider's range its base's (BODY_LIMITS); the car is built again a moment after a slider rests */
function dimSliders(): HTMLElement[] {
  const mm = (v: number) => sign(v, 'mm'), H = () => Math.round((designHeight(D) + 0) * 1000);
  const rows: [DimKey, string, number, (v: number) => string][] = [['wheelbase', '휠베이스', 10, mm], ['width', '폭 (한쪽)', 5, mm], ['track', '윤거', 10, mm],
    ['roof', '전고', 5, v => `${mm(v)} · ${H().toLocaleString()} mm`], ['overhangF', '앞 오버행', 10, mm], ['overhangR', '뒤 오버행', 10, mm],
    ['ride', '지상고', 5, v => `${mm(v)} · ${CLEARANCE[D.body.base] + v} mm`], ['cabin', '캐빈 위치 (+ 앞으로)', 10, mm],
    ['rake', '앞유리 각도 (+ 눕힘)', 0.5, v => `${v > 0 ? '+' : ''}${v}°`]];
  const out: HTMLElement[] = [h2('치수')], kitOnly = (e: HTMLElement) => { syncs.push(() => { e.hidden = isModelBase(D.body.base); }); return e; };
  for (const [k, name, step, show] of rows) { const r = range(name, BODY_LIMITS(D.body.base)[k], step, () => D.body[k], v => { D.body[k] = v; }, show, `dim-${k}`), i = r.querySelector('input')!;
    // the range first (the value's own sync, pushed by range(), comes after it)
    syncs.splice(syncs.length - 1, 0, () => { const [a, b] = BODY_LIMITS(D.body.base)[k]; i.min = String(a); i.max = String(b); }); out.push(kitOnly(r)); }
  out.push(note('전고는 벨트라인 위 캐빈을 늘이고 줄입니다. 캐빈을 앞으로 옮기면 뒤의 엔진룸이 그만큼 길어집니다(긴 V12가 들어갈 수 있습니다). 지상고가 100 mm보다 낮으면 바닥이 닿을 위험이 있다는 경고가 나옵니다.'),
    btnRow('치수 원래대로', () => { for (const k of DIMS) D.body[k] = 0; changed(); }));
  kitOnly(out[0]!); kitOnly(out[out.length - 2]!); kitOnly(out[out.length - 1]!); return out; }
function btnRow(t: string, f: () => void): HTMLElement { const d = document.createElement('div'); d.className = 'btns'; const b = document.createElement('button'); b.type = 'button'; b.className = BTN; b.textContent = t; b.addEventListener('click', f); d.append(b); return d; }
// ③ 부품: the panels' kinds (a kit base's) or the model body's swaps; ⑦ 칠·마감: the paint
{ const ch = designChoices('nsx'), kinds = <T extends string>(ks: T[]) => ks.map(k => [k, KIND_NAME[k] ?? k] as [T, string]);
  // the face in slots (core/design.ts Face; render/car/face.ts): chips with a small drawing each, a value the rules do not
  // allow greyed out with its reason (faceLock), the car built again at each choice
  const I = (d: string) => `<svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const NOSE: [NoseKind, string, string][] = [['round', '둥근 코', I('<path d="M3 14 C3 5 8 3 13 3 C18 3 23 5 23 14"/>')], ['pointed', '뾰족한 코', I('<path d="M2 14 L6 5 L10 3 H16 L20 5 L24 14"/>')], ['mass', '덩어리 코', I('<path d="M6 8 C6 4 10 2 13 2 C16 2 20 4 20 8"/><path d="M2 14 C2 9 6 8 13 8 C20 8 24 9 24 14"/>')]];
  const FACE: { [K in FaceKey]: [string, [Face[K], string, string][]] } = {
    bumper: ['범퍼', [['upright', '직립형', I('<path d="M23 2 H9 Q5 2 5 5 V10 Q5 13 9 14 H23"/>')], ['crease', '주름선형', I('<path d="M23 2 H9 L4 5 L5 9 L11 14 H23"/>')],
      ['wedge', '쐐기형', I('<path d="M23 2 H13 L3 12 V14 H23"/>')], ['airdam', '에어댐', I('<path d="M23 2 H9 V6 H6 V13"/><path d="M1 14 H23"/>')]]],
    grille: ['그릴', [['slot', '슬롯', I('<rect x="3" y="5" width="20" height="6"/><path d="M9 5 V11 M13 5 V11 M17 5 V11"/>')], ['oval', '타원 격자', I('<ellipse cx="13" cy="8" rx="10" ry="4.5"/><path d="M3 8 H23 M13 3.5 V12.5 M8 4.2 V11.8 M18 4.2 V11.8"/>')],
      ['horseshoe', '말굽', I('<path d="M11 13 V7 Q11 4 13 4 Q15 4 15 7 V13 Z"/><path d="M2 7 H8 M2 11 H8 M18 7 H24 M18 11 H24"/>')], ['mesh', '와이드 메시', I('<rect x="1" y="5" width="24" height="6"/><path d="M5 5 V11 M9 5 V11 M13 5 V11 M17 5 V11 M21 5 V11 M1 8 H25"/>')],
      ['none', '없음', I('<path d="M3 5 H23 M3 11 H23" stroke-dasharray="2 3"/>')]]],
    head: ['헤드라이트', [['popup', '팝업', I('<path d="M2 13 H24 M6 13 L8 5 H19 V13"/><rect x="10" y="7" width="6" height="4"/>')], ['pocket', '포켓 (투명 덮개)', I('<path d="M3 4 H23 L20 12 H6 Z"/><circle cx="16" cy="9" r="2"/><rect x="8" y="7" width="4" height="3.5"/>')],
      ['fixed', '매립 렌즈', I('<path d="M3 5 H23 L20 11 H6 Z"/>')]]],
    pod: ['램프 유닛', [['twin', '사각 2등', I('<rect x="3" y="5" width="8" height="6"/><rect x="15" y="5" width="8" height="6"/>')], ['single', '넓은 1등', I('<rect x="3" y="5" width="20" height="6"/>')],
      ['round', '원형 2등', I('<circle cx="8" cy="8" r="4"/><circle cx="18" cy="8" r="4"/>')]]],
    aux: ['보조등', [['strip', '띠형', I('<rect x="3" y="6" width="20" height="4"/><path d="M16 6 V10"/>')], ['round', '원형 안개등', I('<circle cx="13" cy="8" r="4.5"/><path d="M3 5 H7 M19 5 H23"/>')], ['none', '없음', I('<path d="M3 8 H23" stroke-dasharray="2 3"/>')]]] };
  /** a slot's chips: a drawing and a name each; a locked value is greyed out and its reason written under the row */
  function chips<T extends string>(label: string, opts: [T, string, string][], get: () => T, set: (v: T) => void, lock?: (v: T) => string | null): HTMLElement {
    const r = cards(label, opts, get, set, lock); r.querySelector('.gk-cards')!.classList.add('facecards'); return r; }
  const slot = <K extends FaceKey>(k: K) => chips<Face[K]>(FACE[k][0], FACE[k][1], () => D.body[k], v => { (D.body as Face)[k] = v; }, v => faceLock(D.body, k, v));
  const kitRows = [h2('앞모습'), chips<NoseKind>('코 모양', NOSE, () => D.body.nose, v => { D.body.nose = v; }), ...FACE_KEYS.map(slot),
    note('앞모습의 다섯 칸은 세 바탕 모두에서 따로 바꿀 수 있습니다. 그릴과 보조등은 고른 범퍼의 선에 맞춰 자리를 다시 잡습니다. 함께 쓸 수 없는 조합은 흐리게 표시하고 이유를 적습니다.'),
    h2('뒷모습·휠'), seg<TailKind>('꼬리', kinds(ch.tail), () => D.body.tail, v => { D.body.tail = v; }), seg<WheelKind>('휠', kinds(ch.wheel), () => D.body.wheel, v => { D.body.wheel = v; })];
  // a model-built body's own swaps (the 959's: render/car/p959), in place of the kit's kinds
  const M = (): ModelSwaps => (D.body.model ??= { ...MODEL_OWN.p959 }), sm = <K extends keyof ModelSwaps>(k: K) => (v: ModelSwaps[K]) => { M()[k] = v; };
  const BUMPER_NAME: Record<ModelSwaps['bumperF'], string> = { std: '순정', aero: '에어로 (깊은 립·디퓨저)', clean: '깔끔 (모서리 벤트 없음)', blank: '민짜 (덩어리)' };
  const plate = document.createElement('input'); plate.type = 'text'; plate.className = 'gk-field'; plate.id = 'plate'; plate.maxLength = 10; plate.placeholder = '12가 3456'; plate.setAttribute('aria-label', '번호판 글자'); plate.autocomplete = 'off';
  const plateWhy = document.createElement('small'); plateWhy.className = 'lock'; plateWhy.hidden = true;
  plate.addEventListener('change', () => { if (plateOk(plate.value)) { M().plate = plate.value; plateWhy.hidden = true; changed(); } else { plateWhy.textContent = '숫자 2개 + 한글 한 글자(받침 없음) + 숫자 4개로 적어 주세요. 예: 12가 3456'; plateWhy.hidden = false; } });
  const plateRow = field('번호판 (옛 초록 번호판)', plate); plateRow.append(plateWhy, btnRow('무작위 번호', () => { M().plate = randomPlate(); plateWhy.hidden = true; changed(); }));
  // each plate off and on again: a removed one is kept as false, a fitted one leaves no key (an older design's own way)
  const plateOn = (k: 'plateF' | 'plateR', label: string) => seg<'on' | 'off'>(label, [['on', '달기'], ['off', '떼기']], () => M()[k] === false ? 'off' : 'on', v => { if (v === 'on') delete M()[k]; else { if (place.id === k) place.end(); M()[k] = false; } });
  // the plates placed freely (docs/systems/115 P1a): a card each; pressed, "놓기" (ui/builder_place.ts)
  const plateCards = cards<PlacedId | ''>('번호판 놓기 (눌러서 자유 배치)', ([['plateF', '앞 번호판'], ['plateR', '뒤 번호판']] as [PlacedId, string][]).map(([k, t]) => [k, t, bumperPic('std', k === 'plateR'), { kind: k, v: k }] as [PlacedId, string, string, ThumbSpec]),
    () => place.id ?? '', v => { if (v) place.start(v); });
  // the parts library (docs/systems/110 G4): each swap a card with its picture
  // "599 순정 세트" (docs/systems/115 §4-1): every part as the car left the works, its glass the stock set; the lump's
  // dimensions and the plate's text kept
  const stockRow = btnRow('599 순정 세트', () => { place.end(); D.body.model = { ...MODEL_OWN.p959, plate: M().plate }; D.body.glass = 'stock'; delete D.body.parts; changed(); flash('599 순정 부품과 창문을 달았습니다 (번호판도 순정 자리로)'); });
  stockRow.querySelector('button')!.className = BTN_MAIN; stockRow.querySelector('button')!.id = 'stockSet';
  const lumpRow = btnRow('모두 떼기 (덩어리로)', () => { place.end(); D.body.model = LUMP_SWAPS(M().plate); delete D.body.parts; changed(); });
  stockRow.append(lumpRow.querySelector('button')!);
  const modelRows = [h2('599 부품'), stockRow, note('순정 세트는 부품과 창문을 지금 599와 같게 답니다. 치수와 번호판 글자는 그대로 둡니다.'), cards<ModelSwaps['bumperF']>('앞 범퍼', BUMPERS_ALL.map(k => [k, BUMPER_NAME[k], bumperPic(k), { kind: 'bumperF', v: k }] as [ModelSwaps['bumperF'], string, string, ThumbSpec]), () => M().bumperF, sm('bumperF')),
    cards<ModelSwaps['bumperR']>('뒤 범퍼', BUMPERS_ALL.map(k => [k, BUMPER_NAME[k], bumperPic(k, true), { kind: 'bumperR', v: k }] as [ModelSwaps['bumperR'], string, string, ThumbSpec]), () => M().bumperR, sm('bumperR')),
    cards<ModelSwaps['lamp']>('헤드램프', LAMPS_ALL.map(k => [k, { round: '둥근 렌즈 (순정)', ellipsoid: '프로젝터 2개', square: '사각 프로젝터', none: '없음 (막힘)' }[k], lampPic(k), ...(k === 'none' ? [] : [{ kind: 'lamp', v: k }])] as [ModelSwaps['lamp'], string, string, ThumbSpec?]), () => M().lamp, sm('lamp')),
    cards<ModelSwaps['wheel']>('휠', WHEELS_ALL.map(k => [k, { hollow5: '속 빈 5스포크 (순정)', dish: '딥디시 8스포크', hole5: '5홀 디스크', steel: '민짜 강철 휠' }[k], wheelPic(k), { kind: 'wheel', v: k }] as [ModelSwaps['wheel'], string, string, ThumbSpec]), () => M().wheel, sm('wheel')),
    seg<'on' | 'off'>('그 밖의 순정 부품 (테일램프 띠, 옆 흡기구, 엔진 덮개 그릴, 미러, 배기구, 배지·레터링)', [['on', '달기'], ['off', '떼기']], () => M().details === false ? 'off' : 'on', v => { if (v === 'on') delete M().details; else M().details = false; }),
    plateOn('plateF', '앞 번호판'), plateOn('plateR', '뒤 번호판'), plateCards, note(`번호판 카드를 누르면 "놓기"가 됩니다. 판을 끌어 차체 위 아무 곳으로나 옮기고, 회전·기울기·크기를 고릅니다. 앞 번호판은 앞을, 뒤 번호판은 뒤를 보는 면(차 축에서 35° 안)에만 붙고, 굽은 면에서는 판이 평평한 채 검은 받침이 틈을 메웁니다(최대 70 mm). 램프·유리·다른 번호판과 겹치면 붙지 않습니다. 레이스 상대와 순정 세트는 순정 자리입니다.`),
    plateRow, note('범퍼는 차체의 이음선 고리에 맞물려 바뀝니다. 헤드램프를 빼면 램프 자리는 차체 색으로 막힙니다. 번호판은 앞뒤를 따로 떼고 다시 달 수 있고, 뗀 자리는 범퍼 면 그대로입니다. 번호판 글자는 판 위에 획으로 그립니다(가상의 번호만). 다른 부품의 자유 부착은 다음 단계(P1, P2)에서 옵니다.')];
  syncs.push(() => { const m = isModelBase(D.body.base); for (const e of kitRows) e.hidden = m; for (const e of modelRows) e.hidden = !m; if (m && document.activeElement !== plate) plate.value = M().plate; });
  add('parts', ...kitRows, ...modelRows);
  const sw = document.createElement('div'); sw.className = 'swatches'; const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'paint'; pick.setAttribute('aria-label', '직접 고르기');
  const bs = PAINTS.map(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c); b.addEventListener('click', () => { D.body.paint = c; changed(); }); sw.append(b); return [c, b] as const; });
  pick.addEventListener('input', () => { D.body.paint = pick.value; changed(); }); sw.append(pick);
  syncs.push(() => { pick.value = D.body.paint; for (const [c, b] of bs) b.setAttribute('aria-pressed', String(c === D.body.paint.toLowerCase())); });
  add('paint', field('도장 색', sw), range('광택', [0, 1], 0.05, () => D.body.gloss, v => { D.body.gloss = v; }, v => v.toFixed(2), 'gloss'),
    seg<TrimId>('실내 색', TRIM_IDS.map(t => [t, TRIM_NAME[t]] as [TrimId, string]), () => interiorD().trim, v => { D.interior = { ...interiorD(), trim: v }; })); }
// ④ 엔진·구동계 (alpha 0.12): an engine from the library put in, or this car's engine opened in the engine designer
{ const box = document.createElement('div'), list = document.createElement('ul'); list.className = 'list'; list.id = 'engLib'; list.hidden = true;
  const fill = () => { list.textContent = ''; const all = savedEngines(store);
    if (!all.length) { const li = document.createElement('li'); li.innerHTML = '<span>보관함에 엔진이 없습니다. 엔진 공방에서 만들어 저장하세요.</span>'; list.append(li); return; }
    for (const s of all) { const e = joinEngine(s.family, s.variant, D), li = document.createElement('li'), t = document.createElement('span'), sm = document.createElement('small'), b = document.createElement('button');
      t.textContent = s.name; sm.textContent = `${LAYOUT_NAME[e.layout]} ${(e.cc / 1000).toFixed(1)} · ${e.grade}등급${e.turbo ? ` · 터보 ${e.turbo}` : ''}`; b.type = 'button'; b.className = BTN; b.textContent = '얹기';
      // the class's wall (docs/systems/115 C1): an engine past the chosen rung's cap is shown, marked with the rung it needs
      const N = needOf(D, x => { Object.assign(x, structuredClone(e)); }, eraOpen()); markNeed(b, N); if (N) sm.textContent += ` · ${needText(N)}`;
      const put = () => { D = withEngine(D, joinEngine(s.family, s.variant, D)); list.hidden = true; of.el.hidden = true; changed(); flash(`엔진을 얹었습니다: ${s.name}`); };
      b.addEventListener('click', () => { if (N) of.show(`엔진 ${s.name}`, N, () => { D = withEngine(D, joinEngine(s.family, s.variant, D)); list.hidden = true; }); else put(); }); li.append(t, sm, b); list.append(li); } };
  const of = offerBox();
  const row = btnRow('보관함에서 엔진 고르기', () => { list.hidden = !list.hidden; of.el.hidden = true; if (!list.hidden) fill(); }); row.querySelector('button')!.id = 'engPick';
  if (host.onEngineShop) { const b = document.createElement('button'); b.type = 'button'; b.className = BTN; b.id = 'engShop'; b.textContent = '엔진 공방에서 편집'; b.addEventListener('click', () => host.onEngineShop!(structuredClone(D))); row.append(b); }
  box.append(row, list, of.el); add('engine', box); }
// ④ 엔진·구동계: the grade first; the details it does not allow greyed out with the reason
{ const E = () => D.engine, lk = <K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo'>(k: K) => (v: Design['engine'][K]) => gradeLock(E().grade, k, v);
  // the class's wall (docs/systems/115 C1): an option whose engine would pass the chosen rung's power cap needs a higher rung
  const nd = <K extends 'grade' | 'layout' | 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo'>(k: K) => (v: Design['engine'][K]) => needFor(`${k}=${v}`, e => { (e as Record<K, unknown>)[k] = v; });
  const boost = range('부스트', LIMITS.boost, 0.05, () => E().boost, v => { E().boost = v; }, v => `${v.toFixed(2)} bar`, 'boost', 'boost'), redline = range('레드라인', LIMITS.redline, 100, () => E().redline, v => { E().redline = v; }, v => `${v.toLocaleString()} rpm`, 'redline', 'redline');
  const vtec = check('가변 캠 (두 가지 캠 프로필)', () => E().vtec, v => { E().vtec = v; }, 'vtec', () => needFor('vtec', e => { e.vtec = true; })), ic = check('인터쿨러', () => E().intercooler, v => { E().intercooler = v; }, 'intercooler', () => needFor('ic', e => { e.intercooler = true; }));
  const gradeNote = note('');
  add('engine', h2('엔진'), seg<Grade>('개발 등급', GRADES.map(g => [g, `${g} ${GRADE_NAME[g]}`] as [Grade, string]), () => E().grade, v => { E().grade = v; D = normalise(D); }, undefined, nd('grade')), gradeNote,
    seg('배열', LAYOUTS.map(l => [l, LAYOUT_NAME[l]]), () => E().layout, v => { E().layout = v; }, undefined, nd('layout')),
    range('배기량', LIMITS.cc, 50, () => E().cc, v => { E().cc = v; }, v => `${v.toLocaleString()} cc`, 'cc', 'cc'),
    seg('실린더당 밸브', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], () => E().valves, v => { E().valves = v; }, lk('valves'), nd('valves')), redline,
    seg<Intake>('흡기', [['single', '단일 스로틀'], ['variable', '가변 흡기'], ['itb', '개별 스로틀']], () => E().intake, v => { E().intake = v; }, lk('intake'), nd('intake')),
    seg<Compression>('압축비', [['low', '낮음 (8.5)'], ['mid', '보통 (10)'], ['high', '높음 (11+)']], () => E().compression, v => { E().compression = v; }, lk('compression'), nd('compression')),
    seg<Sump>('윤활', [['wet', '웨트 섬프'], ['dry', '드라이 섬프']], () => E().sump, v => { E().sump = v; }, lk('sump'), nd('sump')),
    seg<Block>('블록 소재', [['iron', '주철'], ['aluminium', '알루미늄'], ['magnesium', '마그네슘']], () => E().block, v => { E().block = v; }, lk('block'), nd('block')),
    seg<Turbos>('터보', [[0, '없음'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], () => E().turbo, v => { E().turbo = v; }, lk('turbo'), nd('turbo')), boost, ic, vtec,
    note('등급이 높으면 고회전에서 출력이 크게 늘지만 저속 토크가 약해지고, 비싸지고, 정비 주기가 짧아집니다. 압축비가 높은 과급 엔진은 부스트를 많이 올리면 노킹이 나서 출력이 거의 늘지 않습니다.'));
  syncs.push(() => { const g = E().grade, R = gradeRedline(g), Bm = gradeBoost(g), ri = redline.querySelector('input')!, bi = boost.querySelector('input')!;
    ri.max = String(R); bi.max = String(Bm); bi.disabled = !E().turbo; (ic.querySelector('input')!).disabled = !E().turbo;
    const vi = vtec.querySelector('input')!, vl = gradeLock(g, 'vtec', true); vi.disabled = !!vl; vtec.title = vl ?? '';
    gradeNote.textContent = `${g}등급: 레드라인 ${R.toLocaleString()} rpm, 부스트 ${Bm.toFixed(1)} bar까지${vl ? ` · 가변 캠은 ${vl.replace(' 고를 수 있습니다', '')}` : ''}`; }); }
// ④ (on): the drive
{ const fin = range('종감속비', LIMITS.final, 0.01, () => D.drive.final || designSpec(D).final, v => { D.drive.final = v; }, v => v.toFixed(2), 'final');
  add('engine', h2('구동계'), seg('기어', [[5, '5단'], [6, '6단']], () => D.drive.gears, v => { D.drive.gears = v; }),
    seg('변속기', [['manual', '수동'], ['f1', 'F1 (반자동)']], () => D.drive.gearbox, v => { D.drive.gearbox = v; }),
    check('종감속 자동 (최고 속도가 출력 정점에서 나오게)', () => !D.drive.final, v => { D.drive.final = v ? 0 : +designSpec(D).final.toFixed(2); }, 'autofinal'), fin,
    check('LSD (차동 제한)', () => D.drive.lsd, v => { D.drive.lsd = v; }, 'lsd'), check('4륜 구동 (점성 센터 커플링, 앞 30 %)', () => D.drive.awd, v => { D.drive.awd = v; }, 'awd'));
  syncs.push(() => { (fin.querySelector('input') as HTMLInputElement).disabled = !D.drive.final; }); }
// ⑤ 서스펜션 (alpha 0.13): each axle's kind, its arms, its springs and dampers, its bar, its static camber and toe, the
// front's caster, the ride; the small graphs from the linkage as the physics reads it (ui/builder_susp.ts)
{ const deg = (n: number) => (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(n)}°`, pct = (v: number) => `${Math.round(v * 100)} %`;
  const RC_NAME: [RcPreset, string][] = [['low', '낮음'], ['mid', '보통'], ['high', '높음']];
  const axle = (front: boolean): HTMLElement[] => { const A = (): SuspAxle => front ? D.susp.front : D.susp.rear, k = front ? 'F' : 'R';
    const lockF = (f: 'arm') => { const r = range('팔 길이 비 (위 / 아래)', SUSP_LIMITS.arm, 0.01, () => A().arm, v => { A().arm = v; }, v => v.toFixed(2), `susp-arm${k}`); syncs.push(() => { const L = suspFieldLock(A(), f), i = r.querySelector('input')!; i.disabled = !!L; r.title = L ?? ''; }); return r; };
    return [h2(front ? '앞 차축' : '뒤 차축'),
      seg<SuspKind>('형식', SUSP_KINDS.map(t => [t, SUSP_KIND_NAME[t]] as [SuspKind, string]), () => A().type, v => { A().type = v; }, v => suspLock(front, v)),
      lockF('arm'), seg<RcPreset>('롤 센터 높이', RC_NAME, () => A().rc, v => { A().rc = v; }),
      range('스프링 (바퀴 고유 진동수)', SUSP_LIMITS.hz, 0.05, () => A().hz, v => { A().hz = v; }, v => `${v.toFixed(2)} Hz`, `susp-hz${k}`),
      range('댐퍼 압축 (범프)', SUSP_LIMITS.bump, 0.01, () => A().bump, v => { A().bump = v; }, pct, `susp-bump${k}`),
      range('댐퍼 반발 (리바운드)', SUSP_LIMITS.rebound, 0.01, () => A().rebound, v => { A().rebound = v; }, pct, `susp-reb${k}`),
      range('스태빌라이저 (기본의 몇 배)', SUSP_LIMITS.bar, 0.05, () => A().bar, v => { A().bar = v; }, v => v ? `× ${v.toFixed(2)}` : '없음', `susp-bar${k}`),
      range('정지 캠버', SUSP_LIMITS.camber, 0.1, () => A().camber, v => { A().camber = v; }, deg(1), `susp-cam${k}`),
      range('토 (+ 토인)', SUSP_LIMITS.toe, 0.01, () => A().toe, v => { A().toe = v; }, deg(2), `susp-toe${k}`),
      ...(front ? [range('캐스터', SUSP_LIMITS.caster, 0.1, () => D.susp.front.caster, v => { D.susp.front.caster = v; }, deg(1), 'susp-caster')] : [])]; };
  const graphs = document.createElement('div'); graphs.id = 'suspGraphs'; graphs.className = 'suspgraphs'; graphs.setAttribute('aria-live', 'polite');
  add('susp', note('장착점(하드포인트)에서 링크를 풀어 바퀴가 오르내릴 때의 캠버·토·롤 센터를 계산합니다. 시험 주행의 물리도 같은 표를 씁니다. 이 단계에서는 서스펜션 보기가 켜집니다.'), graphs,
    ...axle(true), ...axle(false),
    h2('차고'), range('지상고 (① 치수와 같은 값)', isModelBase(D.body.base) ? FRAMES.A959.ranges.ride : BODY_LIMITS(D.body.base).ride, 5, () => isModelBase(D.body.base) ? frameD().dims.ride : D.body.ride, v => { if (isModelBase(D.body.base)) D.body.frame = { ...frameD(), dims: { ...frameD().dims, ride: v } }; else D.body.ride = v; }, v => `${sign(v, 'mm')} · ${CLEARANCE[D.body.base] + v} mm`, 'susp-ride'),
    note('스프링이 단단할수록(진동수가 높을수록) 덜 기울고 덜 숙이지만 요철에서 접지가 흔들립니다. 롤 센터가 높으면 롤이 줄지만 바퀴가 옆으로 밀리며 차가 들립니다. 음의 캠버는 코너에서 바깥 바퀴를 세웁니다. 일체 차축·판스프링은 1930년대 차대(복원 작업)용입니다.'),
    btnRow('서스펜션 원래대로', () => { D.susp = structuredClone(SUSP_OWN[D.body.base]); changed(); }));
  syncs.push(() => { const r = $('susp-ride') as HTMLInputElement | null; if (r) { const [a, b] = isModelBase(D.body.base) ? FRAMES[frameD().id].ranges.ride : BODY_LIMITS(D.body.base).ride; r.min = String(a); r.max = String(b); } }); }
/** the step's graphs drawn again (with the figures, a moment after a change) */
function suspGraphs() { const el = $('suspGraphs'); if (!el || (step !== 'susp' && el.innerHTML)) return; try { el.innerHTML = suspPanel(suspFigures(D)); } catch (e) { console.warn('suspension graphs', e); el.innerHTML = ''; } }
// ⑥ 장비
add('kit', check('ABS', () => D.kit.abs, v => { D.kit.abs = v; }, 'abs'), check('TCS (트랙션 컨트롤)', () => D.kit.tcs, v => { D.kit.tcs = v; }, 'tcs'),
  select('스티어링', [['manual', '수동'], ['hydraulic', '유압 파워'], ['electric', '전동 파워']], () => D.kit.steering, v => { D.kit.steering = v; }, 'steering'),
  seg('댐퍼', [['fixed', '고정'], ['adaptive', '가변 (두 가지 모드)']], () => D.kit.dampers, v => { D.kit.dampers = v; }),
  check('리어 윙', () => D.kit.wing, v => { D.kit.wing = v; }, 'wing'), check('언더트레이 + 디퓨저', () => D.kit.diffuser, v => { D.kit.diffuser = v; }, 'diffuser'),
  h2('타이어와 휠'),
  range('앞 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[0], v => { D.kit.tyres = [v, D.kit.tyres[1]]; }, v => `${v} mm`, 'tyreF'),
  range('뒤 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[1], v => { D.kit.tyres = [D.kit.tyres[0], v]; }, v => `${v} mm`, 'tyreR'),
  seg('림', [[16, '16″'], [17, '17″'], [18, '18″']], () => D.kit.rim, v => { D.kit.rim = v; }),
  note('윙은 꼬리에 맞춰 차체에 달립니다(캡슐 꼬리는 능동 윙: 달리면 올라옵니다). 디퓨저는 뒤 바닥 아래에 그려집니다.'),
  // the interior (docs/systems/115 §4-3): a set of the lump's own, not placed freely; its trim's colour in ⑦
  h2('실내'), cards<InteriorSetId>('실내 세트', INTERIOR_SET_IDS.map(k => [k, INTERIOR_SETS[k].name, icon('interior'), { kind: 'interior', v: k }] as [InteriorSetId, string, string, ThumbSpec]), () => interiorD().set, v => { D.interior = { ...interiorD(), set: v }; }),
  ...INTERIOR_SET_IDS.map(k => note(`${INTERIOR_SETS[k].name}: ${INTERIOR_SETS[k].note}`)), note('실내는 정해 둔 세트에서 고릅니다. 드리프트 세트는 가볍고(무게 계수 경량), 순정 세트를 황갈색으로 고르면 가죽·에어컨의 고급 사양으로 무게를 셉니다. 색은 ⑦ 칠·마감에서 고릅니다.'));
// ⑧ 검사·시험 주행: the fit's checks with their fixes and the step each belongs to, the class, the cost and the
// reliability, what was measured, the test drive and the save
{ const div = (id: string, cls: string) => { const d = document.createElement('div'); d.id = id; d.className = cls; return d; };
  const drv = document.createElement('a'); drv.id = 'drive6'; drv.className = BTN_MAIN; drv.target = '_blank'; drv.rel = 'opener'; drv.textContent = '시험 주행 ▶'; drv.href = 'drive.html';
  const b = (t: string, f: () => void, id: string) => { const x = document.createElement('button'); x.type = 'button'; x.className = BTN; x.id = id; x.textContent = t; x.addEventListener('click', f); return x; };
  const row = document.createElement('div'); row.className = 'btns'; row.append(drv, b('저장', saveNow, 'save6'), b('저장·불러오기', () => go('files'), 'files6'));
  add('check', row, note('앞 단계를 바꾸면 이 검사는 바로 다시 계산됩니다. 문제가 생긴 단계는 위 단계 표시에 ⚠️·⛔로 나옵니다.'),
    h2('장착 검사'), div('fit6', 'fit6'), h2('차종'), div('cls6', 'cls6'), h2('원가와 신뢰성'), div('cost6', 'sumfig'), div('meas6', 'meas6')); }
// 저장·불러오기: the saved designs, new ones, files
{ const list = document.createElement('ul'); list.className = 'list'; list.id = 'list';
  const btn = (t: string, f: () => void, cls = BTN) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = t; b.addEventListener('click', f); return b; };
  const row = (...els: HTMLElement[]) => { const d = document.createElement('div'); d.className = 'btns'; d.append(...els); return d; };
  const ta = document.createElement('textarea'); ta.id = 'json'; ta.placeholder = '설계 JSON을 여기에 붙여넣거나, "JSON 보기"로 지금 설계를 꺼냅니다'; ta.setAttribute('aria-label', '설계 JSON');
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.id = 'file';
  file.addEventListener('change', () => { const f = file.files?.[0]; if (!f) return; void f.text().then(t => { const d = parseDesign(t); if (d) { if (use(d)) flash(`불러옴: ${d.name}`); } else flash('설계 파일이 아닙니다'); file.value = ''; }); });
  add('files', h2('저장된 설계'), list,
    h2('새 설계'), row(btn('새 설계 (차급부터)', () => { use(newDesign(ENABLED_BODIES[0]!)); flash('새 설계: 차급을 고르세요'); }), btn('지금 설계 복사', () => { use({ ...structuredClone(D), id: newId(), name: `${D.name} 사본`.slice(0, 40) }); flash('사본을 만들었습니다 (아직 저장 전)'); })),
    h2('파일'), row(btn('JSON 파일 받기', download), btn('파일 열기', () => file.click()), btn('JSON 보기', () => { ta.value = designJson(D); ta.select(); try { void navigator.clipboard?.writeText(ta.value).catch(() => {}); } catch { /* no clipboard */ } }),
      btn('붙여넣은 JSON 불러오기', () => { const d = parseDesign(ta.value); if (d) { if (use(d)) flash(`불러옴: ${d.name}`); } else flash('JSON이 설계가 아닙니다'); })), ta, file,
    note('설계는 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 JSON 파일을 받거나 복사하세요.')); }
function download() { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([designJson(D)], { type: 'application/json' })); a.href = url; a.download = `${D.name.replace(/[^\w가-힣-]+/g, '_') || 'design'}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showList() { const list = $('list'), all = savedDesigns(store); list.textContent = '';
  if (!all.length) { const li = document.createElement('li'); li.innerHTML = '<span>아직 저장한 설계가 없습니다</span>'; list.append(li); return; }
  for (const d of all) { const li = document.createElement('li'); if (d.id === D.id) li.className = 'me'; const s = document.createElement('span'); s.textContent = d.name; const sm = document.createElement('small'); sm.textContent = `${enabledDesign(d) ? FRAMES[d.body.frame?.id ?? 'A959'].name : BASE_NAME[d.body.base]} · ${d.engine.layout} ${(d.engine.cc / 1000).toFixed(1)}`;
    const load = document.createElement('button'); load.type = 'button'; load.className = BTN; load.textContent = '열기'; load.addEventListener('click', () => { if (use(d)) flash(`열림: ${d.name}`); });
    if (!enabledDesign(d)) { li.classList.add('old'); sm.textContent = `${BASE_NAME[d.body.base]} · 옛 방식 · 비활성`; load.disabled = true; load.title = '이 차체는 지금 게임에서 꺼져 있습니다'; }
    const del = document.createElement('button'); del.type = 'button'; del.className = BTN; del.textContent = '삭제'; del.setAttribute('aria-label', `${d.name} 삭제`); del.addEventListener('click', () => { if (confirm(`"${d.name}" 설계를 지울까요?`)) { deleteDesign(store, d.id); showList(); savedState(); } });
    li.append(s, sm, load, del); list.append(li); } }

// ---- the design changed: kept, the figures, the car (when its body changed), the link ----
// the engine's shape is in the key too (the car carries its powertrain: the engine view shows it)
const bodyKey = (d: Design) => JSON.stringify([d.body.model ?? null, isModelBase(d.body.base) ? [d.kit.interior, d.interior ?? null, d.body.frame ?? null, d.body.glass === undefined ? 'stock' : d.body.glass, d.body.parts ?? null, d.engine.redline, d.engine.boost] : 0, d.engine.layout, d.engine.cc, d.engine.bs, d.engine.valves, d.engine.block, d.engine.grade, d.engine.intake, d.engine.sump, d.engine.turbo, d.engine.intercooler, d.drive.gears, d.drive.gearbox, d.drive.awd, d.body.base, d.body.nose, ...FACE_KEYS.map(k => d.body[k]), d.body.tail, d.body.wheel, ...DIMS.map(k => d.body[k]), d.body.paint, d.body.gloss, d.kit.tyres, d.kit.rim, d.kit.wing, d.kit.diffuser,
  // the suspension's linkage (its kind, arms, roll centre, caster, static camber and toe: the rig is built with them; not the springs, the dampers or the bars)
  ...[d.susp.front, d.susp.rear].map(a => [a.type, a.arm, a.rc, a.camber, a.toe]), d.susp.front.caster]);
let meshT = 0, figT = 0;
function changed() { D = normalise(D); for (const s of syncs) s(); keepCurrent(store, D); savedState(); driveLink();
  clearTimeout(figT); figT = setTimeout(figures, 40) as unknown as number;
  if (bodyKey(place.shown(D)) !== meshKey) { clearTimeout(meshT); meshT = setTimeout(rebuild, 90) as unknown as number; } }
/** another design on the bench */
function use(d: Design): boolean { if (!enabledDesign(d)) { flash(`옛 방식 설계는 열 수 없습니다 (${BASE_NAME[d.body.base]} · 비활성)`); return false; }
  place.end(); D = structuredClone(d); if (!D.fresh) D = withTier(D); $<HTMLInputElement>('name').value = D.name; lastFigs = null; for (const o of offers) o.hidden = true; restoreStep(); changed(); showList();
  // a new design asks its class first; an engine brought back past the class's cap (the engine designer) is held by the restrictor, and said so
  if (D.fresh) openPick(true); else { picker.close(); const t = chosenTier(D), over = freeHp(D) - t.hpMax; if (over > 0) flash(`리스트릭터가 출력을 ${t.id} 상한에 묶습니다 (−${Math.round(over).toLocaleString()} hp)`); }
  return true; }
let flashT = 0; function flash(t: string) { $('saved').textContent = t; clearTimeout(flashT); flashT = setTimeout(savedState, 2500) as unknown as number; }
// (an older design's class, given when it opened, is not a change of its own: it is compared with the class it reaches)
function savedState() { const had = savedDesigns(store).find(x => x.id === D.id), h = had && !had.fresh ? withTier(had) : had; $('saved').textContent = !h ? '저장 안 됨' : JSON.stringify(h) === JSON.stringify(D) ? '저장됨' : '바뀐 내용 저장 안 됨'; }
$<HTMLInputElement>('name').addEventListener('input', e => { D.name = (e.target as HTMLInputElement).value.slice(0, 40) || '이름 없는 설계'; keepCurrent(store, D); savedState(); driveLink(); });
function saveNow() { flash(saveDesign(store, D) ? `저장했습니다: ${D.name}` : '이 브라우저는 저장을 허락하지 않습니다'); showList(); }
$('save').addEventListener('click', saveNow);
// the test drive (B4): the drive page opened with this design in its link
function driveLink() { for (const id of ['drive', 'drive6']) $<HTMLAnchorElement>(id).href = `drive.html?design=${encodeDesign(D)}`; }
for (const id of ['drive', 'drive6']) $(id).addEventListener('click', e => { keepCurrent(store, D); try { store?.setItem(KEYS.testDrive, encodeDesign(D)); } catch { /* not kept: the link carries it */ }
  if (host.onTestDrive) { e.preventDefault(); host.onTestDrive(structuredClone(D)); } });   // in the game's page: its drive screen

// ---- the figures ----
let lastFigs: DesignFigures | null = null, fitOpen: boolean | null = null;
const fmtLap = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const ICON = { ok: '✅', modified: '⚠️', blocked: '⛔' } as const;
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** the figures as the kit's bars (docs/systems/110 G4), growing and shrinking as they change; the first four on a
 *  phone's folded strip. Grip is not among them: the builder works out no grip figure */
const FIG_BARS: [StatDef, (f: DesignFigures) => number][] = [[STATS.power, f => f.hp], [STATS.weight, f => f.mass], [STATS.top, f => f.topKmh],
  [{ id: 'zero', name: '0→100', unit: 's', min: 2, max: 12, role: 'green', icon: 'play', digits: 1, low: true }, f => f.zeroTo100],
  [{ id: 'torque', name: '토크', unit: 'Nm', min: 0, max: 800, role: 'yellow', icon: 'gearbox', digits: 0 }, f => f.torque],
  [{ id: 'rel', name: '신뢰성', unit: '', min: 0, max: 110, role: 'metal', icon: 'wrench', digits: 0 }, f => f.reliability],
  [{ id: 'cost', name: '원가', unit: '', min: 0, max: 300, role: 'red', icon: 'money', digits: 0 }, f => f.cost]];
const figBars = FIG_BARS.map(([d, v]) => { const b = statBar(d, NaN); b.dataset.stat = d.id; $('bars').append(b); return [b, v] as const; });
function figures() { const f = designFigures(D), s = designSpec(D); lastFigs = f;
  for (const [b, v] of figBars) if (b.value !== v(f)) b.set(v(f));
  $('figs').innerHTML = `<dt>출력 정점</dt><dd>${s.hpRpm.toLocaleString()} <small>rpm</small></dd><dt>토크 정점</dt><dd>${s.torqueRpm.toLocaleString()} <small>rpm</small></dd>`
    + `<dt>마력당 무게</dt><dd>${f.kgPerHp.toFixed(2)} <small>kg/hp</small></dd><dt>앞 배분</dt><dd>${Math.round(f.front * 100)} <small>%</small></dd>`
    + `<dt>종감속</dt><dd>${s.final.toFixed(2)}${D.drive.final ? '' : ' <small>자동</small>'}</dd><dt>정비 주기</dt><dd>${(f.serviceKm / 1000).toLocaleString()}천 <small>km</small></dd>`;
  showTier(f); { const t = chosenTier(D), reach = tierOf(f); $('cls6').innerHTML = `${tierBadge(t)}${outOfEra(t) ? ' <small class="era">시대 밖</small>' : ''} <small>${reach.id !== t.id ? `목표 ${t.id} · 지금 ${reach.id} (${TIER_GROUP_NAME[reach.group]}) · ` : ''}${esc(f.form)}</small>`; }
  $('cost6').innerHTML = `<dl><dt>원가 지수</dt><dd>${f.cost} <small>옛 바탕 A=100</small></dd><dt>신뢰성</dt><dd>${f.reliability}</dd><dt>정비 주기</dt><dd>${(f.serviceKm / 1000).toLocaleString()}천 <small>km</small></dd>`
    + `<dt>무게</dt><dd>${f.mass.toLocaleString()} <small>kg</small></dd><dt>출력</dt><dd>${f.hp} <small>hp</small></dd><dt>최고 속도</dt><dd>${f.topKmh} <small>km/h</small></dd></dl>`;
  showFit(f.fit); stepMarks(f.fit); meas(); suspGraphs(); }
/** the class (docs/systems/115 C0): the rung the car reaches by its power, as a badge in its class colour, and the room
 *  left under that rung's caps (power, and top speed under its limiter) as two meters. Shown only: nothing is held to
 *  the caps yet (C1). On a phone's folded strip the badge and the power's room stand alone */
const tierBadge = (t: Tier) => `<span class="gk-tier gk-tier-${t.group}" title="차급 ${t.id} · ${TIER_GROUP_NAME[t.group]}: 출력(hp)으로만 정합니다"><span class="gk-tier-cd">${t.id}</span><span class="gk-tier-nm">${TIER_GROUP_NAME[t.group]}</span><span class="gk-tier-ch" aria-hidden="true">${tierChevrons(t)}</span></span>`;
function roomRow(name: string, v: number, cap: number, floor: number, unit: string, t: Tier): string {
  // the track spans the rung (from the cap below to its own), so the room reads at a glance; under the floor it is empty
  const open = !Number.isFinite(cap), r = cap - v, k = open ? 0 : Math.max(0, Math.min(1, (v - floor) / (cap - floor)));
  const text = open ? '상한 없음' : r < 0 ? `${roomText(r, unit)} <small>넘음 · ${cap.toLocaleString()}</small>` : `${roomText(r, unit)} <small>/ ${cap.toLocaleString()}</small>`;
  const span = open ? '' : ` title="${name}: ${floor.toLocaleString()}~${cap.toLocaleString()} ${unit} 칸에서 ${Math.round(v).toLocaleString()}"`;
  return `<div class="gk-room gk-tier-${t.group}${open ? ' gk-open' : ''}${r < 0 ? ' gk-over' : ''}" role="meter" aria-label="${name} 여유" aria-valuenow="${Math.round(v)}"${open ? '' : ` aria-valuemax="${cap}"`}>`
    + `<span class="gk-room-l">${name}</span><div class="gk-room-k"${span}><i class="gk-room-b"></i><i class="gk-room-f" style="--k:${k.toFixed(3)}"></i></div><span class="gk-room-t">${text}</span></div>`; }
function showTier(f: DesignFigures) { const t = chosenTier(D), reach = tierOf(f), room = tierRoom(f, t), era = outOfEra(t) ? '<small class="era">시대 밖</small>' : '';
  // the name is the rung reached (no floor, doc 115 §2-4): under the chosen one the bar says both
  const goal = reach.id !== t.id ? `<small class="goal">목표 ${t.id} · 지금 ${reach.id}</small>` : '';
  $('cls').innerHTML = `${tierBadge(t)}${era}<small class="room">${f.restrictor ? `묶임 −${f.restrictor} hp` : roomText(room.hp, 'hp')}</small>${goal}<small class="form">· ${esc(f.form)}</small>`;
  // the holds (doc 115 §3 간접 초과): the restrictor's cut and the limiter where they hold the car, each with its way out
  const up = (to: Tier, label: string) => { const L = tierLock(to, eraOpen()); return `<button type="button" class="${BTN}" data-act="up" data-to="${to.id}"${L ? ` disabled title="${to.id}: ${L}"` : ''}>${L ? `${to.id}: ${L}` : label}</button>`; };
  const topUp = ROAD_TIERS.find(x => x.topMax >= f.topFree && ROAD_TIERS.indexOf(x) > ROAD_TIERS.indexOf(t));
  const holds = (f.restrictor ? `<div class="hold"><b>리스트릭터 −${f.restrictor.toLocaleString()} hp</b><span>엔진 ${f.hpFree.toLocaleString()} hp를 ${t.id} 상한 ${t.hpMax.toLocaleString()} hp로 묶음</span><div class="btns">${up(tierFor(f.hpFree), `차급을 ${tierFor(f.hpFree).id}로`)}<button type="button" class="${BTN}" data-act="fit">엔진을 ${t.id}에 맞추기</button></div></div>` : '')
    + (f.limiter ? `<div class="hold"><b>제한기 ${f.limiter} km/h</b><span>풀면 ${f.topFree} km/h</span>${topUp ? `<div class="btns">${up(topUp, `차급을 ${topUp.id}로`)}</div>` : ''}</div>` : '');
  $('tier').innerHTML = roomRow('출력 상한', f.hp, t.hpMax, tierFloor(reach), 'hp', t) + roomRow('제한기', f.topKmh, t.topMax, tierTopFloor(reach), 'km/h', t) + holds;
  for (const b of Array.from($('tier').querySelectorAll<HTMLButtonElement>('button[data-act]'))) b.addEventListener('click', () => {
    if (b.dataset.act === 'fit') { D = fitEngine(D, t.hpMax); changed(); flash(`엔진을 ${t.id}에 맞췄습니다 (${freeHp(D).toLocaleString()} hp)`); return; }
    const to = tierById(b.dataset.to ?? ''); if (to) { D.tier = to.id; changed(); flash(`차급을 ${to.id}로 올렸습니다`); } });
  // the chip: the chosen rung's code, its chevrons, its group (the class colour on its border and band only)
  chip.className = `gk-tchip gk-tier-${t.group}`; chip.title = `차급 ${t.id} · ${TIER_GROUP_NAME[t.group]} (눌러서 바꾸기)`; chip.setAttribute('aria-label', `차급 ${t.id} ${TIER_GROUP_NAME[t.group]}, 바꾸기`);
  chip.innerHTML = `<span class="gk-tchip-cd">${t.id}</span><span class="gk-tchip-ch" aria-hidden="true">${tierChevrons(t)}</span><span class="gk-tchip-nm">${outOfEra(t) ? '시대 밖' : TIER_GROUP_NAME[t.group]}</span>`; }
/** each step marked with the fit checks that concern it and are not clean */
function stepMarks(r: FitResult[]) { for (const [id, b] of stepBtn) { const mine = r.filter(x => FIT_STEP[x.part] === id), nb = mine.filter(x => x.verdict === 'blocked').length, nm = mine.filter(x => x.verdict === 'modified').length, badge = b.querySelector<HTMLElement>('.badge')!;
  badge.hidden = !nb && !nm; badge.className = `badge${nb ? ' blocked' : ''}`; badge.textContent = nb ? `⛔${nb > 1 ? nb : ''}` : `⚠️${nm > 1 ? nm : ''}`;
  badge.title = [nb ? `장착 불가 ${nb}` : '', nm ? `개조 필요 ${nm}` : ''].filter(Boolean).join(', '); label(id); } }
/** the fit's checks: the ones needing work or blocked first, each with its fixes as buttons that apply them */
function showFit(r: FitResult[]) {
  const bad = r.filter(x => x.verdict !== 'ok').sort((a, b) => (a.verdict === 'blocked' ? 0 : 1) - (b.verdict === 'blocked' ? 0 : 1)), ok = r.filter(x => x.verdict === 'ok');
  const nb = bad.filter(x => x.verdict === 'blocked').length, nm = bad.length - nb, el = $('fit');
  const open = fitOpen ?? (nb > 0 || (nm > 0 && innerWidth > 760));
  // in ⑧ each check also names its step, a button that goes there
  const item = (x: FitResult, toStep = false) => `<li class="${x.verdict}"><span class="ic" aria-hidden="true">${ICON[x.verdict]}</span><div><b>${esc(x.name)}</b> <span>${esc(x.reason)}</span>`
    + (x.fixes.length || (toStep && x.verdict !== 'ok') ? `<div class="fixes">${x.fixes.map((fx, i) => `<button type="button" class="${BTN} fix" data-part="${x.part}" data-i="${i}">${esc(fx.label)}</button>`).join('')}`
      + (toStep && x.verdict !== 'ok' ? `<button type="button" class="${BTN} go" data-step="${FIT_STEP[x.part]}">◀ ${stepNo(FIT_STEP[x.part]) + 1}단계 ${STEPS[stepNo(FIT_STEP[x.part])]![1]}로</button>` : '') + '</div>' : '') + '</div></li>';
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
const cv = host.renderer?.canvas ?? $<HTMLCanvasElement>('view'); let L: LiveRenderer | null = null;
try { L = host.renderer ?? new LiveRenderer(cv); L.setGround(studioFloor()); L.setTrack(1, 30, 12, 0); const L0 = L; if (!host.renderer) { void loadSky(L0).then(() => { dirty = true; }).catch(e => console.warn('sky', e));
  const im = [texAlb, texNor, texRgh].map(src => { const i = new Image(); i.src = src; return i; });
  void Promise.all(im.map(i => i.decode())).then(() => { L0.setTextures(im[0]!, im[1]!, im[2]!, (texMeta as { layers: { size_m: number; luma_mean: number; rough_mean: number }[] }).layers); dirty = true; }).catch(e => console.warn('textures', e)); } }
catch (e) { console.warn('live renderer unavailable', e); L = null; const p = document.createElement('p'); p.className = 'nogl'; p.textContent = '이 브라우저는 WebGL2가 없어 3D 미리보기를 띄울 수 없습니다. 설계와 수치는 그대로 쓸 수 있습니다.'; document.body.append(p); }
/** the parts lifted off for the engine view: the deck's lids and its glass */
const DECK = ['bootLid', 'engineCover', 'rearPane'];
let meshKey = '', down: Mesh | null = null, up: Mesh | null = null, onGpu: Mesh | null = null, builds = 0;
const open = new WeakMap<Mesh, Mesh>();
const view = { spin: false, lamps: false, engine: false, /** the suspension view: the body off, the wheels' faces off, the wheels bouncing slowly */ susp: false, look: 2, yaw: 0, ang: 0, pitch: 0, zoom: 1 };
let dirty = true, g: ReturnType<LiveRenderer['car']> | null = null, awake = true;
/** the last picture's camera (the free placing's rays) and the overlaid part on the GPU */
let cam: { v: Parameters<typeof viewRay>[0]; len: number } | null = null, overM: Mesh | null = null, overG: ReturnType<LiveRenderer['car']> | null = null;
/** the free placing (docs/systems/115 P1a): a plate's card in ③ starts it; its bar over the view, its rays from the last picture's camera */
const place = placeTool({ design: () => D, changed, flash, redraw: () => { dirty = true; }, bar: $('placeBar'),
  ray(cx, cy) { if (!cam) return null; const r = cv.getBoundingClientRect(); return viewRay(cam.v, { x: 0, y: 0, z: -0.015, yaw: view.yaw, len: cam.len }, (cx - r.left) * cv.width / r.width, (cy - r.top) * cv.height / r.height); },
  mode(on) { document.body.classList.toggle('placing', on); if (on && innerWidth <= 760) drawer(false); if (on) { view.spin = false; $('spin').setAttribute('aria-pressed', 'false'); } dirty = true; } });
addEventListener('keydown', e => { if (!awake || !place.id) return; const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && e.key !== 'Escape') return; if (place.key(e)) e.preventDefault(); });   // awake: on screen (a page of its own always)
function rebuild() { const S = place.shown(D), key = bodyKey(S); if (key === meshKey && down) return; const t0 = performance.now(); meshKey = key; down = designMesh(S, 0, 0, 1); up = null; builds++; dirty = true; console.info(`design mesh ${D.body.base}: ${down.n} triangles, ${Math.round(performance.now() - t0)} ms`); }
function shown(): Mesh { let M = view.lamps ? (up ??= designMesh(place.shown(D), 0, 1, 1)) : down!; if (view.susp) return bareMesh(M); if (view.engine) { let o = open.get(M); if (!o) { o = withoutParts(M, openParts(D.body.base, DECK)); open.set(M, o); } M = o; } return M; }
const home = () => { view.ang = Math.PI - 0.7; view.pitch = 17; view.zoom = 1; view.yaw = 0; dirty = true; }; home();
const press = (id: string, k: 'spin' | 'lamps' | 'engine' | 'susp') => $(id).addEventListener('click', () => { view[k] = !view[k]; $(id).setAttribute('aria-pressed', String(view[k])); dirty = true; });
press('spin', 'spin'); press('lamps', 'lamps'); press('engine', 'engine'); press('susp', 'susp');
$('susp').addEventListener('click', () => { suspAuto = false; });   // the viewer's own choice from now on
/** the suspension view on or off (step ⑤ puts it on) */
function setSuspView(on: boolean) { view.susp = on; $('susp').setAttribute('aria-pressed', String(on)); dirty = true; }
$('engine').addEventListener('click', () => { if (view.engine) { view.ang = view.yaw + 0.6; view.pitch = 42; view.zoom = 0.8; } });   // the engine bay seen from behind and above
$<HTMLSelectElement>('look').addEventListener('change', e => { view.look = +(e.target as HTMLSelectElement).value; dirty = true;
  // the engine's and the suspension's look follow (look 4: their drift look, render/car/powertrain/style.ts): the car built again in it
  const ps = styleForLook(view.look); if (ps !== partStyle()) { setPartStyle(ps); meshKey = ''; clearTimeout(meshT); meshT = setTimeout(rebuild, 30) as unknown as number; } });
$('home').addEventListener('click', home); cv.addEventListener('dblclick', home);
{ const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); if (ptrs.size === 0 && place.down(e)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); } });
  cv.addEventListener('pointermove', e => { if (place.move(e)) return; const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { view.ang -= dx * 0.007; view.pitch = Math.max(6, Math.min(85, view.pitch + dy * 0.25)); dirty = true; }
    else if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y); view.zoom = Math.max(0.35, Math.min(3, view.zoom * pinch / d)); pinch = d; dirty = true; } });
  const off = (e: PointerEvent) => { place.up(e); ptrs.delete(e.pointerId); pinch = 0; }; cv.addEventListener('pointerup', off); cv.addEventListener('pointercancel', off);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (place.wheel(e)) return; view.zoom = Math.max(0.35, Math.min(3, view.zoom * (e.deltaY > 0 ? 1.12 : 1 / 1.12))); dirty = true; }, { passive: false }); }
addEventListener('resize', () => { dirty = true; });
let last = performance.now(), frames = 0;
function frame(now: number) { const el = Math.min(0.1, (now - last) / 1000); last = now;
  if (view.spin) { view.yaw += el * 0.35; dirty = true; }
  if (view.susp) dirty = true;   // the bounce demo runs
  if (L && down && awake && TH.pump(L, cv)) dirty = true;   // the parts' pictures, drawn in the canvas's corner: this frame is drawn over them
  if (L && down && dirty && awake) { dirty = false; frames++;
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(2, Math.round(cv.clientWidth * dpr)), H = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const M = shown(); if (M !== onGpu) { g = onGpu ? L.swapCar(onGpu, M) : L.car(M); onGpu = M; }
    // the free middle between the panels (a phone: the strip above, the drawer below when open): the car framed in it
    const r = cv.getBoundingClientRect(), phone = innerWidth <= 760, sideR = phone ? 0 : $('side').getBoundingClientRect().right, figs = $('figs').closest('section')!.getBoundingClientRect(), figL = phone ? r.width : figs.left;
    // on a phone the band between the figures' strip and the drawer (or the view's buttons)
    const top = phone ? figs.bottom : 0, bottom = phone ? (document.body.classList.contains('open') ? $('side').getBoundingClientRect().top : $('steps').getBoundingClientRect().top - 52) : r.height;
    const free = Math.max(160, figL - sideR) * dpr, band = Math.max(120, bottom - top) * dpr, shift = ((sideR + figL) / 2 - r.width / 2) * dpr, len = M.length;
    const mm = Math.max(len * 1.3 / free, len * 0.62 / band) * view.zoom, ox = -shift * mm / 1000;
    const rx = Math.sin(view.ang), ry = -Math.cos(view.ang);   // the screen's right, in the world
    const V = { x: rx * ox, y: ry * ox, z: 0.55, ang: view.ang, pitch: view.pitch, mm, W, H, cy: phone ? (top + bottom) / 2 / r.height : 0.55 }; cam = { v: V, len };
    // the part being placed, drawn apart over the car (ui/builder_place.ts): made again only when it moved
    const OM = view.susp ? null : place.overlay(len); if (OM !== overM) { if (overM && overG) { freeGpu(L.gl, overG); L.forget(overM); } overM = OM; overG = OM ? L.car(OM) : null; }
    const at = { x: 0, y: 0, z: -0.015, yaw: view.yaw, roll: 0, pitch: 0, steerL: 0.14, steerR: 0.12, spin: 0 };
    L.render(V, [{ g: g!, ...at, player: true, lamps: view.lamps ? 1 : 0, ...(view.susp ? bounce(now / 1000) : {}) }, ...(overG ? [{ g: overG, ...at, player: false }] : [])], [], [],
      { look: view.look, glass: 0.8, glassRefl: host.glassRefl?.() ?? 1, rays: true, bloomK: 1, reflK: 1.3, dof: 0, outW: 0.5, outK: 0.6 }); }
  requestAnimationFrame(frame); }
// the phone's drawer
function drawer(on: boolean) { if (on === document.body.classList.contains('open')) return; document.body.classList.toggle('open', on); $('toggle').setAttribute('aria-expanded', String(on)); $('toggle').textContent = on ? '✕ 닫기' : '⚙ 설계'; dirty = true; if (on) showStep(); }
$('toggle').addEventListener('click', () => drawer(!document.body.classList.contains('open')));
// the phone's figures: a folded strip of the first bars, unfolded to all of them, the class, the fit and the runs
$('figsToggle').addEventListener('click', () => { const on = !document.body.classList.contains('figs-open'); document.body.classList.toggle('figs-open', on); $('figsToggle').setAttribute('aria-expanded', String(on)); dirty = true; });

$<HTMLInputElement>('name').value = D.name; for (const s of syncs) s(); restoreStep(); rebuild(); figures(); showList(); savedState(); driveLink(); requestAnimationFrame(frame);
if (D.fresh) openPick(true);   // a new design: its class first (docs/systems/115 C1)
(globalThis as { __builder?: unknown }).__builder = { get design() { return D; }, use, get builds() { return builds; }, get frames() { return frames; }, get triangles() { return onGpu?.n ?? 0; }, get step() { return onFiles ? 'files' : step; }, go, /** a base's preset opened; the view (its angle, pitch, the car's yaw) set and drawn again */ preset: (id: BaseId) => use(fromPreset(id)), view, redraw() { dirty = true; } };   // for the page tests (tools)
return { enter(d?: Design) { if (d && JSON.stringify(d) !== JSON.stringify(D)) use(d); awake = true; dirty = true; meas(); }, leave() { place.end(); awake = false; drawer(false); },
  get design() { return D; }, get step() { return onFiles ? 'files' : step; }, use };
}
// a page of its own: the builder's markup is on it (the game's page mounts it on a screen instead)
if (typeof document !== 'undefined' && document.getElementById('panes') && !document.getElementById('gh-app')) mountBuilder();
