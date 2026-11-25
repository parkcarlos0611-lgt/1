// The machinery's drift-game look (docs/systems/109 section 10; render/car/powertrain/style.ts): the powertrain and the
// suspension drawn chunky and bold by the same builders. What must hold: the realistic look is what it was and is still
// there to ask for; the drift look keeps every part's name, the engine's fit and what the checks read, the suspension's
// rig and bones; its round sections keep to each kind's least thickness; its triangles stay in budget; the bay's
// fittings and the bay drawn on its own are there; its colours and rules are data a customisation can change.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, DESIGN_EB110, applyPatch, type Design } from '../core/design';
import { designKit, designPowertrain } from '../render/car/design';
import { assemble, type Assembled } from '../render/car/kit/assemble';
import { kitSite } from '../render/car/kit/parts/engine';
import { powertrainMesh, fromDesign, setPartStyle, partStyle, styleForLook, driftStyle } from '../render/car/powertrain';
import { DRIFT_RULES, DRIFT_PALETTE, DRIFT_PAINT, PART_KIND, CALIPER_COLOURS, kindOf, minDiameter, type PartKind } from '../render/car/powertrain/style';
import { Geo } from '../render/car/powertrain/geo';
import { standModel, exploded, PART_INFO } from '../render/car/powertrain/stand';
import { Build } from '../render/car/mesh';
import { SUSPENSION, TRAVEL, addSuspension, isSuspPart, poseMesh, poseRig, boneAt, PART_BONE } from '../render/car/suspension';
import { kitWheels } from '../render/car/kit/parts/suspension';
import { makeLines } from '../render/car/kit/lines';
import { hullNormals } from '../render/car/edges';
import { STYLE_PARTS, FRONT_SITE, REAR_SITE, I6_TURBO, F6_NA, V8_NA } from '../render/car/styleparts';

const HEAVY = applyPatch(DESIGN_F355, { body: { wheelbase: 250 }, engine: { grade: 4, layout: 'V12', cc: 5000, turbo: 4, intake: 'itb' }, drive: { awd: true, gearbox: 'f1' } });
const DESIGNS: [string, Design][] = [['nsx', DESIGN_NSX], ['f355', DESIGN_F355], ['eb110', DESIGN_EB110], ['v12 four turbos awd', HEAVY], ['i6 turbo', applyPatch(DESIGN_F355, { engine: { layout: 'I6', cc: 3000, turbo: 1 } })],
  ['flat six', applyPatch(DESIGN_NSX, { engine: { layout: 'F6', cc: 3600, sump: 'dry' } })], ['v8 twin turbo variable', applyPatch(DESIGN_NSX, { engine: { layout: 'V8', cc: 4000, turbo: 2, intake: 'variable' } })]];
const pt = (d: Design, style: 'real' | 'drift', detail: 0 | 1 | 2 = 2) => { const { kit, tweak } = designKit(d); return powertrainMesh(designPowertrain(d), kitSite(kit, tweak), { detail, style }); };
/** the kinds drawn as tubes or bars: their least thickness is checked */
const TUBES: PartKind[] = ['pipe', 'exhaust', 'runner', 'header', 'hose', 'line', 'belt', 'link', 'shaft', 'arm', 'frame'];
/** the budgets in the drift look: a V8 with its bay's fittings 3,000 to 5,000 (the task's); the heaviest engine (twelve
 *  cylinders, four turbos, four intercoolers, all-wheel drive) to 6,000, over the realistic look's 4,900 by its bevels
 *  and its thick pipes' sides; the lighter details as the realistic look's (no bevels there) */
const DRIFT_BUDGET = { v8: [3000, 5000], heaviest: 6000, 1: 2800, 0: 1250 } as const;

describe('the look is chosen by a setting, the realistic one kept', () => {
  it('the default is the realistic look; the renderer\'s look 4 asks for the drift one', () => {
    expect(partStyle()).toBe('real'); expect(styleForLook(4)).toBe('drift'); for (const l of [0, 1, 2, 3]) expect(styleForLook(l)).toBe('real');
    const a = pt(DESIGN_F355, 'real').mesh; setPartStyle('drift'); try { const { kit, tweak } = designKit(DESIGN_F355), b = powertrainMesh(designPowertrain(DESIGN_F355), kitSite(kit, tweak)).mesh; expect(b.n).not.toBe(a.n); expect(b.names).toContain('fuseBox'); } finally { setPartStyle('real'); }
    const { kit, tweak } = designKit(DESIGN_F355), c = powertrainMesh(designPowertrain(DESIGN_F355), kitSite(kit, tweak)).mesh; expect(Array.from(c.pos)).toEqual(Array.from(a.pos)); expect(c.partLines).toBeUndefined();
  });
});

describe('the powertrain in the drift look', () => {
  for (const [name, d] of DESIGNS) it(`${name}: every part's name kept, the fit and the checks' numbers the realistic build's, no bad number`, () => {
    for (const det of [2, 1, 0] as const) { const R = pt(d, 'real', det), D = pt(d, 'drift', det), rn = [...R.built.parts.keys()], dn = [...D.built.parts.keys()];
      for (const n of rn) expect(dn, `${n} at detail ${det}`).toContain(n);
      expect(dn.filter(n => !rn.includes(n)).sort()).toEqual(['fuseBox', 'washerTank']);
      expect(D.built.scale).toBe(R.built.scale); expect(D.built.engine).toEqual(R.built.engine); expect(D.built.core).toEqual(R.built.core); expect(D.built.placed).toEqual(R.built.placed);
      for (let i = 0; i < D.mesh.pos.length; i++) if (!Number.isFinite(D.mesh.pos[i]!)) throw new Error('a bad number');
      for (const l of D.mesh.partLines ?? []) { expect(dn).toContain(l.part); for (const p of l.pts) for (const v of p) expect(Number.isFinite(v)).toBe(true); } }
  });
  it('each tube kind keeps its least thickness (pipes, hoses, belts, links, shafts, frames); the realistic look\'s are thinner', () => {
    let thinner = 0;
    for (const [name, d] of DESIGNS) { const R = pt(d, 'real').built.parts, D = pt(d, 'drift').built.parts;
      for (const [n, b] of D) { const k = kindOf(n); if (!TUBES.includes(k) || b.thin === undefined) continue;
        expect(b.thin, `${name}: ${n} (${k})`).toBeGreaterThanOrEqual(minDiameter(k) - 1e-6);
        const r = R.get(n)?.thin; if (r !== undefined) { expect(b.thin, `${name}: ${n}`).toBeGreaterThanOrEqual(r - 1e-6); if (r < minDiameter(k)) thinner++; } } }
    expect(thinner).toBeGreaterThan(20);
    // the charge pipes near twice as thick as true, and measured on the mesh: the water pipes down the tunnel lie along the car, so their bounds across it show their thickness
    const R = pt(DESIGN_EB110, 'real').built.parts, D = pt(DESIGN_EB110, 'drift').built.parts;
    expect(D.get('boostPipe')!.thin! / R.get('boostPipe')!.thin!).toBeGreaterThanOrEqual(1.5);
    const wide = (P: typeof D) => { const b = P.get('coolantPipe')!; return b.max[2] - b.min[2]; }; expect(wide(D)).toBeGreaterThanOrEqual(minDiameter('hose') * 0.9); expect(wide(D)).toBeGreaterThan(wide(R) * 1.3);
  });
  it('the rules themselves: a tube is drawn by its kind\'s scale and never under its least; a box\'s edges are cut; a closed shape is wound outward', () => {
    const g = new Geo(driftStyle()); g.part('boostPipe', '#c9cbcf').cyl([0, 0, 0], [200, 0, 0], 4, 6);
    g.part('intakeHose', '#232326').tube([[0, 300, 0], [200, 300, 0]], 40, 6); g.part('battery', '#1d1e21').box(0, 240, 500, 676, 0, 175);
    const P = g.measure(), pipe = P.get('boostPipe')!, hose = P.get('intakeHose')!;
    expect(pipe.thin).toBeCloseTo(minDiameter('pipe')); expect(pipe.max[2] - pipe.min[2]).toBeGreaterThan(minDiameter('pipe') * 0.9);
    expect(hose.thin).toBeCloseTo(80 * DRIFT_RULES.hose.scale); expect(P.get('battery')!.tris).toBe(44);   // six sides, twelve edges' strips, eight corners
    const b = new Build(); g.emit(b); const M = b.mesh(1000), N = hullNormals(M.pos, M.n), c = [[100, 0, 0], [100, 300, 0], [120, 588, 87.5]];
    for (let t = 0; t < M.n; t++) { const o = c[M.names![M.part[t]!] === 'boostPipe' ? 0 : M.names![M.part[t]!] === 'intakeHose' ? 1 : 2]!; for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3; const dx = M.pos[q]! - o[0]!, dy = M.pos[q + 1]! - o[1]!, dz = M.pos[q + 2]! - o[2]!;
        if (M.names![M.part[t]!] !== 'battery' && Math.abs(dx) > 99) continue;   // a tube's end: its hull normal leans along the tube
        expect(N[q]! * (M.names![M.part[t]!] === 'battery' ? dx : 0) + N[q + 1]! * dy + N[q + 2]! * dz).toBeGreaterThan(0); } }
    // the realistic collector draws what it is told
    const r = new Geo(); r.part('boostPipe', '#c9cbcf').cyl([0, 0, 0], [200, 0, 0], 4, 6).part('battery', '#1d1e21').box(0, 240, 500, 676, 0, 175); expect(r.measure().get('boostPipe')!.thin).toBe(8); expect(r.measure().get('battery')!.tris).toBe(12);
  });
  it('the triangles: a V8 with the bay\'s fittings 3,000 to 5,000, the heaviest engine within 6,000, the lighter details within the realistic budgets', () => {
    for (const d of [DESIGN_F355, applyPatch(DESIGN_NSX, { engine: { layout: 'V8', cc: 4000 } })]) { const n = pt(d, 'drift').built.tris; expect(n).toBeGreaterThanOrEqual(DRIFT_BUDGET.v8[0]); expect(n).toBeLessThanOrEqual(DRIFT_BUDGET.v8[1]); }
    for (const [, d] of DESIGNS) { expect(pt(d, 'drift').built.tris).toBeLessThanOrEqual(DRIFT_BUDGET.heaviest); for (const det of [1, 0] as const) expect(pt(d, 'drift', det).built.tris).toBeLessThanOrEqual(DRIFT_BUDGET[det]); }
  });
  it('the colours are the palette\'s by each part\'s role and can be changed; the engine\'s own colours stay', () => {
    const hex = (h: string) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
    const cols = (M: ReturnType<typeof pt>['mesh'], name: string) => { const S = new Set<string>(); for (let t = 0; t < M.n; t++) if (M.names![M.part[t]!] === name) S.add([M.col[t * 3], M.col[t * 3 + 1], M.col[t * 3 + 2]].join()); return S; };
    const d = applyPatch(DESIGN_F355, { engine: { turbo: 2 } }), { kit, tweak } = designKit(d), S = designPowertrain(d), site = kitSite(kit, tweak), D = powertrainMesh(S, site, { style: 'drift' }).mesh;
    expect(cols(D, 'boostPipe')).toEqual(new Set([hex(DRIFT_PALETTE.pipeBoost.col).join()])); expect(cols(D, 'coolantPipe')).toEqual(new Set([hex(DRIFT_PALETTE.pipeWater.col).join()]));
    expect(cols(D, 'expansionTank')).toEqual(new Set([hex(DRIFT_PALETTE.plasticWhite.col).join(), hex(DRIFT_PALETTE.capRed.col).join()])); expect(cols(D, 'camCover').has(hex(S.colours.covers).join())).toBe(true); expect(cols(D, 'engineBlock')).toEqual(new Set([hex(S.colours.block).join()]));
    const C = powertrainMesh(S, site, { style: driftStyle({ palette: { pipeBoost: { col: '#22aa44', gloss: 0.4, kind: 'plain' } } }) }).mesh; expect(cols(C, 'boostPipe')).toEqual(new Set([hex('#22aa44').join()]));
    // every role named is in the palette, every part with a kind or a role is one the builders make or the stand names
    for (const [n, roles] of Object.entries(DRIFT_PAINT)) { expect(PART_KIND[n], n).toBeDefined(); for (const r of roles) if (r) expect(DRIFT_PALETTE[r], `${n}: ${r}`).toBeDefined(); }
    for (const n of Object.keys(PART_INFO)) if (!['stand', 'crankshaft', 'conRod', 'piston', 'pistonRing', 'cylinderBore', 'camshaft', 'intakeValve', 'exhaustValve', 'sparkPlug'].includes(n)) expect(PART_KIND[n], n).toBeDefined();
  });
  it('the stand: the same parts by name in both looks, the lines moved with the engine and with the parts spread apart, the cutaway keeping only its parts\' lines', () => {
    for (const d of [V8_NA, I6_TURBO, F6_NA]) { const R = standModel(d, 2, undefined, 'real'), D = standModel(d, 2, undefined, 'drift');
      expect(new Set(D.mesh.names)).toEqual(new Set(R.mesh.names)); expect(D.min).toEqual(R.min); expect(D.max).toEqual(R.max); expect(R.mesh.partLines).toBeUndefined();
      const L = D.mesh.partLines!; expect(L.length).toBeGreaterThan(0); for (const l of L) for (const p of l.pts) { expect(p[0]).toBeGreaterThan(D.min[0] - 60); expect(p[0]).toBeLessThan(D.max[0] + 60); expect(p[2]).toBeGreaterThan(D.min[2] - 5); }
      const X = exploded(D.mesh, 1).partLines!, cam = L.findIndex(l => l.part === 'camCover'); expect(X.length).toBe(L.length); if (cam >= 0) expect(X[cam]!.pts[0]![2] - L[cam]!.pts[0]![2]).toBeCloseTo(230);
      const C = standModel(d, 2, {}, 'drift'); for (const l of C.mesh.partLines ?? []) expect(l.part).not.toBe('camCover'); expect(C.rig).toBeDefined(); }
  });
  it('a bay drawn on its own: the tub, the panel and the fittings round a front engine and a rear one; a flat engine\'s bay wider', () => {
    const bay = (d: Design, site: typeof FRONT_SITE) => powertrainMesh(fromDesign(d), site, { engineOnly: true, bay: true, style: 'drift' }).built;
    const F = bay(I6_TURBO, FRONT_SITE), V = bay(V8_NA, FRONT_SITE), R = bay(F6_NA, REAR_SITE);
    for (const B of [F, V, R]) for (const n of ['engineBlock', 'bayTub', 'radiatorPanel', 'lampBack', 'battery', 'washerTank', 'fuseBox', 'expansionTank']) expect(B.parts.has(n), n).toBe(true);
    expect(F.parts.has('radiator')).toBe(true); expect(R.parts.has('radiator')).toBe(false);   // the radiator in a front bay's panel
    // the panel at the car's end: ahead of a front engine, behind a rear one; the fittings inside the tub
    expect(F.parts.get('radiatorPanel')!.max[0]).toBeLessThan(F.engine.min[0]); expect(R.parts.get('radiatorPanel')!.min[0]).toBeGreaterThan(R.engine.max[0]);
    for (const B of [F, V, R]) { const T = B.parts.get('bayTub')!; for (const n of ['battery', 'washerTank', 'fuseBox', 'expansionTank']) { const p = B.parts.get(n)!; for (const k of [0, 1]) { expect(p.min[k]!, n).toBeGreaterThan(T.min[k]!); expect(p.max[k]!, n).toBeLessThan(T.max[k]!); } }
      expect(B.tris).toBeLessThanOrEqual(DRIFT_BUDGET.v8[1]); }
    const w = (B: typeof F) => B.engine.max[1] - B.engine.min[1], tub = (B: typeof F) => B.parts.get('bayTub')!.max[1] - B.parts.get('bayTub')!.min[1]; expect(w(R)).toBeGreaterThan(w(F)); expect(tub(R)).toBeGreaterThan(tub(F));
    // the realistic look has no bay; the style page's machinery builds in both looks
    expect(powertrainMesh(fromDesign(V8_NA), FRONT_SITE, { engineOnly: true, bay: true, style: 'real' }).built.parts.has('bayTub')).toBe(false);
    for (const c of STYLE_PARTS) { const M = c.mesh(); expect(M.n, c.id).toBeGreaterThan(300); expect(M.length).toBeGreaterThan(300); }
  });
});

describe('the suspension in the drift look', () => {
  const car = (d: Design, style: 'real' | 'drift'): Assembled => { setPartStyle(style); try { const { kit, tweak } = designKit(d, 2); return assemble(kit, { tweak }); } finally { setPartStyle('real'); } };
  const susp = (id: 'nsx' | 'f355' | 'eb110', style: 'real' | 'drift', detail: 0 | 1 | 2 = 2) => { const { kit } = designKit({ nsx: DESIGN_NSX, f355: DESIGN_F355, eb110: DESIGN_EB110 }[id]), L = makeLines(kit.lines, {}); return addSuspension(new Build(), SUSPENSION[id]!, kitWheels(kit, L.wheels), { detail, style }); };
  it('the same parts by name on the same bones, the same rig; the arms at least 1.8 times as thick, the links and the coil\'s wire thicker', () => {
    for (const id of ['nsx', 'f355', 'eb110'] as const) for (const det of [2, 1, 0] as const) { const R = susp(id, 'real', det), D = susp(id, 'drift', det);
      expect([...D.parts.keys()].sort()).toEqual([...R.parts.keys()].sort()); expect(D.rig).toEqual(R.rig); for (const n of D.parts.keys()) expect(PART_BONE[n], n).toBeDefined();
      for (const n of ['wishboneLower', 'wishboneUpper']) expect(D.parts.get(n)!.thin! / R.parts.get(n)!.thin!, `${id} ${n}`).toBeGreaterThanOrEqual(1.8);
      for (const n of ['tieRod', 'toeLink', 'dropLink', 'antiRollBar']) if (R.parts.get(n)?.thin) { expect(D.parts.get(n)!.thin!).toBeGreaterThan(R.parts.get(n)!.thin! * 1.3); expect(D.parts.get(n)!.thin!).toBeGreaterThanOrEqual(minDiameter('link') - 1e-6); }
      if (det === 2) { expect(D.parts.get('spring')!.thin!).toBeGreaterThanOrEqual(minDiameter('spring') * 0.8); expect(D.tris).toBeLessThanOrEqual(R.tris * 1.25); }
      // a bigger caliper, still a block on the disc's edge
      const size = (P: typeof R.parts, n: string) => { const b = P.get(n)!; return (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]); }; expect(size(D.parts, 'caliper')).toBeGreaterThan(size(R.parts, 'caliper') * (det === 2 ? 1.15 : 1.3)); }
  });
  it('in the car: every triangle on the bone its part had, the rig poses it, the wheels still four; the parts stay inside the wheel through the travel', () => {
    for (const d of [DESIGN_NSX, DESIGN_F355, DESIGN_EB110]) { const R = car(d, 'real'), D = car(d, 'drift'), M0 = D.mesh, rig = M0.susp!, N = M0.names!, su = D.panels.indexOf('suspension');
      expect({ ...rig, chassis: [] }).toEqual({ ...R.mesh.susp!, chassis: [] }); expect(rig.chassis).toEqual(expect.arrayContaining(R.mesh.susp!.chassis!)); const names = (A: Assembled) => new Set(A.mesh.names!.filter(isSuspPart)); expect(names(D)).toEqual(names(R));
      for (const tr of [-TRAVEL.droop, 0, TRAVEL.bump]) { const P = poseRig(rig, [tr, tr, tr, tr], 0, 0), M = poseMesh(M0, P);
        for (let t = 0; t < M.n; t++) { if (D.panelOf[t] !== su) continue; const nm = N[M.part[t]!]!, q0 = t * 9; expect(boneAt(rig, nm, (M0.pos[q0]! + M0.pos[q0 + 3]! + M0.pos[q0 + 6]!) / 3, (M0.pos[q0 + 1]! + M0.pos[q0 + 4]! + M0.pos[q0 + 7]!) / 3)).toBeGreaterThanOrEqual(0);
          for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3, x = M.pos[q]!, y = M.pos[q + 1]!, z = M.pos[q + 2]!, c = (x < rig.midX ? 0 : 2) + (y > 0 ? 0 : 1), H = rig.corners[c]!, w = H.wheel, wc = P.wheels[c]!.wc, tag = `${d.id} ${nm} at travel ${tr}`;
            expect(Number.isFinite(x + y + z)).toBe(true); expect(Math.abs(y), tag).toBeLessThan(w.y + w.w / 2); expect(z, tag).toBeGreaterThan(wc[2] - w.r + 20); if (tr === 0) expect(z, tag).toBeGreaterThan(80);
            if (Math.abs(y) > w.y - w.w / 2) expect(Math.hypot(x - wc[0], z - wc[2]), tag).toBeLessThan(nm === 'brakeDisc' || nm === 'caliper' ? w.rim - 8 : w.rim - 2); } } } }
  });
  it('the caliper\'s colour is a palette entry a player can choose', () => {
    expect(CALIPER_COLOURS).toContain(DRIFT_PALETTE.caliper.col); const { kit } = designKit(DESIGN_NSX), L = makeLines(kit.lines, {}), b = new Build();
    addSuspension(b, SUSPENSION.nsx!, kitWheels(kit, L.wheels), { style: driftStyle({ palette: { caliper: { col: CALIPER_COLOURS[4], gloss: 0.5, kind: 'paint' } } }) }); const M = b.mesh(4400);
    let n = 0; for (let t = 0; t < M.n; t++) if (M.names![M.part[t]!] === 'caliper' && M.col[t * 3] === 0x24 && M.col[t * 3 + 1] === 0x56 && M.col[t * 3 + 2] === 0xc8) n++; expect(n).toBeGreaterThan(40);
  });
});
