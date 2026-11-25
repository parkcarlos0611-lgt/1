// The game page's two working screens (docs/systems/101 part 3-4): the parts builder and the drive, their own pages
// (ui/builder3d.ts, ui/drive.ts) mounted once on the shared renderer and shown again as they were left; the builder's
// test drive goes to the drive screen with the design and comes back to the builder at the same step. The drive gets a
// pause menu (Esc, or its pause button on a phone) with the adjustments made while driving (the camera, the dampers,
// the assists); its drawer keeps the rest, the developers' effects folded under "개발자". A race's end goes to its
// results (a first version: U2 makes them a screen of their own with the car's picture).
import type { Screen, Move } from './router';
import type { ShellCtx } from './ctx';
import { PageScreen } from './stage';
import { el, button, chips, toggle, toast } from './ui';
import { mountBuilder, type BuilderApi } from '../builder3d';
import { mountDrive, type DriveApi } from '../drive';
import builderPage from '../builder3d.page.html';
import drivePage from '../drive.page.html';
import type { Design } from '../../core/design';
import { savedDesigns, saveDesign } from '../../core/designstore';
import { withEngine } from '../../core/engines';
import { lapTimes } from '../../race/race';
import { trackDef } from '../../race/tracks';
import { GLASS_REFL, type Settings } from './settings';
import { CAM_VIEWS, type CamView } from '../drivecam';

const LOOK_B: Record<Settings['graphics']['look'], string> = { pbr: '2', toon: '3', stepped: '0', baked: '0', drift: '4' };
/** a page field set as a person would (its own listeners told), only when it differs */
function setField(root: ParentNode, id: string, v: boolean | string | number) { const f = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`); if (!f || f.disabled) return;
  if (f instanceof HTMLInputElement && f.type === 'checkbox') { if (f.checked === v) return; f.checked = !!v; f.dispatchEvent(new Event('change')); return; }
  if (f.value === String(v)) return; f.value = String(v); f.dispatchEvent(new Event(f instanceof HTMLInputElement && f.type === 'range' ? 'input' : 'change')); }
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)));

// ---- the builder ----
export interface BuilderParams { design?: Design }
export function builderScreen(ctx: ShellCtx): Screen<BuilderParams> & { readonly api: BuilderApi | null } {
  let page: PageScreen | null = null, api: BuilderApi | null = null;
  return { get api() { return api; },
    enter(p, how) { ctx.backdrop.stop(); page ??= new PageScreen('builder', builderPage, { dropCanvas: !!ctx.stage.L }); ctx.stage.use('builder', true); page.show(ctx.pages);
      if (!api) { api = mountBuilder({ root: page.root, renderer: ctx.stage.L, design: p?.design, glassRefl: () => GLASS_REFL[ctx.settings.graphics.glassRefl], onTestDrive: d => void ctx.router.go('drive', { design: d, from: 'builder' }),
          // step ②: the engine designer with this car's engine, handed back to the car here
          onEngineShop: d => void ctx.router.go('engine', { design: d, onApply: (e: Design['engine']) => { if (api) api.use(withEngine(api.design, e)); } }) });
        // the way back to the garage, at the bar's start
        page.root.querySelector('.top')?.prepend(button('◀ 차고', () => ctx.router.back(), { title: '차고로 (Esc)' })); }
      else api.enter(how === 'back' ? undefined : p?.design);
      setField(page.root, 'look', LOOK_B[ctx.settings.graphics.look]); document.title = `GEARHOUSE · 차 빌더 · ${api.design.name}`; ctx.keepLast({ screen: 'builder', design: api.design.id }); },
    leave() { if (api) { api.leave(); const d = api.design; if (savedDesigns(ctx.store).some(x => x.id === d.id)) saveDesign(ctx.store, d); }   // a saved design kept as it was left (자동 저장)
      page?.hide(); } }; }

// ---- the drive ----
export interface DriveParams { design?: Design | null; track?: string; race?: { opp?: number; lineup?: string; laps?: number }; from?: 'builder' | 'pick' }
export interface ResultRow { pos: number; name: string; best: number; total: number; me: boolean }
let restartAsked = false;
export function driveScreen(ctx: ShellCtx): Screen<DriveParams> & { readonly api: DriveApi | null; apply(): void } {
  let page: PageScreen | null = null, api: DriveApi | null = null, params: DriveParams = {}, pause: HTMLElement | null = null, menuOn = false, poll = 0, raceSeen: unknown = null;
  const R = () => page!.root;
  /** the game's settings put on the drive's own fields */
  const apply = () => { if (!page) return; const s = ctx.settings, r = R(); setField(r, 'live', s.graphics.live); setField(r, 'look', s.graphics.look); setField(r, 'photoGround', s.graphics.photoGround); setField(r, 'hdri', s.graphics.hdri); setField(r, 'blur', s.graphics.blur); setField(r, 'glassRefl', s.graphics.glassRefl); setField(r, 'smokeQ', s.graphics.smoke); setField(r, 'smokeSize', s.graphics.smokeSize);
    setField(r, 'touch', s.controls.touch === 'auto' ? matchMedia('(pointer: coarse)').matches : s.controls.touch === 'on'); setField(r, 'auto', s.controls.auto); setField(r, 'tcs', s.controls.tcs); setField(r, 'assist', s.controls.assist); setField(r, 'progressive', s.controls.progressive); setField(r, 'ignition', s.controls.ignition); setField(r, 'stall', s.controls.stall);
    setField(r, 'hudSize', s.controls.hudSize); setField(r, 'hudAlpha', s.controls.hudAlpha); setField(r, 'hudLeft', s.controls.leftHand); setField(r, 'shifter', s.controls.shifter);   // docs/systems/110 G3
    setField(r, 'vol', s.sound.volume); setField(r, 'sound', s.sound.on); if (api) api.camera = s.camera.view; };
  /** the drive's drawer for the game: what the pause menu and the settings now hold taken out of it, the effects folded under 개발자 */
  const shellize = (r: HTMLElement) => { const hide = (id: string) => { const f = r.querySelector(`#${id}`); const box = f?.closest<HTMLElement>('.row, label.check'); if (box) box.style.display = 'none'; };
    for (const id of ['auto', 'assist', 'ignition', 'stall', 'tcs', 'pilot', 'progressive', 'touch', 'hudSize', 'hudAlpha', 'hudLeft', 'shifter', 'damper', 'chase', 'cine', 'live', 'look', 'photoGround', 'hdri', 'blur', 'sound', 'vol', 'smokeQ', 'smokeSize']) hide(id);
    const tabBar = r.querySelector('.tabs')!, dials = r.querySelector('.dials')!, dev = el('section'); dev.dataset.tab = 'dev'; dev.append(el('p', 'note', '개발자용 세부 효과입니다. 게임 설정은 타이틀의 "설정"에 있습니다.'));
    for (const [tab, name] of [['gfx', '빛과 재질, 선'], ['fx', '효과와 시대감'], ['wear', '차 상태 (녹, 바램, 먼지)']] as const) { const sec = r.querySelector<HTMLElement>(`.dials section[data-tab="${tab}"]`), b = r.querySelector<HTMLElement>(`.tabs button[data-tab="${tab}"]`); if (!sec) continue;
      const d = el('details', 'gh-dev', el('summary', '', name)); d.append(...Array.from(sec.childNodes)); dev.append(d); sec.remove(); b?.remove(); }
    r.querySelector(`.tabs button[data-tab="sound"]`)?.remove(); r.querySelector(`.dials section[data-tab="sound"]`)?.remove(); dials.append(dev);
    const tb = el('button', '', '개발자'); tb.type = 'button'; tb.setAttribute('role', 'tab'); tb.dataset.tab = 'dev'; tb.setAttribute('aria-selected', 'false'); tabBar.append(tb);
    tb.addEventListener('click', () => { r.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === tb))); r.querySelectorAll<HTMLElement>('.dials section').forEach(s => s.classList.toggle('on', s.dataset.tab === 'dev')); });
    // the pause button (a phone has no Esc): beside the drawer's
    const pb = el('button', 'fsbtn gh-pausebtn', '❚❚'); pb.type = 'button'; pb.id = 'gh-pausebtn'; pb.setAttribute('aria-label', '일시정지'); pb.addEventListener('click', () => openPause()); r.querySelector('.screen')?.append(pb); };
  // ---- the pause menu ----
  const toDesign = () => { if (!ctx.router.backTo('builder')) void ctx.router.go('builder', { design: params.design ?? undefined }); };
  const openPause = () => { if (!api || menuOn) return; api.pause(); api.drawer(false); menuOn = true; buildPause(); };
  const closePause = () => { if (!menuOn) return; menuOn = false; pause?.remove(); pause = null; api?.resume(); (document.activeElement as HTMLElement | null)?.blur(); };
  const buildPause = () => { pause?.remove(); const r = R(), f = (id: string) => r.querySelector<HTMLInputElement & HTMLSelectElement>(`#${id}`)!;
    const keepCtl = (k: 'auto' | 'tcs' | 'assist', v: boolean) => { ctx.settings.controls[k] = v; ctx.changed(); };
    const nav = el('nav', 'gh-menu gh-pausemenu', button('계속', closePause, { kind: 'menu', id: 'gh-resume' }), button('다시 시작', () => { closePause(); api!.restart(); }, { kind: 'menu' }),
      params.design ? button('설계로 돌아가기', toDesign, { kind: 'menu', sub: params.design.name }) : null, button('설정', () => void ctx.router.go('settings'), { kind: 'menu' }), button('타이틀로', () => void ctx.router.reset('title'), { kind: 'menu' }));
    const quick = el('div', 'gh-form gh-quick', el('h3', 'gh-h3', '주행 중 조절'),
      chips('카메라 (C)', CAM_VIEWS.filter(c => api!.cameras.includes(c.id)).map(c => [c.id, c.name] as [CamView, string]), api!.camera, v => { api!.camera = v; }),
      chips('댐퍼 (가변 댐퍼가 있는 차)', [['sport', '스포츠'], ['comfort', '컴포트']], f('damper').value, v => setField(r, 'damper', v)),
      toggle('자동 변속 (M)', f('auto').checked, v => { setField(r, 'auto', v); keepCtl('auto', v); }), toggle('트랙션 보조', f('tcs').checked, v => { setField(r, 'tcs', v); keepCtl('tcs', v); }),
      toggle('카운터스티어 보조', f('assist').checked, v => { setField(r, 'assist', v); keepCtl('assist', v); }), toggle('시험 운전자에게 맡기기', f('pilot').checked, v => setField(r, 'pilot', v)));
    quick.append(el('p', 'gh-note', `엔진: ${api!.engine}`));   // docs/systems/110 G1
    pause = el('div', 'gh-pause', el('div', 'gh-panel gh-pausebox', el('h2', 'gh-h2 gh-display', '일시정지'), el('div', 'gh-pausecols', nav, quick)));
    pause.setAttribute('role', 'dialog'); pause.setAttribute('aria-label', '일시정지'); pause.addEventListener('click', e => { if (e.target === pause) closePause(); });
    ctx.over.append(pause); requestAnimationFrame(() => pause?.querySelector<HTMLElement>('#gh-resume')?.focus()); };
  /** a race's end: its results shown on their own screen */
  const watch = () => { clearInterval(poll); poll = setInterval(() => { const race = api?.raceNow; if (!race?.done || race === raceSeen || menuOn) return; raceSeen = race;
    const ord = race.order(), rows: ResultRow[] = ord.map((e, i) => { const laps = lapTimes(e); return { pos: i + 1, name: e.name, best: laps.length ? Math.min(...laps) : 0, total: e.finish ? e.finish - e.start : 0, me: e === race.player }; });
    toast('레이스 끝: 결과를 봅니다'); setTimeout(() => void ctx.router.go('results', { rows, track: trackDef(api!.track).title, laps: race.laps }), 1200); }, 400) as unknown as number; };
  return { get api() { return api; }, apply() { if (api) apply(); },
    async enter(p, how: Move) { ctx.backdrop.stop(); page ??= new PageScreen('drive', drivePage); ctx.stage.use('drive', false); page.show(ctx.pages); if (how !== 'back') params = p ?? {};
      document.title = `GEARHOUSE · 시험 주행${params.design ? ` · ${params.design.name}` : ''}`;
      if (!api) { ctx.loading(true, '트랙을 준비하는 중', 0.2); await nextFrame();
        api = mountDrive({ root: page.root, renderer: ctx.stage.L, design: params.design ?? null, onDesign: toDesign, camera: ctx.settings.camera.view,
          onCamera: v => { if (ctx.settings.camera.view !== v) { ctx.settings.camera.view = v; ctx.changed(); } } }); shellize(page.root); apply(); ctx.loading(true, '트랙 재질과 소품을 불러오는 중', 0.6);
        await Promise.race([api.ready, new Promise(r => setTimeout(r, 20000))]); ctx.loading(false);
        if (params.track) api.setTrack(params.track); if (params.race) api.race(params.race); }
      else if (how !== 'back') { menuOn = false; pause?.remove(); pause = null; api.useDesign(params.design ?? null); if (params.track) api.setTrack(params.track); if (params.race) api.race(params.race); apply(); api.resume(); }
      else { apply(); if (restartAsked) { restartAsked = false; menuOn = false; pause?.remove(); pause = null; api.restart(); api.resume(); } else if (menuOn) buildPause(); else api.resume(); }
      watch(); ctx.keepLast({ screen: 'drive', design: params.design?.id, track: api.track }); },
    leave() { clearInterval(poll); api?.pause(); pause?.remove(); page?.hide(); },
    /** Esc and the phone's back: the drawer closed first, else the pause menu on and off */
    back() { if (!api) return false; if (api.drawerOpen) { api.drawer(false); return true; } if (menuOn) closePause(); else openPause(); return true; } }; }

// ---- the race's results (a first version) ----
export interface ResultParams { rows: ResultRow[]; track: string; laps: number }
const fmt = (t: number) => t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : '-';
export function resultsScreen(ctx: ShellCtx): Screen<ResultParams> {
  const root = el('section', 'gh-screen gh-dim gh-results');
  return { enter(p) { root.textContent = ''; const tb = el('table', 'gh-table'); tb.innerHTML = '<thead><tr><th>순위</th><th>차</th><th>최고 랩</th><th>기록</th></tr></thead>';
      const body = el('tbody'); for (const r of p.rows) { const tr = el('tr', r.me ? 'gh-me' : ''); for (const c of [String(r.pos), r.name, fmt(r.best), fmt(r.total)]) tr.append(el('td', '', c)); body.append(tr); } tb.append(body);
      const again = button('다시 하기', () => { restartAsked = true; ctx.router.back(); }, { kind: 'main' });
      root.append(el('header', 'gh-bar', el('h1', 'gh-bar-t', `레이스 결과 · ${p.track} · ${p.laps}바퀴`), el('span', 'gh-grow')), el('div', 'gh-body gh-narrow', el('div', 'gh-panel', tb),
        el('div', 'gh-actions', again, button('차고로', () => void ctx.router.reset('title').then(() => ctx.router.go('garage'))), button('타이틀로', () => void ctx.router.reset('title')))));
      ctx.layer.append(root); ctx.backdrop.setDesign(ctx.recent()); ctx.backdrop.start(); requestAnimationFrame(() => again.focus()); },
    leave() { root.remove(); } }; }
