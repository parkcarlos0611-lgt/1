// Town map (separate from the firing range): real sizes the art is scaled to (user-agreed).
// h = height (m) of the drawn object, top to ground; L = length (m), used for vehicles, containers and barriers
// whose side-view length is the surer measure. Sheets: assets/ref/city_market_sheet.png,
// assets/ref/city_street_props_sheet.png (background-free versions to come). Existing city buildings keep
// their own wall heights in data/city.js (low 4.5–7 m, mid 14–18 m, high 30–32 m).
window.DS = window.DS || {};
DS.TOWN_SCALE = {
  // buildings and large structures
  market_gate: { h: 11 }, market_2storey: { h: 8 }, market_arcade: { h: 6.5 }, shop: { h: 5.2 },
  watchtower: { h: 6 }, ruined_wall: { h: 4.5 }, quonset: { h: 4.6 }, tent: { h: 4 }, tin_shed: { h: 3.4 }, container_office: { L: 6.1 },
  // street furniture and stalls (only the single-arm street lamp is used)
  street_lamp: { h: 5.5 }, billboard: { h: 5 }, traffic_light: { h: 5.5 }, direction_sign: { h: 4.6 },
  lane_lamp: { h: 3.8 }, poster_board: { h: 3.6 }, stall: { h: 2 },
  // props and civilian vehicles
  sedan: { L: 4.4 }, old_sedan: { L: 4.7 }, pickup: { L: 5.0 }, van: { h: 1.85 }, taxi: { L: 4.4 },
  water_tank: { L: 2.4 }, dumpster: { h: 1.5 }, ibc: { h: 1.15 }, jersey_barrier: { L: 3.0 },
  wheelie_bin: { h: 1.1 }, trash_can: { h: 0.9 }, drum: { h: 0.9 },
};
