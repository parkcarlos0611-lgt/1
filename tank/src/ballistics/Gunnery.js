// Gunnery (A1–A4): what makes a well-laid shot still miss, and what each fire-control system corrects.
//   A1 dispersion: every round leaves at a slightly different angle — the round's own precision (sabot
//      separation, fin/spin stability), gun jump at the shot, more on the move, more as the tube wears — and at a
//      slightly different speed (propellant lot).
//   A2 barrel bend: firing heats the tube, which bends a little upward; it cools over minutes. A muzzle reference
//      system (MRS: M1A1, Challenger) lets the crew re-reference the sight to the bent tube when halted.
//   A3 range-rate: a target closing or opening changes range while the round flies; a fire-control computer with
//      lead (M1A1, Challenger, AMX-30B2) lays for the range at impact, the others for the range lased (or set).
//   A4 charge temperature: cold rounds leave slower than the 21 °C of the firing tables, hot ones faster; a
//      computer told the ammunition temperature allows for it.
// Direct-fire main guns only (artillery, rockets and automatic cannon keep their own spread).
DS.Gunnery = {
  // fire-control capability and gun precision by vehicle (disp: multiplier on the rounds' dispersion)
  FCS: {
    m1a1:        { lead: true,  temp: true,  mrs: true,  disp: 0.9 },
    challenger1: { lead: true,  temp: true,  mrs: true,  disp: 1.0 },
    amx30b2:     { lead: true,  temp: true,  mrs: false, disp: 1.0 },
    m60a1:       { lead: false, temp: true,  mrs: false, disp: 1.05 },
    t72:         { lead: false, temp: false, mrs: false, disp: 1.25 },
    t62:         { lead: false, temp: false, mrs: false, disp: 1.25 },
    t55:         { lead: false, temp: false, mrs: false, disp: 1.2 },
  },
  fcs(v) { return this.FCS[v.def.id] || { lead: false, temp: false, mrs: false, disp: 1.1 }; },
  direct(A) { return !A.bag && !A.rocket && !A.small && !A.missile; },
  // round precision, 1σ in mils (angle), by kind
  dispMil(A) { return { APFSDS: 0.2, APDS: 0.28, HEAT: 0.3, HESH: 0.32, APHE: 0.38, HE: 0.4 }[A.type] || 0.3; },
  gauss(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()); },
  // propellant temperature (°C): the desert night is cold, the stowage lags the air and the afternoon sun bakes it
  chargeTemp(world) { const c = (world.env && world.env.clock) != null ? world.env.clock : 12; return 15 + 9 * Math.sin(2 * Math.PI * (c - 10) / 24); },
  tempFactor(world) { return 1 + 0.0008 * (this.chargeTemp(world) - 21); },
  // tube wear: muzzle velocity falls a little and dispersion grows with rounds fired (equivalent full charges)
  wear(v) { const n = v.gun.efc || 0; return { v: 1 - Math.min(0.012, n * 0.00004), d: 1 + n / 600 }; },
  // the upward bend of the hot tube (mil), and what the crew has referenced out (MRS)
  bendMil(v) { const h = v.gun.bheat || 0; return Math.min(1.6, 0.32 * Math.pow(h, 0.75)); },
  // muzzle velocity this round actually leaves with (before its lot variation)
  v0(v, A, world) { return v.muzzleV(A) * (this.direct(A) ? this.tempFactor(world) * this.wear(v).v : 1); },
  // the velocity the fire-control computer assumes
  v0Fcs(v, A, world) { const F = this.fcs(v); return this.direct(A) && F.temp ? this.v0(v, A, world) : v.muzzleV(A); },
  // a shot: returns { da (rad, added to the bore line), v0 }
  shot(v, A, world) {
    if (!this.direct(A)) return { da: 0, v0: v.muzzleV(A) };
    const r = world.rng || Math.random, F = this.fcs(v), W = this.wear(v), gs = v.gun;
    const move = Math.min(1, Math.abs(v.vt || 0) / 10);
    const sd = Math.hypot(this.dispMil(A) * F.disp * W.d, 0.12 + 0.25 * move);          // round + jump (+ on the move)
    const lay = (v.wounds && v.wounds.gunner ? 0.25 : 0) + (v.opticsBroken ? 0.35 : 0);              // wounded gunner, auxiliary sight
    const sdA = Math.hypot(sd, lay);
    const bend = this.bendMil(v) - (gs.mrsComp || 0);                                  // what the MRS has not taken out
    const da = (this.gauss(r) * sdA + bend) / 1000;
    return { da, v0: this.v0(v, A, world) * (1 + this.gauss(r) * 0.0025) };
  },
  // after the shot: the tube heats and wears
  fired(v, A) { if (!this.direct(A)) return; const gs = v.gun; gs.bheat = (gs.bheat || 0) + (A.type === 'APFSDS' || A.type === 'APDS' ? 1 : 0.8); gs.efc = (gs.efc || 0) + 1; gs.sinceShot = 0; },
  // every step: the tube cools; a crew with an MRS re-references it when halted and a while after the last shot
  step(v, dt, world) {
    const gs = v.gun; if (!gs) return;
    gs.bheat = Math.max(0, (gs.bheat || 0) * Math.exp(-dt / 300)); gs.sinceShot = (gs.sinceShot || 0) + dt;
    const F = this.fcs(v);
    if (F.mrs && v.alive && Math.abs(v.vt || 0) < 0.5 && gs.sinceShot > 6 && Math.abs(this.bendMil(v) - (gs.mrsComp || 0)) > 0.15) {
      gs.mrsComp = this.bendMil(v); gs.mrsAt = world.time;
      if (v === world.vehicles[0] && window.__game) window.__game.toast(`MRS 갱신 — 포신 휨 ${gs.mrsComp.toFixed(1)} mil 보정`);
    }
  },
};
