// The game page's menu screens (docs/systems/101 part 4): the title with its menu, the garage of saved designs, the
// test track's and the race's choices, the settings and the about screen. Each is built afresh when it comes on (what
// it shows is read from the storage then), over the backdrop's turning car.
import type { Screen } from './router';
import type { ShellCtx } from './ctx';
import { el, button, card, chips, toggle, slider, tabs, row, dialog, toast, download, pickFile, topbar, carPic, focusables, slotsChip, group, secHead } from './ui';
import { slideIn, stagger, statBar, badge } from '../kit/parts';
import { STATS } from '../kit/logic';
import { PALETTES, PALETTE_IDS } from '../kit/tokens';
import { buildSheet } from '../kit/sheet';
import { CAM_VIEWS, CABIN_FOV, type CamView } from '../drivecam';
import { saveSettings, exportAll, importAll, resetAll, loadSettings, DEFAULTS, type Settings } from './settings';
import { VERSION_NAME, CHANGES } from '../../core/version';
import type { BodyBase, Design } from '../../core/design';
import { ENABLED_BODIES, enabledDesign, stockP959, stockN33 } from '../../core/bodies';
import { BODY_NAME, CAR_599, CAR_N33 } from '../../core/names';
import { savedDesigns, saveDesign, deleteDesign, currentDesign, keepCurrent, newDesign, newId, designJson, parseDesign, measured, designSig } from '../../core/designstore';
import { designFigures } from '../../race/design';
import { tierOf, tierLabel } from '../../race/tiers';
import { TRACKS } from '../../race/tracks';
import { titleCar } from './titleset';
import { carThumbs } from './carthumbs';
import { FRAMES } from '../../core/frames';
import pbrMeta from '../../assets/textures/pbr/pbr.json';
import groundMeta from '../../assets/textures/ground/ground.json';
import buildMeta from '../../assets/textures/buildings/buildings.json';
import skyMeta from '../../assets/textures/sky/sky.json';
import modelMeta from '../../assets/models/models.json';

export const BASE_NAME: Record<string, string> = { ...BODY_NAME };
/** what a card says the car is built on: an enabled body's design its body lump ("차체 A"), not the model it came from */
const frameName = (d: Design): string => FRAMES[d.body.frame?.id ?? 'A959']?.name ?? FRAMES.A959.name;
const SCREEN_NAME: Record<string, string> = { garage: '차고', builder: '차 빌더', drive: '시험 주행' };
const fmtLap = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

/** a screen's parts slide in (docs/systems/110 G2): the bar from the top, the body up, the title's menu buttons one by one */
function arrive(root: HTMLElement): void { const bar = root.querySelector<HTMLElement>(':scope > .gh-bar'), body = root.querySelector<HTMLElement>(':scope > .gh-body'), nav = root.querySelector<HTMLElement>(':scope > .gh-menu');
  if (bar) slideIn(bar, 'd'); if (body) slideIn(body, 'u'); if (nav) stagger(nav, 'l'); }
/** a menu screen: its root built on entering (the backdrop behind, dimmed except on the title), focus on its first item */
function menu(ctx: ShellCtx, id: string, build: (root: HTMLElement) => void, o: { dim?: boolean; car?: () => Design; leave?: () => void } = {}): Screen<never> & { root: HTMLElement } {
  const root = el('section', `gh-screen gh-${id}${o.dim === false ? '' : ' gh-dim'}`); root.dataset.screen = id;
  return { root, enter() { root.textContent = ''; build(root); ctx.layer.append(root); ctx.backdrop.setDesign((o.car ?? ctx.recent)()); ctx.backdrop.start(); arrive(root);
      requestAnimationFrame(() => { if (!root.contains(document.activeElement)) (root.querySelector<HTMLElement>('[data-first]') ?? focusables(root)[0])?.focus({ preventScroll: true }); }); },
    leave() { o.leave?.(); root.remove(); } }; }

// ---- the title (docs/systems/110 G4): the big tilted logo, the tilted yellow menu stacked at the bottom left, the
// settings' gear (and the about screen) at the top right; behind, the stock car without its plates on a piece of
// circuit, its wheels turned (ui/shell/titleset.ts) ----
export function titleScreen(ctx: ShellCtx): Screen<never> {
  return menu(ctx, 'title', root => { const r = ctx.router, last = ctx.last(), c0 = currentDesign(ctx.store), cur = c0 && enabledDesign(c0) ? c0 : null, d = ctx.recent();
    const go = (screen: string, p?: unknown) => () => void r.go(screen, p);
    const cont = () => { const l = ctx.last(), c1 = currentDesign(ctx.store), des = c1 && enabledDesign(c1) ? c1 : d; void (async () => { await r.go('garage');
      if (l?.screen === 'builder' || l?.screen === 'drive') await r.go('builder', { design: des });
      if (l?.screen === 'drive') await r.go('drive', { design: des, track: l.track, from: 'builder' }); })(); };
    const nav = el('nav', 'gh-menu gh-tmenu', button('이어하기', cont, { kind: 'menu', tilt: true, icon: 'play', sub: last ? `${SCREEN_NAME[last.screen] ?? ''} · ${cur?.name ?? d.name}` : cur ? `차 빌더 · ${cur.name}` : '아직 이어 할 것이 없습니다', disabled: !last && !cur }),
      button('자유 설계', go('garage'), { kind: 'menu', tilt: true, icon: 'wrench', sub: '차고: 설계 목록, 새 차 설계, 엔진 공방' }), button('시험장', go('pick', { mode: 'test' }), { kind: 'menu', tilt: true, icon: 'flag', sub: '트랙을 골라 시험 주행' }),
      button('레이스', go('pick', { mode: 'race' }), { kind: 'menu', tilt: true, icon: 'trophy', sub: '599 원메이크: 상대, 바퀴 수' }));
    nav.setAttribute('aria-label', '메인 메뉴'); (nav.querySelector('button:not([disabled])') as HTMLElement | null)?.setAttribute('data-first', '');
    const corner = el('div', 'gh-tcorner', button('정보', go('about'), { kind: 'ghost', icon: 'info', square: true, title: `정보: ${VERSION_NAME}, 바뀐 점, 출처` }),
      button('설정', go('settings'), { kind: 'ghost', icon: 'settings', square: true, title: '설정: 그래픽, 소리, 조작, 화면, 저장' }));
    root.append(el('div', 'gh-brand', el('h1', 'gh-logo gk-logo', 'GEARHOUSE'), el('i', 'gh-logoband gk-stripes'), el('div', 'gh-brandrow', el('span', 'gh-ver', VERSION_NAME), el('span', 'gh-tagline', '설계하고, 만들고, 시험하는 자동차'))), nav, corner,
      el('p', 'gh-foot', '↑↓ 이동 · Enter 선택 · Esc 뒤로')); }, { dim: false, car: titleCar }); }

// ---- the garage: the saved designs as cards (docs/systems/110 G4: cut-corner kit cards with the car's picture, its
// stat bars, the working design green, an old body's design grey and locked) ----
export function garageScreen(ctx: ShellCtx): Screen<never> {
  const s = ctx.store; let root: HTMLElement;
  const open = (d: Design) => { keepCurrent(s, d); void ctx.router.go('builder', { design: d }); };
  // a new design goes straight to the builder: its class first, then the body lump (docs/systems/115 C1, F1); no body asked here
  const fresh = () => { const d = newDesign(ENABLED_BODIES[0] as BodyBase); saveDesign(s, d); open(d); };
  const thumbs = carThumbs();
  /** the design's figures as the kit's bars (power, weight, top speed; grip has no figure of the design's yet), its engine and class line, its runs */
  const lines = (d: Design): (string | HTMLElement)[] => { const out: (string | HTMLElement)[] = [], m = measured(s, d.id), meas = m && m.sig === designSig(d) ? m : null;
    try { const f = designFigures(d); out.push(el('p', 'gh-card-l gh-spec', `${d.engine.layout} ${(d.engine.cc / 1000).toFixed(1)} L · ${tierLabel(tierOf(f))} · 0-100 ${f.zeroTo100} s`));
      out.push(el('div', 'gh-stats', statBar(STATS.power, f.hp), statBar(STATS.weight, f.mass), statBar(STATS.top, meas?.topKmh || f.topKmh))); }
    catch { out.push(el('p', 'gh-card-l gh-spec', `${d.engine.layout} ${(d.engine.cc / 1000).toFixed(1)} L`)); }
    if (meas) { const laps = Object.values(meas.laps).map(l => `${l.track.replace(/\s*\(.*$/, '')} ${fmtLap(l.t)}`); out.push(el('p', 'gh-card-l gh-meas', `측정: 최고 ${meas.topKmh || '-'} km/h${laps.length ? ` · ${laps.join(' · ')}` : ''}`)); }
    else out.push(el('p', 'gh-card-l gh-soft', '측정 없음 (시험 주행을 하면 기록됩니다)')); return out; };
  const del = (d: Design) => button('삭제', () => { void dialog('설계 삭제', [`"${d.name}" 설계를 지울까요? 되돌릴 수 없습니다.`], [['del', '삭제', { kind: 'danger' }], ['', '취소', { kind: 'ghost' }]]).then(v => { if (v) { deleteDesign(s, d.id); if (currentDesign(s)?.id === d.id) try { s?.removeItem('gearhouse.builder.current.v1'); } catch { /* not kept */ } toast('지웠습니다'); fill(); } }); }, { kind: 'danger' });
  const exp = (d: Design) => button('내보내기', () => download(`${d.name.replace(/[^\w가-힣-]+/g, '_') || 'design'}.json`, designJson(d)), { kind: 'ghost' });
  /** a card's badge pinned on its picture */
  const pin = (c: HTMLElement, b: HTMLElement) => { c.querySelector('.gh-card-pic')?.append(b); };
  const fill = () => { root.textContent = ''; thumbs.clear(); ctx.backdrop.pre = (L, cv) => thumbs.pump(L, cv); const all = savedDesigns(s), cur = currentDesign(s), list = cur && !all.some(d => d.id === cur.id) ? [cur, ...all] : all;
    const grid = el('div', 'gh-grid gh-designs'); let old = 0;
    for (const d of list) { const saved = all.some(x => x.id === d.id);
      // an old body's design (docs/systems/113 V0): a grey card, kept in the storage; it can only be deleted or exported
      if (!enabledDesign(d)) { old++; const c = card({ pic: carPic(d.body.paint, d.body.base), title: d.name, lines: [el('p', 'gh-card-l gh-spec', BASE_NAME[d.body.base] ?? d.body.base), el('p', 'gh-card-l gh-soft', '이 차체는 지금 게임에서 꺼져 있습니다. 주행·레이스·편집은 할 수 없고, 설계는 그대로 남아 있습니다.')],
          actions: [del(d), exp(d)] }); c.classList.add('gh-old'); pin(c, badge('lock', '옛 방식 · 비활성', true)); grid.append(c); continue; }
      const working = cur?.id === d.id, c = card({ pic: carPic(d.body.paint, d.body.base), title: d.name, selected: working, lines: [el('p', 'gh-card-l gh-base', frameName(d)), ...lines(d)],
        actions: [button('열기', () => open(d), { kind: 'main', icon: 'wrench' }), button('복제', () => { saveDesign(s, { ...structuredClone(d), id: newId(), name: `${d.name} 사본`.slice(0, 40) }); toast(`복제했습니다: ${d.name} 사본`); fill(); }),
          del(d), exp(d)] });
      thumbs.want(c.querySelector<HTMLElement>('.gh-card-pic')!, d);
      if (!saved) pin(c, badge('hot', '저장 안 됨', true)); else if (working) pin(c, badge('beta', '작업 중', true));
      grid.append(c); }
    if (!list.length) grid.append(el('p', 'gh-empty', '아직 설계가 없습니다. "새 차 설계"로 시작하세요.'));
    const acts = el('div', 'gh-gacts', button('새 차 설계', fresh, { kind: 'main', icon: 'body', big: true, tilt: true, sub: '차급을 고르고 차체 덩어리부터' }),
      button('엔진 공방', () => void ctx.router.go('engine', {}), { id: 'gh-engineshop', title: '엔진 설계와 엔진 보관함', icon: 'engine', kind: 'watch', big: true, tilt: true, sub: '엔진 설계와 보관함' }),
      button('가져오기', () => void pickFile().then(t => { if (t === null) return; const d = parseDesign(t); if (!d) { toast('설계 파일이 아닙니다'); return; } saveDesign(s, d); toast(`가져왔습니다: ${d.name}`); fill(); }), { kind: 'alt', title: '설계 파일(.json) 가져오기' }));
    root.append(topbar('차고', () => ctx.router.back(), slotsChip(all.length)), el('div', 'gh-body', acts,
      secHead('내 설계', 'body', el('span', 'gh-note', `설계 ${all.length}개${old ? ` · 옛 방식 ${old}개` : ''} · 이 브라우저에 저장`)), grid));
    root.querySelector('.gh-gacts .gh-main')?.setAttribute('data-first', ''); };
  const m = menu(ctx, 'garage', r => { root = r; fill(); }, { leave: () => { thumbs.clear(); ctx.backdrop.pre = null; } }); return m; }

// ---- the test track's and the race's choices ----
/** the 959 as it left the works (its own design, one id: its runs are kept under it), for the test track and the race without a design of one's own */
let p959Own: Design | null = null;
const p959Stock = (): Design => (p959Own ??= stockP959());
/** the N33 as it left the works (docs/systems/117 R4), as the 599's */
let n33Own: Design | null = null;
const n33Stock = (): Design => (n33Own ??= stockN33());
export interface PickParams { mode: 'test' | 'race' }
const TRACK_KEY = 'gearhouse.drive.track';
export function pickScreen(ctx: ShellCtx): Screen<never> {
  let mode: PickParams['mode'] = 'test';
  const m = menu(ctx, 'pick', root => { const s = ctx.store, d = ctx.recent(); let track = (() => { try { return s?.getItem(TRACK_KEY) ?? 'millbrook'; } catch { return 'millbrook'; } })();
    const race = { opp: 3, lineup: 'p959', laps: 2 }; let car: 'design' | 'p959' | 'n33' = enabledDesign(d) && d.id !== 'p959stock' && d.id !== 'n33stock' ? 'design' : d.id === 'n33stock' ? 'n33' : 'p959';
    const cards = el('div', 'gh-grid gh-tracks'), drawTracks = () => { cards.textContent = ''; for (const t of TRACKS) cards.append(card({ title: t.title, lines: [t.label], selected: t.id === track, onPick: () => { track = t.id; drawTracks(); (cards.querySelector('.gh-on') as HTMLElement | null)?.focus(); } })); }; drawTracks();
    const opts = el('div', 'gh-opts gk-panel', chips('차', [...(car === 'design' ? [['design', `설계: ${d.name}`] as ['design', string]] : []), ['p959', `${CAR_599} (순정)`], ['n33', `${CAR_N33} (순정)`]], car, v => { car = v; }));   // enabled bodies only (docs/systems/113 V0)
    if (mode === 'race') opts.append(slider('상대 차 수', [1, 7, 1], race.opp, v => { race.opp = v; }, v => `${v}대`),
      // the field is the 599's one-make whatever the player drives (docs/systems/117 R4: the N33 is the player's, not an opponent): nothing to choose
      chips('바퀴 수', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], race.laps, v => { race.laps = v; }));
    const start = button(mode === 'race' ? '레이스 시작' : '주행 시작', () => { try { s?.setItem(TRACK_KEY, track); } catch { /* not kept */ }
      void ctx.router.go('drive', { design: car === 'design' ? d : car === 'n33' ? n33Stock() : p959Stock(), track, race: mode === 'race' ? { ...race } : undefined, from: 'pick' }); }, { kind: 'main', icon: 'play' });
    root.append(topbar(mode === 'race' ? '레이스' : '시험장', () => ctx.router.back(), start), el('div', 'gh-body', el('h2', 'gh-h2', '트랙'), cards, el('h2', 'gh-h2', mode === 'race' ? '차와 상대' : '차'), opts));
    (cards.querySelector('.gh-on') as HTMLElement | null)?.setAttribute('data-first', ''); });
  return { ...m, enter(p: PickParams, how) { if (how !== 'back') mode = p?.mode ?? 'test'; return m.enter(p as never, how); } }; }

// ---- the settings (docs/systems/110 G4: each tab's fields gathered into named kit panels, two columns on a wide window) ----
/** the screen's own fields, written to the settings as they change */
export function settingsScreen(ctx: ShellCtx): Screen<never> {
  return menu(ctx, 'settings', root => { const S = (): Settings => ctx.settings, set = (f: (s: Settings) => void) => { f(ctx.settings); ctx.changed(); };
    const pane = (...kids: HTMLElement[]) => el('div', 'gh-groups', ...kids);
    const gfx = pane(
      group('화풍', 'spray', toggle('실시간 렌더러 (WebGL2)', S().graphics.live, v => set(s => { s.graphics.live = v; }), '끄면 구운 그림으로 그립니다 (느린 기기)'),
        chips('조명·재질', [['drift', '드리프트 (화풍 4)'], ['toon', '툰'], ['baked', '단계 조명']], S().graphics.look, v => set(s => { s.graphics.look = v; })),
        chips('선 굵기 (툰·드리프트)', [['thin', '가늘게 ×0.75'], ['normal', '보통'], ['bold', '굵게 ×1.25'], ['heavy', '아주 굵게 ×1.5']], S().graphics.lineWeight, v => set(s => { s.graphics.lineWeight = v; })),
        chips('유리 반사 (툰)', [['off', '끔'], ['weak', '약함'], ['mid', '보통']], S().graphics.glassRefl, v => set(s => { s.graphics.glassRefl = v; }))),
      group('연기와 효과', 'turbo', chips('연기 품질', [['off', '끔'], ['parcels', '덩어리'], ['mid', '부피 보통'], ['high', '부피 높음']], S().graphics.smoke, v => set(s => { s.graphics.smoke = v; })),
        chips('연기 크기', [['normal', '보통'], ['big', '크게']], S().graphics.smokeSize, v => set(s => { s.graphics.smokeSize = v; })),
        chips('속도 효과 (공기 줄기·미등 빛줄기)', [['off', '끔'], ['weak', '약하게'], ['mid', '보통']], S().graphics.speedFx, v => set(s => { s.graphics.speedFx = v; })),
        toggle('모션 블러', S().graphics.blur, v => set(s => { s.graphics.blur = v; }))),
      group('배경과 풍경', 'flag', toggle('사진 콘크리트 (Poly Haven 텍스처)', S().graphics.photoGround, v => set(s => { s.graphics.photoGround = v; })),
        toggle('HDRI 하늘 (사진 하늘의 반사와 빛)', S().graphics.hdri, v => set(s => { s.graphics.hdri = v; })),
        chips('풍경 밀도 (나무 수)', [['low', '낮음'], ['mid', '보통'], ['high', '높음']], S().graphics.scenery, v => set(s => { s.graphics.scenery = v; })),
        el('p', 'gh-note', '빛 세기, 반사, 블룸, 선, 시대감 같은 세부 효과는 주행 화면의 ⚙ 서랍 "개발자" 탭에 있습니다.')));
    const snd = pane(group('소리', 'play', toggle('주행 소리 (엔진, 타이어, 바람, 주변음)', S().sound.on, v => set(s => { s.sound.on = v; })),
      slider('음량', [0, 1, 0.05], S().sound.volume, v => set(s => { s.sound.volume = v; }), v => `${Math.round(v * 100)} %`),
      toggle('메뉴 소리 (버튼, 이동)', S().sound.ui, v => set(s => { s.sound.ui = v; }))));
    const ctl = pane(
      // docs/systems/110 G3: the driving HUD's touch controls
      group('화면 버튼', 'steering', chips('화면 버튼 (핸들, 페달)', [['auto', '자동 (터치 화면)'], ['on', '항상'], ['off', '끄기']], S().controls.touch, v => set(s => { s.controls.touch = v; })),
        slider('화면 버튼 크기', [0.7, 1.4, 0.05], S().controls.hudSize, v => set(s => { s.controls.hudSize = v; }), v => `${Math.round(v * 100)}%`), slider('화면 버튼 불투명도', [0.35, 1, 0.05], S().controls.hudAlpha, v => set(s => { s.controls.hudAlpha = v; }), v => `${Math.round(v * 100)}%`),
        toggle('왼손 배치 (핸들 오른쪽, 페달 왼쪽)', S().controls.leftHand, v => set(s => { s.controls.leftHand = v; })), chips('수동 변속 조작', [['lever', '기어 레버 (F1은 패들)'], ['buttons', '+ / − 버튼']], S().controls.shifter, v => set(s => { s.controls.shifter = v; }))),
      group('주행 보조', 'wheel', toggle('자동 변속', S().controls.auto, v => set(s => { s.controls.auto = v; })), toggle('트랙션 보조 (키보드용)', S().controls.tcs, v => set(s => { s.controls.tcs = v; })),
        toggle('카운터스티어 보조', S().controls.assist, v => set(s => { s.controls.assist = v; })), toggle('가속 게이지 모드 (오래 누를수록 차오름)', S().controls.progressive, v => set(s => { s.controls.progressive = v; }))),
      group('시동과 카메라', 'engine', chips('시동', [['direct', '직접 시동 (I/Enter 길게)'], ['auto', '자동 시동']], S().controls.ignition, v => set(s => { s.controls.ignition = v; })), toggle('시동 꺼짐 (수동 변속, 직접 시동)', S().controls.stall, v => set(s => { s.controls.stall = v; })),
        chips('주행 카메라 (주행 중 C로 바꿈)', CAM_VIEWS.map(c => [c.id, c.name] as [CamView, string]), S().camera.view, v => set(s => { s.camera.view = v; })),
        // docs/systems/118 D1: the cockpit's view
        slider('운전석 시야 (세로 각도)', [CABIN_FOV.min, CABIN_FOV.max, 1], S().camera.fov, v => set(s => { s.camera.fov = v; }), v => `${Math.round(v)}°`),
        chips('머리 움직임 (운전석 시점)', [['off', '끔'], ['subtle', '아주 약하게'], ['weak', '약하게'], ['normal', '보통']], S().camera.head, v => set(s => { s.camera.head = v; })),
        toggle('운전석 시점에서도 화면 핸들 그림 보이기', S().camera.hudWheel, v => set(s => { s.camera.hudWheel = v; }), '끄면 실제 핸들이 보이므로 핸들 그림을 숨깁니다 (터치 핸들은 그대로)')),
      group('키와 패드', 'info', el('p', 'gh-note', '주행: ↑/W 가속 · ↓/S 브레이크 · ←→/A D 조향 · Space 핸드브레이크 · Q/E 기어 · M 자동/수동 · R 복귀 · C 시네마틱 · Esc 일시정지. 메뉴: 화살표, Enter, Esc (게임패드의 십자키, A, B도 됩니다).')));
    const scr = pane(
      group('색과 밝기', 'spray', chips('화면 색 (팔레트)', PALETTE_IDS.map(id => [id, PALETTES[id].name] as [typeof id, string]), S().screen.palette, v => set(s => { s.screen.palette = v; })),
        chips('화면 밝기 (빌더·주행 화면)', [['auto', '기기 설정대로'], ['light', '밝게'], ['dark', '어둡게']], S().screen.theme, v => set(s => { s.screen.theme = v; }))),
      group('움직임과 전체화면', 'settings', toggle('움직임 줄이기 (전환 효과, 턴테이블)', S().screen.calm, v => set(s => { s.screen.calm = v; })),
        row('전체화면', button('전체화면 켜기·끄기', () => { const e = document.documentElement; if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void e.requestFullscreen?.().catch(() => toast('이 브라우저는 전체화면을 허락하지 않습니다')); }))));
    const game = pane(group('샌드박스 규칙', 'wrench', toggle('연도 제한 (기술의 등장 연도)', S().sandbox.eraLimit, v => set(s => { s.sandbox.eraLimit = v; }), '켜면 엔진 공방이 설계한 해보다 늦게 나온 기술을 표시합니다. 0.12에서는 정보로만 보여 주고 막지는 않습니다(0.20 연구 체계와 함께 적용).'),
        toggle('시대 잠금 풀기 (하이퍼 H1~H3)', S().sandbox.eraOpen, v => set(s => { s.sandbox.eraOpen = v; }), '빌더의 차급에서 2000년대 이후의 하이퍼 칸(800 hp 넘게)을 엽니다. 이렇게 고른 설계에는 "시대 밖" 표시가 붙습니다.')),
      group('개발자', 'suspension', chips('개발자 · 주행 물리', [['kinematic', '기구학 물리'], ['old', '옛 물리']], S().sandbox.physics, v => set(s => { s.sandbox.physics = v; })),
        el('p', 'gh-note', '기구학 물리: 키트 바탕 차(1990년대)는 서스펜션 장착점에서 계산한 캠버·토·롤 센터로 달립니다. 옛 물리: 0.12까지의 근사식(비교용). 다음 주행부터 적용됩니다.')));
    const save = pane(group('저장 관리', 'money', el('p', 'gh-note', '설계, 측정 기록, 최고 랩, 설정은 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 전체를 파일로 내보내고 그 기기에서 가져오세요.'),
      el('div', 'gh-actions', button('전체 내보내기', () => { const t = exportAll(ctx.store); if (t === null) { toast('이 브라우저는 저장소를 읽게 하지 않습니다'); return; } download(`gearhouse_save_${new Date().toISOString().slice(0, 10)}.json`, t); toast('저장 파일을 내보냈습니다'); }, { kind: 'main' }),
        button('가져오기', () => void pickFile().then(t => { if (t === null) return; const n = importAll(ctx.store, t); if (n === null) { toast('GEARHOUSE 저장 파일이 아닙니다'); return; } Object.assign(ctx.settings, loadSettings(ctx.store)); ctx.changed(); toast(`가져왔습니다 (${n}개 항목)`); })),
        button('초기화', () => void dialog('저장 초기화', ['이 브라우저에 저장된 설계, 측정 기록, 최고 랩, 설정을 모두 지웁니다. 되돌릴 수 없습니다. 먼저 내보내기를 해 두세요.'], [['reset', '모두 지우기', { kind: 'danger' }], ['', '취소', { kind: 'ghost' }]]).then(v => {
          if (!v) return; const n = resetAll(ctx.store); Object.assign(ctx.settings, structuredClone(DEFAULTS)); saveSettings(ctx.store, ctx.settings); ctx.changed(); toast(`초기화했습니다 (${n}개 항목)`); }), { kind: 'danger' }))));
    const t = tabs([['gfx', '그래픽', gfx, 'spray'], ['sound', '소리', snd, 'play'], ['controls', '조작', ctl, 'steering'], ['screen', '화면', scr, 'settings'], ['game', '샌드박스', game, 'wrench'], ['save', '저장 관리', save, 'money']]);
    root.append(topbar('설정', () => ctx.router.back()), el('div', 'gh-body gh-wide', t.el)); root.querySelector('.gh-tab')?.setAttribute('data-first', ''); }); }

// ---- about: the version, what changed, where the pictures come from ----
type Src = { source?: string; authors?: string[]; license?: string; name?: string; layer?: string; id?: string };
export function aboutScreen(ctx: ShellCtx): Screen<never> {
  return menu(ctx, 'about', root => { const ul = (items: (string | HTMLElement)[]) => el('ul', 'gh-list', ...items.map(i => el('li', '', i)));
    const src = (title: string, list: Src[]) => el('details', 'gh-src', el('summary', '', `${title} (${list.length})`), ul(list.map(x => { const a = el('a', '', (x.source ?? '').replace('https://polyhaven.com/a/', '')); a.href = x.source ?? '#'; a.target = '_blank'; a.rel = 'noopener';
      return el('span', '', a, ` — ${(x.authors ?? []).join(', ')}${x.license ? ` · ${x.license}` : ''}`); })));
    const P = pbrMeta as { layers: Src[] }, G = groundMeta as { layers: Src[] }, B = buildMeta as { layers: Src[] }, K = skyMeta as Src, M = modelMeta as { models: Src[] };
    root.append(topbar('정보', () => ctx.router.back(), button('디자인 견본', () => void ctx.router.go('kit'), { kind: 'alt', icon: 'spray', title: '인터페이스 디자인 체계 견본 (문서 110 G2)' })), el('div', 'gh-body gh-narrow',
      el('div', 'gh-panel gk-panel', el('h2', 'gh-logo gk-logo gh-small', 'GEARHOUSE'), el('p', 'gh-ver', VERSION_NAME), el('p', 'gh-note', '1930년대부터 이어지는 자동차 회사를 꿈꾸는 게임의 설계·시험 샌드박스입니다. 차를 설계하고, 시험장에서 측정하고, 레이스를 합니다. 회사 경영은 알파 0.20부터 들어옵니다.')),
      el('div', 'gh-panel gk-panel', el('h2', 'gh-h2', '바뀐 점'), ul([...CHANGES])),
      el('div', 'gh-panel gk-panel', el('h2', 'gh-h2', '만든 이와 자료 출처'), el('p', 'gh-note', '사진 재질, 하늘, 소품 모델은 모두 Poly Haven(polyhaven.com)의 CC0 자료입니다. 글꼴: Oswald, Noto Sans KR (SIL Open Font License, Google Fonts). 차의 모양과 물리, 트랙, 소리는 이 게임에서 만들었습니다.'),
        src('차 재질 텍스처', P.layers), src('트랙 노면 재질', G.layers), src('건물 재질', B.layers), src('하늘 (HDRI)', [K]), src('소품 모델', M.models))));
    root.querySelector('.gh-bar .gh-btn')?.setAttribute('data-first', ''); }); }

// ---- the design system's style sheet (docs/systems/110 G2), from the about screen ----
export function kitScreen(ctx: ShellCtx): Screen<never> {
  return menu(ctx, 'kit', root => { const d = el('div'); root.append(d); buildSheet(d, { onBack: () => ctx.router.back() }); root.querySelector<HTMLElement>('.gk-top .gk-btn')?.setAttribute('data-first', ''); }); }
