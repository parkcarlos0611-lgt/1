import { describe, it, expect } from 'vitest';
import { roadCourse } from '../race/roadcourse';
import { speedway } from '../race/speedway';
import { TRACKS } from '../race/tracks';
import { roadScenery, speedwayScenery } from '../race/scenery';
import { groundData } from '../render/live/ground';
import { raceSpec } from '../race/cars';
import { Vehicle } from '../race/vehicle';
import { Driver } from '../race/driver';
import { Race, bookFor, bookTime } from '../race/race';
import type { Track } from '../race/track';

const closes = (T: Track) => { const a = T.at(0), b = T.at(T.length - 1e-6); return Math.hypot(a.x - b.x, a.y - b.y); };
const turn = (T: Track) => T.nodes.reduce((s, n) => s + n.k, 0) * 180 / Math.PI;
describe('the new tracks (review 162)', () => {
  it('lays Ashcombe Park: a closed, level 3.8 km road course with a 25 m hairpin and a 250 m sweeper', () => {
    const T = roadCourse(); expect(Math.abs(T.length - 3773)).toBeLessThan(10); expect(closes(T)).toBeLessThan(1.5); expect(turn(T)).toBeCloseTo(360, 0);
    expect(T.spec.width).toBeGreaterThanOrEqual(12); expect(T.spec.width).toBeLessThanOrEqual(15);
    let kMax = 0; for (let s = 0; s < T.length; s += 3) { expect(T.height(s, 5)).toBe(0); expect(T.height(s, -5)).toBe(0); kMax = Math.max(kMax, Math.abs(T.at(s).k)); }
    expect(1 / kMax).toBeGreaterThan(24); expect(1 / kMax).toBeLessThan(27);
    // the loop does not cross itself: every stretch keeps 30 m from the others
    for (let s = 0; s < T.length; s += 20) { const p = T.at(s); for (let q = 0; q < T.length; q += 5) { if (Math.abs(T.gap(s, q)) < 150) continue; const o = T.at(q); expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThan(30); } }
  });
  it('lays the Speed Bowl: two true 15 km straights, flat 1.2 km turns, centred so it stays within 8.75 km of the origin', () => {
    const T = speedway(); expect(Math.abs(T.length - 37540)).toBeLessThan(5); expect(closes(T)).toBeLessThan(1.5); expect(turn(T)).toBeCloseTo(360, 0);
    let r = 0; for (const n of T.nodes) r = Math.max(r, Math.abs(n.x), Math.abs(n.y)); expect(r).toBeLessThan(8750);
    for (const s of [1000, 7000, 13000]) { expect(T.at(s).k).toBe(0); expect(Math.abs(T.at(s).y + 1200)).toBeLessThan(1); expect(T.at(s).h).toBeCloseTo(0, 6); }   // the south straight lies true
    for (let s = 0; s < T.length; s += 50) expect(T.height(s, 7)).toBe(0);
    expect(T.spec.landmarks.find(l => l.name === 'Flying km start')!.s).toBe(11000); expect(T.pieceAt(12500)).toBe('South Straight');
  });
  it('builds the speed track\'s ground in long steps on its level concrete: a sane vertex count, every vertex on the ground', () => {
    const T = speedway(), g = groundData(T, speedwayScenery(T), 0, 25); expect(g.n).toBeLessThan(400_000);
    let worst = 0; for (let i = 0; i < g.n; i++) worst = Math.max(worst, Math.abs(g.pos[i * 3 + 2]!)); expect(worst).toBeLessThan(0.05);
    const fine = groundData(roadCourse(), roadScenery(roadCourse()), 20); expect(fine.n).toBeGreaterThan(3773 * 9 * 6);
  });
  it('keeps the road course\'s trees off the road', () => {
    const T = roadCourse(), S = roadScenery(T); expect(S.props.filter(p => p.kind.startsWith('tree')).length).toBeGreaterThan(300);
    for (const p of S.props) if (/^tree|bush/.test(p.kind)) expect(Math.abs(T.locate(p.x, p.y).off)).toBeGreaterThan(T.spec.width / 2 + 5);
  });
  it('the test driver laps the road course on the concrete, braking for the hairpin', () => {
    const T = roadCourse(), car = new Vehicle(raceSpec('fnTT33'), T).place(16, 0, 0), d = new Driver(T); let t = 0, worst = 0, hairpin = Infinity, dist = 0, prev = car.s;
    while (dist < T.length + 50 && t < 300) { car.step(1 / 200, d.drive(car)); t += 1 / 200; dist += T.gap(prev, car.s); prev = car.s; worst = Math.max(worst, Math.abs(car.off)); if (T.pieceAt(car.s) === 'Hairpin') hairpin = Math.min(hairpin, car.speed * 3.6); }
    expect(dist).toBeGreaterThan(T.length); expect(worst).toBeLessThan(T.spec.width / 2); expect(hairpin).toBeLessThan(60); expect(t).toBeLessThan(170);
  });
  it('keeps a handicap book per track: the road course\'s for every car, none for the speed track', () => {
    const road = bookFor('road')!; for (const id of Object.keys(bookFor('millbrook')!)) expect(road[id]!.flying).toBeGreaterThan(100);
    expect(bookFor('speed')).toBeNull(); expect(TRACKS.map(t => t.id)).toEqual(['millbrook', 'road', 'speed']);
    const T = roadCourse(), r = new Race(T, ['fordT23', 'eb110'], 2, null); expect(r.cars[1]!.start).toBeCloseTo(bookTime('fordT23', 2, 'road') - bookTime('eb110', 2, 'road'), 6);
  });
});
