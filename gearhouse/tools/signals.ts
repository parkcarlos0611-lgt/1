// Which signals the systems send, and who listens (plan 12, 3-4). A signal nobody hears is a loose end:
// the test keeps a list of the known ones, so a new one is noticed.
// npx tsx tools/signals.ts
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function signals(dirs = ['core', 'ui']): { sent: Record<string, string[]>; heard: Record<string, string[]>; unheard: string[] } { const root = fileURLToPath(new URL('..', import.meta.url)), sent: Record<string, string[]> = {}, heard: Record<string, string[]> = {};
  for (const dir of dirs) for (const f of readdirSync(root + dir).filter(x => x.endsWith('.ts'))) { const src = readFileSync(`${root}${dir}/${f}`, 'utf8'), name = `${dir}/${f}`;
    for (const m of src.matchAll(/\bemit\('(\w+)'/g)) (sent[m[1]!] ??= []).includes(name) || sent[m[1]!]!.push(name);
    for (const m of src.matchAll(/\bon\('(\w+)'/g)) (heard[m[1]!] ??= []).includes(name) || heard[m[1]!]!.push(name); }
  return { sent, heard, unheard: Object.keys(sent).filter(k => !heard[k]).sort() }; }
if (process.argv[1]?.endsWith('signals.ts')) { const s = signals(); for (const k of Object.keys(s.sent).sort()) console.log(`${k.padEnd(26)} ${s.sent[k]!.join(', ').padEnd(34)} -> ${s.heard[k]?.join(', ') ?? '(nobody)'}`); console.log(`\n${Object.keys(s.sent).length} signals, ${s.unheard.length} unheard`); }
