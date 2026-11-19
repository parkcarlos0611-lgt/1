// Text variety (system design 00). A piece of text = a situation x a layout x one sentence part per element x the
// speaker's voice, with facts from the game filled in. Recently used parts are avoided, so the same event does not
// read the same twice. All wording lives in data/text; nothing here knows what an inquiry or an article says.
import type { Rng } from './rng';

export interface Voice { formal?: 'high' | 'mid' | 'low'; mood?: string; job?: string }
export interface PartData { t: string; formal?: 'high' | 'mid' | 'low'; situation?: string | string[]; job?: string | string[]; mood?: string | string[]; weight?: number }
export interface TextSet { situations: { id: string; weight?: number; when?: Record<string, string | number | boolean>; notJob?: string[] }[]; layouts: string[][]; parts: Record<string, PartData[]>; words?: Record<string, string[]> }
/** ids of parts used lately, per text kind */
export type TextMemory = Record<string, string[]>;
export interface Composed { text: string; situation: string; layout: number; used: string[] }

const has = (want: string | string[] | undefined, v: string | undefined) => want == null || (Array.isArray(want) ? want.includes(v ?? '') : want === v);
function pickW<T>(rng: Rng, items: T[], w: (x: T) => number): T { let t = rng.float() * items.reduce((s, i) => s + w(i), 0); for (const i of items) { t -= w(i); if (t <= 0) return i; } return items[items.length - 1]!; }
/** Korean particles follow the last sound of the word before them: {name:은/는} -> 은 after a final consonant, 는 after a vowel */
function josa(word: string, pair: string): string { const [a, b] = pair.split('/') as [string, string], ch = word.charCodeAt(word.length - 1), ro = a === '으로';
  if (ch < 0xac00 || ch > 0xd7a3) { const closed = /[013678lmnrLMNR]$/.test(word); return ro ? (closed && !/[lLrR1]$/.test(word) ? a : b) : closed ? a : b; }
  const jong = (ch - 0xac00) % 28; return ro ? (jong === 0 || jong === 8 ? b : a) : jong ? a : b; }

export function compose(rng: Rng, kind: string, set: TextSet, facts: Record<string, string | number>, voice: Voice, memory: TextMemory, opt: { situation?: string; ctx?: Record<string, string | number | boolean> } = {}): Composed {
  const recent = (memory[kind] ??= []), ctx = opt.ctx ?? {};
  // a situation tied to the facts of the case (how the customer heard of us) wins over the general ones
  const ok = set.situations.filter(s => !(s.notJob ?? []).includes(voice.job ?? '')), tied = ok.filter(s => s.when && Object.entries(s.when).every(([k, v]) => ctx[k] === v)), free = ok.filter(s => !s.when);
  const sits = opt.situation ? set.situations.filter(s => s.id === opt.situation) : tied.length && rng.float() < 0.7 ? tied : free.length ? free : ok;
  const sit = pickW(rng, sits.length ? sits : set.situations, s => (s.weight ?? 1) * (recent.includes('s:' + s.id) ? 0.3 : 1));
  const li = pickW(rng, set.layouts.map((_, i) => i), i => (recent.includes('l:' + i) ? 0.3 : 1)), used = ['s:' + sit.id, 'l:' + li], out: string[] = [];
  for (const el of set.layouts[li]!) { const all = set.parts[el] ?? [], fit = all.map((p, i) => ({ p, id: el + ':' + i })).filter(({ p }) => has(p.situation, sit.id) && has(p.job, voice.job) && has(p.mood, voice.mood) && (p.formal == null || p.formal === (voice.formal ?? 'mid')));
    if (!fit.length) continue; const fresh = fit.filter(f => !recent.includes(f.id)), c = pickW(rng, fresh.length ? fresh : fit, f => (f.p.weight ?? 1) * (f.p.situation || f.p.job ? 2.5 : 1));   // lines written for this very case come up more often
    used.push(c.id); out.push(c.p.t); }
  let text = out.join(' ');
  // {=list} picks a word from a word list; {fact} fills in a fact; {fact:은는} adds the particle that fits the fact
  text = text.replace(/\{=(\w+)\}/g, (_, k: string) => { const w = set.words?.[k]; return w?.length ? w[rng.int(0, w.length - 1)]! : ''; });
  text = text.replace(/\{(\w+)(?::([^}]+))?\}/g, (m, k: string, j?: string) => { const v = facts[k]; if (v == null) return m; const s = String(v); return j ? s + josa(s, j) : s; });
  recent.push(...used); const keep = Math.max(12, Math.floor(Object.values(set.parts).reduce((n, p) => n + p.length, 0) * 0.35)); if (recent.length > keep) recent.splice(0, recent.length - keep);
  return { text, situation: sit.id, layout: li, used };
}
/** placeholders left unfilled in a composed text (for the automatic check) */
export const unfilled = (text: string): string[] => text.match(/\{[^}]*\}/g) ?? [];
