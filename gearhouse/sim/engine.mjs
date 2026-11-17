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
export const maxCR = (y, head) => 2.6 + octane(y) * 0.05 + (head === 'sv' ? 0 : 0.6);
// mean piston speed limit (m/s) by era and quality: materials / bearings / lubrication improve over time
export const pistonLimit = (y, q = 0) => 12.5 + Math.max(0, y - 1925) * 0.15 + q * 0.5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function displacement(e) { return Math.PI / 4 * (e.bore / 1000) ** 2 * (e.stroke / 1000) * LAYOUTS[e.layout].cyl; }   // m^3

// e = { layout, head, material, bore, stroke, cr, cam (0 touring .. 1 sporty), carbs (count), carbSize (0.5..1.5), quality (-3..3), year }
export function engineCurve(e) {
  const L = LAYOUTS[e.layout], H = HEADS[e.head], D = displacement(e), year = e.year || 1940, q = e.quality || 0, cam = e.cam ?? 0.3;
  const cr = Math.min(e.cr ?? maxCR(year, e.head), maxCR(year, e.head));
  const eta = (1 - Math.pow(cr, -0.3)) * 0.61 * Math.pow(e.stroke / 95, 0.3);   // long strokes: compact chamber, better L-head combustion (calibrated)                                              // brake-relevant thermal efficiency
  const rp = H.pk * (0.82 + 0.45 * cam) * Math.sqrt(95 / e.stroke);                          // torque-peak rpm
  const flowCap = (e.carbs || 1) * (e.carbSize || 1) * 0.105 * (L.cyl >= 8 ? 1.25 : 1) * Math.min(1.15, 0.75 + 0.012 * Math.max(0, year - 1930));   // + era carburettor / manifold know-how       // induction capacity (m^3/s at VE 1)
  const spLim = pistonLimit(year, q), rpmPiston = spLim * 60 / (2 * e.stroke / 1000);
  const redline = Math.round(Math.min(H.float * (0.92 + 0.18 * cam), rpmPiston) / 50) * 50;
  const pts = [];
  for (let rpm = 600; rpm <= redline; rpm += 100) {
    let ve = H.ve * (1 - 0.32 * Math.log(rpm / rp) ** 2) * (1 + q * 0.01) * Math.min(1, 0.84 + 0.01 * Math.max(0, year - 1930));   // era port / manifold know-how
    const need = D * rpm / 120 * ve; if (need > flowCap) ve *= Math.pow(flowCap / need, 0.6);   // carburettor choke
    const air = D * rpm / 120 * ve * 1.18;                                                    // kg/s
    const indicated = air / 12.8 * 44e6 * eta;                                                // W
    const sp = 2 * e.stroke / 1000 * rpm / 60, fmep = (50 + 10 * rpm / 1000 + 0.28 * sp * sp) * 1000 * (1 - q * 0.02);
    const friction = fmep * D * rpm / 120;
    const P = Math.max(0, indicated - friction), T = P / (rpm * Math.PI / 30);
    pts.push({ rpm, P, T, hp: P / 745.7 });
  }
  const pk = pts.reduce((a, b) => (b.P > a.P ? b : a)), tk = pts.reduce((a, b) => (b.T > a.T ? b : a));
  return { D, litres: D * 1000, cid: D * 61023.7, cr, redline, curve: pts, hp: pk.hp, hpRpm: pk.rpm, torque: tk.T, tRpm: tk.rpm, eta };
}

// derived design figures used by the market and the visuals
export function engineStats(e) {
  const c = engineCurve(e), L = LAYOUTS[e.layout], H = HEADS[e.head], M = MATERIALS[e.material || 'iron'], q = e.quality || 0, year = e.year || 1940;
  const perBank = L.cyl / L.banks, pitch = e.bore + 22 + (L.banks > 1 ? 10 : 0);
  const len = perBank * pitch + (L.banks > 1 ? pitch * 0.5 : 0) + 170;                          // mm, incl. timing cover + bell flange
  const height = e.stroke * 2.6 + 260 + H.h + (L.banks > 1 ? 40 : 0), width = L.banks > 1 ? 520 + e.stroke * 1.4 : 330 + e.stroke * 0.6;
  const mass = (40 + c.litres * 48 + L.cyl * 5.5 + H.h * 0.15) * M.kg;
  const stress = Math.max(c.redline * 2 * e.stroke / 1000 / 60 / pistonLimit(year, q), c.redline / H.float);
  const reliability = clamp(0.92 - 0.35 * Math.max(0, stress - 0.75) + q * 0.025 - (c.cr > maxCR(year, e.head) - 0.3 ? 0.04 : 0), 0.3, 0.99);
  const smooth = clamp(L.smooth + (L.cyl >= 8 ? 0.02 : 0) - (e.stroke / e.bore > 1.35 ? 0.05 : 0), 0, 1);
  const cost = Math.round((60 + c.litres * 25 + L.cyl * 8) * H.cost * M.cost * (1 + q * 0.06) * (1 + (e.carbs || 1) * 0.04));   // $ per unit (1940 dollars)
  const tooling = Math.round((60000 + L.cyl * 9000) * H.eng * M.cost);                        // family tooling (one-off)
  const engMonths = Math.round((5 + L.cyl * 0.5) * H.eng * (1 + Math.max(0, q) * 0.12));
  const bsfc = 0.0818 / Math.max(0.12, c.eta);                                                  // kg/kWh at best point (3.6 MJ / (eta * 44 MJ/kg))
  return { ...c, len: Math.round(len), height: Math.round(height), width: Math.round(width), mass: Math.round(mass), reliability, smooth, cost, tooling, engMonths, bsfc };
}
