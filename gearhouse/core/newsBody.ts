// Article bodies (review 09): the facts of the topic x one of ten frames for the item's importance x the voice of
// the reporter who writes it. A body is not stored: it is written again from the item's seed whenever it is read,
// and always comes out the same.
import { Rng } from './rng';
import { fill, tierOf, type FictionData, type NewsItem, type Relation, type Slant, type Tier } from './news';

export interface Voice { id: string; label: string; beats: Relation[]; slants: Slant[]; style?: 'archaic' | 'terse'; /** importance this voice writes: [from, to] */ importance: [number, number]; /** turns of phrase this voice puts in place of the plain ones */ swaps?: [string, string][]; vo: string[]; va: string[]; vc: string[] }
export interface BodyData { frames: Record<string, string[][]>; X: Record<Relation, Record<Slant, string[]>>; O: Record<Slant, string[]>; P: Record<Slant, string[]>; Q: string[]; words: Record<string, string[]>;
  topics: Record<string, { speakers: string[]; say: string[] } & Record<Tier, { L: string[]; D: string[]; N: string[] }>>; voices: Voice[] }
export interface Body { sentences: string[]; text: string; voice: string; frame: number }

export function writeBody(item: NewsItem, data: BodyData, fiction: FictionData, town: string): Body | null {
  const T = data.topics[item.id]; if (!T || item.origin !== 'fictional' || item.importance == null || item.seed == null) return null;
  const rng = new Rng(item.seed), imp = item.importance, facts = T[tierOf(imp)], slant = item.slant ?? 'neutral', voice = data.voices.find(v => v.id === item.voice) ?? data.voices[0]!;
  const frames = data.frames[String(imp)]!, fi = rng.int(0, frames.length - 1); let frame = frames[fi]!;
  if (voice.style === 'terse') { const core = frame.filter(e => e === 'L' || e === 'D' || e === 'N').slice(0, imp <= 2 ? 1 : 3); frame = rng.float() < 0.4 ? [...core, 'va'] : core; }   // the hurried hand writes the least
  else if (imp >= 2 && !frame.some(e => e === 'vo' || e === 'va' || e === 'vc') && voice.va.length + voice.vc.length > 0) frame = [...frame, voice.va.length && rng.float() < 0.6 ? 'va' : voice.vc.length ? 'vc' : 'va'];   // every voice leaves its mark
  const words = { ...fiction.words, ...data.words, speaker: T.speakers, say: T.say }, bound: Record<string, string> = { ...(item.slots ?? {}) }, slots = { ...(item.slots ?? {}), town };
  const left: Record<string, string[]> = { L: [...facts.L], D: [...facts.D], N: [...facts.N], X: [...data.X[item.relation][slant]], O: [...data.O[slant]], P: [...data.P[slant]], Q: [...data.Q], vo: [...voice.vo], va: [...voice.va], vc: [...voice.vc] };
  const out: string[] = [];
  for (const el of frame) { const pool = left[el]; if (!pool?.length) continue; const pat = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;   // no sentence twice in one article
    if (el === 'Q') { delete bound.speaker; delete bound.say; }                                                                      // a second quotation is another speaker
    out.push(fill(rng, pat, words, slots, imp, bound, slant)); }
  if (item.slots?.before && item.slots.beforeHeadline) out.splice(Math.min(2, out.length), 0, `본지가 ${item.slots.before} "${item.slots.beforeHeadline.split(/[…—(\[]/)[0]!.trim()}"라고 전한 데 이은 일이다.`);   // the paper remembers
  if (item.quirk?.short && out.length > 3) out.splice(out.length - 2, 1); if (item.quirk?.word && out.length > 1) out[1] = `${item.quirk.word} ${out[1]}`;
  let sentences = out;
  if (voice.swaps) sentences = sentences.map(x => (x.includes('"') ? x : voice.swaps!.reduce((t, [from, to]) => (t.endsWith(from) ? t.slice(0, -from.length) + to : t), x)));
  if (voice.style === 'archaic') sentences = sentences.map(s => s.replace(/했다\./g, '하였다.').replace(/됐다\./g, '되었다.').replace(/났다\./g, '났더라.'));
  return { sentences, text: sentences.join(' '), voice: voice.id, frame: fi };
}
