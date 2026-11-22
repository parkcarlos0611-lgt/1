// A race track as a centre line with its width, its banking and its surface (the driving game, review 84): built
// from straights and arcs, its corners eased, sampled every metre. Units m; x east, y north, z up; headings in radians
// anticlockwise from east. Lateral offset `off` is measured to the left of the direction of running.
export type Piece = { kind: 'straight'; len: number; name: string } | { kind: 'arc'; radius: number; turn: number; name: string };   // turn in degrees, + left
/** banking: over [s0, s1] the outer edge stands `height` m above the inner, the cross-section rising as (u/width)^`curve`;
 *  it comes in and goes out over `ease` m at each end */
export interface Banking { s0: number; s1: number; height: number; curve: number; ease: number; name: string }
/** a bump across the track: a rise of `height` m over `len` m, centred at s */
export interface Bump { s: number; height: number; len: number; name?: string }
export interface Landmark { s: number; name: string; kind: 'bridge' | 'line' | 'fork' }
export interface TrackSpec { name: string; pieces: Piece[]; start: { x: number; y: number; heading: number }; width: number; easing: number; banking: Banking[]; bumps: Bump[]; landmarks: Landmark[]; joints: number }
export interface Node { s: number; x: number; y: number; h: number; k: number }

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export class Track {
  readonly nodes: Node[] = []; readonly length: number; readonly ds = 1;
  constructor(readonly spec: TrackSpec) {
    // curvature along the run, eased by a moving average so the corners come in gradually
    const raw: number[] = []; for (const p of spec.pieces) { const len = p.kind === 'straight' ? p.len : Math.abs(p.radius * p.turn * Math.PI / 180), n = Math.round(len); for (let i = 0; i < n; i++) raw.push(p.kind === 'straight' ? 0 : Math.sign(p.turn) / p.radius); }
    const N = raw.length, half = Math.max(1, Math.round(spec.easing / 2)), k = raw.map((_, i) => { let s = 0; for (let j = -half; j <= half; j++) s += raw[(i + j + N) % N]!; return s / (2 * half + 1); });
    let x = spec.start.x, y = spec.start.y, h = spec.start.heading; const pts: Node[] = [];
    for (let i = 0; i < N; i++) { pts.push({ s: i, x, y, h, k: k[i]! }); const hm = h + k[i]! / 2; x += Math.cos(hm); y += Math.sin(hm); h += k[i]!; }
    // what the easing leaves open at the end is closed by a small shift spread along the run
    const ex = x - spec.start.x, ey = y - spec.start.y; for (const p of pts) { const f = p.s / N; p.x -= ex * f; p.y -= ey * f; }
    this.nodes = pts; this.length = N; }
  /** the centre line at distance s (wraps) */
  at(s: number): Node { const L = this.length, t = ((s % L) + L) % L, i = Math.floor(t), f = t - i, a = this.nodes[i]!, b = this.nodes[(i + 1) % L]!;
    return { s: t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: a.h + (b.h - a.h) * f, k: a.k + (b.k - a.k) * f }; }
  /** the nearest point of the centre line to (x, y): its s and the lateral offset; `hint` (the last s) makes it a local search */
  locate(x: number, y: number, hint?: number): { s: number; off: number } {
    const L = this.length; let best = 0, bd = Infinity; const scan = (i0: number, i1: number) => { for (let i = i0; i <= i1; i++) { const n = this.nodes[((i % L) + L) % L]!, d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = ((i % L) + L) % L; } } };
    if (hint === undefined) scan(0, L - 1); else scan(Math.floor(hint) - 60, Math.floor(hint) + 60);
    // refine on the segment either side
    let s = best, off = 0; for (const j of [best - 1, best]) { const a = this.nodes[((j % L) + L) % L]!, b = this.nodes[(j + 1 + L) % L]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
      const px = a.x + dx * t, py = a.y + dy * t, d = (px - x) ** 2 + (py - y) ** 2; if (d <= bd + 1e-9) { bd = d; s = (((j + t) % L) + L) % L; off = (dx * (y - a.y) - dy * (x - a.x)) / Math.sqrt(l2); } }
    return { s, off }; }
  /** how much of the banking stands at s, 0..1, and which */
  bankAt(s: number): { b: Banking | null; f: number } { const L = this.length, t = ((s % L) + L) % L;
    for (const b of this.spec.banking) { if (t < b.s0 - b.ease || t > b.s1 + b.ease) continue; return { b, f: t < b.s0 ? smooth((t - b.s0 + b.ease) / b.ease) : t > b.s1 ? smooth((b.s1 + b.ease - t) / b.ease) : 1 }; }
    return { b: null, f: 0 }; }
  /** the surface's height at (s, off): the banking's rise from the inner edge, the bumps across */
  height(s: number, off: number): number { const W = this.spec.width, { b, f } = this.bankAt(s); let z = 0;
    if (b && f > 0) { const inLeft = this.at(s).k >= 0, u = Math.max(0, Math.min(W, (inLeft ? -off : off) + W / 2)); z = b.height * f * (u / W) ** b.curve; }
    const L = this.length, t = ((s % L) + L) % L;
    for (const q of this.spec.bumps) { let d = Math.abs(t - q.s); d = Math.min(d, L - d); if (d < q.len / 2) z += q.height * (1 + Math.cos(d / (q.len / 2) * Math.PI)) / 2; }
    return z; }
  /** the surface's slope across the track (rise per metre to the left) and along it, at (s, off) */
  slope(s: number, off: number): { across: number; along: number } { const e = 0.25;
    return { across: (this.height(s, off + e) - this.height(s, off - e)) / (2 * e), along: (this.height(s + e, off) - this.height(s - e, off)) / (2 * e) }; }
  /** a point at (s, off) in the world */
  point(s: number, off: number): { x: number; y: number; z: number } { const n = this.at(s); return { x: n.x - Math.sin(n.h) * off, y: n.y + Math.cos(n.h) * off, z: this.height(s, off) }; }
  /** the piece a distance falls in, by name */
  pieceAt(s: number): string { let acc = 0; const t = ((s % this.length) + this.length) % this.length;
    for (const p of this.spec.pieces) { acc += p.kind === 'straight' ? p.len : Math.abs(p.radius * p.turn * Math.PI / 180); if (t < acc) return p.name; } return this.spec.pieces[0]!.name; }
}
