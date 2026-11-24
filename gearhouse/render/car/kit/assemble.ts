// The assembler: an assembly spec (data, render/car/cars/<id>.kit.ts) in, a Mesh out. It makes the line system from
// the sheet (with any tweak), lays the standard section along it (skin.ts), then calls each panel and part function
// the spec names, in order, telling the emitter what each triangle is for (so the seam check can find the shell).
import type { Mesh } from '../mesh';
import { Emit, type Role } from './emit';
import { makeLines, type Lines, type Tweak } from './lines';
import { makeSkin, type Skin } from './skin';
import type { Ctx } from './ctx';
import type { CarKit } from './spec';
import type { V } from './geom';
import { bonnet, bonnetTrim } from './panels/bonnet';
import { frontWing, flankPatch } from './panels/frontWing';
import { noseBumper } from './panels/noseBumper';
import { door, doorTrim } from './panels/door';
import { sill } from './panels/sill';
import { quarter, quarterTrim } from './panels/quarter';
import { deck, deckTrim } from './panels/deck';
import { tail } from './panels/tail';
import { canopy } from './panels/canopy';
import { underbody } from './panels/underbody';
import { sideIntake } from './panels/sideIntake';
import { popupLamp, popupTrim } from './panels/popupLamp';
import { cabin, engineBay } from './panels/cabin';
import { lampCluster } from './parts/lampCluster';
import { wheel } from './parts/wheel';
import { mirror } from './parts/mirror';
import { wiper } from './parts/wiper';
import { exhaust } from './parts/exhaust';
import { plate } from './parts/small';
import { engine } from './parts/engine';

export interface AssembleOpts { /** the wheels turned (radians) */ spin?: number; /** the pop-up lamps raised 0..1 */ lamps?: number; /** a change to the sheet's lines */ tweak?: Tweak }
export interface Assembled { mesh: Mesh; lines: Lines; skin: Skin;
  /** each triangle's role (an index into ROLES) and the panel or part function that made it */
  role: Uint8Array; panelOf: Int16Array; panels: string[] }

export function assemble(k: CarKit, o: AssembleOpts = {}): Assembled {
  const L = makeLines(k.lines, o.tweak), s = makeSkin(L, k), e = new Emit(), c = k.colours;
  const SN = k.top.rows.map(L.X), topRow = (a: number | string) => { const xv = L.X(a), q = SN.findIndex(v => Math.abs(v - xv) < 0.5); return q >= 0 ? k.top.capRows.length + q : s.iXJ + L.at(a); };
  const x: Ctx = { e, s, L, k, c, lamps: Math.max(0, Math.min(1, o.lamps ?? 0)), spin: o.spin ?? 0, topRow, P: (p: V): V => [L.mx(p[0]), L.my(p[1]), p[2]] };
  const run = (role: Role, name: string, f: () => void) => { e.role(role, name); f(); };
  // the body's shell, panel by panel
  run('shell', 'bonnet', () => bonnet(x)); run('shell', 'frontWing', () => frontWing(x));
  run('shell', 'door', () => door(x)); run('shell', 'sill', () => sill(x)); run('shell', 'quarter', () => quarter(x));
  run('shell', 'deck', () => deck(x)); run('shell', 'tail', () => tail(x)); run('shell', 'canopy', () => canopy(x));
  run('shell', 'noseBumper', () => noseBumper(x)); run('shell', 'underbody', () => underbody(x));
  run('shell', 'sideIntake', () => sideIntake(x)); run('shell', 'popupLamp', () => popupLamp(x));
  // what is laid on it: shut lines, lamps, small fittings
  run('part', 'trim', () => { bonnetTrim(x); popupTrim(x); doorTrim(x); deckTrim(x); quarterTrim(x); flankPatch(x, 'repeater', c.amber, 0.7, k.repeater); });
  run('part', 'lampCluster', () => lampCluster(x, k.tail.kind === 'ducktail' ? 'sunk' : k.tail.kind === 'roundLamps' ? 'round' : 'band'));
  run('part', 'plate', () => plate(x, k.plate)); run('part', 'exhaust', () => exhaust(x, k.exhaust));
  // inside
  run('inside', 'cabin', () => cabin(x)); run('inside', 'engineBay', () => engineBay(x)); run('inside', 'engine', () => engine(x, k.engine.spec, k.engine.at, k.engine.opts));
  // the fittings and the wheels
  run('part', 'mirror', () => mirror(x, k.mirror)); run('part', 'wiper', () => wiper(x, k.wiper));
  for (const sg of [1, -1] as const) { run('part', 'wheel', () => { wheel(x, L.wheels.f, sg, true, k.wheel); wheel(x, L.wheels.r, sg, false, k.wheel); }); }
  const mesh = e.b.mesh(L.length), r = e.roles(mesh.n);
  return { mesh, lines: L, skin: s, role: r.role, panelOf: r.panelOf, panels: r.panel };
}
