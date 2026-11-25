// The game page's shell (docs/systems/101 part 3, U1): the router's back stack and its history entry, the settings
// kept through a storage that works, holds rubbish or throws, the save carried as one file, and the version.
import { describe, it, expect } from 'vitest';
import { Router, type Screen, type HistoryLike } from '../ui/shell/router';
import { DEFAULTS, SETTINGS_KEY, loadSettings, saveSettings, asSettings, exportAll, importAll, resetAll, type ListStore } from '../ui/shell/settings';
import { ALPHA, VERSION_NAME, CHANGES } from '../core/version';

/** screens that write down what happened to them */
function screens(ids: string[], log: string[], backs: Record<string, () => boolean> = {}): Record<string, Screen<never>> {
  return Object.fromEntries(ids.map(id => [id, { enter: (p: unknown, how: string) => { log.push(`+${id}:${how}${p !== undefined ? `:${String(p)}` : ''}`); }, leave: (how: string) => { log.push(`-${id}:${how}`); }, back: backs[id] }]));
}
class FakeHistory implements HistoryLike { entries = 1; pushes = 0; backs = 0; onBack: (() => void) | null = null;
  pushState() { this.entries++; this.pushes++; } back() { this.entries--; this.backs++; queueMicrotask(() => this.onBack?.()); } }
const settle = () => new Promise(r => setTimeout(r, 0));

describe('router', () => {
  it('goes on and back along its stack, each screen entered and left once', async () => {
    const log: string[] = [], r = new Router(screens(['title', 'garage', 'builder', 'drive'], log));
    await r.reset('title'); await r.go('garage'); await r.go('builder', 'd1'); await r.go('drive');
    expect(r.stack.map(s => s.id)).toEqual(['title', 'garage', 'builder', 'drive']);
    expect(r.back()).toBe(true); await settle();
    expect(r.current?.id).toBe('builder');
    expect(log.slice(-2)).toEqual(['-drive:back', '+builder:back:d1']);   // the builder entered again with its own params, told it is a return
    r.back(); r.back(); await settle(); expect(r.stack.map(s => s.id)).toEqual(['title']);
    expect(r.back()).toBe(false);   // nothing behind the first screen: the page's own back
  });
  it('replaces, resets and goes back to a screen further down', async () => {
    const log: string[] = [], r = new Router(screens(['title', 'garage', 'builder', 'drive', 'pick'], log));
    await r.reset('title'); await r.go('pick'); await r.replace('drive'); expect(r.stack.map(s => s.id)).toEqual(['title', 'drive']);
    await r.go('builder'); await r.go('garage'); expect(r.backTo('drive')).toBe(true); await settle(); expect(r.stack.map(s => s.id)).toEqual(['title', 'drive']);
    expect(r.backTo('nowhere')).toBe(false);
    await r.reset('title'); expect(r.depth).toBe(1); expect(log.at(-1)).toBe('+title:reset');
  });
  it('lets a screen take the back press first (a pause menu)', async () => {
    let menu = false; const log: string[] = [], r = new Router(screens(['title', 'drive'], log, { drive: () => { menu = !menu; return true; } }));
    await r.reset('title'); await r.go('drive'); r.back(); await settle(); expect(menu).toBe(true); expect(r.current?.id).toBe('drive'); r.back(); expect(menu).toBe(false);
  });
  it('keeps one history entry while there is somewhere to go back to, and follows the browser back', async () => {
    const h = new FakeHistory(), log: string[] = [], r = new Router(screens(['title', 'garage', 'builder'], log), { history: h }); h.onBack = () => r.popped();
    await r.reset('title'); expect(h.pushes).toBe(0);
    await r.go('garage'); await r.go('builder'); expect(h.pushes).toBe(1); expect(h.entries).toBe(2);
    // the phone's back button: the entry spent, the router goes back and puts it again (still somewhere to go back to)
    h.entries--; r.popped(); await settle(); expect(r.current?.id).toBe('garage'); expect(h.entries).toBe(2);
    // back from the menus to the first screen: the extra entry taken away, its popstate not taken for another back
    r.back(); await settle(); await settle(); expect(r.current?.id).toBe('title'); expect(h.entries).toBe(1); expect(r.depth).toBe(1);
  });
  it('makes changes one at a time, each fade waited for', async () => {
    const order: string[] = [], r = new Router(screens(['a', 'b', 'c'], order), { fade: async swap => { order.push('fade'); await new Promise(res => setTimeout(res, 5)); await swap(); } });
    await r.reset('a'); void r.go('b'); await r.go('c');
    expect(order).toEqual(['+a:reset', 'fade', '-a:push', '+b:push', 'fade', '-b:push', '+c:push']);
  });
});

/** a storage in a map, with the Storage's length and key() */
class MapStore implements ListStore { m = new Map<string, string>(); get length() { return this.m.size; } key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
/** a storage that refuses everything (a private window, storage blocked) */
const broken: ListStore = { get length(): number { throw new Error('denied'); }, key() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

describe('settings', () => {
  it('reads the defaults from nothing, and keeps what was saved', () => {
    const st = new MapStore(); expect(loadSettings(st)).toEqual(DEFAULTS); expect(loadSettings(null)).toEqual(DEFAULTS);
    const s = structuredClone(DEFAULTS); s.graphics.look = 'toon'; s.sound.volume = 0.3; s.controls.touch = 'on'; s.screen.theme = 'dark';
    expect(saveSettings(st, s)).toBe(true); expect(loadSettings(st)).toEqual(s);
  });
  it('reads rubbish and half-right settings as the defaults where they are wrong', () => {
    const st = new MapStore(); st.setItem(SETTINGS_KEY, '{not json'); expect(loadSettings(st)).toEqual(DEFAULTS);
    st.setItem(SETTINGS_KEY, JSON.stringify({ graphics: { look: 'neon', blur: false }, sound: { volume: 7 }, screen: 'dark' }));
    const s = loadSettings(st); expect(s.graphics.look).toBe('drift'); expect(s.graphics.blur).toBe(false); expect(s.sound.volume).toBe(1); expect(s.screen).toEqual(DEFAULTS.screen);
    expect(asSettings([1, 2])).toEqual(DEFAULTS);
  });
  it('works on through a storage that throws', () => {
    expect(loadSettings(broken)).toEqual(DEFAULTS); expect(saveSettings(broken, DEFAULTS)).toBe(false);
    expect(exportAll(broken)).toBeNull(); expect(importAll(broken, JSON.stringify({ game: 'gearhouse', keys: { 'gearhouse.a': '1' } }))).toBe(0); expect(resetAll(broken)).toBe(0);
  });
  it('carries the whole save as one file and back, and clears only the game\'s keys', () => {
    const a = new MapStore(); a.setItem('gearhouse.builder.designs.v1', '[]'); a.setItem(SETTINGS_KEY, '{}'); a.setItem('other.site', 'keep');
    const file = exportAll(a, new Date(0))!; expect(JSON.parse(file).keys).toEqual({ 'gearhouse.builder.designs.v1': '[]', [SETTINGS_KEY]: '{}' });
    const b = new MapStore(); expect(importAll(b, file)).toBe(2); expect(b.getItem('gearhouse.builder.designs.v1')).toBe('[]');
    expect(importAll(b, '{"keys":{}}')).toBeNull(); expect(importAll(b, 'nonsense')).toBeNull();
    expect(importAll(b, JSON.stringify({ game: 'gearhouse', keys: { 'evil.key': 'x', 'gearhouse.n': 5 } }))).toBe(0);   // only the game's keys, only text
    expect(resetAll(a)).toBe(2); expect(a.getItem('other.site')).toBe('keep'); expect(a.length).toBe(1);
  });
});

describe('version', () => {
  it('is alpha 0.12, written once', () => {
    expect(ALPHA).toBe('0.2'); expect(VERSION_NAME).toBe('알파 0.2'); expect(CHANGES.length).toBeGreaterThan(3);
  });
});

describe('the title backdrop (docs/systems/110 G4)', () => {
  it('draws the car in the game look, the drift look by default, never PBR', async () => {
    const { LOOK_NUM, backdropOpts } = await import('../ui/shell/stage');
    expect(LOOK_NUM[DEFAULTS.graphics.look]).toBe(4);
    expect(backdropOpts(LOOK_NUM.drift!, 1).look).toBe(4); expect(backdropOpts(4, 1).outW).toBe(1);
    for (const l of ['drift', 'toon', 'baked'] as const) expect(LOOK_NUM[l]).not.toBe(2);
  });
  it('stands the stock car without plates on a piece of track, its front wheels turned, framed where the menu leaves room', async () => {
    const { titleCar, titleGround, titleView, STEER } = await import('../ui/shell/titleset');
    const d = titleCar(); expect(d.body.model?.plateF).toBe(false); expect(d.body.model?.plateR).toBe(false); expect(d.body.model?.bumperF).toBe('std');
    const g = titleGround(); expect(g.n).toBeGreaterThan(100); expect(g.n % 3).toBe(0); expect(g.trk!.every(v => v === 0)).toBe(true);   // plain colours, not the track's concrete
    expect(Math.abs(STEER.R)).toBeGreaterThan(0.3); expect(Math.abs(STEER.R)).toBeGreaterThan(Math.abs(STEER.L)); expect(Math.sign(STEER.L)).toBe(Math.sign(STEER.R));
    // the car's middle on the screen: a perspective camera from the eye (ang the heading, pitch down +)
    const onScreen = (W: number, H: number) => { const v = titleView(W, H, 0, 4260), e = v.eye!, a = v.ang, p = v.pitch * Math.PI / 180, ty = Math.tan(v.fov! * Math.PI / 360);
      const f = [Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), -Math.sin(p)], r = [Math.sin(a), -Math.cos(a), 0], u = [r[1]! * f[2]! - r[2]! * f[1]!, r[2]! * f[0]! - r[0]! * f[2]!, r[0]! * f[1]! - r[1]! * f[0]!];
      const c = [0 - e[0], 0 - e[1], 0.6 - e[2]], dot = (q: number[]) => q[0]! * c[0]! + q[1]! * c[1]! + q[2]! * c[2]!, z = dot(f);
      expect(e[2]).toBeLessThan(1.2); expect(z).toBeGreaterThan(3);   // low, in front
      return [0.5 + dot(r) / z / (ty * W / H) / 2, 0.5 - dot(u) / z / ty / 2] as [number, number]; };
    const [wx, wy] = onScreen(1280, 800); expect(wx).toBeGreaterThan(0.6); expect(wx).toBeLessThan(0.75); expect(wy).toBeGreaterThan(0.55);   // right of the menu, low
    const [px, py] = onScreen(390, 844); expect(Math.abs(px - 0.53)).toBeLessThan(0.05); expect(Math.abs(py - 0.5)).toBeLessThan(0.06);   // a phone: between the logo and the menu
  });
});
