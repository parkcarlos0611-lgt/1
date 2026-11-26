import { describe, expect, it } from 'vitest';
import letter from '../data/text/ko/inquiry_letter.json';
import { Rng } from '../core/rng';
import { compose, unfilled, type TextMemory, type TextSet, type Voice } from '../core/text';

const set = letter as TextSet;
const facts = { founder: '호프만', shop: '호프만 공방', town: '밀브룩', customer: '에드워드 켈러', paper: '밀브룩 쿠리어', friend: '하워드', body: '4인승 세단', must: '접이식 지붕', season: '봄' };
describe('text variety', () => {
  it('fills every fact and fits Korean particles', () => { const r = new Rng(1), m: TextMemory = {};
    for (let i = 0; i < 3000; i++) { const c = compose(r, 'inquiry', set, facts, { formal: (['high', 'mid', 'low'] as const)[i % 3], job: ['doctor', 'farmer', 'banker', 'racer'][i % 4] }, m); expect(unfilled(c.text)).toEqual([]); expect(c.text).not.toMatch(/세단를|세단가 |지붕는|지붕를|봄를|쿠리어을|하워드이 |켈러이라고/); expect(c.text.length).toBeGreaterThan(20); } });
  it('rarely repeats itself', () => { const r = new Rng(2), m: TextMemory = {}, seen = new Map<string, number>(); let sameStart = 0, last = ''; const N = 10000, voices: Voice[] = [{ formal: 'mid', job: 'doctor' }, { formal: 'low', job: 'farmer' }, { formal: 'high', job: 'banker' }, { formal: 'mid', job: 'shopkeeper' }, { formal: 'mid', job: 'heir' }];
    for (let i = 0; i < N; i++) { const c = compose(r, 'inquiry', set, facts, voices[i % voices.length]!, m), first = c.text.split(/[.?]/)[0]!; seen.set(c.text, (seen.get(c.text) ?? 0) + 1); if (first === last) sameStart++; last = first; }
    const repeats = N - seen.size; expect(repeats / N).toBeLessThan(0.02); expect(sameStart / N).toBeLessThan(0.02); expect(seen.size).toBeGreaterThan(9800); });
  it('speaks in the voice of the writer', () => { const r = new Rng(3), m: TextMemory = {}; let low = 0, high = 0;
    for (let i = 0; i < 300; i++) { const LOW = /거두절미|짧게 쓰겠습니다|씨께\.|필요합니다|하나 지어 주십시오|되겠습니까|회답을 기다립니다|이만 줄입니다|마음을 정했습니다|믿음직했습니다|얼마면|못 넘길 듯합니다|되는지 안 되는지/, MIXED = /[가-힣](하오|이오|겠소|았소|었소)[.?]|[^십]시오[.?]|[적않]소[.?]|[가-힣]요\.$/;   /* plain-spoken, yet in one speech level */ const plain = compose(r, 'a', set, facts, { formal: 'low', job: 'farmer' }, m).text; expect(plain).not.toMatch(MIXED); if (LOW.test(plain)) low++; if (LOW.test(compose(r, 'b', set, facts, { formal: 'high', job: 'banker' }, m).text)) high++; }
    expect(low).toBeGreaterThan(200); expect(high).toBeLessThan(low / 3); });
  it('follows the situation it is given', () => { const r = new Rng(4), m: TextMemory = {}; for (let i = 0; i < 200; i++) { const c = compose(r, 'x', set, facts, { formal: 'mid' }, m, { situation: 'saw_ad' }); expect(c.situation).toBe('saw_ad'); expect(c.text).toMatch(/광고|쿠리어|안내란/); }
    let ad = 0; for (let i = 0; i < 400; i++) if (compose(r, 'y', set, facts, { formal: 'mid' }, m, { ctx: { source: 'ad' } }).situation === 'saw_ad') ad++; expect(ad).toBeGreaterThan(220);
    for (let i = 0; i < 300; i++) expect(compose(r, 'z', set, facts, { formal: 'mid', job: 'racer' }, m).situation).not.toBe('family_grew'); });
  it('is the same for the same seed', () => { const run = () => { const r = new Rng(9), m: TextMemory = {}; return Array.from({ length: 50 }, () => compose(r, 'k', set, facts, { formal: 'mid', job: 'lawyer' }, m).text).join('|'); }; expect(run()).toBe(run()); });
});
