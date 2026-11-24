// The parts builder (docs/systems/98_alpha_interface_and_builder_plan.md, B3 and B4): a car's design (core/design.ts)
// edited on a studio turntable. The live renderer (render/live/renderer.ts, as the drive page and the photo mode use it:
// its sun and shadows, the photographed sky, the PBR textures, the looks) draws the design's car (render/car/design.ts),
// built again only when the body's fields change and a moment after a slider rests. Left: the choices in tabs; right:
// the figures worked out from the design (race/design.ts) as it changes, a warning when the tyres stand out of the
// arches, and what the drive page measured of it. Designs are kept in this browser, carried as JSON files, and sent to
// the drive page in its link ("시험 주행"), which drives them with the physics made from them and records its runs.
import { LiveRenderer } from '../render/live/renderer';
import { loadSky } from '../render/live/groundtex';
import { studioFloor } from '../render/live/studio';
import type { Mesh } from '../render/car/mesh';
import { designMesh, designChoices, withoutParts } from '../render/car/design';
import { designSpec, designFigures, type DesignFigures } from '../race/design';
import { LIMITS, type BaseId, type Design, type NoseKind, type FrontKind, type TailKind, type WheelKind } from '../core/design';
import { currentDesign, keepCurrent, savedDesigns, saveDesign, deleteDesign, fromPreset, encodeDesign, designJson, parseDesign, measured, designSig, tyreWarning, newId, KEYS, type KeyStore } from '../core/designstore';
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
function seg<T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void): HTMLElement {
  const box = document.createElement('div'); box.className = 'seg'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  const bs = opts.map(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.addEventListener('click', () => { set(v); changed(); }); box.append(b); return [v, b] as const; });
  syncs.push(() => { for (const [v, b] of bs) b.setAttribute('aria-pressed', String(v === get())); });
  const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.className = 'lab'; l.textContent = label; r.append(l, box); return r; }
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

const TABS: [string, string][] = [['chassis', '차대'], ['body', '차체'], ['engine', '엔진'], ['drive', '구동계'], ['kit', '장비'], ['files', '저장']];
const pane = new Map<string, HTMLElement>();
for (const [id, name] of TABS) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = id; b.textContent = name; b.setAttribute('aria-selected', String(id === 'chassis')); $('tabs').append(b);
  const p = document.createElement('section'); p.className = 'pane' + (id === 'chassis' ? ' on' : ''); p.dataset.tab = id; $('panes').append(p); pane.set(id, p);
  b.addEventListener('click', () => { for (const x of Array.from($('tabs').children)) x.setAttribute('aria-selected', String(x === b)); for (const [k, q] of pane) q.classList.toggle('on', k === id); }); }
const add = (tab: string, ...els: HTMLElement[]) => pane.get(tab)!.append(...els);

// 차대: the base, its stretch, its structure
add('chassis', seg<BaseId>('바탕 차대', [['nsx', BASE_NAME.nsx], ['f355', BASE_NAME.f355]], () => D.body.base, v => { if (v === D.body.base) return;
    // the tyres and the rims follow the base where they were its own
    const was = fromPreset(D.body.base), to = fromPreset(v); if (D.kit.tyres[0] === was.kit.tyres[0] && D.kit.tyres[1] === was.kit.tyres[1]) D.kit.tyres = [...to.kit.tyres]; if (D.kit.rim === was.kit.rim) D.kit.rim = to.kit.rim; D.body.base = v; }),
  note('바탕은 차체 패널의 치수를 정합니다. 코·앞면·꼬리·휠은 두 바탕 모두에 끼울 수 있습니다.'),
  range('휠베이스', LIMITS.wheelbase, 10, () => D.body.wheelbase, v => { D.body.wheelbase = v; }, v => sign(v, 'mm'), 'wheelbase'),
  range('폭 (한쪽)', LIMITS.width, 5, () => D.body.width, v => { D.body.width = v; }, v => sign(v, 'mm'), 'width'),
  seg('차체 소재', [['steel', '강철'], ['aluminium', '알루미늄']], () => D.body.material, v => { D.body.material = v; }),
  note('알루미늄 구조는 같은 강성에서 강철보다 40 % 가볍습니다.'));
// 차체: the panels' kinds, the paint
{ const ch = designChoices('nsx'), kinds = <T extends string>(ks: T[]) => ks.map(k => [k, KIND_NAME[k] ?? k] as [T, string]);
  add('body', seg<NoseKind>('코', kinds(ch.nose), () => D.body.nose, v => { D.body.nose = v; }), seg<FrontKind>('앞면', kinds(ch.front), () => D.body.front, v => { D.body.front = v; }),
    seg<TailKind>('꼬리', kinds(ch.tail), () => D.body.tail, v => { D.body.tail = v; }), seg<WheelKind>('휠', kinds(ch.wheel), () => D.body.wheel, v => { D.body.wheel = v; }));
  const sw = document.createElement('div'); sw.className = 'swatches'; const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'paint'; pick.setAttribute('aria-label', '직접 고르기');
  const bs = PAINTS.map(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c); b.addEventListener('click', () => { D.body.paint = c; changed(); }); sw.append(b); return [c, b] as const; });
  pick.addEventListener('input', () => { D.body.paint = pick.value; changed(); }); sw.append(pick);
  syncs.push(() => { pick.value = D.body.paint; for (const [c, b] of bs) b.setAttribute('aria-pressed', String(c === D.body.paint.toLowerCase())); });
  add('body', field('도장 색', sw), range('광택', [0, 1], 0.05, () => D.body.gloss, v => { D.body.gloss = v; }, v => v.toFixed(2), 'gloss')); }
// 엔진
add('engine', seg('배열', [['V6', 'V6'], ['V8', 'V8'], ['V12', 'V12']], () => D.engine.layout, v => { D.engine.layout = v; }),
  range('배기량', LIMITS.cc, 50, () => D.engine.cc, v => { D.engine.cc = v; }, v => `${v.toLocaleString()} cc`, 'cc'),
  seg('실린더당 밸브', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], () => D.engine.valves, v => { D.engine.valves = v; }),
  range('레드라인', LIMITS.redline, 100, () => D.engine.redline, v => { D.engine.redline = v; }, v => `${v.toLocaleString()} rpm`, 'redline'),
  seg('과급', [[0, '없음'], [1, '싱글 터보'], [2, '트윈 터보']], () => D.engine.turbo, v => { D.engine.turbo = v; }),
  check('VTEC (두 가지 캠 프로필)', () => D.engine.vtec, v => { D.engine.vtec = v; }, 'vtec'),
  note('출력은 배기량 × 회전수 × 밸브가 정하는 평균 유효 압력으로 계산합니다. 피스톤 속도가 초당 21 m를 넘으면 숨이 막혀 출력이 줄어듭니다.'));
// 구동계
{ const fin = range('종감속비', LIMITS.final, 0.01, () => D.drive.final || designSpec(D).final, v => { D.drive.final = v; }, v => v.toFixed(2), 'final');
  add('drive', seg('기어', [[5, '5단'], [6, '6단']], () => D.drive.gears, v => { D.drive.gears = v; }),
    seg('변속기', [['manual', '수동'], ['f1', 'F1 (반자동)']], () => D.drive.gearbox, v => { D.drive.gearbox = v; }),
    check('종감속 자동 (최고 속도가 출력 정점에서 나오게)', () => !D.drive.final, v => { D.drive.final = v ? 0 : +designSpec(D).final.toFixed(2); }, 'autofinal'), fin,
    check('LSD (차동 제한)', () => D.drive.lsd, v => { D.drive.lsd = v; }, 'lsd'), check('4륜 구동 (점성 센터 커플링, 앞 30 %)', () => D.drive.awd, v => { D.drive.awd = v; }, 'awd'));
  syncs.push(() => { (fin.querySelector('input') as HTMLInputElement).disabled = !D.drive.final; }); }
// 장비
add('kit', check('ABS', () => D.kit.abs, v => { D.kit.abs = v; }, 'abs'), check('TCS (트랙션 컨트롤)', () => D.kit.tcs, v => { D.kit.tcs = v; }, 'tcs'),
  select('스티어링', [['manual', '수동'], ['hydraulic', '유압 파워'], ['electric', '전동 파워']], () => D.kit.steering, v => { D.kit.steering = v; }, 'steering'),
  seg('댐퍼', [['fixed', '고정'], ['adaptive', '가변 (두 가지 모드)']], () => D.kit.dampers, v => { D.kit.dampers = v; }),
  check('리어 윙', () => D.kit.wing, v => { D.kit.wing = v; }, 'wing'), check('언더트레이 + 디퓨저', () => D.kit.diffuser, v => { D.kit.diffuser = v; }, 'diffuser'),
  h2('타이어와 휠'),
  range('앞 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[0], v => { D.kit.tyres = [v, D.kit.tyres[1]]; }, v => `${v} mm`, 'tyreF'),
  range('뒤 타이어 폭', LIMITS.tyre, 5, () => D.kit.tyres[1], v => { D.kit.tyres = [D.kit.tyres[0], v]; }, v => `${v} mm`, 'tyreR'),
  seg('림', [[16, '16″'], [17, '17″'], [18, '18″']], () => D.kit.rim, v => { D.kit.rim = v; }),
  note('윙과 디퓨저는 아직 차체에 그려지지 않고 물리(다운포스, 공기 저항)에만 들어갑니다.'));
// 저장: the saved designs, new ones, files
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
function changed() { for (const s of syncs) s(); keepCurrent(store, D); savedState(); driveLink();
  clearTimeout(figT); figT = setTimeout(figures, 40) as unknown as number;
  if (bodyKey(D) !== meshKey) { clearTimeout(meshT); meshT = setTimeout(rebuild, 150) as unknown as number; } }
/** another design on the bench */
function use(d: Design) { D = structuredClone(d); $<HTMLInputElement>('name').value = D.name; lastFigs = null; changed(); showList(); }
let flashT = 0; function flash(t: string) { $('saved').textContent = t; clearTimeout(flashT); flashT = setTimeout(savedState, 2500) as unknown as number; }
function savedState() { const had = savedDesigns(store).find(x => x.id === D.id); $('saved').textContent = !had ? '저장 안 됨' : JSON.stringify(had) === JSON.stringify(D) ? '저장됨' : '바뀐 내용 저장 안 됨'; }
$<HTMLInputElement>('name').addEventListener('input', e => { D.name = (e.target as HTMLInputElement).value.slice(0, 40) || '이름 없는 설계'; keepCurrent(store, D); savedState(); driveLink(); });
$('save').addEventListener('click', () => { flash(saveDesign(store, D) ? `저장했습니다: ${D.name}` : '이 브라우저는 저장을 허락하지 않습니다'); showList(); });
// the test drive (B4): the drive page opened with this design in its link
function driveLink() { const a = $<HTMLAnchorElement>('drive'); a.href = `drive.html?design=${encodeDesign(D)}`; }
$('drive').addEventListener('click', () => { keepCurrent(store, D); try { store?.setItem(KEYS.testDrive, encodeDesign(D)); } catch { /* not kept: the link carries it */ } });

// ---- the figures ----
let lastFigs: DesignFigures | null = null;
const fmtLap = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
function figures() { const f = designFigures(D), s = designSpec(D), was = lastFigs; lastFigs = f;
  /** a figure, marked when it moved since the last change: better (up) or worse (down); `more`: is more better */
  const cell = (k: keyof DesignFigures, text: string, more: boolean | null) => { const a = was?.[k], b = f[k], moved = more !== null && a !== undefined && Math.abs(b - a) > 1e-9; return `<dd${moved ? ` class="${(b > a) === more ? 'up' : 'down'}"` : ''}>${text}</dd>`; };
  $('figs').innerHTML = `<dt>무게</dt>${cell('mass', `${f.mass.toLocaleString()} <small>kg</small>`, false)}`
    + `<dt>출력</dt>${cell('hp', `${f.hp} <small>hp<span class="rpm"> · ${s.hpRpm.toLocaleString()}</span></small>`, true)}`
    + `<dt>토크</dt>${cell('torque', `${f.torque} <small>Nm<span class="rpm"> · ${s.torqueRpm.toLocaleString()}</span></small>`, true)}`
    + `<dt>마력당 무게</dt>${cell('kgPerHp', `${f.kgPerHp.toFixed(2)} <small>kg/hp</small>`, false)}`
    + `<dt>앞 배분</dt>${cell('front', `${Math.round(f.front * 100)} <small>%</small>`, null)}`
    + `<dt>최고 속도</dt>${cell('topKmh', `${f.topKmh} <small>km/h</small>`, true)}`
    + `<dt>0→100</dt>${cell('zeroTo100', `${f.zeroTo100.toFixed(1)} <small>s</small>`, false)}`
    + `<dt>종감속</dt><dd>${s.final.toFixed(2)}${D.drive.final ? '' : ' <small>자동</small>'}</dd>`;
  const w = tyreWarning(D); $('warn').hidden = !w; $('warn').textContent = w ?? '';
  meas(); }
/** what the drive page measured (its runs recorded under the design's id) */
function meas() { const m = measured(store, D.id), el = $('meas');
  if (!m) { el.innerHTML = '<div class="lab">측정</div><p class="note">시험 주행을 하면 낸 최고 속도와 랩 타임이 여기 기록됩니다.</p>'; return; }
  if (m.sig !== designSig(D)) { el.innerHTML = '<div class="lab">측정</div><p class="note">설계가 바뀐 뒤로는 아직 측정이 없습니다 (전 설계의 기록은 시험 주행을 다시 하면 지워집니다).</p>'; return; }
  const laps = Object.values(m.laps).map(l => `<dt>${l.track.replace(/\s*\(.*$/, '')}</dt><dd>${fmtLap(l.t)}</dd>`).join('');
  el.innerHTML = `<div class="lab">측정 (시험 주행)</div><dl><dt>낸 최고 속도</dt><dd>${m.topKmh || '-'} <small>km/h</small></dd>${laps || '<dt>최고 랩</dt><dd>-</dd>'}</dl>`; }
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
$('toggle').addEventListener('click', () => { const on = !document.body.classList.contains('open'); document.body.classList.toggle('open', on); $('toggle').setAttribute('aria-expanded', String(on)); $('toggle').textContent = on ? '✕ 닫기' : '⚙ 설계'; dirty = true; });

$<HTMLInputElement>('name').value = D.name; for (const s of syncs) s(); rebuild(); figures(); showList(); savedState(); driveLink(); requestAnimationFrame(frame);
(globalThis as { __builder?: unknown }).__builder = { get design() { return D; }, use, get builds() { return builds; }, get frames() { return frames; }, get triangles() { return onGpu?.n ?? 0; } };   // for the page tests (tools)
