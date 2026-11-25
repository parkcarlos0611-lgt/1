// The game's one page (docs/systems/101 part 3-5, U1): the loading cover while the sky and the car textures load, then
// the title; from it the garage, the builder, the test track, the race, the settings and the about screen, all on this
// page: one WebGL canvas and one renderer handed from screen to screen, the textures loaded once, no new window and no
// page loaded again between the builder and the drive. Esc and the phone's back button go back along the screens' way;
// the arrow keys walk the menus (a pad's cross too). Built by tools/ref/buildsite.mjs into game.html.
import { setLineWeight } from '../../render/live/style';
import { setPartStyle, styleForLook } from '../../render/car/powertrain';
import { LINE_WEIGHT } from './settings';
import { LiveRenderer } from '../../render/live/renderer';
import { loadSky } from '../../render/live/groundtex';
import texAlb from '../../assets/textures/pbr/albedo.jpg';
import texNor from '../../assets/textures/pbr/normal.jpg';
import texRgh from '../../assets/textures/pbr/rough.jpg';
import texMeta from '../../assets/textures/pbr/pbr.json';
import { Router, type Screen } from './router';
import { Stage, Backdrop } from './stage';
import { loadSettings, saveSettings, type ListStore } from './settings';
import { setSceneryDensity } from '../../race/scenery';
import type { ShellCtx, Last } from './ctx';
import { titleScreen, garageScreen, pickScreen, settingsScreen, aboutScreen, kitScreen } from './menus';
import { installKit, setPalette } from '../kit/style';
import { builderScreen, driveScreen, resultsScreen } from './play';
import { engineScreen } from './engine';
import { closeDialog, dialogBox, navKey, padKeys, uiSounds, blip } from './ui';
import { TIPS } from './tips';
import { VERSION_NAME } from '../../core/version';
import { currentDesign, savedDesigns, fromPreset } from '../../core/designstore';
import type { Design } from '../../core/design';
import { PHYSICS } from '../../race/kin';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
installKit();   // the design system's tokens and parts (docs/systems/110 G2, ui/kit)
const store: ListStore | null = (() => { try { return localStorage; } catch { return null; } })();
const settings = loadSettings(store);
const canvas = $<HTMLCanvasElement>('gh-gl');
let L: LiveRenderer | null = null;
try { L = new LiveRenderer(canvas); } catch (e) { console.warn('live renderer unavailable', e); }
const stage = new Stage(L, canvas), backdrop = new Backdrop(stage);

// ---- the loading cover: a bar, what is loading, a tip that changes every few seconds ----
let tipAt = Math.floor(Math.random() * TIPS.length), tipT = 0;
const showTip = () => { const t = $('gh-tip'); t.textContent = ''; const b = document.createElement('b'); b.textContent = '알고 계셨나요'; t.append(b, TIPS[tipAt++ % TIPS.length]!); };
function loading(on: boolean, text = '불러오는 중', done = 0) { const c = $('gh-loading'); $('gh-loadver').textContent = VERSION_NAME;
  if (!on) { c.hidden = true; clearInterval(tipT); tipT = 0; return; }
  if (c.hidden || !tipT) { c.hidden = false; showTip(); clearInterval(tipT); tipT = setInterval(showTip, 3600) as unknown as number; }
  $('gh-loadtext').textContent = text; $('gh-loadbar').style.width = `${Math.round(Math.max(0, Math.min(1, done)) * 100)}%`; }

// ---- the screens' way, with a short fade between ----
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const fade = async (swap: () => Promise<void>) => { if (settings.screen.calm) { await swap(); return; } const f = $('gh-fade'); f.classList.add('gh-on'); await wait(170); try { await swap(); } finally { f.classList.remove('gh-on'); } };
const history_ = (() => { try { return typeof history.pushState === 'function' ? { pushState: (d: unknown, u: string) => { try { history.pushState(d, u); } catch { /* sandboxed */ } }, back: () => { try { history.back(); } catch { /* sandboxed */ } } } : null; } catch { return null; } })();
const screens: Record<string, Screen<never> & { root?: HTMLElement; api?: unknown; apply?: () => void }> = {};
const router = new Router(screens, { history: history_, fade });
addEventListener('popstate', () => router.popped());

// ---- where play was left, the design to show ----
const LAST_KEY = 'gearhouse.shell.last.v1';
let preset: Design | null = null;
const ctx: ShellCtx = { router, stage, backdrop, store, settings, layer: $('gh-layer'), pages: $('gh-pages'), over: $('gh-over'), loading,
  changed() { saveSettings(store, settings); applySettings(); },
  last() { try { const o = JSON.parse(store?.getItem(LAST_KEY) ?? 'null') as Last | null; return o && ['garage', 'builder', 'drive'].includes(o.screen) ? o : null; } catch { return null; } },
  keepLast(l) { try { store?.setItem(LAST_KEY, JSON.stringify(l)); } catch { /* not kept */ } },
  recent() { return currentDesign(store) ?? savedDesigns(store)[0] ?? (preset ??= fromPreset('f355', 'F355 프리셋')); } };
/** the settings at work: the theme, the menus' sounds, the calm screen, the drive's own fields */
function applySettings() { const t = settings.screen.theme; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  setPalette(settings.screen.palette); document.documentElement.toggleAttribute('data-calm', settings.screen.calm);   // the design system's palette and its motion (docs/systems/110 G2)
  PHYSICS.kinematic = settings.sandbox.physics !== 'old';   // the developers' physics switch (race/kin.ts), for the next car made
  setLineWeight(LINE_WEIGHT[settings.graphics.lineWeight]);   // the toon look's line widths (render/live/style.ts)
  setPartStyle(styleForLook(settings.graphics.look === 'drift' ? 4 : 2));   // look 4: the engines and the suspensions built in their drift look (docs/systems/109 section 10)
  uiSounds(settings.sound.ui); setSceneryDensity(settings.graphics.scenery); backdrop.calm = settings.screen.calm || matchMedia('(prefers-reduced-motion: reduce)').matches; backdrop.redraw(); screens.drive?.apply?.(); }

const drive = driveScreen(ctx), builder = builderScreen(ctx), engine = engineScreen(ctx);
Object.assign(screens, { title: titleScreen(ctx), garage: garageScreen(ctx), pick: pickScreen(ctx), settings: settingsScreen(ctx), about: aboutScreen(ctx), kit: kitScreen(ctx), builder, drive, engine, results: resultsScreen(ctx) });
router.onChange = s => { if (s.id !== 'builder' && s.id !== 'drive' && s.id !== 'engine') document.title = s.id === 'title' ? 'GEARHOUSE' : `GEARHOUSE · ${({ garage: '차고', pick: '시험장', settings: '설정', about: '정보', kit: '디자인 견본', results: '레이스 결과' } as Record<string, string>)[s.id] ?? ''}`;
  if (s.id === 'garage') ctx.keepLast({ screen: 'garage' }); };

// ---- keys: Esc back (a dialog first, a text field let go of), the arrows through the menus; a pad's cross the same ----
const menuBox = (): ParentNode | null => dialogBox() ?? (ctx.over.querySelector('.gh-pause') as HTMLElement | null) ?? (screens[router.current?.id ?? '']?.root ?? null);
function key(k: string, target: EventTarget | null, e?: KeyboardEvent): boolean {
  if (k === 'Escape') { if (closeDialog()) return true;
    if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number') || target instanceof HTMLTextAreaElement) { target.blur(); return true; }
    if (router.current?.id === 'drive' && drive.api?.drawerOpen) return false;   // the drive's own Esc closes its drawer
    blip('back'); return router.back(); }
  const box = menuBox(); if (!box) return false;
  if (k === 'Enter' && !e) { const a = document.activeElement as HTMLElement | null; if (a && box.contains(a)) { a.click(); return true; } return false; }
  return e ? navKey(box, e) : false; }
addEventListener('keydown', e => { if (e.defaultPrevented) return; if (e.key === 'Escape' || e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') { if (key(e.key, e.target, e)) e.preventDefault(); } });
padKeys(k => { const a = document.activeElement; if (k.startsWith('Arrow')) { const box = menuBox(); if (box) { if (!box.contains(a)) (box.querySelector<HTMLElement>('button, [tabindex="0"]'))?.focus(); else navKey(box, new KeyboardEvent('keydown', { key: k })); } return; } key(k, a); });
addEventListener('resize', () => backdrop.redraw());

// ---- boot: the sky, the car textures, the fonts and the title's car, then the title ----
async function boot() { loading(true, '불러오는 중', 0.02); applySettings(); let done = 0; const steps = 4, step = (t: string) => { done++; loading(true, t, done / steps); };
  const t0 = performance.now();
  const jobs: Promise<unknown>[] = [
    (L ? loadSky(L).catch(e => console.warn('sky', e)) : Promise.resolve()).then(() => step('하늘을 불러왔습니다')),
    (async () => { if (!L) return; const im = [texAlb, texNor, texRgh].map(src => { const i = new Image(); i.src = src; return i; });
      await Promise.all(im.map(i => i.decode())); L.setTextures(im[0]!, im[1]!, im[2]!, (texMeta as { layers: { size_m: number; luma_mean: number; rough_mean: number }[] }).layers); })().catch(e => console.warn('textures', e)).then(() => step('재질 텍스처를 불러왔습니다')),
    (document.fonts?.ready ?? Promise.resolve()).catch(() => {}).then(() => step('글꼴 준비')),
    (async () => { await wait(0); backdrop.setDesign(ctx.recent()); })().catch(e => console.warn('title car', e)).then(() => step('차를 턴테이블에 올렸습니다')) ];
  await Promise.all(jobs); const left = 900 - (performance.now() - t0); if (left > 0) await wait(left);   // the cover long enough to read its tip
  await router.reset('title'); loading(false); }
void boot();
(globalThis as { __shell?: unknown }).__shell = { router, stage, backdrop, ctx, get builder() { return builder.api; }, get drive() { return drive.api; }, get engine() { return engine.api; } };   // for the page tests (tools)
