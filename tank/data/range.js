// Firing range (sandbox): a US base at the west end, the firing line, 4.5 km of lanes and the open desert
// beyond as the impact area. The base is scenery only (no collision): barracks, GP Medium tents, supplies
// under camouflage nets, HESCO / concrete / sandbag barriers, drawn in depth layers behind and in front of
// the drive line. Sizes are real: the art is scaled to the widths below.
window.DS = window.DS || {};
DS.RANGE = {
  id: 'range', name: '사격장', range: true,
  line: 1050,                 // firing line (x, m); range signs count from here
  start: 985,                 // where the player's vehicle starts (just outside the gate)
  road: [0, 1062],            // gravel road along the drive line through the base to the firing line
  roadW: 1.5,                 // how far the road reaches toward the viewer on the ground plane (m of plane depth)
  cross: [150, 470, 760],     // side roads running off toward the viewer
  laneEnd: 5600,
  berms: [[1215, 1.1, 5], [2080, 1.5, 6], [3085, 1.6, 6], [4090, 1.6, 7]],     // hull-down berm, target berms
  env: { visibility: 0, night: 0, wind: 2, sun: { el: 35, side: 1 } },
  // sprite: [file, width m]
  sprites: { barracks: 12.5, tent: 9.8, sandbag: 6.4, hesco: 6.6, twall: 6.6, supply: 13,
    s_range: 5.2, s_danger: 3.3, s_warning: 2.8, s_lane: 2.6,
    s_500: 2.4, s_1000: 2.4, s_1500: 2.4, s_2000: 2.4, s_2500: 2.4, s_3000: 2.4, s_3500: 2.4, s_4000: 2.4, s_4500: 2.4 },
  // boards standing right behind the line at their true position: [sprite, metres from the firing line]
  signs: [['s_range', -62], ['s_danger', -4], ['s_lane', 22], ['s_warning', 60]].concat([500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500].map(d => ['s_' + d, d])),
  // flagpoles: [z, x, pole height m]
  flags: [[1, 135, 9], [2, 312, 8], [3, 455, 8], [1, 585, 9], [2, 765, 8], [1, 948, 10], [2, 1034, 8]],
  // parked M1A1s (scenery): [z, x, facing]
  parked: [[2, 384, 1], [2, 396.5, 1], [2, 409, 1], [2, 421.5, 1], [2, 434, 1], [2, 446.5, 1], [3, 846, -1], [1, 738, 1], [1, 751.5, 1], [2, 1078, 1]],
  // depth layers behind the line: z → [parallax & scale, haze]. z < 0: in front of the line, on the near ground
  layers: { 4: [0.58, 0.34], 3: [0.70, 0.24], 2: [0.82, 0.13], 1: [0.93, 0.04] },
  front: 0.34,                // depth of the near row on the ground plane (0 = at the line … 1 = closest)

  // the base layout: [sprite, z, x] — x is where it sits along the line (metres)
  layout() {
    const P = [], S = this.sprites, r = DS.rng(1991);
    const row = (k, z, x0, x1, gap = k === 'hesco' ? -0.9 : 0) => { for (let x = x0 + S[k] / 2; x + S[k] / 2 <= x1; x += S[k] + gap) P.push([k, z, x]); };   // HESCO runs overlap: the drawn bank is wider than the wall
    const put = (k, z, ...xs) => { for (const x of xs) P.push([k, z, x]); };
    // far perimeter: HESCO wall all the way round the back, turning in at the gate
    row('hesco', 4, -40, 900);
    // back rows: billets (barracks), then the tent lines
    row('barracks', 3, 30, 330, 7); row('tent', 3, 350, 600, 5); row('barracks', 3, 620, 820, 9);
    put('twall', 3, 338, 610, 832); put('supply', 3, 862);
    row('tent', 2, 40, 140, 4); put('twall', 2, 154); row('barracks', 2, 175, 300, 8);
    put('supply', 2, 322, 344); put('twall', 2, 362);
    row('tent', 2, 500, 640, 4.5); put('sandbag', 2, 652); row('barracks', 2, 668, 740, 6); put('twall', 2, 792, 800);
    // nearest row: blast walls and sandbags by the doors, supply dumps by the road, the gate
    put('sandbag', 1, 60, 250, 545); put('twall', 1, 100, 108, 300, 700); put('supply', 1, 395, 620);
    put('tent', 1, 205, 430); put('barracks', 1, 320);
    row('hesco', 1, 838, 862); put('twall', 1, 868, 912); put('sandbag', 1, 884, 926);
    // range side: control tent, ammunition point and an observation post behind the firing line
    put('tent', 2, 1002); put('supply', 1, 1022); put('sandbag', 1, 1046); put('twall', 2, 1016, 1060);
    // near side (in front of the line): the near perimeter in short runs with gaps, and the gate chicane
    for (const [a, b] of [[-30, 60], [205, 300], [560, 640], [800, 872]]) row('hesco', -1, a, b);
    put('twall', -1, 900, 934); put('sandbag', -1, 110, 520, 962); put('supply', -1, 380);
    for (const [z, x, f] of this.parked) P.push(['m1a1', z, x, f]);
    for (const [z, x, h] of this.flags) P.push(['flag', z, x, h]);
    P.sort((a, b) => b[1] - a[1] || a[2] - b[2]);
    return P.map(([k, z, x, f]) => ({ k, z, x, w: S[k] || 0, f }));
  },

  // ready-made target layouts (ranges from the firing line). mode: dummy / watch / hold / combat / patrol
  presets: {
    '거리별 표적': { items: [500, 1000, 1500, 2000, 2500, 3000].map(d => ({ id: 't72', d, dir: -1, team: 'IQ', mode: 'dummy' })) },
    '관통 시험': { items: [
      { id: 't72', d: 800, dir: -1, team: 'IQ', mode: 'dummy' }, { id: 't72', d: 830, dir: 1, team: 'IQ', mode: 'dummy' },
      { id: 't62', d: 1200, dir: -1, team: 'IQ', mode: 'dummy' }, { id: 't55', d: 1230, dir: 1, team: 'IQ', mode: 'dummy' },
      { id: 'm1a1', d: 1600, dir: -1, team: 'IQ', mode: 'dummy' }, { id: 'm2a2', d: 1640, dir: -1, team: 'IQ', mode: 'dummy' }] },
    '이동 표적': { items: [
      { id: 't62', d: 1200, dir: -1, team: 'IQ', mode: 'patrol', span: 150, speed: 5 },
      { id: 't62', d: 2000, dir: -1, team: 'IQ', mode: 'patrol', span: 250, speed: 8 },
      { id: 't72', d: 1500, dir: -1, team: 'IQ', mode: 'hold' }] },
  },
};
