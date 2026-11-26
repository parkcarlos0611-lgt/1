import { describe, it, expect } from 'vitest';
import { raceSpec } from '../race/cars';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { trackDef } from '../race/tracks';
import { roadCourse } from '../race/roadcourse';
import { pieceSpan } from '../race/scenery';
import { edgeLayout, edgeAt, roadGrid } from '../race/trackside';
import { Collider, SURFACE } from '../race/collide';
import { millbrook } from '../race/millbrook';
import { Driver } from '../race/driver';

// docs/systems/111 T1 and T3: the tracks cleared to the road and the woods, a real circuit's edge, and what it does to a car
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 3000, name: 'a' }, { kind: 'arc', radius: 300, turn: 180, name: 'b' }, { kind: 'straight', len: 3000, name: 'c' }, { kind: 'arc', radius: 300, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 14, easing: 30, banking: [], bumps: [], landmarks: [], joints: 10 });
const dt = 1 / 200, none = { throttle: 0, brake: 0, steer: 0 };

describe('the tracks cleared (T1)', () => {
  it('keeps only the woods and the edge on every track; nothing of the edge on the road; the Members\' step levelled', () => {
    for (const id of ['millbrook', 'road', 'speed']) { const D = trackDef(id), T = D.make(), S = D.scenery(T), W2 = T.spec.width / 2, near = roadGrid(T);
      expect(S.props.length + S.lines.length + S.areas.length + S.railway.length).toBe(0); expect(S.trees!.length).toBeGreaterThan(100);
      expect(S.detail!.every(p => /^edge/.test(p.kind))).toBe(true);
      for (const p of S.detail!) expect(near(p.x, p.y).d).toBeGreaterThan(W2 + 0.2);
      for (const t of S.trees!) expect(near(t.x, t.y).d).toBeGreaterThan(W2 + 3); }
    expect(millbrook().spec.bumps.every(b => b.height < 0.1)).toBe(true);
  });
  it("lays a gravel trap and tyres on the outside of Ashcombe Park's hairpin, the barrier beyond the run-off", () => {
    const T = roadCourse(), E = edgeLayout(T), h = pieceSpan(T, 'Hairpin'), mid = (h.s0 + h.s1) / 2, out = edgeAt(E, mid, -1), inn = edgeAt(E, mid, 1);   // a left-hander: its outside to the right
    expect(out.trap).toBe('gravel'); expect(out.tyres).toBe(true); expect(out.barrierOff).toBeGreaterThan(out.paint + 5); expect(inn.trap).toBe('grass');
    for (const side of E.sides) for (const e of side) { expect(e.barrierOff).toBeGreaterThan(e.paint); expect(e.fenceOff).toBeGreaterThan(e.barrierOff); }
  });
});

describe('collisions (T3)', () => {
  const P = flat.point(500, 0), C = new Collider(flat, edgeLayout(flat), [{ x: P.x, y: P.y, z: 0, kind: 0, size: 1, heading: 0, rank: 0 }]);
  it('throws a car back off a wall at speed, slower, dented, without passing through it', () => {
    for (const v0 of [30, 90]) { const car = C.equip(new Vehicle(raceSpec('dueSSJ35'), flat).place(200, 0, 0)); car.v[0] = v0 * 0.5; car.v[1] = -v0 * 0.866;   // 60 degrees into the right-hand barrier
      const wall = edgeAt(C.edge!, 200, -1).barrierOff; let most = 0;
      for (let t = 0; t < 1.5; t += dt) { car.step(dt, none); most = Math.max(most, -car.off); }
      expect(most).toBeLessThan(wall); expect(car.speed).toBeLessThan(v0 * 0.6); expect(car.hits.length).toBeGreaterThan(0); }
  });
  it('stops a car on a tree, the tree where it stood', () => {
    const car = C.equip(new Vehicle(raceSpec('dueSSJ35'), flat).place(470, 0, 25)); for (let t = 0; t < 2; t += dt) car.step(dt, none);
    expect(car.s).toBeLessThan(499); expect(car.speed).toBeLessThan(10); expect(car.hits.length).toBeGreaterThan(0); expect(C.trunks[0]!.x).toBe(P.x);
  });
  it('slows a car in a gravel trap far quicker than on the painted run-off', () => {
    const run = (sf: typeof SURFACE.gravel) => { const car = new Vehicle(raceSpec('dueSSJ35'), flat).place(300, -12, 30); car.surface = () => sf; for (let t = 0; t < 2; t += dt) car.step(dt, none); return car.speed; };
    expect(run(SURFACE.gravel)).toBeLessThan(run(SURFACE.paint) - 12);
  });
  it('lets the test driver lap Ashcombe Park among the barriers, striking none', () => {
    const D = trackDef('road'), T = D.make(), Co = Collider.of(T, D.scenery(T)), car = Co.equip(new Vehicle(raceSpec('dueSSJ35'), T).place(16, 0, 0)), d = new Driver(T); let t = 0, dist = 0, prev = car.s;
    while (dist < T.length + 50 && t < 300) { car.step(dt, d.drive(car)); t += dt; dist += T.gap(prev, car.s); prev = car.s; }
    expect(dist).toBeGreaterThan(T.length); expect(car.hits.length).toBe(0);
  });
});
