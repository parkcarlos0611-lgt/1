// The 959's sockets (docs/systems/109 §3): where the separate modules go. Positions in the car's axes (mm).
import { DIM } from './cage';
import type { V } from './subdiv';

export interface Hub { name: string; /** the wheel's outer face centre */ o: V; tyreR: number; rimR: number; width: number; archR: number; front: boolean }
export interface Mount { name: string; o: V; /** the way it faces, out of the surface */ n: V }
export interface Sockets { hubs: Hub[]; mirrors: Mount[] }
export function sockets(): Sockets { const hubs: Hub[] = [], mirrors: Mount[] = [];
  for (const s of [1, -1]) { hubs.push({ name: s > 0 ? 'hubFL' : 'hubFR', o: [DIM.axleF, s * (DIM.trackF / 2 + 118), DIM.hubZ], tyreR: DIM.tyreR, rimR: 222, width: 235, archR: DIM.archR, front: true });
    hubs.push({ name: s > 0 ? 'hubRL' : 'hubRR', o: [DIM.axleR, s * (DIM.trackR / 2 + 128), DIM.hubZ - 2], tyreR: DIM.tyreR - 2, rimR: 222, width: 255, archR: DIM.archR, front: false });
    mirrors.push({ name: s > 0 ? 'mirrorL' : 'mirrorR', o: [1680, s * 760, 880], n: [0, s, 0] }); }
  return { hubs, mirrors }; }
