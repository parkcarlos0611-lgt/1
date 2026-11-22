import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// A line comment written into the middle of a line swallows the code after it; it has broken a shader and the
// brake keys before (reviews 100, 110). Look for code after a // on the same line.
const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
describe('no code hidden behind a line comment', () => {
  it('in the renderer, the race and the pages', () => {
    const bad: string[] = [], code = /\/\/[^\n]*?[;{}]\s*(uniform |in vec|out vec|float |vec[234] |int |if \(|for \(|const |let |gl\.|this\.|return |[a-zA-Z_.\[\]]+ (=|\+=|-=|\*=) )/;
    for (const f of [...files('render/live'), ...files('race'), 'ui/drive.ts']) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { const at = l.indexOf('//'); if (at < 0 || l.slice(0, at).includes('://')) return; if (code.test(l.slice(at)) && !/^\s*\/\//.test(l)) bad.push(`${f}:${i + 1}`); });
    expect(bad).toEqual([]);
  });
});
