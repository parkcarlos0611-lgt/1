// The fence's broken pieces as small rigid bodies (review 112): each a post or a length of rail, flung by the car that
// broke it, turning about all three axes, falling, bouncing and sliding to rest on the road or the grass, kicked again
// by any car that runs into it. World axes, metres, seconds.
import type { Mesh } from '../render/car/mesh';
/** a post or a rail of the fence, or a part come off a car (review 121: its own mesh, about its middle, mm) */
export interface Piece { id: number; kind: 'post' | 'rail' | 'part'; len: number; mesh?: Mesh; key?: string; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  yaw: number; pitch: number; roll: number; wy: number; wp: number; wr: number; life: number; still: number }
export class Debris {
  readonly pieces: Piece[] = []; private n = 0; max = 220;
  add(p: Omit<Piece, 'id' | 'still'>): void { this.pieces.push({ ...p, id: this.n++, still: 0 }); while (this.pieces.length > this.max) this.pieces.shift(); }
  /** one step: `ground(x, y)` the surface's height there; `cars` what may run into the pieces (centre, velocity, reach) */
  step(dt: number, ground: (x: number, y: number) => number, cars: { x: number; y: number; vx: number; vy: number; r: number }[] = []): void {
    for (let i = this.pieces.length - 1; i >= 0; i--) { const p = this.pieces[i]!; p.life -= dt; if (p.life <= 0) { this.pieces.splice(i, 1); continue; }
      for (const c of cars) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), sp = Math.hypot(c.vx, c.vy); if (d < c.r && sp > 1.5 && p.z < ground(p.x, p.y) + 1.2) {   // struck: thrown ahead and up, spinning
          p.vx = c.vx * (0.6 + Math.random() * 0.5) + dx / Math.max(0.3, d) * 2; p.vy = c.vy * (0.6 + Math.random() * 0.5) + dy / Math.max(0.3, d) * 2; p.vz = 1.5 + sp * 0.15 * Math.random();
          p.wy += (Math.random() - 0.5) * 12; p.wp += (Math.random() - 0.5) * 14; p.wr += (Math.random() - 0.5) * 14; p.still = 0; } }
      if (p.still > 1.5) continue;   // at rest
      p.vz -= 9.81 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.yaw += p.wy * dt; p.pitch += p.wp * dt; p.roll += p.wr * dt;
      // the piece's lowest point: half its thickness, or more while it stands on end (a post upright, a rail on its end)
      const half = p.kind === 'post' ? 0.04 + 0.46 * Math.abs(Math.cos(p.pitch) * Math.cos(p.roll)) : 0.03 + p.len / 2 * Math.abs(Math.sin(p.pitch)), floor = ground(p.x, p.y) + half;
      if (p.z < floor) { p.z = floor; if (p.vz < 0) p.vz = -p.vz * 0.28; const f = Math.exp(-dt * 6); p.vx *= f; p.vy *= f; p.wy *= f; p.wp *= 0.7; p.wr *= 0.7;
        // tipping over to lie flat: a post falls onto its side, a rail settles along the ground
        const lie = (a: number, flat: number) => a + Math.max(-dt * 4, Math.min(dt * 4, flat - a));
        if (p.kind === 'post') { if (Math.abs(Math.cos(p.pitch) * Math.cos(p.roll)) > 0.3) p.pitch = lie(p.pitch, Math.sign(p.pitch || 1) * Math.PI / 2); } else p.pitch = lie(p.pitch, Math.round(p.pitch / Math.PI) * Math.PI);
        p.still = Math.hypot(p.vx, p.vy, p.vz) < 0.15 && Math.abs(p.vz) < 0.2 ? p.still + dt : 0; } }
  }
}
