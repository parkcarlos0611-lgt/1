import { createHash } from 'node:crypto';
import { p959Model, P959_LUMP } from '../../render/car/p959';
const h = (m: ReturnType<typeof p959Model>) => createHash('sha1').update(Buffer.from(m.mesh.pos.buffer)).update(Buffer.from(m.normals.buffer)).update(JSON.stringify(m.mesh.lines)).update(JSON.stringify(m.mesh.creases)).update(Buffer.from(m.mesh.col.buffer)).digest('hex').slice(0, 16);
for (const [n, o] of [['stock', {}], ['lump', P959_LUMP], ['max', { ...P959_LUMP, glass: 'stock', dims: { overhangF: 80, wheelbase: 150, overhangR: 80, width: 60, roof: 40, ride: 40 } }], ['min', { ...P959_LUMP, dims: { overhangF: -80, wheelbase: -150, overhangR: -60, width: -60, roof: -40, ride: -30 } }]] as const) console.log(n, h(p959Model(o as never)));
