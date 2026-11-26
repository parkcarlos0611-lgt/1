import { millbrook } from '/home/user/1/gearhouse/race/millbrook';
import { millbrookScenery } from '/home/user/1/gearhouse/race/scenery';
import { writeFileSync } from 'node:fs';
const T = millbrook(), S = millbrookScenery(T), W2 = T.spec.width / 2, L = Math.round(T.length);
const edge = (o: number) => Array.from({ length: Math.ceil(L / 5) + 1 }, (_, i) => { const p = T.point(i * 5, o); return [p.x, p.y]; });
const start = T.spec.landmarks.find(l => l.kind === 'line')!.s;
const pt = (s: number, o: number) => { const p = T.point(s, o); return [p.x, p.y, T.at(s).h]; };
writeFileSync(process.argv[2]!, JSON.stringify({ L, W2, start, left: edge(W2), right: edge(-W2), props: S.props, lines: S.lines, areas: S.areas,
  marks: Object.fromEntries([['start', pt(start, 0)], ...[-60, -40, -20, 0, 20, 40, 60, 80, 100, 120, 140, 160, 200, 260, 320, 380, 450, 520].map(d => [`s${d}`, pt(start + d, 0)])]),
  pieces: T.spec.pieces.map(p => p.name), landmarks: T.spec.landmarks.map(l => ({ ...l, p: pt(l.s, 0) })) }));
