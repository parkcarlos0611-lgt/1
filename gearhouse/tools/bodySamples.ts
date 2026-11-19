// Writes sample article bodies for the planner to read: docs/samples/news_bodies_pilot.md
// npx tsx tools/bodySamples.ts
import { writeFileSync } from 'node:fs';
import { DATA } from '../core/world';
import { Rng } from '../core/rng';
import { fill, tierOf, tailsFor, type NewsItem } from '../core/news';
import { writeBody } from '../core/newsBody';

const F = DATA.fiction, B = DATA.bodies, rng = new Rng(1933);
export function makeItem(r: Rng, topicId: string, importance: number, voice?: string): NewsItem { const t = F.topics.find(x => x.id === topicId)!, pats = t[tierOf(importance)]!, pat = pats[r.int(0, pats.length - 1)]!, tails = tailsFor(F, pat, importance, t.relation), tail = tails[r.int(0, tails.length - 1)]!;
  const facts = { town: '밀브룩', person: 'Howard Keller', supplier: 'Tri-County Auto Supply' }, bound: Record<string, string> = {}, headline = fill(r, pat + tail.t, t.officials ? { ...F.words, official: t.officials } : F.words, facts, importance, bound, t.slant), fit = B.voices.filter(v => v.beats.includes(t.relation) && v.slants.includes(t.slant) && importance >= v.importance[0] && importance <= v.importance[1]);
  return { origin: 'fictional', id: topicId, relation: t.relation, slant: t.slant, importance, headline, weight: importance, slots: { ...bound, ...facts }, seed: r.next(), voice: voice ?? fit[r.int(0, fit.length - 1)]!.id }; }
if (process.argv[1]?.endsWith('bodySamples.ts')) {
  const out: string[] = ['# 기사 본문 시범 (주제 4개)', '', '`tools/bodySamples.ts`가 만든 파일이다. 말투와 시대감을 검수하기 위한 것이고, 고칠 곳을 표시해 주시면 조각 데이터(`data/news/bodies_ko.json`)를 고친다.', ''];
  const label = (id: string) => B.voices.find(v => v.id === id)!.label, KO: Record<string, string> = { essential: '필수', related: '관련', background: '배경', unrelated: '무관', good: '호재', bad: '악재', neutral: '중립' };
  for (const id of Object.keys(B.topics)) { const t = F.topics.find(x => x.id === id)!; out.push(`## 주제: ${id} (${KO[t.relation]}, ${KO[t.slant]})`, '');
    for (const imp of [1, 2, 3, 4, 5, 6]) { const it = makeItem(rng, id, imp), b = writeBody(it, B, F, '밀브룩')!; out.push(`### 중요도 ${imp} · ${label(b.voice)} · ${b.sentences.length}문장`, '', `**${it.headline}**`, '', b.text, ''); } }
  out.push('## 같은 사건, 어투 10가지 (공장 화재, 중요도 4)', ''); const base = makeItem(new Rng(7), 'fire', 4);
  for (const v of B.voices) { const b = writeBody({ ...base, voice: v.id }, B, F, '밀브룩')!; out.push(`- **${v.label}**: ${b.text}`); }
  out.push('', '## 같은 사건, 같은 어투, 짜임 틀만 다르게 (자재 값 인상, 중요도 4, 숫자 좋아하는 경제 기자)', ''); const b2 = makeItem(new Rng(11), 'price_up', 4, 'figures');
  for (let k = 0; k < 6; k++) out.push(`- ${writeBody({ ...b2, seed: 1000 + k }, B, F, '밀브룩')!.text}`);
  writeFileSync('docs/samples/news_bodies_pilot.md', out.join('\n') + '\n'); console.log('wrote docs/samples/news_bodies_pilot.md', out.length, 'lines'); }
