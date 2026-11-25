import { buildN33Shell, n33Skin } from '../../render/car/n33';
const sk = n33Skin(buildN33Shell({ glass: 'stock' }));
const f = (v: number[]) => v.map(x => x.toFixed(2)).join(',');
for (const z of [620, 560, 420, 330, 250, 200, 170]) for (const y of [0, 300, 500, 600, 700, 760, 820]) { const h = sk.hit([-800, y, z], [1, 0, 0], 3000); console.log('F z', z, 'y', y, h ? `x ${h.p[0].toFixed(0)} n ${f(h.n)} ${h.tag.panel}/${h.tag.mat}` : '-'); }
for (const z of [820, 700, 680, 600, 450, 300]) for (const y of [0, 300, 430, 580, 700, 760]) { const h = sk.hit([5800, y, z], [-1, 0, 0], 3000); console.log('R z', z, 'y', y, h ? `x ${h.p[0].toFixed(0)} n ${f(h.n)} ${h.tag.panel}/${h.tag.mat}` : '-'); }
