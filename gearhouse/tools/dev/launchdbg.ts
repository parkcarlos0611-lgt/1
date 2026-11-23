import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { VehicleFlat } from '../../race/vehicle_flat';
import { Track } from '../../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const id = process.argv[2] ?? 'dueSSJ35', dt = 1 / 200;
const a = new Vehicle(raceSpec(id), flat).place(100, 0, 0), b = new VehicleFlat(raceSpec(id), flat).place(100, 0, 0);
for (let k = 0; k <= 2000; k++) { if (k % 100 === 0) { const ax = a.axles[1]; console.log((k * dt).toFixed(1), 'v', (a.speed * 3.6).toFixed(0), (b.speed * 3.6).toFixed(0), 'g', a.gear, b.gear, 'rpm', a.rpm.toFixed(0), b.rpm.toFixed(0), 'kx', a.slipX[2]!.toFixed(2), b.slipX[2]!.toFixed(2), 'Fz', Math.round(a.load[2]!), Math.round(b.load[2]!), 'patch', a.rings[2]!.patch.toFixed(2), 'wu', ax.wu.toFixed(3), 'pitch', (a.pitch * 57.3).toFixed(1), (b.pitch * 57.3).toFixed(1), 'fx', Math.round(a.tfx[2]!), Math.round(b.tfx[2]!)); }
  a.step(dt, { throttle: 1, brake: 0, steer: 0 }); b.step(dt, { throttle: 1, brake: 0, steer: 0 }); }
