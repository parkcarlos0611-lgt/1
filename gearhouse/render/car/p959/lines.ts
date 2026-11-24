// The 959's drawn lines (docs/systems/109 §5.2): panel gaps, shut lines, glass edges, lamp rims and creases as
// polylines on the surface, both sides.
import type { Shell959, ShellLine } from './shell';
import type { V } from './subdiv';

export function p959Lines(S: Shell959): ShellLine[] { const out: ShellLine[] = [];
  for (const l of S.lines) { out.push(l); const onCentre = l.pts.every(p => Math.abs(p[1]) < 1e-6); if (onCentre) continue;
    const m = l.pts.map(p => [p[0], -p[1], p[2]] as V);
    // a line that starts or ends on the centre line carries on into its mirror image as one line
    out.push({ ...l, name: l.name + 'R', pts: m }); }
  return out; }
