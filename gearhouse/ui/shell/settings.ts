// The game's own settings (docs/systems/101 part 4, 설정 통합): the ones that hold for the whole game, gathered from the
// drive page's drawer (its graphics, its sound, the controls) with the screen's (the theme, motion) and kept in this
// browser. Pure: the storage is passed in, and one that throws or holds rubbish reads as the defaults. Also the save as
// a whole: every key of the game's carried out as one file, read back, or cleared.
import { CAM_DEFAULT, isCamView, type CamView } from '../drivecam';
import type { SmokeSetting } from '../../render/live/volume/caps';

/** what the helpers need of a storage (the browser's Storage has these) */
export interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface ListStore extends KeyStore { readonly length: number; key(i: number): string | null }

/** 'drift': the drift-game style (the live renderer's look 4, docs/systems/109 S1): outlines, drawn lines, two bands; the engines and the suspensions in their drift look too */
export type Look = 'pbr' | 'stepped' | 'baked' | 'toon' | 'drift';
/** the looks the game offers for now: the PBR looks are switched off (2026-11-25, the user's call) while the game goes the drift-game way;
 *  their code stays, and a saved 'pbr' or 'stepped' reads as the default. Put them back in this list to offer them again. */
export const LOOKS_ON = ['drift', 'toon', 'baked'] as const;
export type GlassRefl = 'off' | 'weak' | 'mid';
/** the toon glass's reflection as the renderer takes it (its `glassRefl`) */
export const GLASS_REFL: Record<GlassRefl, number> = { off: 0, weak: 0.5, mid: 1 };
export type LineWeight = 'thin' | 'normal' | 'bold' | 'heavy';
/** the scale each line weight puts on the style's line widths */
export const LINE_WEIGHT: Record<LineWeight, number> = { thin: 0.75, normal: 1, bold: 1.25, heavy: 1.5 };
export interface Settings {
  graphics: { /** the live renderer (WebGL2) where the browser has it */ live: boolean; look: Look; photoGround: boolean; hdri: boolean; blur: boolean; /** 풍경 밀도: how many trees the woods have (review 181) */ scenery: 'low' | 'mid' | 'high';
    /** 유리 반사: the toon look's glass mirroring its drawn sky (docs/systems/104 A) */ glassRefl: GlassRefl;
    /** 연기 품질 (docs/systems/104 B, V0): none, the parcels (덩어리), the volume (보통, 높음); the volume falls back to the parcels where the device has no float render targets */ smoke: SmokeSetting;
    /** 연기 크기 (docs/systems/103): the puffs at their full cartoon size (크게) or about half (보통) */ smokeSize: 'normal' | 'big';
    /** 선 굵기: the drift-game style's lines (the outline, the character lines, the panel lines) scaled together (docs/systems/109 §5) */ lineWeight: LineWeight };
  sound: { /** the engine and the place in the drive */ on: boolean; volume: number; /** the menus' short sounds */ ui: boolean };
  controls: { /** the drive's screen buttons: by the screen's kind (a touch screen shows them), always, never */ touch: 'auto' | 'on' | 'off'; auto: boolean; tcs: boolean; assist: boolean; progressive: boolean;
    /** the ignition (docs/systems/110 G1): 직접 시동 (held start control, the default) or 자동 시동 (running at once, as before); stalling a manual box (off: it never stalls) */ ignition: 'direct' | 'auto'; stall: boolean };
  screen: { theme: 'auto' | 'light' | 'dark'; /** fewer moving things (the fades, the turntable) */ calm: boolean };
  /** the sandbox's rules (alpha 0.12): the technologies held to their years (docs/systems/101 1-2 ⑦; off, and in 0.12
   *  only shown as the engine designer's year tags) */
  sandbox: { eraLimit: boolean; /** alpha 0.13 (M4): the developers' physics switch: the kinematic suspension (race/kin.ts) or the rules before it */ physics: 'kinematic' | 'old' };
  /** the drive's camera (alpha 0.12, ui/drivecam.ts): the view last chosen, by the C key, its button or the pause menu */
  camera: { view: CamView };
}
export const SETTINGS_KEY = 'gearhouse.settings.v1';
export const DEFAULTS: Settings = {
  graphics: { live: true, look: 'drift', photoGround: true, hdri: true, blur: true, scenery: 'mid', glassRefl: 'mid', smoke: 'mid', smokeSize: 'big', lineWeight: 'normal' },
  sound: { on: false, volume: 0.7, ui: false },
  controls: { touch: 'auto', auto: true, tcs: true, assist: false, progressive: false, ignition: 'direct', stall: true },
  screen: { theme: 'auto', calm: false },
  sandbox: { eraLimit: false, physics: 'kinematic' },
  camera: { view: CAM_DEFAULT },
};

const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
const one = <T>(v: unknown, of: readonly T[], d: T): T => of.includes(v as T) ? v as T : d;
const unit = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
/** any value made into settings: the fields it has right, the rest the defaults */
export function asSettings(v: unknown): Settings { const o = obj(v), g = obj(o.graphics), s = obj(o.sound), c = obj(o.controls), sc = obj(o.screen), sb = obj(o.sandbox), cm = obj(o.camera), D = DEFAULTS;
  return {
    graphics: { live: bool(g.live, D.graphics.live), look: one(g.look, LOOKS_ON, D.graphics.look), photoGround: bool(g.photoGround, D.graphics.photoGround), hdri: bool(g.hdri, D.graphics.hdri), blur: bool(g.blur, D.graphics.blur), scenery: one(g.scenery, ['low', 'mid', 'high'] as const, D.graphics.scenery), glassRefl: one(g.glassRefl, ['off', 'weak', 'mid'] as const, D.graphics.glassRefl), smoke: one(g.smoke, ['off', 'parcels', 'mid', 'high'] as const, D.graphics.smoke), smokeSize: one(g.smokeSize, ['normal', 'big'] as const, D.graphics.smokeSize), lineWeight: one(g.lineWeight, ['thin', 'normal', 'bold', 'heavy'] as const, D.graphics.lineWeight) },
    sound: { on: bool(s.on, D.sound.on), volume: unit(s.volume, D.sound.volume), ui: bool(s.ui, D.sound.ui) },
    controls: { touch: one(c.touch, ['auto', 'on', 'off'] as const, D.controls.touch), auto: bool(c.auto, D.controls.auto), tcs: bool(c.tcs, D.controls.tcs), assist: bool(c.assist, D.controls.assist), progressive: bool(c.progressive, D.controls.progressive),
      ignition: one(c.ignition, ['direct', 'auto'] as const, D.controls.ignition), stall: bool(c.stall, D.controls.stall) },
    screen: { theme: one(sc.theme, ['auto', 'light', 'dark'] as const, D.screen.theme), calm: bool(sc.calm, D.screen.calm) },
    sandbox: { eraLimit: bool(sb.eraLimit, D.sandbox.eraLimit), physics: one(sb.physics, ['kinematic', 'old'] as const, D.sandbox.physics) }, camera: { view: isCamView(cm.view) ? cm.view : D.camera.view } }; }
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
