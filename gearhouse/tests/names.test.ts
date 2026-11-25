// No real maker, model or engine maker on a screen (core/names.ts): the name tables, the texts the screens show, and the
// string literals of the game's screens' sources (comments and code left out) hold none of the banned names, nor the
// old "959" as a shown number.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BANNED, BODY_NAME, CAR_599, MAKE_LATIN, bannedIn } from '../core/names';
import { CHANGES } from '../core/version';
import { TIPS } from '../ui/shell/tips';
import { stockP959 } from '../core/bodies';
import { fromPreset } from '../core/designstore';
import { BODY_BASES, DESIGN_NSX, DESIGN_F355, DESIGN_EB110, DESIGN_P959, DESIGN_DIABLO, DESIGN_XJ220, DESIGN_MCLAREN_F1 } from '../core/design';
import { oneMakeField, PAINTS_1980S } from '../race/onemake';
import { TECH_YEAR } from '../core/engines';

const OLD_NUMBER = /(^|[^0-9A-Za-z_])959(?![0-9])/;
const clean = (t: string) => { const b = bannedIn(t); return OLD_NUMBER.test(t) ? [...b, '959'] : b; };

/** the string literals of a TypeScript source: what is between quotes or backticks (a template's text and its
 *  placeholders' strings), with the comments and the code left out */
function literals(src: string): string[] {
  const out: string[] = []; let i = 0;
  const str = (q: string): string => { let s = ''; i++;
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1] ?? ''; i += 2; continue; }
      if (q === '`' && src[i] === '$' && src[i + 1] === '{') { i += 2; let depth = 1; const start = i;
        while (i < src.length && depth) { const c = src[i]!; if (c === '{') depth++; else if (c === '}') depth--; else if (c === "'" || c === '"' || c === '`') { out.push(str(c)); continue; } if (depth) i++; }
        void start; i++; s += ' '; continue; }
      s += src[i]; i++; }
    i++; return s; };
  while (i < src.length) { const c = src[i]!, d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    // a regular expression literal after an operator or a bracket: skipped whole (a quote inside it is not a string)
    if (c === '/' && /[(,=:[!&|?{};]\s*$/.test(src.slice(Math.max(0, i - 3), i))) { i++; while (i < src.length && src[i] !== '/' && src[i] !== '\n') { if (src[i] === '\\') i++; if (src[i] === '[') { while (i < src.length && src[i] !== ']') i++; } i++; } i++; continue; }
    if (c === "'" || c === '"' || c === '`') { out.push(str(c)); continue; }
    i++; }
  return out; }

const ROOT = join(__dirname, '..');
/** the sources of the game's screens and the texts they show */
const SOURCES = [...readdirSync(join(ROOT, 'ui/shell')).filter(f => f.endsWith('.ts')).map(f => `ui/shell/${f}`), ...readdirSync(join(ROOT, 'ui/kit')).filter(f => f.endsWith('.ts')).map(f => `ui/kit/${f}`),
  'ui/builder3d.ts', 'ui/builder_tier.ts', 'ui/builder_classpick.ts', 'race/tiers.ts', 'core/version.ts', 'core/bodies.ts', 'core/engines.ts', 'race/fit.ts', 'race/onemake.ts'];
const PAGES = ['ui/shell/game.page.html', 'ui/builder3d.page.html', 'ui/drive.page.html'];

describe('no real brand on a screen', () => {
  it('the check finds the banned names, whole words in their own case, and leaves the ids alone', () => {
    expect(bannedIn('포르쉐 959')).toEqual(['포르쉐']); expect(bannedIn('NSX 바탕')).toEqual(['NSX']); expect(bannedIn("'nsx' 'f355' DESIGN_NSX")).toEqual([]);
    expect(bannedIn('Alfa  Romeo')).toEqual(['Alfa Romeo']); expect(clean('959 원메이크')).toEqual(['959']); expect(clean("'p959' p959stock")).toEqual([]);
    expect(BANNED.length).toBeGreaterThan(40);
  });
  it('the bodies, the 599 and the presets are named in the game\'s own names', () => {
    expect(CAR_599).toBe('포스터 599'); expect(MAKE_LATIN).toBe('Phorster');
    for (const b of BODY_BASES) { expect(BODY_NAME[b]).toBeTruthy(); expect(clean(BODY_NAME[b])).toEqual([]); expect(clean(fromPreset(b).name)).toEqual([]); }
    for (const d of [DESIGN_NSX, DESIGN_F355, DESIGN_EB110, DESIGN_P959, DESIGN_DIABLO, DESIGN_XJ220, DESIGN_MCLAREN_F1]) expect(clean(d.name)).toEqual([]);
    expect(stockP959().name).toBe(CAR_599); expect(stockP959().id).toBe('p959stock');   // the id kept: its runs are stored under it
  });
  it('the about screen\'s changes, the loading tips, the technologies and the race field', () => {
    for (const t of [...CHANGES, ...TIPS, ...Object.values(TECH_YEAR).map(t => t.name), ...PAINTS_1980S.map(p => p.name)]) expect(clean(t), t).toEqual([]);
    for (const c of oneMakeField(7, 12345)) { expect(clean(c.design.name)).toEqual([]); expect(c.design.name.startsWith('599 ')).toBe(true); }
  });
  it('the string literals of the game\'s screens and their pages', () => {
    const found: string[] = [];
    for (const f of SOURCES) for (const s of literals(readFileSync(join(ROOT, f), 'utf8'))) { const b = clean(s); if (b.length) found.push(`${f}: ${b.join(', ')} in "${s.slice(0, 80)}"`); }
    for (const f of PAGES) { const text = readFileSync(join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); const b = bannedIn(text); if (b.length) found.push(`${f}: ${b.join(', ')}`); }
    expect(found).toEqual([]);
  });
});
