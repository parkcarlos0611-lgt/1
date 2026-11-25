// The 959's sockets (docs/systems/109 §3): where the separate modules go. Positions in the car's axes (mm).
import { DIM } from './cage';
import type { V } from './subdiv';

export interface Hub { name: string; /** the wheel's outer face centre */ o: V; tyreR: number; rimR: number; width: number; archR: number; front: boolean }
export interface Mount { name: string; o: V; /** the way it faces, out of the surface */ n: V }
/** an area marked for a picture laid on later (a texture or decal, not geometry): its centre, the way it faces, its width and height */
export interface Mark { name: string; o: V; n: V; w: number; h: number }
export interface Sockets { hubs: Hub[]; mirrors: Mount[]; exhausts: { name: string; o: V; r: number }[]; marks: Mark[] }
export function sockets(): Sockets { const hubs: Hub[] = [], mirrors: Mount[] = [], exhausts: Sockets['exhausts'] = [];
  const marks: Mark[] = [{ name: 'porscheLettering', o: [4258, 0, 622], n: [1, 0, 0], w: 620, h: 70 }, { name: 'badge', o: [215, 0, 588], n: [-0.4, 0, 0.92], w: 46, h: 58 }, { name: 'plateF', o: [4, 0, 272], n: [-1, 0, 0], w: 335, h: 170 }, { name: 'plateR', o: [4259, 0, 420], n: [1, 0, 0], w: 335, h: 170 }];
  for (const s of [1, -1]) { hubs.push({ name: s > 0 ? 'hubFL' : 'hubFR', o: [DIM.axleF, s * (DIM.trackF / 2 + 118), DIM.hubZ], tyreR: DIM.tyreR, rimR: 222, width: 235, archR: DIM.archR, front: true });
    hubs.push({ name: s > 0 ? 'hubRL' : 'hubRR', o: [DIM.axleR, s * (DIM.trackR / 2 + 128), DIM.hubZ - 2], tyreR: DIM.tyreR - 2, rimR: 222, width: 255, archR: DIM.archR, front: false });
    exhausts.push({ name: s > 0 ? 'exhaustL' : 'exhaustR', o: [4258, s * 335, 256], r: 40 });
    const L = s > 0 ? 'L' : 'R'; marks.push({ name: 'sideMarker' + L, o: [1300, s * 868, 705], n: [0, s, 0], w: 60, h: 28 }, { name: 'fogLamp' + L, o: [40, s * 470, 372], n: [-1, 0, 0], w: 70, h: 70 }, { name: 'doorHandle' + L, o: [2470, s * 800, 778], n: [0, s, 0], w: 150, h: 30 });
    mirrors.push({ name: s > 0 ? 'mirrorL' : 'mirrorR', o: [1680, s * 760, 880], n: [0, s, 0] }); }
  return { hubs, mirrors, exhausts, marks }; }
