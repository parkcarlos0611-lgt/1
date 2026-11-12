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
  env: { visibility: 0, wind: 2, time: '10:00' },
  berms: [], signs: [], flags: [], parked: [], sprites: {},
  // depth rows: [parallax and scale, haze]. Each row farther back is clearly smaller, paler and bluer, so the
  // town reads in depth rather than as one sheet of cut-outs. 0.5: street lamps at the kerb (the drive line's plane)
  layers: { 0.5: [1, 0], 5: [0.42, 0.58], 4: [0.54, 0.44], 3: [0.68, 0.3], 2: [0.84, 0.15], 1: [0.95, 0.05] },
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
  // Scenery rows (step 3): z 4…1 behind the road (far → near, smaller and hazier with distance), z -1 in front
  // of it. Items are town sprites ('t:<id>', true sizes from data/town_sprites.js) and the city buildings
  // ('city:<k>', data/city.js). Fixed by a seed, so the town is the same every time.
  layout() {
    const r = DS.rng(1991), P = [], TS = DS.TOWN_SPRITES;
    const width = k => { if (k.startsWith('city:')) { const d = DS.CITY[k.slice(5)], ppm = (d.h - d.roof) / d.hb; return d.w / ppm; } return TS[k.replace(/^t:/, '')].w; };
    const flip = k => /sedan|pickup|van|taxi|drum|tires|barrier|sandbags|crates|sacks|pots|basket|table|pallet|ibc|water_tank|tent|quonset|hedgehog|lamp_bent|lamp_down/.test(k) && r() < 0.5 ? -1 : 1;
    const key = k => k.startsWith('city:') ? k : 't:' + k;
    // the same building is never placed close to itself: in its own row it keeps three of its widths plus 30 m
    // from its twin; in another row (other depth, other scale) at least one and a half widths plus 12 m, so twins
    // never stand side by side or one behind the other. Props, vehicles and street furniture may repeat.
    const seen = new Map(), bld = k => k.startsWith('city:') || /^t:(market_|shop_|tin_shed|shed_pair|container|tent|quonset|canopy|shelter_|ruin_|camo_net|watchtower)/.test(k);
    const room = (k, x, z) => { let m = 1e9; const w = width(k); for (const [q, zq] of seen.get(k) || []) m = Math.min(m, Math.abs(q - x) / (zq === z ? w * 3 + 30 : w * 1.5 + 12)); return m; };
    const clear = (k, x, z) => !bld(k) || room(k, x, z) >= 1;
    const mark = (k, x, z) => { if (bld(k)) { if (!seen.has(k)) seen.set(k, []); seen.get(k).push([x, z]); } };
    const put = (k, z, x) => { k = key(k); P.push({ k, z, x, w: width(k), f: flip(k) }); mark(k, x, z); };
    const pick = pool => pool[Math.floor(r() * pool.length)];
    // a pool item that may stand at x: random among the allowed ones; if none is, the one whose twin is farthest
    const pickAt = (pool, x, z) => {
      const ok = pool.filter(k => clear(key(k), x + width(key(k)) / 2, z));
      return ok.length ? pick(ok) : null;          // none may stand here: the caller leaves a gap
    };
    const putAt = (pool, z, x) => { const k = pickAt(pool, x - 8, z); if (k) put(k, z, x); };
    // fill [x0, x1] in row z with items from pool, gaps g0…g1 between them
    const fill = (z, x0, x1, pool, g0, g1) => { let x = x0 + r() * g1; for (;;) { const k0 = pickAt(pool, x, z); if (!k0) { x += 6; if (x > x1) break; continue; } const k = key(k0), w = width(k); if (x + w > x1) break; P.push({ k, z, x: x + w / 2, w, f: flip(k) }); mark(k, x + w / 2, z); x += w + g0 + r() * (g1 - g0); } };
    const every = (k, z, x0, x1, step, jit = 0) => { for (let x = x0; x < x1; x += step) put(k, z, x + (r() - 0.5) * jit); };
    const L = ['city:l1', 'city:l2', 'city:l3', 'city:l4', 'city:l5', 'city:l6', 'city:l7'], Mm = ['city:m1', 'city:m2', 'city:m3', 'city:m4', 'city:m5', 'city:m6', 'city:m7'], H = ['city:h1', 'city:h2', 'city:h3', 'city:h4', 'city:h5', 'city:h6'];
    const cars = ['sedan', 'old_sedan', 'taxi', 'pickup', 'van'], wrecks = ['sedan_dmg', 'old_sedan_dmg', 'pickup_dmg', 'van_dmg', 'taxi_burnt'];
    const bins = ['trash_can', 'wheelie_bin', 'dumpster'];
    const market = ['crates', 'pots', 'sacks', 'carpet_stand', 'red_table', 'table', 'basket', 'fruit_crate1', 'fruit_crate2', 'fruit_crate3', 'plastic_crate', 'flat_sacks', 'covered_goods', 'pallet_goods', 'jerrycans', 'crate_stack', 'stool', 'small_table', 'table2', 'crates_small'];
    const stalls = ['stall_fruit', 'stall_red', 'stall_blue', 'stall_meat'], shops = ['shop_garage', 'shop_awning', 'shop_grocery', 'shop_clothes', 'shop_elec'];
    // the far town behind everything from the outskirts to the ruins: a continuous hazy skyline
    fill(5, 2600, 4800, L.concat('city:m3', 'city:m6'), 4, 40); fill(5, 4800, 16900, H.concat(Mm, Mm), 0, 5);
    // ① desert highway (west): roadside boards, then the checkpoint at the edge of town
    put('billboard', 1, 450); put('billboard', 1, 1350); put('direction_sign', 1, 1760); put('poster_board', 1, 1880);
    put('watchtower', 2, 1952); put('sandbags', 1, 1936); put('sandbags', 1, 1940.5); put('barrier1', 1, 1968); put('barrier2', 1, 1971.5);
    put('barrier2', -1, 1958); put('roadblock1', -1, 1984);
    // ② outskirts: sheds, containers and lean-tos, junk by the road
    fill(4, 2400, 5000, L.concat('city:m3'), 10, 60);
    fill(3, 2000, 5000, ['tin_shed', 'shed_pair', 'quonset', 'container', 'tent', 'city:l6', 'city:l2'], 6, 30);
    fill(2, 2000, 5000, ['canopy', 'shelter_tin', 'shelter_wood', 'shelter_cloth', 'ruin_small', 'container', 'city:l5'], 8, 36);
    fill(1, 2000, 5000, ['drum_red', 'drum_blue', 'tires1', 'tires2', 'pallets', 'water_tank', 'ibc', 'crates', 'sacks', 'burn_drum', 'pickup', 'sedan_dmg'], 6, 34);
    fill(-1, 2000, 5000, ['barrier1', 'tires1', 'drum_red', 'pickup'], 70, 170);
    // ③ low housing: one- and two-storey houses, mid-rise behind; lamps, bins and parked cars on the street
    fill(4, 5000, 8000, ['city:m3', 'city:m6', 'city:m2', 'city:m4'].concat(L), 1, 14);
    fill(3, 5000, 8000, L, 3, 14); fill(2, 5000, 8000, L.concat('shop_garage', 'shop_awning'), 4, 15);
    fill(1, 5000, 8000, bins.concat(cars, cars), 6, 28);
    fill(-1, 5000, 8000, ['sedan', 'wheelie_bin', 'trash_can', 'taxi'], 55, 130);
    // ④ market quarter (the middle of the map): market blocks and alleys, shopfronts, stalls and goods
    // (the two big market panoramas appear once each; the rest is built from single buildings)
    fill(4, 8000, 10000, Mm.concat('city:h5', 'city:m1'), 0, 10);
    fill(3, 8000, 8960, ['market_arcade', 'city:l1', 'city:l3', 'market_2storey', 'city:m3'], 1, 6);
    put('market_a', 3, 9000 + width('t:market_a') / 2 + 4);
    fill(3, 9090, 10000, ['market_arcade', 'city:l1', 'city:l3', 'market_2storey', 'city:m3'], 1, 6);
    put('market_b', 2, 8420); put('market_gate', 2, 8860); put('market_gate', 2, 9620);
    for (const [a, b] of [[8000, 8395], [8445, 8850], [8870, 9610], [9630, 10000]]) {
      for (let x = a; x < b;) { const k = pickAt(['market_2storey', 'market_arcade', 'market_2storey'].concat(shops), x, 2); if (!k) { x += 4; continue; } const w = width(key(k)); if (x + w > b) break; put(k, 2, x + w / 2); x += w + r() * 3; }
    }
    fill(1, 8000, 10000, stalls.concat(stalls, market, market, market), 0.4, 3.5);
    fill(-1, 8000, 10000, ['stall_fruit', 'stall_red', 'crates', 'pots', 'fruit_crate1', 'sacks'], 22, 70);
    // ⑤ the square: the gate in the middle, traffic lights at the two avenues, posters
    fill(4, 10000, 11000, ['city:h2', 'city:h6', 'city:h1'].concat(Mm), 0, 12);
    put('market_a', 3, 10500); putAt(Mm, 3, 10130); putAt(Mm, 3, 10880);
    put('market_gate', 2, 10500); putAt(Mm, 2, 10170); putAt(Mm, 2, 10840); fill(2, 10560, 10700, shops, 1, 5); fill(2, 10300, 10440, shops, 1, 5);
    for (const x of [10233, 10267, 10733, 10767]) put('traffic_light', 1, x);
    put('poster_board', 1, 10420); put('poster_board', 1, 10580);
    fill(1, 10020, 10220, bins.concat(cars), 8, 30); fill(1, 10780, 10990, bins.concat(cars), 8, 30);
    // ⑥ centre: high-rise skyline, mid-rise blocks, a busy street
    fill(4, 11000, 14000, H.concat(Mm), 0, 8); fill(3, 11000, 14000, Mm.concat(H), 0, 6); fill(2, 11000, 14000, Mm.concat('city:l3', 'shop_grocery', 'shop_elec', 'shop_clothes'), 3, 15);
    fill(1, 11000, 14000, cars.concat(cars, bins, ['poster_board', 'billboard', 'direction_sign']), 5, 24);
    fill(-1, 11000, 14000, ['sedan', 'taxi', 'van', 'wheelie_bin'], 50, 120);
    // ⑦ the battered district: broken towers, ruins, wrecks, bent lamps
    fill(4, 14000, 17000, ['city:hd1', 'city:hd2', 'city:h3', 'city:h4', 'city:m2', 'city:m6', 'city:m5', 'city:m3'], 2, 22);
    fill(3, 14000, 17000, ['ruin_wall', 'city:m2', 'city:m6', 'city:m7', 'city:m4', 'ruin_small', 'city:hd2', 'city:hd1'], 4, 20);
    fill(2, 14000, 17000, ['ruin_small', 'ruin_wall', 'sign_frame', 'billboard_dmg', 'city:l4'], 8, 30);
    fill(1, 14000, 17000, ['lamp_bent', 'lamp_down', 'bin_burnt', 'bin_tipped', 'burn_drum', 'tires1', 'barrier1', 'hedgehog'].concat(wrecks, wrecks), 3, 20);
    fill(-1, 14000, 17000, ['taxi_burnt', 'sedan_dmg', 'lamp_down', 'barrier2'], 45, 120);
    // ⑧ desert highway (east): Iraqi positions under nets, obstacles, a last board
    put('camo_net', 2, 17600); put('camo_net', 2, 18210); put('watchtower', 2, 18300); put('sandbags', 1, 17590); put('sandbags', 1, 18200);
    for (const x of [17400, 17418, 17436, 17454]) put('hedgehog', 1, x);
    for (const x of [17410, 17446]) put('hedgehog', -1, x);
    put('barrier1', 1, 18700); put('billboard_dmg', 1, 19050); put('direction_sign', 1, 19620);
    // street lamps along the road every 30 m through town; bent or down ones in the battered district
    for (let x = 2015; x < 17000; x += 30) {
      const ruin = x >= 14000;
      put(ruin ? (r() < 0.45 ? 'lamp' : r() < 0.6 ? 'lamp_bent' : 'lamp_down') : 'lamp', 0.5, x + (r() - 0.5) * 1.5);
    }
    P.sort((a, b) => b.z - a.z || a.x - b.x);
    return P;
  },
};
DS.MAP = DS.MAP || DS.RANGE;
