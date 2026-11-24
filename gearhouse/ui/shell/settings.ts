// The game's own settings (docs/systems/101 part 4, 설정 통합): the ones that hold for the whole game, gathered from the
// drive page's drawer (its graphics, its sound, the controls) with the screen's (the theme, motion) and kept in this
// browser. Pure: the storage is passed in, and one that throws or holds rubbish reads as the defaults. Also the save as
// a whole: every key of the game's carried out as one file, read back, or cleared.

/** what the helpers need of a storage (the browser's Storage has these) */
export interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface ListStore extends KeyStore { readonly length: number; key(i: number): string | null }

export type Look = 'pbr' | 'stepped' | 'baked' | 'toon';
export interface Settings {
  graphics: { /** the live renderer (WebGL2) where the browser has it */ live: boolean; look: Look; photoGround: boolean; hdri: boolean; blur: boolean };
  sound: { /** the engine and the place in the drive */ on: boolean; volume: number; /** the menus' short sounds */ ui: boolean };
  controls: { /** the drive's screen buttons: by the screen's kind (a touch screen shows them), always, never */ touch: 'auto' | 'on' | 'off'; auto: boolean; tcs: boolean; assist: boolean; progressive: boolean };
  screen: { theme: 'auto' | 'light' | 'dark'; /** fewer moving things (the fades, the turntable) */ calm: boolean };
}
export const SETTINGS_KEY = 'gearhouse.settings.v1';
export const DEFAULTS: Settings = {
  graphics: { live: true, look: 'pbr', photoGround: true, hdri: true, blur: true },
  sound: { on: false, volume: 0.7, ui: false },
  controls: { touch: 'auto', auto: true, tcs: true, assist: false, progressive: false },
  screen: { theme: 'auto', calm: false },
};

const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
const one = <T>(v: unknown, of: readonly T[], d: T): T => of.includes(v as T) ? v as T : d;
const unit = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
/** any value made into settings: the fields it has right, the rest the defaults */
export function asSettings(v: unknown): Settings { const o = obj(v), g = obj(o.graphics), s = obj(o.sound), c = obj(o.controls), sc = obj(o.screen), D = DEFAULTS;
  return {
    graphics: { live: bool(g.live, D.graphics.live), look: one(g.look, ['pbr', 'stepped', 'baked', 'toon'] as const, D.graphics.look), photoGround: bool(g.photoGround, D.graphics.photoGround), hdri: bool(g.hdri, D.graphics.hdri), blur: bool(g.blur, D.graphics.blur) },
    sound: { on: bool(s.on, D.sound.on), volume: unit(s.volume, D.sound.volume), ui: bool(s.ui, D.sound.ui) },
    controls: { touch: one(c.touch, ['auto', 'on', 'off'] as const, D.controls.touch), auto: bool(c.auto, D.controls.auto), tcs: bool(c.tcs, D.controls.tcs), assist: bool(c.assist, D.controls.assist), progressive: bool(c.progressive, D.controls.progressive) },
    screen: { theme: one(sc.theme, ['auto', 'light', 'dark'] as const, D.screen.theme), calm: bool(sc.calm, D.screen.calm) } }; }
export function loadSettings(st: KeyStore | null): Settings { try { const t = st?.getItem(SETTINGS_KEY); return asSettings(t ? JSON.parse(t) : null); } catch { return asSettings(null); } }
/** kept; false when the storage keeps nothing */
export function saveSettings(st: KeyStore | null, s: Settings): boolean { try { if (!st) return false; st.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch { return false; } }

// ---- the save as a whole: every key of the game's (they all start 'gearhouse.') ----
export const SAVE_PREFIX = 'gearhouse.';
const keysOf = (st: ListStore): string[] => { const ks: string[] = []; for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k?.startsWith(SAVE_PREFIX)) ks.push(k); } return ks; };
/** the whole save as one file's text (null when the storage cannot be read) */
export function exportAll(st: ListStore | null, now = new Date()): string | null { try { if (!st) return null; const keys: Record<string, string> = {};
  for (const k of keysOf(st).sort()) { const v = st.getItem(k); if (v !== null) keys[k] = v; } return JSON.stringify({ game: 'gearhouse', saved: now.toISOString(), keys }, null, 1); } catch { return null; } }
/** a save file read back over what is kept (its keys written; others left): how many keys, or null when it is not a save */
export function importAll(st: KeyStore | null, text: string): number | null { let o: Record<string, unknown>; try { o = obj(JSON.parse(text)); } catch { return null; }
  if (o.game !== 'gearhouse') return null; const keys = Object.entries(obj(o.keys)).filter(([k, v]) => k.startsWith(SAVE_PREFIX) && typeof v === 'string') as [string, string][];
  let n = 0; for (const [k, v] of keys) { try { st?.setItem(k, v); n++; } catch { /* storage full or refused: the rest tried */ } } return n; }
/** everything of the game's cleared: how many keys went */
export function resetAll(st: ListStore | null): number { try { if (!st) return 0; const ks = keysOf(st); for (const k of ks) st.removeItem(k); return ks.length; } catch { return 0; } }
