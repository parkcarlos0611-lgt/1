// The builder's frames, glass sets and interior sets (docs/systems/115 §4, step F1): data only. A frame is a body lump
// with no openings ("차체 A": the 959's control cage with its sockets flushed, its bumpers blank, a plain steel wheel,
// its panel lines faint; "차체 B": the N33's, docs/systems/117 R1, the first front-engined one), stretched by a few dimensions within the frame's own ranges; the glass is picked after it as
// a set of the frame's own cells (material tags only, no new faces); the interior is picked from the frame's sets,
// its colour apart. The render side reads these (render/car/p959: the cage stretched, the cells tagged); the physics
// reads a frame's dimensions as the body's own (bodyDimsOf: race/design.ts, race/fit.ts take them as any base's).

import type { ModelBaseId } from './design';

export type FrameId = 'A959' | 'B33';
/** a frame's dimensions against its own (mm): the front overhang, the wheelbase and the rear overhang apart (the length
 *  is their sum), the width overall (the track follows it), the roof's height, the ride height (the body over its hubs) */
export interface FrameDims { overhangF: number; wheelbase: number; overhangR: number; width: number; roof: number; ride: number }
export type FrameDimKey = keyof FrameDims;
export const FRAME_DIMS: FrameDimKey[] = ['overhangF', 'wheelbase', 'overhangR', 'width', 'roof', 'ride'];
export const FRAME_DIM_NAME: Record<FrameDimKey, string> = { overhangF: '앞 오버행', wheelbase: '휠베이스', overhangR: '뒤 오버행', width: '차폭', roof: '지붕 높이', ride: '지상고' };
export const NO_FRAME_DIMS: FrameDims = { overhangF: 0, wheelbase: 0, overhangR: 0, width: 0, roof: 0, ride: 0 };

export interface FrameDef { id: FrameId; /** the card's name */ name: string; /** the model body it is cut from (core/design.ts MODEL_BASES) */ base: ModelBaseId;
  /** the card's tag: the classes it suits (a label, not a limit) */ suits: string;
  /** its own measurements (mm): what the dimensions are added to */ own: { length: number; wheelbase: number; width: number; height: number; trackF: number; trackR: number };
  /** each dimension's range (mm): as far as the stretched surface stays sound (tests/frames.test.ts measures both ends) */ ranges: Record<FrameDimKey, readonly [number, number]> }
/** 차체 A: the 959's lump. The ranges are where its surface keeps the surface rules of docs/systems/108 (no wave, no
 *  dimple, no unmarked fold) at either end, the stretch laid where its lines take it (render/car/p959/frame.ts) */
export const FRAMES: Record<FrameId, FrameDef> = {
  A959: { id: 'A959', name: '차체 A', base: 'p959', suits: '추천 S3~P3', own: { length: 4260, wheelbase: 2272, width: 1840, height: 1280, trackF: 1504, trackR: 1550 },
    ranges: { overhangF: [-80, 80], wheelbase: [-150, 150], overhangR: [-60, 80], width: [-60, 60], roof: [-40, 40], ride: [-30, 40] } },
  /** 차체 B: the N33's lump (docs/systems/117 R1), a front-engined 2+2 coupe. Its wheelbase is laid over the bonnet's
   *  back and the screen's foot (render/car/n33/frame.ts), so a longer one is a longer engine bay; the ranges are where
   *  its surface keeps the same rules (tests/frames.test.ts) */
  B33: { id: 'B33', name: '차체 B', base: 'bnr33', suits: '추천 S1~S3', own: { length: 4675, wheelbase: 2720, width: 1780, height: 1364, trackF: 1480, trackR: 1490 },
    ranges: { overhangF: [-60, 80], wheelbase: [-100, 120], overhangR: [-80, 80], width: [-40, 60], roof: [-40, 30], ride: [-30, 40] } } };
export const FRAME_IDS: FrameId[] = ['A959', 'B33'];
/** each model body's frame (a design on a body takes its frame) */
export const FRAME_OF_BASE: Record<ModelBaseId, FrameId> = { p959: 'A959', bnr33: 'B33' };
export const isFrameId = (v: unknown): v is FrameId => (FRAME_IDS as unknown[]).includes(v);

/** a frame's dimensions from anything (a file, a link): each a whole number of millimetres within the frame's range */
export function fitFrameDims(id: FrameId, d: unknown): FrameDims { const R = FRAMES[id].ranges, src = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>, out = { ...NO_FRAME_DIMS };
  for (const k of FRAME_DIMS) { const v = Number(src[k]); out[k] = Number.isFinite(v) ? Math.round(Math.max(R[k][0], Math.min(R[k][1], v))) : 0; } return out; }
export const sameDims = (a: FrameDims, b: FrameDims) => FRAME_DIMS.every(k => a[k] === b[k]);

/** the body's own dimensions (core/design.ts BodyDims: what the physics reads) a frame's stand for: the wheelbase and the
 *  overhangs as they are, the width as half of it a side, the track as the frame's widening carries the hubs out (the
 *  body is widened about its centre line, so the hubs move out by the width's share at their place), the roof, the ride */
export function bodyDimsOf(id: FrameId, d: FrameDims): { wheelbase: number; width: number; track: number; overhangF: number; overhangR: number; roof: number; ride: number } {
  const o = FRAMES[id].own, k = d.width / o.width, track = Math.round((o.trackF + o.trackR) / 2 * k);
  return { wheelbase: d.wheelbase, width: d.width / 2, track: track - d.width, overhangF: d.overhangF, overhangR: d.overhangR, roof: d.roof, ride: d.ride }; }

// ---- the glass (§4-2): sets of the frame's cells, picked after the lump; none picked: the cabin all body colour ----
export type GlassId = 'stock' | 'noQuarter' | 'louvre';
export interface GlassDef { id: GlassId; name: string; note: string }
export const GLASS: Record<GlassId, GlassDef> = {
  stock: { id: 'stock', name: '순정', note: '앞 유리, 문 유리, 쿼터 유리, 뒤 유리' },
  noQuarter: { id: 'noQuarter', name: '쿼터 유리 없음', note: '문 뒤를 차체로 막음' },
  louvre: { id: 'louvre', name: '뒤 유리 루버', note: '뒤 유리 자리에 검은 루버' } };
export const GLASS_IDS: GlassId[] = ['stock', 'noQuarter', 'louvre'];
export const isGlassId = (v: unknown): v is GlassId => (GLASS_IDS as unknown[]).includes(v);

// ---- the interior (§4-3): the frame's sets, the trim's colour apart ----
export type InteriorSetId = 'stock' | 'drift';
export type TrimId = 'black' | 'brown' | 'tan';
export interface InteriorSetDef { id: InteriorSetId; name: string; note: string; /** the old kit's interior it weighs as (race/design.ts INTERIOR_K) with the black trim */ kit: 'standard' | 'light' }
export const INTERIOR_SETS: Record<InteriorSetId, InteriorSetDef> = {
  stock: { id: 'stock', name: '순정', note: '가죽 스포츠 시트, 뒷좌석', kit: 'standard' },
  drift: { id: 'drift', name: '드리프트', note: '버킷 시트, 롤 케이지, 계기 포드', kit: 'light' } };
export const INTERIOR_SET_IDS: InteriorSetId[] = ['stock', 'drift'];
/** a frame's own sets where they are not the 959's (docs/systems/117 R2: the N33's, right-hand drive; the tuned one in the drift set's place, its weight the same) */
export const FRAME_INTERIOR: Partial<Record<FrameId, Record<InteriorSetId, { name: string; note: string }>>> = {
  B33: { stock: { name: '순정', note: '오른쪽 핸들, 계기 4개, 가운데 둥근 계기 3개(부스트·유압·수온), 4스포크 핸들' }, drift: { name: '스포츠', note: '딥디시 핸들, 버킷 시트, A필러 부스트계' } } };
export const interiorSetOf = (f: FrameId, s: InteriorSetId): { name: string; note: string } => FRAME_INTERIOR[f]?.[s] ?? INTERIOR_SETS[s];
export const TRIM_IDS: TrimId[] = ['black', 'brown', 'tan'];
export const TRIM_NAME: Record<TrimId, string> = { black: '검정', brown: '갈색', tan: '황갈색' };
export interface InteriorPick { set: InteriorSetId; trim: TrimId }
/** the old kit's interior as a set (docs/systems/115 §7: light the drift set, luxury the stock one in tan, standard the stock one in black) */
export function interiorOfKit(k: 'light' | 'standard' | 'luxury'): InteriorPick { return k === 'light' ? { set: 'drift', trim: 'black' } : k === 'luxury' ? { set: 'stock', trim: 'tan' } : { set: 'stock', trim: 'black' }; }
/** and back: what the set weighs as (the stock set in tan is the luxurious one: leather all round, air conditioning) */
export function kitOfInterior(p: InteriorPick): 'light' | 'standard' | 'luxury' { return p.set === 'drift' ? 'light' : p.trim === 'tan' ? 'luxury' : 'standard'; }
export function fitInterior(v: unknown, d: InteriorPick): InteriorPick { const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { set: (INTERIOR_SET_IDS as unknown[]).includes(o.set) ? o.set as InteriorSetId : d.set, trim: (TRIM_IDS as unknown[]).includes(o.trim) ? o.trim as TrimId : d.trim }; }
