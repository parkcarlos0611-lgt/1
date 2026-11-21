// Bed module (bedgen): cargo beds as stacks of real sub-parts instead of one box / floating planks.
// Side-view parts for buildCar (`parts` entries, mm, x from the front tip, z up). Military variants reuse the same layout.
const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const B = (o, extra) => ({ behind: 1, tag: 4, smooth: 0, ...o, ...extra });

// Stepside pickup bed (1940s half-ton, measured on the 1948-type dimension drawing: floor ~610, top ~1125, load length ~1980)
// narrower than the cab, rear fenders bolted OUTSIDE the bed sides, running board between cab and rear fender.
export function stepside({ x0, x1, floor = 610, top = 1125, pockets = 3, paint = 'PAINT', chain = true }) {
  const parts = [];
  parts.push(B({ pts: R(x0, floor - 70, x1, top - 45), ramp: paint, grad: [2.7, 1.3], base: 2 }));                 // side panel
  parts.push(B({ pts: R(x0 - 12, top - 45, x1 + 12, top), ramp: paint, base: 3 }));                                   // rolled top rail
  parts.push(B({ pts: R(x0 + 40, floor + 40, x1 - 40, floor + 64), ramp: paint, base: 1 }));                          // pressed reinforcing rib
  const px = Array.from({ length: pockets }, (_, k) => x0 + 50 + k * (x1 - x0 - 140) / Math.max(1, pockets - 1));
  for (const x of px) parts.push(B({ pts: R(x, top - 150, x + 45, top - 45), ramp: paint, base: 1 }));              // stake pockets under the rail
  parts.push(B({ pts: R(x0 - 35, floor - 80, x0, top + 10), ramp: paint, base: 1 }));                                // front panel flange
  parts.push(B({ pts: R(x1 - 5, floor - 85, x1 + 45, top - 10), ramp: paint, base: 2, edge: 1 }));                  // tailgate seen edge-on
  parts.push(B({ pts: R(x0 + 60, floor - 150, x1 - 60, floor - 75), ramp: 'black', base: 1 }));                     // bed sills on the frame
  for (const x of [x0 + 120, (x0 + x1) / 2, x1 - 160]) parts.push(B({ pts: R(x, floor - 170, x + 60, floor - 75), ramp: 'black', base: 0 }));   // cross sills / U-bolts
  parts.push(B({ pts: R(x1 - 10, floor - 75, x1 + 50, floor - 45), ramp: 'wood', base: 1, tag: 4 }));               // floor board end grain at the tail
  if (chain) parts.push({ band: [[x1 + 25, top - 25], [x1 - 40, top - 150], [x1 - 120, top - 175], [x1 - 175, top - 70]], th: 16, ramp: 'iron', base: 2, tag: 13 });   // slack tailgate chain
  parts.push({ pts: R(x1 + 8, top - 60, x1 + 40, top - 30), ramp: 'iron', base: 3, tag: 13 });                     // gate latch
  return parts;
}

// Platform / stake body for trucks: sills on the frame -> cross-sill ends -> plank floor -> rub rail with stake pockets
// -> drop-side boards in sections (hinges at the bottom, latches at the top) -> stakes -> headboard (cab guard).
export function platform({ x0, x1, frameTop, sideH = 560, boards = 3, sections = 3, side = 'wood', rail = 'PAINT', head = 450, guard = true }) {
  const parts = [], fl = frameTop + 110, ft = fl + 60, z1 = ft + sideH;
  parts.push(B({ pts: R(x0, frameTop, x1, fl), ramp: 'woodDark', base: 1, grain: 1 }));                              // longitudinal sills
  for (let x = x0 + 60; x < x1 - 40; x += 460) parts.push(B({ pts: R(x, frameTop - 10, x + 80, fl), ramp: 'wood', base: 2 }));   // cross-sill ends
  parts.push(B({ pts: R(x0, fl, x1 + 20, ft), ramp: 'wood', base: 2, grain: 1 }));                                  // plank floor
  parts.push(B({ pts: R(x1 - 10, fl, x1 + 20, ft), ramp: 'woodDark', base: 1 }));                                     // end grain
  parts.push(B({ pts: R(x0, fl + 5, x1, fl + 45), ramp: rail, base: 1 }));                                            // steel rub rail
  const secW = (x1 - x0 - 80) / sections, stakes = Array.from({ length: sections + 1 }, (_, k) => x0 + 40 + k * secW);
  const bh = (sideH - 30 * (boards - 1)) / boards;
  for (let s = 0; s < sections; s++) { const a = stakes[s] + 45, b = stakes[s + 1] - 45;
    for (let k = 0; k < boards; k++) { const zb = ft + 10 + k * (bh + 30); parts.push(B({ pts: R(a, zb, b, zb + bh), ramp: side, base: 2, grain: side === 'wood' ? 1 : 0 })); }
    for (const hx of [a + 90, b - 150]) parts.push(B({ pts: R(hx, ft - 10, hx + 60, ft + 60), ramp: 'black', base: 1 }));     // hinges
    for (let k = 0; k < boards; k++) { const zb = ft + 10 + k * (bh + 30) + bh / 2 - 25; for (const sx of [a + 30, b - 70]) parts.push(B({ pts: R(sx, zb, sx + 40, zb + 50), ramp: 'black', base: 1 })); }   // board straps
    parts.push(B({ pts: R(b - 40, z1 - 70, b + 10, z1 - 20), ramp: 'iron', base: 3 })); }                              // latch
  for (const x of stakes) { parts.push(B({ pts: R(x - 40, fl - 40, x + 40, z1 + 50), ramp: rail, base: 2, edge: 1 })); parts.push(B({ pts: R(x - 55, fl - 50, x + 55, fl + 50), ramp: rail, base: 1 })); }   // stakes + pockets
  if (guard) { parts.push(B({ pts: R(x0 - 60, fl, x0 + 30, z1 + head), ramp: rail, base: 2, edge: 1 }));               // headboard post (edge-on)
    for (let z = ft + 150; z < z1 + head - 60; z += 180) parts.push(B({ pts: R(x0 - 60, z, x0 + 30, z + 30), ramp: rail, base: 3 })); }
  return { parts, stakes, floorTop: ft, sideTop: z1 };
}
// Mudguard over a rear axle (flat steel arc on brackets) + toolbox
export const mudguard = (x, r, { ramp = 'black', frameTop }) => {          // pressed flat-crown steel fender over the rear axle
  const ro = r + 140, ri = r + 80, out = [], inn = [];
  for (let a = 170; a >= 10; a -= 8) { const t = a * Math.PI / 180, k = Math.min(1, Math.sin(t) * 1.25); out.push([x + Math.cos(t) * ro * 1.08, r + Math.sin(t) * ro * (0.8 + 0.2 * k)]); inn.push([x + Math.cos(t) * ri * 1.08, r + Math.sin(t) * ri * (0.8 + 0.2 * k)]); }
  return [{ pts: [...out, ...inn.reverse()], ramp, base: 2, tag: 6, smooth: 0 }, ...[-0.5, 0.5].map(c => ({ band: [[x + c * ro, r + ro * 0.75], [x + c * ro * 0.8, frameTop - 40]], th: 40, ramp: 'black', base: 1, tag: 2, behind: 1 }))];
};
export const toolbox = (x0, x1, z0, z1, ramp = 'PAINT') => [{ pts: R(x0, z0, x1, z1), ramp, base: 2, tag: 4, behind: 1, edge: 1, smooth: 0 }, { pts: R(x0 + 20, z1 - 50, x1 - 20, z1 - 35), ramp, base: 1, tag: 4, behind: 1, smooth: 0 }, { pts: R((x0 + x1) / 2 - 25, z1 - 120, (x0 + x1) / 2 + 25, z1 - 60), ramp: 'iron', base: 3, tag: 4, behind: 1, smooth: 0 },
  { band: [[x0 + 40, z0], [x0 + 40, z1 + 120]], th: 25, ramp: 'black', base: 1, tag: 2, behind: 1 }, { band: [[x1 - 40, z0], [x1 - 40, z1 + 120]], th: 25, ramp: 'black', base: 1, tag: 2, behind: 1 }];
