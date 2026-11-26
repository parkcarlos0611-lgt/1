// The engine and the whole powertrain round it (render/car/powertrain: the engine, the gearbox and the driveshafts, the
// exhaust out to the body's own tips, the cooling, the fuel tank, the subframes), set in the car as the spec says: the
// site is read off the car's own lines and spec (the wheels, the floor, the bay, the cabin's tunnel, the exhaust tips).
// The specification is the engine's own (render/car/enginemesh.ts ENGINES) unless the spec's options carry a design's.
// The body's warp (kit/lines.ts makeWarp) moves this part whole, with the engine: what the powertrain must meet
// elsewhere (the wheels' hubs, the tips, the nose) is found where the warp will leave it, less that move.
import type { Ctx } from '../ctx';
import type { EngineOpts, EngineSpec } from '../../enginemesh';
import { makeLines, makeWarp, type Tweak } from '../lines';
import { makeSkin } from '../skin';
import type { CarKit } from '../spec';
import type { V } from '../geom';
import { NK } from '../section';
import { addPowertrain, fromEngineSpec, type PowertrainBuilt, type Site } from '../../powertrain';

/** the car's site for a powertrain */
export function siteOf(x: Ctx, at: V, opts: EngineOpts): Site {
  const { L, k } = x, W = makeWarp(L, [k.canopy.roof.from, k.canopy.roof.to], L.tweak), E = W.engine;
  const body = (p: V): V => { const q = W.none ? p : W.body(p); return [q[0] - E[0], q[1] - E[1], q[2] - E[2]]; };
  const wheel = (w: typeof L.wheels.f) => ({ x: w.x + W.wheel[0] - E[0], y: w.y, r: w.r, w: w.w, z: w.r + W.wheel[2] - E[2] });
  const o: V = [L.mx(at[0]), L.my(at[1]), at[2]], across = (opts.dir ?? 'x').endsWith('y'), bx = opts.box;
  // the engine's room grows as the lines are stretched round it
  const grow = (c: number, n: number) => Math.max(n, L.mx(c + n / 2) - L.mx(c - n / 2)), wide = (n: number) => Math.max(n, L.my(n));
  const box = bx && (across ? { len: wide(bx.len), wid: grow(at[0], bx.wid), hgt: bx.hgt } : { len: grow(at[0] - bx.len / 2, bx.len), wid: wide(bx.wid), hgt: bx.hgt });
  const X = k.exhaust, tip = body([L.mx(X.x[0]), 0, X.z]), C = k.cabin, c0 = body([L.mx(C.x[0]), 0, C.floor]), c1 = body([L.mx(C.x[1]), 0, C.floor]);
  // the underbody's height along the car: the floor's own stations, then the tail's foot
  const tailZ = Math.max(...[...x.s.TLG, ...x.s.VG].map(r => r[NK]![2])), floor = [...x.s.SF.map(px => body([px, 0, x.s.F.chain(px, true)[NK]![2]])), body([L.length, 0, tailZ])].map(p => [p[0], p[2]] as [number, number]);
  return { length: W.length - E[0], floor, foot: L.foot, wheels: { f: wheel(L.wheels.f), r: wheel(L.wheels.r) }, engine: { at: o, dir: opts.dir ?? 'x', ...(box ? { box } : {}) },
    tips: { x: tip[0], z: tip[2], y: X.y.map(L.my), r: X.r[1] },
    ...(k.bay ? { bay: { x: [L.mx(k.bay.x[0]), L.mx(k.bay.x[1])] as [number, number], half: L.my(k.bay.y[0]), floor: k.bay.z[0] } } : {}),
    cabin: { floor: C.floor, x: [c0[0], c1[0]], tunnel: [body([L.mx(C.tunnel[0]), 0, 0])[0], L.my(C.tunnel[1]), C.tunnel[2]] } };
}

export function engine(x: Ctx, spec: EngineSpec, at: V, opts: EngineOpts): PowertrainBuilt {
  return addPowertrain(x.e.b, opts.powertrain ?? fromEngineSpec(spec), siteOf(x, at, opts), { detail: opts.detail ?? 2 }); }

/** a kit car's site without building the car (the engine designer's pedestal, the checks): its lines and skin only */
export function kitSite(k: CarKit, tweak: Tweak = {}): Site { const L = makeLines(k.lines, tweak), s = makeSkin(L, k); return siteOf({ L, k, s } as Ctx, k.engine.at, k.engine.opts); }
