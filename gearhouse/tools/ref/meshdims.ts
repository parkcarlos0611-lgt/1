// Each mesh car's overall size in mm (length along x, width across y, height up z), to check against the real cars.
//   npx tsx tools/ref/meshdims.ts
import { MESH_CARS } from '../../render/car/meshcars';
for (const c of MESH_CARS) {
  const p = c.mesh().pos, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k]!, p[i + k]!); mx[k] = Math.max(mx[k]!, p[i + k]!); }
  console.log(c.id.padEnd(10), 'L', Math.round(mx[0]! - mn[0]!), 'W', Math.round(mx[1]! - mn[1]!), 'H', Math.round(mx[2]! - mn[2]!), ' x', Math.round(mn[0]!), '..', Math.round(mx[0]!), ' z', Math.round(mn[2]!));
}
