// Bundle the test-drive page (ui/testtrack.ts) into one HTML file with everything inline.
// node tools/ref/buildtrack.mjs <page template html> <out html>
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const [tpl, out] = process.argv.slice(2);
const r = await build({ entryPoints: ['ui/testtrack.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, loader: { '.json': 'json' } });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
writeFileSync(out, readFileSync(tpl, 'utf8').replace('/*BUNDLE*/', () => js)); console.log(out, Math.round(js.length / 1024), 'KB of script');
