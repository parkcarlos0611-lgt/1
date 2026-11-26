// What the device can do for the volumetric smoke (docs/systems/104 B-1, step V0), and the quality it gets: the grid
// is simulated in float textures drawn to, so without float (or half-float) render targets the smoke falls back to the
// parcels (race/smoke.ts and the renderer's SMOKE_FS), as it does for "덩어리" and for the smoke far from the grid.
export interface GpuCaps { webgl2: boolean; /** EXT_color_buffer_float */ floatRT: boolean; /** EXT_color_buffer_half_float */ halfRT: boolean; maxTex: number; /** a phone (a coarse pointer): the low tier */ coarse: boolean }
/** the setting: 끔, 덩어리, 부피 보통, 부피 높음 */
export type SmokeSetting = 'off' | 'parcels' | 'mid' | 'high';
/** what is drawn: none, the parcels, or the volume at a tier */
export type SmokeTier = 'off' | 'parcels' | 'low' | 'mid' | 'high';
export const SMOKE_SETTINGS: readonly [SmokeSetting, string][] = [['off', '끔'], ['parcels', '덩어리'], ['mid', '부피 보통'], ['high', '부피 높음']];
/** each tier's grid: cells, a cell's size (m), the pressure's sweeps, the march's steps */
export const TIERS: Record<'low' | 'mid' | 'high', { nx: number; ny: number; nz: number; h: number; iters: number; steps: number }> = {
  low: { nx: 32, ny: 32, nz: 12, h: 0.4, iters: 6, steps: 28 },
  mid: { nx: 64, ny: 64, nz: 24, h: 0.25, iters: 16, steps: 40 },
  high: { nx: 80, ny: 80, nz: 28, h: 0.22, iters: 20, steps: 56 } };
export function gpuCaps(gl: WebGL2RenderingContext | null): GpuCaps { if (!gl) return { webgl2: false, floatRT: false, halfRT: false, maxTex: 0, coarse: false };
  return { webgl2: true, floatRT: !!gl.getExtension('EXT_color_buffer_float'), halfRT: !!gl.getExtension('EXT_color_buffer_half_float'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    coarse: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches }; }
/** the tier a setting gets on a device: the volume needs WebGL2 and half-float render targets (the float extension
 *  gives them too); a phone a step lower */
export function smokeTier(s: SmokeSetting, c: GpuCaps): SmokeTier { if (s === 'off' || s === 'parcels') return s;
  if (!c.webgl2 || !(c.floatRT || c.halfRT) || c.maxTex < 2048) return 'parcels';
  return c.coarse ? (s === 'high' ? 'mid' : 'low') : s; }
