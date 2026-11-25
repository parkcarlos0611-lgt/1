// The Porsche 959 in the drift-game style (docs/systems/109, step S2): the shell made from the hand-placed cage by one
// subdivision stays in its triangle budget, is one closed surface, carries its sockets, boundary loops and drawn
// lines, and keeps the surface rules of docs/systems/108 (section 4.2): flat panels flat, no change of curvature sign
// along a panel's lines but the declared ones, no short dimples, no unmarked hard folds, the game's shading within
// 3 degrees of the surface's own on 99 % of the painted corners. The measured values are printed.
import { describe, expect, it } from 'vitest';
import { KINDS, wheelsOf } from '../render/car/mesh';
import { surfaceNormals } from '../render/car/edges';
import { p959Model, sockets, DIM } from '../render/car/p959';
import { measure, shadingError } from '../render/car/p959/check';
import { edgeUse } from '../render/car/p959/shell';
import { ekey } from '../render/car/p959/subdiv';

const { mesh: M, shell: S, normals, shellTris } = p959Model();
const tris = (pick: (k: number) => boolean) => S.F.reduce((n, f, k) => n + (pick(k) ? f.length - 2 : 0), 0);
const near = (a: number[], b: number[]) => Math.abs(a[0]! - b[0]!) < 1e-6 && Math.abs(Math.abs(a[1]!) - Math.abs(b[1]!)) < 1e-6 && Math.abs(a[2]! - b[2]!) < 1e-6;

describe('p959: the shell', () => {
  it('stays in the budget: the body shell 5,000 - 6,000 triangles', () => { const shell = tris(k => S.tag[k]!.region === 'shell'), tail = tris(k => S.tag[k]!.region === 'tail'), bf = tris(k => S.tag[k]!.region === 'bumperF'), br = tris(k => S.tag[k]!.region === 'bumperR');
    console.log(`p959 triangles: body shell ${shell} (paint ${tris(k => S.tag[k]!.region === 'shell' && S.tag[k]!.mat === 'paint')}, glass ${tris(k => S.tag[k]!.mat === 'glass')}, wells and floor ${tris(k => /wheelWell|floor/.test(S.tag[k]!.panel))}); modules in place: wing ${tail}, front bumper ${bf}, rear bumper ${br}; cage ${S.cage.F.length} faces; the mesh with wheels, mirrors, exhausts ${M.n}`);
    expect(shell).toBeGreaterThanOrEqual(5000); expect(shell).toBeLessThanOrEqual(6000); expect(tail).toBeLessThanOrEqual(900); expect(bf).toBeLessThanOrEqual(800); expect(br).toBeLessThanOrEqual(800);
    expect(M.length).toBe(DIM.length); expect(Array.from(M.pos).every(Number.isFinite)).toBe(true); });
  it('is one closed surface: every edge has two faces', () => { const use = [...edgeUse(S.F).values()]; expect(use.filter(u => u === 1).length).toBe(0); expect(use.filter(u => u > 2).length).toBe(0); });
  it('the shell without its bumpers is open only along their boundary loops', () => { const body = S.F.filter((_, k) => !/^bumper/.test(S.tag[k]!.region)), loop = [...S.loops.frontBumper!, ...S.loops.rearBumper!, ...S.loops.frontBumperFoot!, ...S.loops.rearBumperFoot!, ...S.loops.frontBumperArch!, ...S.loops.rearBumperArch!]; let open = 0, off = 0;
    for (const [key, n] of edgeUse(body)) { if (n !== 1) continue; open++; const [a, b] = key.split('|').map(Number) as [number, number]; if (![a, b].every(v => loop.some(p => near(S.P[v]!, p)) || S.tag.some((t, k) => t.panel === 'floor' && S.F[k]!.includes(v)))) off++; }
    expect(open).toBeGreaterThan(40); expect(off).toBe(0); });
  it('has its sockets and boundary loops', () => { const K = sockets(); expect(K.hubs.length).toBe(4); expect(K.mirrors.length).toBe(2); expect(K.exhausts.length).toBe(2); expect(K.hubs[1]!.o[0] - K.hubs[0]!.o[0]).toBe(DIM.wheelbase);
    for (const n of ['frontBumper', 'rearBumper', 'headLamp', 'tailLamp', 'sideIntake', 'wing']) expect(S.loops[n]!.length, n).toBeGreaterThan(6);
    for (const s of ['headLamp', 'tailLamp', 'sideIntake']) expect(S.tag.filter(t => t.socket === s).length, s).toBeGreaterThan(0);
    for (const m of K.marks) expect(m.w * m.h).toBeGreaterThan(0); expect(K.marks.map(m => m.name)).toEqual(expect.arrayContaining(['porscheLettering', 'badge', 'plateR', 'sideMarkerL', 'fogLampL'])); });
  it('has its drawn lines, on the surface, and its creases', () => { const L = M.lines!, kinds = new Set(L.map(l => l.kind)); for (const k of ['door', 'bonnet', 'boot', 'bumper', 'lamp', 'glass', 'vent', 'crease', 'trim', 'panel']) expect(kinds.has(k as never), k).toBe(true);
    expect(L.length).toBeGreaterThan(60); expect(M.creases!.length).toBeGreaterThan(500);
    const key = (p: number[]) => p.map(v => Math.round(v * 100)).join(','), pts = new Set(S.P.map(key)); for (const l of S.lines) if (!S.cage.lines.find(c => c.name === l.name)!.between) for (const p of l.pts) expect(pts.has(key(p)), l.name).toBe(true); });
});

describe('p959: the surface rules (docs/systems/108)', () => { const R = measure(S);
  it('panels: no change of curvature sign but the declared, no short dimples, the flat panel flat', () => {
    for (const p of R.panels) { console.log(`p959 panel ${p.panel.name}: ${p.lines} lines, sign changes across ${p.across}/${p.panel.across ?? 0} along ${p.along}/${p.panel.along ?? 0} (measured/declared), short dimples ${p.dimples}, twist p95 ${p.twistP95.toFixed(1)} max ${p.twistMax.toFixed(1)} deg${p.panel.flat ? `, off its plane ${p.off.toFixed(1)} mm` : ''}`);
      expect(p.across, p.panel.name).toBeLessThanOrEqual(p.panel.across ?? 0); expect(p.along, p.panel.name).toBeLessThanOrEqual(p.panel.along ?? 0); expect(p.dimples, p.panel.name).toBe(0);
      if (p.panel.flat) { expect(p.off).toBeLessThanOrEqual(p.panel.flat); expect(p.twistP95).toBeLessThanOrEqual(2); expect(p.twistMax).toBeLessThanOrEqual(5); } } });
  it('folds: none of 35 degrees or more that is not a marked crease; few between 20 and 35', () => { console.log(`p959 folds of the painted skin: under 8 deg ${R.smooth}, 8-20 ${R.soft}, 20-35 unmarked ${R.mushy.length} (worst ${Math.max(0, ...R.mushy.map(e => e.deg)).toFixed(1)}), 35 and over unmarked ${R.unmarked.length}; slivers ${R.slivers}`);
    expect(R.unmarked.length).toBe(0); expect(R.mushy.length).toBeLessThanOrEqual(80); expect(Math.max(0, ...R.mushy.map(e => e.deg))).toBeLessThan(30); expect(R.slivers).toBe(0); });
  it('shading: the game\'s normals within 3 degrees of the surface\'s own on 99 % of the painted corners', () => { const PAINT = KINDS.indexOf('paint'), grp = Int32Array.from(M.kind, k => KINDS[k] === 'plain' ? PAINT : k);
    const game = surfaceNormals(M.pos, M.n, grp, { creases: M.creases }), E = shadingError(game, normals, shellTris, t => M.kind[t] === PAINT);
    console.log(`p959 shading: ${E.corners} painted corners, over 3 deg ${E.over3} (${(E.over3 / E.corners * 100).toFixed(2)} %), p95 ${E.p95.toFixed(2)}, max ${E.max.toFixed(1)} deg`);
    expect(E.over3 / E.corners).toBeLessThanOrEqual(0.01); });
  it('every crease is an edge of the shell', () => { const use = edgeUse(S.F); for (const k of S.crease) expect(use.has(k)).toBe(true); expect(ekey(2, 1)).toBe('1|2'); });
});

// Step S3: the attached parts, their alternatives on the same loops and sockets, the number plate
import { p959Mesh, plateText, PLATE_SYLLABLES } from '../render/car/p959';
import { buildShell } from '../render/car/p959/shell';
import { glyph } from '../render/car/p959/parts';
import { lineClass } from '../render/car/p959/lines';
import { STYLE } from '../render/live/style';
describe('p959: the attached parts (S3)', () => {
  it('the exterior with its parts stays near the budget (9,200; ceiling about 10,000) and carries the parts', () => { const names = new Set(M.names!.filter(Boolean)); console.log(`p959 exterior with parts: ${M.n} triangles`); expect(M.n).toBeLessThanOrEqual(10000);
    for (const n of ['headLamp', 'lampBezel', 'tyreF', 'tyreR', 'rim', 'wheel', 'hub', 'brakeDisc', 'brakeCaliper', 'mirror', 'exhaust', 'plate', 'plateText', 'plateFrame', 'plateBolt', 'indicatorF', 'ventF', 'ventR', 'tailLamp', 'tailLampEnd', 'sideIntake']) expect(names.has(n), n).toBe(true); });
  it('every bumper variant closes on the same seam loops', () => { const base = buildShell(), key = (p: number[]) => p.map(v => Math.round(v * 100)).join(',');
    for (const k of ['aero', 'clean'] as const) { const s = buildShell({ bumperF: k, bumperR: k }), use = [...edgeUse(s.F).values()]; expect(use.filter(u => u !== 2).length, k).toBe(0);
      expect(s.loops.frontBumper!.map(key)).toEqual(base.loops.frontBumper!.map(key)); expect(s.loops.rearBumper!.map(key)).toEqual(base.loops.rearBumper!.map(key));
      expect(s.F.filter((_, q) => s.tag[q]!.region === 'shell').length).toBe(base.F.filter((_, q) => base.tag[q]!.region === 'shell').length); } });
  it('the lamp and wheel alternatives swap in the same sockets', () => { for (const lamp of ['round', 'ellipsoid', 'square'] as const) for (const wheel of ['hollow5', 'dish', 'hole5'] as const) { const m = p959Mesh({ lamp, wheel }); expect(m.n, `${lamp} ${wheel}`).toBeLessThanOrEqual(10000); expect(Array.from(m.pos).every(Number.isFinite)).toBe(true); expect(wheelsOf(m).length).toBe(4); } });
  it('plate numbers: given or made from a seed, every plate syllable has its strokes', () => { expect(plateText('12가 3456')).toEqual({ top: '12가', big: '3456' }); expect(plateText(7)).toEqual(plateText(7)); expect(plateText(7)).not.toEqual(plateText(8)); expect(() => plateText('1가 23')).toThrow();
    for (const ch of [...PLATE_SYLLABLES, ...'0123456789']) expect(glyph(ch)?.length, ch).toBeGreaterThan(0); expect(glyph('각')).toBeNull();
    const a = p959Mesh({ plate: plateText('45노 7802') }), c = p959Mesh(); expect(a.n).not.toBe(c.n); });
  it('panel lines are drawn thinner than character lines', () => { const door = M.lines!.find(l => l.kind === 'door')!, lamp = M.lines!.find(l => l.kind === 'lamp')!; expect(lineClass('door')).toBe('panel'); expect(lineClass('lamp')).toBe('character'); expect(door.w).toBeCloseTo(STYLE.panelPx / STYLE.linePx); expect(lamp.w ?? 1).toBe(1); });
});

// docs/systems/116 B2, B3: the crest plate on the lid and the lettering on the tail band, on the skin, with no outline
import { CREST_BOX } from '../render/live/crest.gen';
import { crestLevels } from '../render/live/crest';
import { makeAtlas, ATLAS_CELLS as CELLS, outlineShare } from '../render/live/style';
import { LETTERS } from '../render/car/p959/badge';
describe('p959: the crest and the lettering (doc 116)', () => {
  const tris = (name: string) => { const out: number[] = []; for (let t = 0; t < M.n; t++) if (M.names![M.part[t]!] === name) out.push(t); return out; };
  const corner = (t: number, k: number): number[] => Array.from(M.pos.subarray(t * 9 + k * 3, t * 9 + k * 3 + 3));
  it('the plate: a face of 24 triangles painted from the crest cell inside its box, sides of 48, standing 1-3 mm over the lid', () => {
    const face = tris('badge'), side = tris('badgeEdge'), cell = CELLS.indexOf('badge') + 1; console.log(`p959 crest plate: face ${face.length}, sides ${side.length}; lettering ${tris('rearLettering').length} triangles`);
    expect(face.length).toBe(24); expect(side.length).toBe(48);
    for (const t of face) for (let k = 0; k < 3; k++) { const u = M.uv![t * 9 + k * 3]! * 0.992 + 0.004, v = M.uv![t * 9 + k * 3 + 1]! * 0.992 + 0.004; expect(M.uv![t * 9 + k * 3 + 2]).toBe(cell);
      expect(u * 256).toBeGreaterThanOrEqual(CREST_BOX[0] - 0.01); expect(u * 256).toBeLessThanOrEqual(CREST_BOX[0] + CREST_BOX[2] + 0.01); expect(v * 256).toBeGreaterThanOrEqual(CREST_BOX[1] - 0.01); expect(v * 256).toBeLessThanOrEqual(CREST_BOX[1] + CREST_BOX[3] + 0.01); }
    expect(M.uv!.filter((_, i) => i % 3 === 2 && M.names![M.part[Math.floor(i / 9)]!] !== 'badge').every(c => c === 0)).toBe(true);
    // the face's height over the lid: a ray from each face corner down its normal meets the bonnet 1 - 3 mm below
    const a = corner(face[0]!, 0), b = corner(face[0]!, 1), c = corner(face[0]!, 2), n = [(b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!), (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!), (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!)], l = Math.hypot(...n);
    expect(n[2]! / l).toBeGreaterThan(0.8);   // it faces up and forward, as the lid does
    const lid = shellTris; let lo = Infinity, hi = -Infinity;
    for (const t of face) for (let k = 0; k < 3; k++) { const p = corner(t, k), d = [-n[0]! / l, -n[1]! / l, -n[2]! / l]; let best = Infinity;
      for (let q = 0; q < lid; q++) { const A = corner(q, 0), B = corner(q, 1), C = corner(q, 2), e1 = [B[0]! - A[0]!, B[1]! - A[1]!, B[2]! - A[2]!], e2 = [C[0]! - A[0]!, C[1]! - A[1]!, C[2]! - A[2]!], pp = [d[1]! * e2[2]! - d[2]! * e2[1]!, d[2]! * e2[0]! - d[0]! * e2[2]!, d[0]! * e2[1]! - d[1]! * e2[0]!], det = e1[0]! * pp[0]! + e1[1]! * pp[1]! + e1[2]! * pp[2]!;
        if (Math.abs(det) < 1e-9) continue; const s = [p[0]! - A[0]!, p[1]! - A[1]!, p[2]! - A[2]!], u = (s[0]! * pp[0]! + s[1]! * pp[1]! + s[2]! * pp[2]!) / det; if (u < 0 || u > 1) continue;
        const qq = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!], v = (d[0]! * qq[0]! + d[1]! * qq[1]! + d[2]! * qq[2]!) / det; if (v < 0 || u + v > 1) continue;
        const tt = (e2[0]! * qq[0]! + e2[1]! * qq[1]! + e2[2]! * qq[2]!) / det; if (tt > -1 && tt < best) best = tt; }
      lo = Math.min(lo, best); hi = Math.max(hi, best); }
    console.log(`p959 crest plate over the lid: ${lo.toFixed(2)} - ${hi.toFixed(2)} mm`); expect(lo).toBeGreaterThanOrEqual(1); expect(hi).toBeLessThanOrEqual(3);
  });
  it('the lettering: PHORSTER in strokes on the tail band, its letters' + "'" + ' own font, lifted off the band, centred', () => {
    const L = tris('rearLettering'); expect(L.length).toBeGreaterThan(80); expect(L.length).toBeLessThan(400);
    for (const ch of 'PHORSTE') expect(LETTERS[ch], ch).toBeTruthy();
    const xs = L.flatMap(t => [0, 1, 2].map(k => corner(t, k)[0]!)), ys = L.flatMap(t => [0, 1, 2].map(k => corner(t, k)[1]!));
    expect(Math.min(...xs)).toBeGreaterThan(4251); expect(Math.max(...xs)).toBeLessThan(4256);   // just behind the band (4250.6 - 4251.8)
    expect(Math.abs(Math.min(...ys) + Math.max(...ys))).toBeLessThan(2); expect(Math.max(...ys)).toBeGreaterThan(280); expect(Math.max(...ys)).toBeLessThan(312);
  });
  it('no outline on either; the plain car without them', () => { for (const n of ['badge', 'badgeEdge', 'rearLettering']) expect(outlineShare(n, 0)).toBe(0); expect(outlineShare('bonnet', 1)).toBe(1);
    const bare = p959Mesh({ marks: false }); expect(bare.n).toBe(M.n - tris('badge').length - tris('badgeEdge').length - tris('rearLettering').length); expect(bare.uv).toBeUndefined(); });
  it('the crest cell: nine levels, the far ones flat, each set over the atlas the renderer makes', () => {
    const L = crestLevels(); expect(L.map(l => Math.sqrt(l.length / 4))).toEqual([256, 128, 64, 32, 16, 8, 4, 2, 1]);
    const colours = (l: Uint8Array) => new Set(Array.from({ length: l.length / 4 }, (_, i) => `${l[i * 4]},${l[i * 4 + 1]},${l[i * 4 + 2]}`)).size;
    expect(colours(L[0]!)).toBeGreaterThan(100); expect(colours(L[4]!)).toBeLessThanOrEqual(5);   // the artwork; the 16 drawn in the five flat colours
    const A = makeAtlas(1024), i = CELLS.indexOf('badge'); expect(Array.from(A.rects.subarray(i * 4, i * 4 + 4))).toEqual([0.5, 0.25, 0.25, 0.25]);
    const bm = A.mips!.filter(m => m.w === m.h);   // the crest's (the lamps' pictures bring their own flat levels, twice as wide as high: render/car/lampart.ts)
    expect(bm.map(m => m.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); expect(bm[3]!).toMatchObject({ x: 32, y: 16, w: 16, h: 16 }); expect(bm[3]!.data).toBe(L[4]);
    expect(Array.from(A.data.subarray(((256 + 128) * 1024 + 512 + 128) * 4, ((256 + 128) * 1024 + 512 + 128) * 4 + 4))).toEqual(Array.from(L[0]!.subarray((128 * 256 + 128) * 4, (128 * 256 + 128) * 4 + 4)));
  });
});
