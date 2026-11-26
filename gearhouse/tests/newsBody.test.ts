import { describe, expect, it } from 'vitest';
import { DATA, newWorld } from '../core/world';
import { Rng } from '../core/rng';
import { writeBody } from '../core/newsBody';
import { makeItem } from '../tools/bodySamples';

const F = DATA.fiction, B = DATA.bodies, TOPICS = Object.keys(B.topics);
describe('article bodies', () => {
  it('ten frames for every importance and ten voices', () => { for (let i = 1; i <= 6; i++) expect(B.frames[String(i)]!.length).toBe(10); expect(B.voices.length).toBe(10); for (const rel of ['essential', 'related', 'background', 'unrelated'] as const) for (const sl of ['good', 'bad', 'neutral'] as const) expect(B.X[rel][sl].length, `${rel} ${sl}`).toBeGreaterThanOrEqual(3); });
  it('fills every slot, says what the headline said, and grows with importance', () => { const r = new Rng(5), len: number[][] = [[], [], [], [], [], []];
    for (let k = 0; k < 2400; k++) { const id = TOPICS[Math.floor(k / 6) % TOPICS.length]!, imp = 1 + (k % 6), it = makeItem(r, id, imp, 'figures'), b = writeBody(it, B, F, '밀브룩')!; expect(b.text).not.toMatch(/[{}]/); len[imp - 1]!.push(b.sentences.length);
      for (const key of ['material', 'pct', 'amount', 'crop', 'track', 'shop', 'factory']) if (it.slots![key] && b.text.includes(`${key}`)) throw new Error('unfilled');
      if (id === 'price_up') { expect(b.text).toContain(it.slots!.material!); if (it.slots!.pct) expect(b.text).toContain(it.slots!.pct); } }
    const avg = len.map(a => a.reduce((x, y) => x + y, 0) / a.length); for (let i = 1; i < 6; i++) expect(avg[i]!).toBeGreaterThan(avg[i - 1]!); expect(avg[0]!).toBeLessThan(2.2); expect(avg[5]!).toBeGreaterThan(8); });
  it('is the same whenever it is read, and different across frames and voices', () => { const it0 = makeItem(new Rng(3), 'fire', 4); expect(writeBody(it0, B, F, '밀브룩')!.text).toBe(writeBody(it0, B, F, '밀브룩')!.text);
    const byVoice = new Set(B.voices.map(v => writeBody({ ...it0, voice: v.id }, B, F, '밀브룩')!.text)); expect(byVoice.size).toBeGreaterThanOrEqual(8);
    const bySeed = new Set(Array.from({ length: 300 }, (_, k) => writeBody({ ...it0, seed: k + 1 }, B, F, '밀브룩')!.text)); expect(bySeed.size).toBeGreaterThan(280); });
  it('keeps a voice to what suits it', () => { const r = new Rng(8); for (let k = 0; k < 600; k++) { const it = makeItem(r, 'fire', 1 + (k % 6)); expect(it.voice).not.toBe('booster'); } });
  it('is served by the newspaper for the pilot topics', () => { const w = newWorld(2, { background: 'coachbuilder', age: 31 }); for (let i = 0; i < 400; i++) w.sim.stepDay(); let withBody = 0, without = 0;
    for (const is of w.sim.g.media.issues) is.articles.forEach((a, i) => { const b = w.media.body(is.id, i); if (b) { withBody++; expect(b.text.length).toBeGreaterThan(10); } else without++; }); expect(withBody).toBeGreaterThan(20); expect(without).toBeGreaterThan(0); });
});
