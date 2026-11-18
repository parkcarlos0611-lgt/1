// The one random source of the simulation (decisions: no Math.random in core/physics).
// PCG32 (O'Neill): 64-bit state, 32-bit output; same seed, same game.
export class Rng {
  private s: bigint;
  private readonly inc: bigint;
  constructor(seed: number, stream = 54) {
    this.inc = ((BigInt(stream) << 1n) | 1n) & 0xffffffffffffffffn;
    this.s = 0n; this.next(); this.s = (this.s + BigInt(seed >>> 0)) & 0xffffffffffffffffn; this.next();
  }
  /** next 32-bit unsigned integer */
  next(): number {
    const old = this.s;
    this.s = (old * 6364136223846793005n + this.inc) & 0xffffffffffffffffn;
    const xs = Number(((old >> 18n) ^ old) >> 27n & 0xffffffffn) >>> 0, rot = Number(old >> 59n);
    return ((xs >>> rot) | (xs << ((-rot) & 31))) >>> 0;
  }
  /** uniform in [0, 1) */
  float(): number { return this.next() / 4294967296; }
  /** integer in [lo, hi] */
  int(lo: number, hi: number): number { return lo + Math.floor(this.float() * (hi - lo + 1)); }
  /** state for saving */
  save(): string { return this.s.toString(16); }
  load(state: string): void { this.s = BigInt('0x' + state); }
}
