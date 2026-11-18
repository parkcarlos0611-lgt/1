// Standard visible under-chassis set (side view) for 1930s semi-elliptic sprung cars. mm, x from front tip.
export function chassisUnder({ F, R, r, frameZ = 520, front = F - 650, rear = R + 900, tank = true, exhaustZ = 300, muffler = null }) {
  const leaf = (xc, half, z) => [0, 1, 2].map(k => ({ band: [[xc - half + k * 70, z + 40 + k * 26], [xc, z - 10 + k * 26], [xc + half - k * 70, z + 40 + k * 26]], th: 22, ramp: 'iron', lv: 2 - (k > 1 ? 1 : 0) }));
  return [
    { band: [[front, frameZ + 40], [F + 300, frameZ], [R - 700, frameZ], [R - 300, frameZ + 220], [R + 300, frameZ + 220], [rear, frameZ + 120]], th: 110, ramp: 'black', lv: 1 },   // frame rail
    ...leaf(F, 520, r + 60), ...leaf(R, 650, r + 60),                                                       // semi-elliptic springs
    { band: [[F - 520, r + 110], [F - 560, frameZ + 30]], th: 28, ramp: 'iron', lv: 2 },                 // front shackle
    { band: [[R + 650, r + 110], [R + 700, frameZ + 220]], th: 28, ramp: 'iron', lv: 2 },
    { pts: [[F + 150, frameZ - 60], [F + 290, frameZ - 60], [F + 290, frameZ + 40], [F + 150, frameZ + 40]], ramp: 'iron', lv: 2 },   // lever shock
    { band: [[F + 220, frameZ - 20], [F + 60, r + 40]], th: 26, ramp: 'iron', lv: 1 },
    { pts: [[R - 330, frameZ + 160], [R - 190, frameZ + 160], [R - 190, frameZ + 260], [R - 330, frameZ + 260]], ramp: 'iron', lv: 2 },
    { band: [[R - 260, frameZ + 200], [R - 80, r + 40]], th: 26, ramp: 'iron', lv: 1 },
    ...(tank ? [{ pts: [[R + 380, frameZ - 40], [rear - 80, frameZ - 40], [rear - 60, frameZ + 200], [R + 360, frameZ + 200]], ramp: 'paint.tank', lv: 2 }] : []),
    { band: [[F + 900, exhaustZ + 60], [R - 900, exhaustZ], [R + 200, exhaustZ + 40], [rear - 150, exhaustZ + 20]], th: 40, ramp: 'iron', lv: 1 },
    { pts: [[(muffler || [R - 1500, R - 900])[0], exhaustZ - 50], [(muffler || [R - 1500, R - 900])[1], exhaustZ - 50], [(muffler || [R - 1500, R - 900])[1], exhaustZ + 70], [(muffler || [R - 1500, R - 900])[0], exhaustZ + 70]], ramp: 'iron', lv: 1 },
  ];
}
