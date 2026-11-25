// The 959's drawn lines (docs/systems/109 §5.2): panel gaps, shut lines, glass edges, lamp rims and creases as
// polylines on the surface, both sides.
import type { Shell959, ShellLine } from './shell';
import type { V } from './subdiv';
import { STYLE } from '../../live/style';

/** panel lines (the gaps between panels: door, bonnet, lid, bumper, sill) are drawn a step thinner than the character
 *  lines (lamp rims, glass edges, creases, vents, trim): their width against the style's line width */
const PANEL = new Set(['door', 'bonnet', 'boot', 'bumper', 'panel']);
export const lineClass = (kind: string): 'panel' | 'character' => PANEL.has(kind) ? 'panel' : 'character';

export function p959Lines(S: Shell959): ShellLine[] { const out: ShellLine[] = [];
  for (const l0 of S.lines) { const l = lineClass(l0.kind) === 'panel' ? { ...l0, w: (l0.w ?? 1) * STYLE.panelPx / STYLE.linePx } : l0; out.push(l); const onCentre = l.pts.every(p => Math.abs(p[1]) < 1e-6); if (onCentre) continue;
    const m = l.pts.map(p => [p[0], -p[1], p[2]] as V);
    // a line that starts or ends on the centre line carries on into its mirror image as one line
    out.push({ ...l, name: l.name + 'R', pts: m }); }
  return out; }
