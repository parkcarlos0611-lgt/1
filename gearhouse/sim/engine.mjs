// Engine design + output model (GEARHOUSE). Structure follows the proven family -> variant split of engineering tycoon games;
// formulas / names / coefficients are our own and calibrated on historical engines (see calibrate.mjs).
// Family = block tooling (layout, valvetrain, material, max bore/stroke). Variant = bore, stroke, compression, cam, carburation, quality.

export const LAYOUTS = {        // banks, cylinders, primary/secondary balance score, relative width, year available
  I4: { cyl: 4, banks: 1, smooth: 0.62, year: 1900 }, I6: { cyl: 6, banks: 1, smooth: 0.95, year: 1900 }, I8: { cyl: 8, banks: 1, smooth: 0.97, year: 1920 },
  V8: { cyl: 8, banks: 2, smooth: 0.86, year: 1914 }, V12: { cyl: 12, banks: 2, smooth: 1.0, year: 1915 }, V16: { cyl: 16, banks: 2, smooth: 1.0, year: 1930 },
  F4: { cyl: 4, banks: 2, smooth: 0.8, year: 1934 }, I3: { cyl: 3, banks: 1, smooth: 0.5, year: 1950 }, V6: { cyl: 6, banks: 2, smooth: 0.72, year: 1950 } };
export const HEADS = {          // valvetrain: VE ceiling, base torque-peak rpm, valve-float rpm, cost & engineering factor, deck height add (mm)
  sv:   { name: 'L-head (side valve)', ve: 0.80, pk: 2100, float: 4300, cost: 1.0, eng: 1.0, h: 0, year: 1900 },
  fh:   { name: 'F-head (IOE)',        ve: 0.83, pk: 2300, float: 4600, cost: 1.12, eng: 1.15, h: 60, year: 1905 },
  ohv:  { name: 'OHV pushrod',         ve: 0.87, pk: 2400, float: 5000, cost: 1.15, eng: 1.2, h: 90, year: 1910 },
  sohc: { name: 'SOHC',                ve: 0.90, pk: 2900, float: 6000, cost: 1.4, eng: 1.5, h: 110, year: 1925 },
  dohc: { name: 'DOHC',                ve: 0.94, pk: 3300, float: 7000, cost: 1.8, eng: 1.9, h: 140, year: 1930 } };
export const MATERIALS = { iron: { kg: 1, cost: 1, year: 1900 }, alHead: { kg: 0.92, cost: 1.12, year: 1932 }, alBlock: { kg: 0.72, cost: 1.45, year: 1950 } };
// era fuel quality -> knock-limited compression (L-heads knock earlier)
export const octane = y => y < 1930 ? 58 : y < 1946 ? 60 + (y - 1930) * 0.9 : y < 1960 ? 74 + (y - 1946) * 1.2 : Math.min(98, 91 + (y - 1960) * 0.4);
export const maxCR = (y, head, chamber) => 2.6 + octane(y) * 0.05 + (head === 'sv' ? 0 : 0.6) + (chamber === 'ricardo' ? 0.4 : chamber === 'hemi' ? 0.3 : 0);
// mean piston speed limit (m/s) by era and quality: materials / bearings / lubrication improve over time
export const pistonLimit = (y, q = 0) => 12.5 + Math.max(0, y - 1925) * 0.15 + q * 0.5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- part-level design (stage C). Every option has a year; the first option of each part is neutral, so engines
// designed before the part model (and the calibration set) give exactly the same numbers.
export const PART_GROUPS = [                                          // design flow: the family first (castings), then what a variant may change
  ['family', 'FAMILY: BLOCK AND HEAD', ['layout', 'material', 'maxBore', 'maxStroke', 'mains', 'head', 'chamber']], ['bottom', 'BOTTOM END', ['bore', 'stroke', 'crank', 'rods', 'pistons', 'cwt', 'balancer']],
  ['valve', 'TOP END', ['cr', 'cam', 'springs', 'lifters']], ['fuel', 'FUEL SYSTEM', ['carbType', 'carbs', 'carbSize', 'manifold', 'mixture', 'advance', 'rpmLimit']],
  ['exhaust', 'EXHAUST', ['exhManifold', 'exhaust', 'exhDia', 'muffler']], ['cooling', 'COOLING AND OIL', ['cooling', 'radiator', 'lube', 'oil']]];
export const PART_OPTS = {
  mains: { min: ['MINIMUM BEARINGS', 1900], full: ['FULL-SUPPORT BEARINGS', 1900] },
  chamber: { std: ['STANDARD CHAMBER', 1900], ricardo: ['TURBULENT HEAD', 1922], hemi: ['HEMISPHERICAL', 1930] },
  crank: { cast: ['CAST CRANK', 1900], forged: ['FORGED CRANK', 1900] }, rods: { cast: ['CAST RODS', 1900], forged: ['FORGED RODS', 1900] }, balancer: { none: ['NO DAMPER', 1900], damper: ['HARMONIC DAMPER', 1928] }, cwt: { no: ['NO COUNTERWEIGHTS', 1900], yes: ['COUNTERWEIGHTED', 1925] },
  pistons: { iron: ['CAST-IRON PISTONS', 1900], alu: ['ALUMINIUM PISTONS', 1928] },
  springs: { std: ['STANDARD SPRINGS', 1900], stiff: ['STIFF SPRINGS', 1900], soft: ['SOFT SPRINGS', 1900] }, lifters: { solid: ['SOLID TAPPETS', 1900], hydraulic: ['HYDRAULIC TAPPETS', 1932] },
  carbType: { std: ['UPDRAFT CARBURETTOR', 1900], down: ['DOWNDRAFT CARBURETTOR', 1932], side: ['SIDE-DRAFT CARBURETTOR', 1930] }, manifold: { log: ['LOG MANIFOLD', 1900], dual: ['DUAL-PLANE MANIFOLD', 1935] },
  exhManifold: { log: ['LOG EXHAUST MANIFOLD', 1900], split: ['SPLIT EXHAUST MANIFOLD', 1930] }, exhaust: { single: ['SINGLE EXHAUST', 1900], dual: ['DUAL EXHAUST', 1935] }, muffler: { quiet: ['QUIET MUFFLER', 1900], free: ['FREE-FLOW MUFFLER', 1900] },
  cooling: { pump: ['WATER PUMP', 1900], thermo: ['THERMOSYPHON', 1900] }, lube: { pressure: ['PRESSURE LUBRICATION', 1900], splash: ['SPLASH LUBRICATION', 1900] } };
export const optsFor = (k, year) => Object.keys(PART_OPTS[k] || {}).filter(o => PART_OPTS[k][o][1] <= year);
// group quality: overall q is their mean; each group also acts on its own parts
const gqOf = e => e.gq || null, qOf = e => { const g = gqOf(e); if (!g) return e.quality || 0; const v = Object.values(g); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
const gv = (e, k) => (gqOf(e)?.[k] || 0);
// part factors (neutral = 1 / 0)
export function partFx(e, year) {
  const f = { crAdd: 0, eta: 1, ve: 1, veHi: 0, spAdd: 0, fmep: 1, float: 1, flow: 1, rel: 0, smooth: 0, cost: 0, mass: 0, tool: 1 };
  if (e.chamber === 'ricardo') { f.crAdd += 0.4; f.eta *= 1.03; } if (e.chamber === 'hemi') { f.ve *= 1.04; f.crAdd += 0.3; f.cost += 14; f.tool *= 1.2; }
  if (e.crank === 'forged') { f.spAdd += 0.8; f.rel += 0.02; f.cost += 8; } if (e.cwt === 'yes') { f.smooth += 0.04; f.rel += 0.015; f.cost += 4; f.mass += 4; }
  if (e.mains === 'full') { f.rel += 0.03; f.spAdd += 0.4; f.fmep *= 1.03; f.cost += 6; f.tool *= 1.08; f.mass += 5; }
  if (e.pistons === 'alu') { f.spAdd += 0.6; f.fmep *= 0.97; f.cost += 5; if (year < 1935) f.rel -= 0.01; }
  if (e.springs === 'stiff') { f.float *= 1.08; f.fmep *= 1.02; } if (e.springs === 'soft') { f.float *= 0.92; f.fmep *= 0.99; }
  if (e.lifters === 'hydraulic') { f.float *= 0.96; f.rel += 0.02; f.cost += 10; }
  if (e.carbType === 'std') f.flow *= 0.96; if (e.carbType === 'side') f.flow *= 1.04; if (e.manifold === 'dual') { f.veHi += 0.04; f.cost += 5; }
  if (e.exhManifold === 'split') { f.ve *= 1.015; f.cost += 4; } if (e.exhaust === 'dual') { f.ve *= LAYOUTS[e.layout].banks > 1 ? 1.03 : 1.015; f.cost += 10; f.mass += 6; } if (e.muffler === 'free') f.ve *= 1.02;
  if (e.lube === 'splash') { f.spAdd -= 0.5; f.cost -= 4; } if (e.oil != null) { f.rel += (e.oil - 1) * 0.04; f.mass += (e.oil - 1) * 4; }
  if (e.advance != null) f.eta *= 1 + (e.advance - 0.5) * 0.06;
  if (e.rods === 'forged') { f.spAdd += 0.5; f.cost += 6; } if (e.balancer === 'damper') { f.smooth += 0.03; f.rel += 0.01; f.cost += 5; f.mass += 3; }
  if (e.mixture != null) { const mx = e.mixture - 0.5; f.eta *= 1 - mx * 0.10; f.ve *= 1 + mx * 0.06; f.rel += mx * 0.03; }   // rich: more power, cooler, thirstier; lean: the reverse
  f.exh = e.exhDia ?? 1;
  f.spAdd += gv(e, 'bottom') * 0.3; f.float *= 1 + gv(e, 'valve') * 0.01; f.flow *= 1 + gv(e, 'intake') * 0.01; f.rel += gv(e, 'cooling') * 0.01;
  return f; }
export function displacement(e) { return Math.PI / 4 * (e.bore / 1000) ** 2 * (e.stroke / 1000) * LAYOUTS[e.layout].cyl; }   // m^3

// e = { layout, head, material, bore, stroke, cr, cam (0 touring .. 1 sporty), carbs (count), carbSize (0.5..1.5), quality (-3..3), year }
export function engineCurve(e) {
  const L = LAYOUTS[e.layout], H = HEADS[e.head], D = displacement(e), year = e.year || 1940, q = qOf(e), cam = e.cam ?? 0.3, fx = partFx(e, year);
  const cr = Math.min(e.cr ?? maxCR(year, e.head, e.chamber), maxCR(year, e.head, e.chamber));
  const eta = (1 - Math.pow(cr, -0.3)) * 0.61 * Math.pow(e.stroke / 95, 0.3) * fx.eta;   // long strokes: compact chamber, better L-head combustion (calibrated)                                              // brake-relevant thermal efficiency
  const rp = H.pk * (0.82 + 0.45 * cam) * Math.sqrt(95 / e.stroke);                          // torque-peak rpm
  const flowCap = (e.carbs || 1) * (e.carbSize || 1) * 0.105 * (L.cyl >= 8 ? 1.25 : 1) * Math.min(1.15, 0.75 + 0.012 * Math.max(0, year - 1930)) * fx.flow;   // + era carburettor / manifold know-how       // induction capacity (m^3/s at VE 1)
  const spLim = pistonLimit(year, q) + fx.spAdd, rpmPiston = spLim * 60 / (2 * e.stroke / 1000), rpmFloat = H.float * (0.92 + 0.18 * cam) * fx.float;
  const redline = Math.round(Math.min(rpmFloat, rpmPiston, e.rpmLimit || 1e9) / 50) * 50, mechLimit = Math.round(Math.min(rpmFloat, rpmPiston) / 50) * 50, limitBy = rpmFloat < rpmPiston ? 'VALVE FLOAT' : 'PISTON SPEED';
  const pts = [];
  for (let rpm = 600; rpm <= redline; rpm += 100) {
    let ve = H.ve * fx.ve * (1 + (fx.exh - 1) * 0.09 * (rpm / rp - 1)) * (1 + fx.veHi * Math.max(0, rpm / rp - 1)) * (1 - 0.32 * Math.log(rpm / rp) ** 2) * (1 + q * 0.01) * Math.min(1, 0.84 + 0.01 * Math.max(0, year - 1930));   // era port / manifold know-how
    const need = D * rpm / 120 * ve; if (need > flowCap) ve *= Math.pow(flowCap / need, 0.6);   // carburettor choke
    const air = D * rpm / 120 * ve * 1.18;                                                    // kg/s
    const indicated = air / 12.8 * 44e6 * eta;                                                // W
    const sp = 2 * e.stroke / 1000 * rpm / 60, fmep = (50 + 10 * rpm / 1000 + 0.28 * sp * sp) * 1000 * (1 - q * 0.02) * fx.fmep;
    const friction = fmep * D * rpm / 120;
    const P = Math.max(0, indicated - friction), T = P / (rpm * Math.PI / 30);
    pts.push({ rpm, P, T, hp: P / 745.7 });
  }
  const pk = pts.reduce((a, b) => (b.P > a.P ? b : a)), tk = pts.reduce((a, b) => (b.T > a.T ? b : a));
  return { D, litres: D * 1000, cid: D * 61023.7, cr, redline, mechLimit, rpmFloat, limitBy, spLim, fx, curve: pts, hp: pk.hp, hpRpm: pk.rpm, torque: tk.T, tRpm: tk.rpm, eta };
}

// derived design figures used by the market and the visuals
export function engineStats(e) {
  const c = engineCurve(e), L = LAYOUTS[e.layout], H = HEADS[e.head], M = MATERIALS[e.material || 'iron'], q = qOf(e), year = e.year || 1940, fx = c.fx;
  const perBank = L.cyl / L.banks, pitch = Math.max(e.bore, e.maxBore || 0) + 22 + (L.banks > 1 ? 10 : 0), room = Math.max(0, (e.maxBore || e.bore) - e.bore) + Math.max(0, (e.maxStroke || e.stroke) - e.stroke);   // a family with room to grow is a bigger, heavier casting
  const len = perBank * pitch + (L.banks > 1 ? pitch * 0.5 : 0) + 170;                          // mm, incl. timing cover + bell flange
  const height = Math.max(e.stroke, e.maxStroke || 0) * 2.6 + 260 + H.h + (L.banks > 1 ? 40 : 0), width = L.banks > 1 ? 520 + e.stroke * 1.4 : 330 + e.stroke * 0.6;
  const mass = (40 + c.litres * 48 + L.cyl * 5.5 + H.h * 0.15) * M.kg + fx.mass + room * 0.35;
  const stress = Math.max(c.redline * 2 * e.stroke / 1000 / 60 / pistonLimit(year, q), c.redline / H.float);
  // cooling: specific output against radiator capacity (thermosyphon carries ~80 % of a pump); knock: compression near the limit with advanced spark
  const heat = c.hp / Math.max(0.5, c.litres) / 28, cap = (e.radiator ?? 1) * (e.cooling === 'thermo' ? 0.8 : 1), overheat = Math.max(0, heat / cap - 1);
  const knock = c.cr > maxCR(year, e.head, e.chamber) - 0.6 && (e.advance ?? 0.5) > 0.5 ? (e.advance - 0.5) * 0.15 : 0, splash = e.lube === 'splash' && c.redline * 2 * e.stroke / 60000 > 11 ? 0.06 : 0;
  const reliability = clamp(0.92 - 0.35 * Math.max(0, stress - 0.75) + q * 0.025 - (c.cr > maxCR(year, e.head, e.chamber) - 0.3 ? 0.04 : 0) + fx.rel - overheat * 0.2 - knock - splash, 0.3, 0.99);
  const smooth = clamp(L.smooth + (L.cyl >= 8 ? 0.02 : 0) - (e.stroke / e.bore > 1.35 ? 0.05 : 0) + fx.smooth, 0, 1);
  const gsum = gqOf(e) ? Object.values(gqOf(e)).reduce((a, b) => a + b, 0) : 0;
  const cost = Math.round(((60 + c.litres * 25 + L.cyl * 8) * H.cost * M.cost * (1 + q * 0.06) * (1 + (e.carbs || 1) * 0.04) + fx.cost + (e.radiator ? (e.radiator - 1) * 10 : 0)) * (1 + gsum * 0.004));   // $ per unit (1940 dollars)
  const tooling = Math.round((60000 + L.cyl * 9000) * H.eng * M.cost * fx.tool);                        // family tooling (one-off)
  const engMonths = Math.round((5 + L.cyl * 0.5) * H.eng * (1 + Math.max(0, q) * 0.12));
  const bsfc = 0.0818 / Math.max(0.12, c.eta);                                                  // kg/kWh at best point (3.6 MJ / (eta * 44 MJ/kg))
  // component loading at the red line (1 = at its limit) and the figures an engineer would quote
  const sp = c.redline * 2 * e.stroke / 60000, bars = { CRANKSHAFT: sp / (c.spLim * (e.crank === 'forged' ? 1.08 : 1)) * (L.banks === 1 && L.cyl >= 6 ? 1.04 : 1), 'CONNECTING RODS': (sp / c.spLim) ** 2 * (e.pistons === 'alu' ? 0.94 : 1.04) / (e.rods === 'forged' ? 1.2 : 1), PISTONS: sp / c.spLim, VALVES: c.redline / c.rpmFloat };
  const response = clamp(0.35 + (e.carbs || 1) * 0.08 + (e.cam ?? 0.3) * 0.15 + (e.pistons === 'alu' ? 0.06 : 0) - (e.cwt === 'yes' ? 0.03 : 0) - (e.stroke - 95) * 0.003 + (e.carbType === 'side' ? 0.06 : 0), 0, 1);
  const noise = clamp(0.35 + (e.exhaust === 'dual' ? 0.12 : 0) + (e.muffler === 'free' ? 0.2 : 0) + (e.lifters === 'hydraulic' ? -0.08 : 0.04) + (e.cam ?? 0.3) * 0.12 + (H === HEADS.sv ? -0.05 : 0.03) + ((e.exhDia ?? 1) - 1) * 0.1, 0, 1);
  const octaneReq = Math.round((c.cr - 2.6 - (e.head === 'sv' ? 0 : 0.6) - (e.chamber === 'ricardo' ? 0.4 : e.chamber === 'hemi' ? 0.3 : 0)) / 0.05 + ((e.advance ?? 0.5) - 0.5) * 6 - ((e.mixture ?? 0.5) - 0.5) * 4);
  const coolKW = Math.round(c.hp * 0.7457 * 0.9), service = Math.round(cost * 0.05 * (1 + L.cyl / 12 + (e.carbs || 1) * 0.1 + (e.lifters === 'hydraulic' ? -0.15 : 0.1)));
  return { ...c, len: Math.round(len), height: Math.round(height), width: Math.round(width), mass: Math.round(mass), reliability, smooth, cost, tooling, engMonths, bsfc, overheat, knock, stress, heat, cap, bars, response, noise, octaneReq, coolKW, service, thermal: c.eta };
}
// family = what the block / head tooling fixes; a variant only changes what the machining line can do on the same castings
export const familyKey = e => [e.layout, e.head, e.material || 'iron', e.chamber || 'std', e.mains || 'min'].join('|');
export function devCost(e, year, engines) {
  const s = engineStats({ ...e, year }), fam = engines.find(x => familyKey(x) === familyKey(e) && e.bore <= (x.maxBore ?? x.bore + 4) && e.stroke <= (x.maxStroke ?? x.stroke + 6));
  return fam ? { kind: 'VARIANT', of: fam, cost: Math.round(s.tooling * 0.15 + 4000), months: 2 } : { kind: 'NEW FAMILY', of: null, cost: s.tooling, months: s.engMonths };
}
// 100-hour durability run: each part's risk from the design's stresses; seeded so the same engine always tells the same story
export function durability(e, year, seed = 1) {
  const s = engineStats({ ...e, year }); let r = (seed * 2654435761 + 1013904223) >>> 0; const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296); rnd(); rnd(); rnd();
  const run = Math.max(s.hpRpm, s.redline * 0.9), sp = run * 2 * e.stroke / 60000, q = qOf(e);   // flat-out at rated speed
  const risk = { 'MAIN BEARINGS': Math.max(0, sp / s.spLim - 0.85) * 2.2 + (e.lube === 'splash' ? 0.12 : 0) - (e.mains === 'full' ? 0.1 : 0),
    'VALVES': Math.max(0, run / (HEADS[e.head].float * (0.92 + 0.18 * (e.cam ?? 0.3)) * (s.fx.float || 1)) - 0.9) * 3 + (e.springs === 'soft' ? 0.08 : 0),
    'HEAD GASKET': s.knock * 3 + Math.max(0, s.cr - maxCR(year, e.head, e.chamber) + 0.5) * 0.25,
    'COOLING': s.overheat * 2.5 + (e.cooling === 'thermo' ? 0.05 : 0),
    'PISTONS': Math.max(0, sp / s.spLim - 0.9) * 1.5 + (e.pistons === 'alu' && year < 1935 ? 0.06 : 0),
    'CRANKSHAFT': Math.max(0, sp / s.spLim - 0.92) * 1.2 * (e.crank === 'forged' ? 0.4 : 1) * (e.cwt === 'yes' ? 0.7 : 1) };
  const out = []; for (const [part, k] of Object.entries(risk)) { const p = clamp(k * (1 - q * 0.08) + 0.02, 0, 0.95); if (rnd() < p) out.push({ part, h: Math.round(10 + rnd() * 88) }); }
  return { failures: out.sort((a, b) => a.h - b.h), risk };
}
