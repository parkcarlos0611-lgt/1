// The parts builder's designs kept and carried (docs/systems/98_alpha_interface_and_builder_plan.md, B3 and B4): a
// design written into a link (the test drive opens the drive page with it) and read back, checked against the format
// (format 1's designs brought to format 2);
// the designs saved in this browser; and what the drive page measured of a design (its best laps, the top speed it
// reached), kept per design and read by the builder. Pure: the storage is passed in (the browser's localStorage, or a
// map in the tests), and a storage that throws (a private window, storage refused) keeps nothing and reads empty.
import { BODY_BASES, NOSES, FRONTS, FACE_KEYS, FACE_KINDS, faceOf3, TAILS, WHEELS, GRADES, INTAKES, COMPRESSIONS, SUMPS, BLOCKS, STRUCTURES, PANELS, INTERIORS, DESIGN_NSX, DESIGN_F355, DESIGN_EB110, DESIGN_P959, DIMS, PLATE_SYLLABLES, isModelBase, fitModel, LAYOUTS, QUALITY_PARTS, BS_DEFAULT, normalise,
  SUSP_OWN, SUSP_KINDS, RC_PRESETS, type BodyBase, type BodyDims, type Design, type DesignV1, type EngineQuality, type Face, type FrontKind, type SuspAxle } from './design';
import { isTierId } from '../race/tiers';

/** what the helpers need of a storage (the browser's Storage has these) */
export interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export const KEYS = { designs: 'gearhouse.builder.designs.v1', current: 'gearhouse.builder.current.v1', testDrive: 'gearhouse.builder.testdrive.v1',
  /** one key a design: what the drive page measured of it */ measure: (id: string) => `gearhouse.design.measure.v1.${id}` } as const;

const read = (s: KeyStore | null, k: string): string | null => { try { return s ? s.getItem(k) : null; } catch { return null; } };
const write = (s: KeyStore | null, k: string, v: string | null): boolean => { try { if (!s) return false; if (v === null) s.removeItem(k); else s.setItem(k, v); return true; } catch { return false; } };

// ---- a design checked: a loaded file, a pasted text or a link may be anything ----
const PRESET: Record<BodyBase, Design> = { nsx: DESIGN_NSX, f355: DESIGN_F355, eb110: DESIGN_EB110, p959: DESIGN_P959 };
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
const one = <T>(v: unknown, of: readonly T[], d: T): T => of.includes(v as T) ? v as T : d;
const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
/** any value made into a design: the fields it has kept where they are of the format, the rest from its base's own car
 *  (the NSX's or the F355's), then brought inside the limits and its engine's grade; null when it is not a design at
 *  all (no body or base). A format-2 design (no dimensions past the wheelbase and the width) takes its base's own. A format-1 design (one body material, a turbo count without a boost, no grade: saved before
 *  review 177, or in an old link) is read as format 1 and brought to format 2 (core/design.ts migrate) */
export function asDesign(v: unknown): Design | null {
  const o = obj(v), b = obj(o.body); if (!o.body || !BODY_BASES.includes(b.base as BodyBase)) return null;
  const P = PRESET[b.base as BodyBase], e = obj(o.engine), r = obj(o.drive), k = obj(o.kit), ty = Array.isArray(k.tyres) ? k.tyres : [];
  const paint = typeof b.paint === 'string' && /^#[0-9a-f]{6}$/i.test(b.paint) ? b.paint.toLowerCase() : P.body.paint;
  const old = o.v === 1 || (o.v === undefined && 'material' in b);
  const head = { id: typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : newId(), name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : P.name };
  const dims = Object.fromEntries(DIMS.map(k => [k, Math.round(num(b[k], 0) * 10) / 10])) as unknown as BodyDims;
  const body = { base: P.body.base, nose: one(b.nose, NOSES, P.body.nose), tail: one(b.tail, TAILS, P.body.tail), wheel: one(b.wheel, WHEELS, P.body.wheel),
    ...dims, paint, gloss: num(b.gloss, P.body.gloss), ...(isModelBase(P.body.base) ? { model: fitModel(P.body.base, obj(b.model)) } : {}) };
  // the face: its slots where the value has them; a format-3 value's (and older) from its front, the rest its base's own
  const front: FrontKind = one(b.front, FRONTS, P.body.aux === 'round' ? 'sunk' : 'plain'), f0: Face = FRONTS.includes(b.front as FrontKind) ? faceOf3(P.body.base, front) : P.body;
  const face = Object.fromEntries(FACE_KEYS.map(k => [k, one(b[k], FACE_KINDS[k] as readonly string[], f0[k])])) as unknown as Face;
  const machine = { layout: one(e.layout, LAYOUTS, P.engine.layout), cc: Math.round(num(e.cc, P.engine.cc)), valves: one(e.valves, [2, 3, 4, 5] as const, P.engine.valves),
    redline: Math.round(num(e.redline, P.engine.redline)), vtec: bool(e.vtec, P.engine.vtec) };
  const rest = { drive: { gears: one(r.gears, [5, 6] as const, P.drive.gears), gearbox: one(r.gearbox, ['manual', 'f1'] as const, P.drive.gearbox), final: num(r.final, P.drive.final), lsd: bool(r.lsd, P.drive.lsd), awd: bool(r.awd, P.drive.awd) },
    kit: { abs: bool(k.abs, P.kit.abs), tcs: bool(k.tcs, P.kit.tcs), steering: one(k.steering, ['manual', 'hydraulic', 'electric'] as const, P.kit.steering), dampers: one(k.dampers, ['fixed', 'adaptive'] as const, P.kit.dampers),
      wing: bool(k.wing, P.kit.wing), diffuser: bool(k.diffuser, P.kit.diffuser), tyres: [Math.round(num(ty[0], P.kit.tyres[0])), Math.round(num(ty[1], P.kit.tyres[1]))] as [number, number], rim: one(k.rim, [16, 17, 18] as const, P.kit.rim) } };
  const interior = one(k.interior, INTERIORS, P.kit.interior);
  if (old) { const mat = one(b.material, ['steel', 'aluminium'] as const, P.body.structure === 'steel' ? 'steel' : 'aluminium');
    return normalise({ v: 1, ...head, body: { ...body, front, material: mat }, engine: { ...machine, layout: one(machine.layout, ['V6', 'V8', 'V12'] as const, 'V6'), turbo: one(e.turbo, [0, 1, 2] as const, 0) }, ...rest } satisfies DesignV1); }
  // format 4's engine fields (a format-3 file has neither: the old bore/stroke, every quality 0)
  const q = obj(e.quality), quality = Object.fromEntries(QUALITY_PARTS.map(k => [k, Math.round(num(q[k], 0))])) as EngineQuality;
  // format 5's suspension (an older file has none: its base's own, SUSP_OWN)
  const su = obj(o.susp), own = SUSP_OWN[P.body.base], axle = <A extends SuspAxle>(v: unknown, d: A): A => { const a = obj(v);
    return { ...d, type: one(a.type, SUSP_KINDS, d.type), rc: one(a.rc, RC_PRESETS, d.rc), arm: num(a.arm, d.arm), hz: num(a.hz, d.hz), bump: num(a.bump, d.bump), rebound: num(a.rebound, d.rebound), bar: num(a.bar, d.bar),
      camber: num(a.camber, d.camber), toe: num(a.toe, d.toe), ...('caster' in d ? { caster: num(a.caster, (d as { caster: number }).caster) } : {}) }; };
  const susp = { front: axle(su.front, own.front), rear: axle(su.rear, own.rear) };
  // format 6's class: the chosen rung where the value has one (an older format's has none: its figures place it), and a
  // new design's mark that it has not been chosen yet
  const cls = { ...(isTierId(o.tier) ? { tier: o.tier } : {}), ...(o.fresh === true && !isTierId(o.tier) ? { fresh: true as const } : {}) };
  const d: Design = { v: 6, ...head, ...cls, body: { ...body, ...face, structure: one(b.structure, STRUCTURES, P.body.structure), panels: one(b.panels, PANELS, P.body.panels) },
    engine: { grade: one(e.grade, GRADES, P.engine.grade), ...machine, intake: one(e.intake, INTAKES, P.engine.intake), compression: one(e.compression, COMPRESSIONS, P.engine.compression),
      sump: one(e.sump, SUMPS, P.engine.sump), block: one(e.block, BLOCKS, P.engine.block), turbo: one(e.turbo, [0, 1, 2, 3, 4] as const, P.engine.turbo),
      boost: num(e.boost, P.engine.boost), intercooler: bool(e.intercooler, P.engine.intercooler), ...(bool(e.sequential, false) ? { sequential: true } : {}),
      bs: num(e.bs, BS_DEFAULT), quality }, drive: rest.drive, kit: { ...rest.kit, interior }, susp };
  return normalise(d); }

/** a new design's id: short, unlikely to meet another in one browser */
export function newId(): string { return 'd' + Date.now().toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0'); }
/** a new design from a base's own car: a fresh id, its name; its class not chosen yet (format 6's `fresh`: the builder
 *  opens on the class pick) */
export function fromPreset(base: BodyBase, name?: string): Design { const P = structuredClone(PRESET[base]); if (P.body.model) P.body.model.plate = randomPlate();
  return { ...P, id: newId(), name: name ?? `${P.name} 개조`, fresh: true }; }
/** a made-up plate number for a new car (two digits, a syllable the plate's font draws, four digits; never a real one on purpose) */
export function randomPlate(rnd: () => number = Math.random): string { const d = () => String(Math.floor(rnd() * 10)), sy = [...PLATE_SYLLABLES];
  return `${d()}${d()}${sy[Math.floor(rnd() * sy.length)]!} ${1 + Math.floor(rnd() * 9)}${d()}${d()}${d()}`; }
/** the parts that make the car (not its id or name): two designs with the same signature drive alike */
export const designSig = (d: Design): string => JSON.stringify([d.body, d.engine, d.drive, d.kit, d.susp]);

// ---- a design in a link: JSON as base64url (UTF-8, the names may be Korean) ----
export function encodeDesign(d: Design): string {
  const bytes = new TextEncoder().encode(JSON.stringify(d)); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decodeDesign(s: string): Design | null {
  try { const b64 = s.replace(/-/g, '+').replace(/_/g, '/'), bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    return asDesign(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))))); } catch { return null; } }
/** a design as a file's text, and back (null when it is not one) */
export const designJson = (d: Design): string => JSON.stringify(d, null, 2);
export function parseDesign(text: string): Design | null { try { return asDesign(JSON.parse(text)); } catch { return null; } }

// ---- the designs saved in this browser ----
/** every saved design, the last saved first */
export function savedDesigns(s: KeyStore | null): Design[] {
  let all: unknown; try { all = JSON.parse(read(s, KEYS.designs) ?? '[]'); } catch { return []; }
  return Array.isArray(all) ? all.map(asDesign).filter((d): d is Design => !!d) : []; }
/** a design saved (replacing one of its id); false when the storage keeps nothing */
export function saveDesign(s: KeyStore | null, d: Design): boolean { const rest = savedDesigns(s).filter(x => x.id !== d.id); return write(s, KEYS.designs, JSON.stringify([d, ...rest].slice(0, 100))); }
export function deleteDesign(s: KeyStore | null, id: string): boolean { return write(s, KEYS.designs, JSON.stringify(savedDesigns(s).filter(x => x.id !== id))); }
/** the design on the bench (kept as it is edited, so a reload finds it) */
export function currentDesign(s: KeyStore | null): Design | null { const t = read(s, KEYS.current); return t ? parseDesign(t) : null; }
export function keepCurrent(s: KeyStore | null, d: Design): boolean { return write(s, KEYS.current, JSON.stringify(d)); }

// ---- what the drive page measured ----
/** a design's measurements: the top speed reached (km/h), its best lap at each track (s, with the track's name), for
 *  the design as it was (its signature: a design changed since is measured afresh) */
export interface Measured { sig: string; topKmh: number; laps: Record<string, { t: number; track: string }>; at: number }
export function measured(s: KeyStore | null, id: string): Measured | null {
  try { const m = JSON.parse(read(s, KEYS.measure(id)) ?? 'null'); return m && typeof m.sig === 'string' && typeof m.topKmh === 'number' && m.laps && typeof m.laps === 'object' ? m as Measured : null; } catch { return null; } }
/** a run's figures kept: the better of these and what was kept (a record for another version of the design is replaced) */
export function recordRun(s: KeyStore | null, d: Design, run: { topKmh?: number; lap?: { trackId: string; track: string; t: number } }, now = Date.now()): Measured {
  const sig = designSig(d), had = measured(s, d.id), m: Measured = had && had.sig === sig ? { ...had, laps: { ...had.laps } } : { sig, topKmh: 0, laps: {}, at: now };
  if (run.topKmh && run.topKmh > m.topKmh) m.topKmh = Math.round(run.topKmh);
  if (run.lap && run.lap.t > 0) { const L = m.laps[run.lap.trackId]; if (!L || run.lap.t < L.t) m.laps[run.lap.trackId] = { t: +run.lap.t.toFixed(3), track: run.lap.track }; }
  m.at = now; write(s, KEYS.measure(d.id), JSON.stringify(m)); return m; }
