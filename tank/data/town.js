// Town map (separate from the firing range): about 20 km of road from the desert through the outskirts, low
// housing, the market quarter in the middle, the square, the mid- and high-rise centre and a battered district,
// out to the desert again. Art and real sizes: data/town_sprites.js, data/town_scale.js. Distances count from
// the west end (x = 0). Scenery layers follow the firing range's (depth rows behind the road, a near row in
// front of it). This file is the map's skeleton: districts, road, side streets; the rows are filled later.
window.DS = window.DS || {};
DS.TOWN = {
  id: 'town', name: '시내', town: true,
  line: 0,                    // distances in the editor count from the west end
  lineName: '서쪽 끝',
  start: 300,
  length: 20000,
  road: [0, 20000],           // asphalt along the whole drive line
  roadW: 1.9,                 // depth of the road toward the viewer on the ground plane (m of plane depth)
  walk: 0.55,                 // sidewalk strip behind the road (rise on screen, m)
  // districts: [from, to, id, name]
  districts: [
    [0, 2000, 'highway_w', '사막 간선 (서)'],
    [2000, 5000, 'outskirts', '외곽'],
    [5000, 8000, 'lowrise', '저층 주거'],
    [8000, 10000, 'market', '시장 지구'],
    [10000, 11000, 'square', '광장'],
    [11000, 14000, 'centre', '중·고층 도심'],
    [14000, 17000, 'ruins', '파괴된 구역'],
    [17000, 20000, 'highway_e', '사막 간선 (동)'],
  ],
  env: { visibility: 0, night: 0, wind: 2, sun: { el: 38, side: 1 } },
  berms: [], signs: [], flags: [], parked: [], sprites: {},
  layers: { 4: [0.58, 0.34], 3: [0.70, 0.24], 2: [0.82, 0.13], 1: [0.93, 0.04] },
  front: 0.34,
  district(x) { for (const d of this.districts) if (x >= d[0] && x < d[1]) return d; return this.districts[this.districts.length - 1]; },
  urban(x) { const d = this.district(x)[2]; return d !== 'highway_w' && d !== 'highway_e'; },
  // side streets running off toward the viewer: every 120–260 m in town, the square's two avenues
  // (made on first use: the random generator is defined after the data files load)
  get cross() {
    if (this._cross) return this._cross;
    const r = DS.rng(1990), c = [];
    for (let x = 2150; x < 16900; x += 120 + r() * 140) if (x < 9950 || x > 11050) c.push(Math.round(x));
    c.push(10250, 10750);
    return (this._cross = c.sort((a, b) => a - b));
  },
  layout() { return []; },                                  // scenery rows: steps 3–5
  presets: { '빈 거리': { items: [] } },
};
DS.MAP = DS.MAP || DS.RANGE;
