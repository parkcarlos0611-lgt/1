// npx tsx tools/ref/mirror.ts <left side json> <out json>: the right side of a car from its left side (render/car/mirror.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { mirrorSide } from '../../render/car/mirror';
writeFileSync(process.argv[3]!, JSON.stringify(mirrorSide(JSON.parse(readFileSync(process.argv[2]!, 'utf8'))), null, 0)); console.log(process.argv[3]);
