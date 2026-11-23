// Crash damage by deformation (review 121): the structure of nodes and beams built from a car's mesh, bent by blows.
import { describe, it, expect } from 'vitest';
import { MESH_CARS } from '../render/car/meshcars';
import { wheelsOf } from '../render/car/mesh';
import { Damage } from '../race/damage';
import { raceSpec } from '../race/cars';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { touch } from '../race/race';

const mesh = (id: string) => MESH_CARS.find(c => c.id === id)!.mesh();
describe('the car as nodes and beams', () => {
  it('takes a blow\'s energy by bending, deeper the harder', () => {
    const M = mesh('dueSSJ35'), m = raceSpec('dueSSJ35').mass, hit = (kmh: number) => { const D = new Damage(M); D.impact([0, 0, 600], [1, 0, 0], 0.5 * m * (kmh / 3.6) ** 2 * 0.6, 360); return D; };
    const a = hit(15), b = hit(50); expect(a.taken).toBeGreaterThan(0.9 * 0.5 * m * (15 / 3.6) ** 2 * 0.6); expect(b.worst).toBeGreaterThan(a.worst * 2);
    expect(a.worst).toBeLessThan(150); expect(b.worst).toBeLessThan(700);   // a heavy frame of the period: a knock dents, a 50 km/h blow crushes the front a quarter of a metre or so
  });
  it('bends the skin with it, and leaves the far end as it was', () => {
    const M = mesh('dueSSJ35'), D = new Damage(M); D.impact([0, 0, 600], [1, 0, 0], 80000, 360); const B = D.rebuild(); let front = 0, tail = 0;
    for (let v = 0; v < M.n * 3; v++) { const d = Math.hypot(B.pos[v * 3]! - M.pos[v * 3]!, B.pos[v * 3 + 1]! - M.pos[v * 3 + 1]!, B.pos[v * 3 + 2]! - M.pos[v * 3 + 2]!); if (M.pos[v * 3]! < 500) front = Math.max(front, d); if (M.pos[v * 3]! > M.length - 500) tail = Math.max(tail, d); }
    expect(front).toBeGreaterThan(50); expect(tail).toBeLessThan(2);
  });
  it('knocks a wheel askew from a blow at its corner, and crushes the radiator from the front', () => {
    const M = mesh('dueSSJ35'), W = wheelsOf(M).filter(w => w.front), side = W.find(w => w.hy > 0)!, D = new Damage(M);
    D.impact([200, side.hy + 300, 650], [0.7, -0.7, 0], 70000, 360); expect(Math.abs(D.askew([side.hx, side.hy, side.hz]).toe)).toBeGreaterThan(0.01);
    const F = new Damage(M); F.impact([0, 0, 700], [1, 0, 0], 140000, 400); expect(F.radiator).toBeGreaterThan(0.1);
  });
  it('lets a part come away when every beam holding it parts (the 540K\'s lamp, standing out in front)', () => {
    const D = new Damage(mesh('mb540k')); D.impact([0, 0, 600], [1, 0, 0], 50000, 360); expect(D.loose.length).toBeGreaterThan(0); const piece = D.piece(D.loose[0]!); expect(piece.n).toBeGreaterThan(0);
  });
  it('records the blows the physics deals: cars meeting, and a body landing on the ground', () => {
    const T = new Track({ name: 'f', pieces: [{ kind: 'straight', len: 3000, name: 'a' }, { kind: 'arc', radius: 100, turn: 180, name: 'b' }, { kind: 'straight', len: 3000, name: 'c' }, { kind: 'arc', radius: 100, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 40, easing: 10, banking: [], bumps: [], landmarks: [], joints: 12 });
    const a = new Vehicle(raceSpec('chevAB28'), T).place(500, 0, 15), b = new Vehicle(raceSpec('chevAB28'), T).place(503.5, 0, 0); touch(a, b);
    expect(a.hits.length).toBeGreaterThan(0); expect(b.hits.length).toBeGreaterThan(0);
    const c = new Vehicle(raceSpec('fordT23'), T).place(800, 0, 0); c.om[0] = 6; c.v[2] = 3; for (let t = 0; t < 3; t += 1 / 200) c.step(1 / 200, { throttle: 0, brake: 0, steer: 0 }); expect(c.hits.length).toBeGreaterThan(0);
  });
});
