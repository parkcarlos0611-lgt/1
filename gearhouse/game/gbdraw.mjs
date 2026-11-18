// gearbox section drawing, built up step by step like the engine (plan 21-1):
// 1 TYPE: case, shafts, bearings (and the fluid coupling / torque converter / planet sets of the automatics)
// 2 GEARS: constant-mesh pair, a gear pair per ratio, reverse idler, synchro hubs or dog collars, forks and rails
// 3 RELEASE: shift lever, oil, the gear in use lit up and the power path through it
// Side elevation, cut along the shafts; gears seen edge-on, teeth run along the rims at the shaft's speed.
import { Draw, S_ } from './engdraw.mjs';
import { GEARBOX } from '../sim/drive.mjs';
import { lang } from './ui.mjs';

export const GB_STEPS = ['TYPE', 'GEARS AND RATIOS', 'TEST AND RELEASE'];
const DC = 110, A_CM = 1.55;                       // shaft centre distance (mm) and constant-mesh step-down
const AUTO = t => t === 'hydra4' || t === 'tc2';
// pitch radii of a pair giving ratio r through the countershaft: mainshaft gear rm, counter gear rc
function pairR(r) { const q = r / A_CM, rc = DC / (1 + q); return { rm: DC - rc, rc }; }

export function gearboxGeo(d) {
  const G = GEARBOX[d.type] || GEARBOX.crash3, ratios = d.ratios || [], fwd = ratios.filter(r => Math.abs(r - 1) > 0.015), pairs = fwd.length + 1;   // + reverse
  const front = AUTO(d.type) ? 150 : d.type === 'fluid' ? 120 : 60, fw = 30, gap = 18, len = front + 70 + pairs * (fw + gap) + 120;
  return { G, ratios, fwd, pairs, front, fw, gap, len, zm: 222, zc: 222 - DC, H: 400, x0: front + 40 };
}

// gear seen edge-on: a slab with tooth notches on the top and bottom rims that travel with the shaft
function gearEdge(D, x, zc, r, fw, ramp, ang, name, lit) {
  const k = D.k, pitchPx = 3, ph = ((Math.floor(ang * r * k) % pitchPx) + pitchPx) % pitchPx;
  return D.rect(x - fw / 2, zc - r - 5, x + fw / 2, zc + r + 5, lit ? 'brass' : ramp, (px, py, u, v) => {
    const rim = v < 0.07 || v > 0.93; if (rim && ((px + (v < 0.5 ? ph : -ph) + 300) % pitchPx === 0)) return -9;
    return Math.max(0, Math.min(4, Math.round((v < 0.3 ? 2.6 + v * 4 : 4 - (v - 0.3) * 3.4) - ((px + py) % 2) * 0.4)));
  }, name);
}

export function drawGearboxPix(P, d, ang, w, h, step = 3, engaged = -1) {
  const g = gearboxGeo(d), k = Math.min((w - 6) / g.len, (h - 6) / g.H), D = new Draw(P, w, h, k, (w - g.len * k) / 2, h - 3 - (h - 6 - g.H * k) / 2);
  const caseR = d.type === 'crash3' || d.type === 'sync3' ? 'iron' : 'alu', x1 = g.len - 40, sp = g.fw + g.gap, ratio = engaged >= 0 ? g.ratios[engaged] ?? 1 : 1;
  const aIn = ang, aCs = ang / A_CM, aOut = engaged >= 0 ? ang / ratio : 0;
  // --- step 1: case, bell flange, shafts and bearings ---
  D.poly([[20, 40], [60, 20], [g.x0 - 20, 30], [x1, 60], [x1, 300], [g.x0 - 20, 330], [60, 340], [20, 320]], caseR, S_.cast(2.4), 'GEARBOX CASE');
  D.poly([[30, 52], [64, 36], [g.x0 - 24, 46], [x1 - 12, 72], [x1 - 12, 288], [g.x0 - 24, 316], [64, 324], [30, 308]], 'black', () => 0, 'GEARBOX CASE');
  D.rect(10, 20, 30, 340, caseR, S_.flat(2), 'BELL HOUSING FLANGE');
  if (step >= 3) D.poly([[34, 60], [x1 - 14, 76], [x1 - 14, g.zc - 34], [34, g.zc - 34]], 'eng.oil', S_.liquid(), 'GEAR OIL');
  if (AUTO(d.type)) {                                   // fluid coupling or converter up front, planet sets behind
    D.circ(g.front / 2 + 20, g.zm, 92, 'iron', S_.ball(), d.type === 'tc2' ? 'TORQUE CONVERTER' : 'FLUID COUPLING'); D.rect(g.front / 2 + 16, g.zm - 92, g.front / 2 + 24, g.zm + 92, 'eng.oil', S_.flat(2), d.type === 'tc2' ? 'STATOR' : 'FLUID COUPLING');
  } else if (d.type === 'fluid') { D.circ(g.front / 2 + 20, g.zm, 80, 'iron', S_.ball(), 'FLUID CLUTCH'); }
  D.rect(-10, g.zm - 9, x1 + 60, g.zm + 9, 'chrome', S_.cylH(), 'MAIN SHAFT'); D.rect(g.x0 - 20, g.zc - 8, x1 - 20, g.zc + 8, 'chrome', S_.cylH(), 'COUNTERSHAFT');
  for (const [x, z, n] of [[g.x0 - 14, g.zm, 'INPUT BEARING'], [x1 - 6, g.zm, 'REAR BEARING'], [g.x0 - 14, g.zc, 'COUNTERSHAFT BEARING'], [x1 - 24, g.zc, 'COUNTERSHAFT BEARING']]) D.rect(x - 9, z - 22, x + 9, z + 22, 'iron', S_.cylV(), n);
  D.rect(x1 + 6, g.zm - 22, x1 + 50, g.zm + 22, caseR, S_.cylH(), 'TAIL HOUSING'); D.rect(x1 + 50, g.zm - 30, x1 + 58, g.zm + 30, 'iron', S_.flat(2), 'OUTPUT FLANGE');
  if (step < 2) { D.outline(); return D; }
  // --- step 2: gears ---
  if (AUTO(d.type)) {                                                                    // automatics: planetary sets with bands, no sliding gears
    const n = d.type === 'tc2' ? 1 : 2; for (let i = 0; i < n; i++) { const x = g.x0 + 40 + i * 110; D.rect(x - 34, g.zm - 70, x + 34, g.zm + 70, 'iron', S_.cylV(), 'PLANET SET'); D.rect(x - 26, g.zm - 44, x + 26, g.zm + 44, engaged >= 0 && (engaged === i || (n === 1 && engaged === 0)) ? 'brass' : 'chrome', S_.cylV(), 'PLANET GEARS'); D.rect(x - 38, g.zm + 70, x + 38, g.zm + 82, 'black', S_.flat(2), 'BRAKE BAND'); }
    D.rect(g.x0 + 260, g.zm - 60, g.x0 + 330, g.zm + 60, 'alu', S_.cast(2), 'VALVE BODY'); D.outline(); return D; }
  let x = g.x0 + 4; const cm = pairR(A_CM * 1);                                           // constant-mesh pair drives the countershaft
  gearEdge(D, x, g.zm, cm.rm, g.fw, 'chrome', aIn, 'CONSTANT MESH GEAR', engaged >= 0); gearEdge(D, x, g.zc, cm.rc, g.fw, 'chrome', aCs, 'COUNTERSHAFT GEAR', engaged >= 0);
  const order = g.fwd.map((r, i) => [r, g.ratios.indexOf(r)]).sort((a, b) => a[0] - b[0]);            // tall gears near the front, first gear at the back
  const sync = d.type !== 'crash3';
  order.forEach(([r, gi], j) => { x += sp; const p = pairR(r), lit = gi === engaged;
    gearEdge(D, x, g.zm, p.rm, g.fw, 'chrome', aCs * (p.rc / p.rm), (lang.ko ? (gi + 1) + '단 기어' : (gi + 1) + ' GEAR'), lit); gearEdge(D, x, g.zc, p.rc, g.fw, 'chrome', aCs, 'COUNTERSHAFT GEAR', lit);
    if (j % 2 === 0) { const hx = x - g.fw / 2 - g.gap / 2; D.rect(hx - 8, g.zm - 30, hx + 8, g.zm + 30, sync ? 'brass' : 'iron', S_.cylV(), sync ? 'SYNCHRO HUB' : 'DOG COLLAR');
      D.bar(hx, g.zm + 30, hx, 286, 3, 3, 'iron', S_.flat(2), 'SHIFT FORK'); } });
  x += sp; const rv = pairR(3.4); gearEdge(D, x, g.zm, rv.rm, g.fw, 'iron', engaged === -2 ? -aCs : 0, 'REVERSE GEAR', engaged === -2); gearEdge(D, x, g.zc, rv.rc, g.fw, 'iron', aCs, 'COUNTERSHAFT GEAR', engaged === -2);
  D.circ(x, g.zc - rv.rc - 18, 14, 'iron', S_.ball(), 'REVERSE IDLER');
  D.rect(g.x0 - 20, 282, x1 - 10, 290, 'chrome', S_.cylH(), 'SHIFT RAIL');
  if (step >= 3) { const lx = g.x0 + (x1 - g.x0) * 0.55, lean = engaged < 0 ? 0 : ((engaged % 2) ? 1 : -1) * 18; D.rect(lx - 30, 300, lx + 30, 318, caseR, S_.cast(2), 'SHIFT TOWER'); D.bar(lx, 318, lx + lean, 384, 5, 4, 'chrome', S_.cylV(), 'GEAR LEVER'); D.circ(lx + lean, 388, 12, 'black', S_.ball(), 'GEAR KNOB'); }
  D.outline(); return D;
}
