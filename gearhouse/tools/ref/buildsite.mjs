// Build a page as several files (review 124): the page, its script, and its pictures beside it, so no one file nears the
// artifact host's limit (16 MB a page or text file, 15 MB a binary; up to 256 MB a version) and big textures load as
// they are needed. node tools/ref/buildsite.mjs <entry ts> <page template html> <out dir> [page name=index.html] [extra dir to copy as 'tex']
// Prints the files written (paths relative to the out dir), one per line after the summary.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const [entry, tpl, out, page = 'index.html', extra] = process.argv.slice(2);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
await build({ entryPoints: { app: entry }, bundle: true, minify: true, charset: 'utf8', format: 'iife', target: 'es2020', outdir: out, assetNames: 'assets/[name]-[hash]', publicPath: '', loader: { '.json': 'json', '.png': 'file', '.jpg': 'file', '.gltf': 'json', '.bin': 'dataurl' }   /* the host serves no .bin files: the models' buffers go inside the script */ });
const html = readFileSync(tpl, 'utf8'), tag = /<script>\s*\/\*BUNDLE\*\/\s*<\/script>/;
if (!tag.test(html)) throw new Error('the template has no <script>/*BUNDLE*/</script>');
writeFileSync(join(out, page), '<meta charset="utf-8">\n' + html.replace(tag, '<script src="app.js" charset="utf-8"></script>'));
if (extra) { const walk = (d, to) => { mkdirSync(to, { recursive: true }); for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, join(to, f)); else copyFileSync(p, join(to, f)); } }; walk(extra, join(out, 'tex')); }
const files = []; const list = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) list(p); else files.push(relative(out, p)); } }; list(out);
let total = 0; for (const f of files) total += statSync(join(out, f)).size;
console.log(`${out}: ${files.length} files, ${(total / 1048576).toFixed(1)} MB, largest ${(Math.max(...files.map(f => statSync(join(out, f)).size)) / 1048576).toFixed(1)} MB`); for (const f of files) console.log(f);
