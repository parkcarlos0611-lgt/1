// The test drive at Millbrook (review 85, step 4): drive one car round the Outer Circuit, seen from a fixed 40-degree
// height and following the car. The track is drawn from its data each frame (concrete shaded by the banking's height,
// its joints and edges, the bridges); the car is its 3D mesh baked at the track's scale; the physics runs at 200 Hz.
// Keys: up/W throttle, down/S brake, left/right or A/D steer, space handbrake, Q/E gears (manual), M automatic or
// manual, R back on the track. Lap times on the start line.
import { millbrook } from '../race/millbrook';
import { raceSpec, RACE_CARS } from '../race/cars';
import { Vehicle, type Controls } from '../race/vehicle';
import { CarSprites, PropSprites } from '../race/sprites';
import { millbrookScenery, type Placed } from '../race/scenery';
import { PROPS } from '../render/props/index';
import { MESH_CARS } from '../render/car/meshcars';
import { Driver } from '../race/driver';
import { Race, type Entrant } from '../race/race';
import { Health, WARN } from '../race/health';
import { Sound, type Skid } from './sound';
import specsData from '../data/cars/specs.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const T = millbrook(), cv = $<HTMLCanvasElement>('view'), ctx = cv.getContext('2d')!;
let SP = Math.sin(30 * Math.PI / 180), CP = Math.cos(30 * Math.PI / 180), pitchDeg = 30; const DT = 1 / 200, START = T.spec.landmarks.find(l => l.kind === 'line')!.s;
let VW = 768, VH = 432, mm = 50;                                               // the picture's own pixels, millimetres a pixel
const st = { auto: true, assist: false, pilot: false, chase: false, progressive: false, cine: false };
const turning = () => st.chase || st.cine;
// ---- the cinematic view: shots cut between trackside cameras (the world turned to look from the camera at the car), a
//      low chase and a high fixed view; pixels twice the size, the gauges hidden, bars top and bottom with a caption ----
const W2c = T.spec.width / 2, CAMS = Array.from({ length: Math.floor(T.length / 380) }, (_, i) => { const s = i * 380 + 60, side = i % 2 ? 1 : -1, p = T.point(s, side * (W2c + 16)); return { s, x: p.x, y: p.y }; });
let cut = false; let shot: { kind: 'side' | 'chase' | 'top'; cam?: { s: number; x: number; y: number }; until: number } = { kind: 'chase', until: 0 }, shotN = 0;
let snd: Sound | null = null, lastS = 0, lastGear = 1, lastV = 0, wasAir = false; const steam: { x: number; y: number; z: number; r: number; a: number }[] = []; let pilot = new Driver(T), camAng = Math.PI / 2, wheelTurn = 0;   // camAng: the world heading that shows as up the screen let pilot = new Driver(T);
let car!: Vehicle, sprites!: CarSprites, carId = 'chevAB28', camX = 0, camY = 0, camZ = 0;
const keys = new Set<string>(), input = { steer: 0, throttle: 0, brake: 0, hand: 0 }; let manualGear = 1;
const skids: { x: number; y: number; z: number; a: number }[] = [], puffs: { x: number; y: number; z: number; r: number; a: number; vx: number; vy: number }[] = [];
let lapStart = -1, lastLap = 0, bestLap = 0, clock = 0, prevS = 0, msg = '', msgT = 0;
// a race: the entrants and their pictures (the player's car is `car`, its pictures `sprites`)
const SCN = millbrookScenery(T), propSprites = new Map<string, PropSprites>(); const train = { d: -1, wait: 40 };
const propPic = (kind: string) => { let p = propSprites.get(kind); if (!p) { const f = PROPS[kind]; if (!f) return null; p = new PropSprites(f(), mm, pitchDeg); propSprites.set(kind, p); } return p; };
let race: Race | null = null; const others = new Map<Entrant, CarSprites>(); let raceSeed = 7;

function choose(id: string) { carId = id; propSprites.clear(); const spec = raceSpec(id), m = MESH_CARS.find(c => c.id === id)!;
  car = new Vehicle(spec, T); car.auto = st.auto; car.place(START + 30, 0, 0); manualGear = 1;
  sprites = new CarSprites(m.mesh(), mm, pitchDeg, spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, matchMedia('(pointer: coarse)').matches ? 1200 : 2400); sprites.prepare([0]); sprites.work(500); sprites.prepare([-1, 1, -2, 2, -3, -4, -5]); camAng = car.yaw;
  pilot = new Driver(T); lapStart = -1; lastLap = 0; bestLap = 0; skids.length = 0; puffs.length = 0; say(`${spec.name} · 출발선 뒤에서 시작`); }
function say(t: string) { msg = t; msgT = 3; }
// ---- the world to the picture ----
// world to picture: the camera turned so that the heading camAng points up the screen (fixed camera: north up)
let cA = 0, sA = 1; const turnCam = () => { const a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2; cA = Math.cos(a); sA = Math.sin(a); };
const P = (x: number, y: number, z: number): [number, number] => { const dx = x - camX, dy = y - camY, rx = dx * cA + dy * sA, ry = -dx * sA + dy * cA; return [rx * 1000 / mm + VW / 2, (-ry * SP - (z - camZ) * CP) * 1000 / mm + VH * (st.chase && !st.cine ? 0.66 : 0.55)]; };
const sx = (x: number, y = camY) => P(x, y, 0)[0], sy = (y: number, z: number, x = camX) => P(x, y, z)[1]; void sx; void sy;
function drawTrack() {
  // grass, with a little texture fixed to the ground
  ctx.fillStyle = '#5d7348'; ctx.fillRect(0, 0, VW, VH);
  const cell = 2.4, reach = Math.hypot(VW, VH / SP) * mm / 2000 + 4, gx0 = Math.floor((camX - reach) / cell), gx1 = Math.ceil((camX + reach) / cell), rng = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h >>> 8) / 16777216; };
  const vy0 = camY - reach, vy1 = camY + reach;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = Math.floor(vy0 / cell); gy <= Math.ceil(vy1 / cell); gy++) { const v = rng(gx, gy); if (v < 0.55) continue; const [X, Y] = P(gx * cell + rng(gy, gx) * cell, gy * cell, 0); if (X < -2 || Y < -2 || X > VW || Y > VH) continue; ctx.fillStyle = v > 0.85 ? '#6b8253' : '#53683f'; ctx.fillRect(Math.round(X), Math.round(Y), 2, 1); }
  // the ground's own features: the paddock's gravel and the mown strip, the railway's ballast and rails, the river
  const poly = (pts: [number, number][], fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => { const [X, Y] = P(x, y, 0); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); ctx.fill(); };
  for (const a of SCN.areas) poly(a.pts, a.kind === 'apron' ? '#a49a83' : '#6a8452');
  for (const l of SCN.lines) { const near = l.pts.some(([x, y]) => Math.abs(x - camX) < reach + 40 && Math.abs(y - camY) < reach + 40); if (!near) continue;
    const band = (w: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = w * 1000 / mm; ctx.lineJoin = 'round'; ctx.beginPath(); l.pts.forEach(([x, y], i) => { const [X, Y] = P(x, y, 0); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); };
    if (l.kind === 'river') { band(l.width + 3, '#4b5c3b'); band(l.width, '#5b7a86'); band(l.width * 0.4, '#6c8c98'); }
    else if (l.kind === 'rail') { band(l.width, '#8a7f6e'); for (let k = 0; k + 1 < l.pts.length; k++) { const [x0, y0] = l.pts[k]!, [x1, y1] = l.pts[k + 1]!, dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
        if (Math.abs(x0 - camX) > reach + 40 || Math.abs(y0 - camY) > reach + 40) continue; ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 1; for (let d = 0; d < n; d += 0.9) { const a = P(x0 + ux * d - uy * 1.3, y0 + uy * d + ux * 1.3, 0), b = P(x0 + ux * d + uy * 1.3, y0 + uy * d - ux * 1.3, 0); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
        for (const g of [-0.72, 0.72]) { ctx.strokeStyle = '#3c3e42'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...P(x0 - uy * g, y0 + ux * g, 0.15)); ctx.lineTo(...P(x1 - uy * g, y1 + ux * g, 0.15)); ctx.stroke(); } } } }
  // the concrete: strips across the track from far to near, every metre in view
  const near = T.locate(camX, camY, car.s).s, W2 = T.spec.width / 2, span = 70;
  const strips: { s: number; y: number }[] = []; for (let d = -span; d <= span; d += 1) { const s = near + d, n = T.at(s); strips.push({ s, y: -(n.x - camX) * sA + (n.y - camY) * cA }); }
  strips.sort((a, b) => b.y - a.y);   // far first
  for (const { s } of strips) { const L = 9; for (let k = 0; k < L; k++) { const o0 = -W2 + k * 2 * W2 / L, o1 = o0 + 2 * W2 / L;
      const p = [T.point(s, o0), T.point(s, o1), T.point(s + 1.05, o1), T.point(s + 1.05, o0)], z = (p[0]!.z + p[1]!.z) / 2, slope = Math.abs(T.slope(s, (o0 + o1) / 2).across);
      const g = Math.round(156 + z * 5 - slope * 34);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 9})`; ctx.beginPath(); p.forEach((q, i) => { const [X, Y] = P(q.x, q.y, q.z); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); ctx.fill(); }
    if (Math.abs((s % T.spec.joints + T.spec.joints) % T.spec.joints) < 1) { const a = T.point(s, -W2), b = T.point(s, W2); ctx.strokeStyle = 'rgba(70,66,58,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, a.z)); ctx.lineTo(...P(b.x, b.y, b.z)); ctx.stroke(); }   // the expansion joints across
    // behind a banking, its earth bank falling away to the fields; the fence along both edges
    { const out = T.at((s)).k >= 0 || T.bankAt(s).b ? (T.bankAt(s).b && T.at((T.bankAt(s).b!.s0 + T.bankAt(s).b!.s1) / 2).k < 0 ? 1 : -1) : -1, H = T.height(s, out * W2) - T.bump(s);
      if (H > 0.3) { const q = [T.point(s, out * W2), T.point(s + 1.05, out * W2)], f = [T.point(s + 1.05, out * (W2 + H * 2.4)), T.point(s, out * (W2 + H * 2.4))]; ctx.fillStyle = '#4c6340'; ctx.beginPath(); ctx.moveTo(...P(q[0]!.x, q[0]!.y, H)); ctx.lineTo(...P(q[1]!.x, q[1]!.y, H)); ctx.lineTo(...P(f[0]!.x, f[0]!.y, 0)); ctx.lineTo(...P(f[1]!.x, f[1]!.y, 0)); ctx.closePath(); ctx.fill(); } }
    for (const o of [-(W2 + 1.5), W2 + 1.5]) { const a = T.point(s, o), b = T.point(s + 1.05, o), za = T.height(s, o) + 0.9, zb = T.height(s + 1.05, o) + 0.9; ctx.strokeStyle = 'rgba(232,227,214,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, za)); ctx.lineTo(...P(b.x, b.y, zb)); ctx.stroke(); }   // the fence's rail
    if (Math.round(s) % 3 === 0) for (const o of [-(W2 + 1.5), W2 + 1.5]) { const z = T.height(s, o), [X, Y] = P(T.point(s, o).x, T.point(s, o).y, z), [, Yt] = P(T.point(s, o).x, T.point(s, o).y, z + 1); ctx.fillStyle = '#e8e3d6'; ctx.fillRect(Math.round(X), Math.round(Yt), 1, Math.max(1, Math.round(Y - Yt))); }
    for (const o of [-W2, W2]) { const a = T.point(s, o), b = T.point(s + 1.05, o); ctx.strokeStyle = '#3b3a35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, a.z)); ctx.lineTo(...P(b.x, b.y, b.z)); ctx.stroke(); } }
  // the start line
  { const a = T.point(START, -W2), b = T.point(START, W2); ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, a.z)); ctx.lineTo(...P(b.x, b.y, b.z)); ctx.stroke(); }
  // skid marks
  for (const m of skids) { const [X, Y] = P(m.x, m.y, m.z); if (X < -4 || Y < -4 || X > VW + 4 || Y > VH + 4) continue; ctx.fillStyle = `rgba(30,28,26,${m.a})`; ctx.fillRect(Math.round(X) - 1, Math.round(Y), 3, 2); } }
function drawBridges() { for (const l of T.spec.landmarks) { if (l.kind !== 'bridge') continue; const W2 = T.spec.width / 2 + 6, a = T.point(l.s, -W2), b = T.point(l.s, W2), h = 5.5, d = T.at(l.s);
  if (Math.hypot(a.x - camX, a.y - camY) > 90) continue;
  // its shadow on the concrete, then the deck above
  ctx.fillStyle = 'rgba(20,20,18,0.35)'; const q = (s: number, o: number) => T.point(s, o);
  ctx.beginPath(); for (const [s, o] of [[l.s - 2, -W2], [l.s - 2, W2], [l.s + 3, W2], [l.s + 3, -W2]] as const) { const p = q(s, o); ctx.lineTo(...P(p.x + 2, p.y - 2, p.z)); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d756a'; ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 2; ctx.beginPath(); for (const [s, o] of [[l.s - 1.5, -W2], [l.s - 1.5, W2], [l.s + 1.5, W2], [l.s + 1.5, -W2]] as const) { const p = q(s, o); ctx.lineTo(...P(p.x, p.y, h + Math.max(a.z, b.z))); } ctx.closePath(); ctx.fill(); ctx.stroke(); void d; } }
// ---- the minimap: the circuit, the line, every car ----
const MINI = $<HTMLCanvasElement>('mini'), mctx = MINI.getContext('2d')!; let mbox = { x0: 0, y0: 0, k: 1 };
{ let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const n of T.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); } const k = 130 / Math.max(x1 - x0, y1 - y0); mbox = { x0: x0 - (150 / k - (x1 - x0)) / 2, y0: y1 + (150 / k - (y1 - y0)) / 2, k }; }
const mp = (x: number, y: number): [number, number] => [(x - mbox.x0) * mbox.k, (mbox.y0 - y) * mbox.k];
function mini() { mctx.clearRect(0, 0, 150, 150); mctx.strokeStyle = 'rgba(235,230,220,0.85)'; mctx.lineWidth = 3; mctx.beginPath(); T.nodes.forEach((n, i) => { if (i % 8) return; const [X, Y] = mp(n.x, n.y); if (i) mctx.lineTo(X, Y); else mctx.moveTo(X, Y); }); mctx.closePath(); mctx.stroke();
  { const a = T.point(START, -18), b = T.point(START, 18), [ax, ay] = mp(a.x, a.y), [bx, by] = mp(b.x, b.y); mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(ax, ay); mctx.lineTo(bx, by); mctx.stroke(); }
  const dots = race ? race.cars.map(e => ({ c: e.car, me: !e.driver })) : [{ c: car, me: true }];
  for (const d of dots) { const [X, Y] = mp(d.c.x, d.c.y); mctx.fillStyle = d.me ? '#ffb347' : '#9fc3ff'; mctx.beginPath(); mctx.arc(X, Y, d.me ? 4 : 3, 0, Math.PI * 2); mctx.fill(); if (d.me) { mctx.strokeStyle = '#000'; mctx.lineWidth = 1; mctx.stroke(); } } }
// ---- steam from a boiling radiator or a blown gasket ----
function letterbox() { const b = Math.round(VH * 0.1); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, b); ctx.fillRect(0, VH - b, VW, b);
  ctx.fillStyle = '#e9e4d8'; ctx.font = `${Math.max(7, Math.round(b * 0.42))}px Oswald, sans-serif`; ctx.textBaseline = 'middle';
  const me = race?.player, lap = me ? `${Math.min(race!.laps, me.lapAt.length)}/${race!.laps}바퀴 · ${race!.order().indexOf(me) + 1}위` : T.pieceAt(car.s);
  ctx.fillText(`${car.spec.name}  ·  ${(car.speed * 3.6).toFixed(0)} km/h  ·  ${lap}`, Math.round(b * 0.5), VH - b / 2); ctx.fillText('MILLBROOK', Math.round(b * 0.5), b / 2); }
function drawSteam(el: number) { const h = car.health; if ((h.water >= WARN.boil || h.failed === 'gasket') && Math.random() < 0.5) { const f = car.spec.wheelbase * (1 - car.spec.frontShare) + 0.4; steam.push({ x: car.x + Math.cos(car.yaw) * f, y: car.y + Math.sin(car.yaw) * f, z: T.height(car.s, car.off) + 1.2, r: 0.3, a: 0.5 }); }
  for (const p of steam) { p.z += 1.2 * el; p.r += 0.8 * el; p.a -= 0.35 * el; } for (let i = steam.length - 1; i >= 0; i--) if (steam[i]!.a <= 0) steam.splice(i, 1);
  for (const p of steam) { ctx.fillStyle = `rgba(245,245,245,${p.a})`; ctx.beginPath(); ctx.arc(...P(p.x, p.y, p.z), p.r * 1000 / mm, 0, Math.PI * 2); ctx.fill(); } }
// ---- sounds ----
const ENGINE = (specsData as { cars: Record<string, { engine: { kind: string; layout: string } }> }).cars;
const voiceOf = (id: string) => { const e = ENGINE[id]!.engine; return { cylinders: +e.layout.replace(/\D/g, '') || 4, kind: (e.kind === 'sleeve' ? 'sleeve' : e.kind === 'ohv' ? 'ohv' : 'sv') as 'sv' | 'ohv' | 'sleeve', supercharged: id === 'dueSSJ35' }; };
function sounds() { if (!snd) return; const me = race?.player, keep = new Set<unknown>(['me']);
  snd.voice('me', voiceOf(carId)).set(car.rpm, st.pilot ? 0.7 : input.throttle, 1, 0, car.health.running);
  if (race) for (const e of race.cars) { if (e === me) continue; const d = Math.hypot(e.car.x - car.x, e.car.y - car.y); if (d > 220) continue; keep.add(e); const [X] = P(e.car.x, e.car.y, 0);
    snd.voice(e, voiceOf(e.id)).set(e.car.rpm, 0.8, 1 / (1 + (d / 30) ** 2), (X - VW / 2) / (VW / 2), e.car.health.running); }
  snd.dropVoices(keep);
  const sk = [0, 1, 2, 3].map(i => skidOf(car, i)), side = (a: Skid, b: Skid): Skid => (a.amount >= b.amount ? { ...a, amount: Math.max(a.amount, b.amount) } : { ...b });
  let others = 0; if (race) for (const e of race.cars) { if (!e.driver) continue; const d = Math.hypot(e.car.x - car.x, e.car.y - car.y); if (d < 120) for (let i = 0; i < 4; i++) others = Math.max(others, skidOf(e.car, i).amount / (1 + (d / 20) ** 2)); }
  snd.update({ left: side(sk[0]!, sk[2]!), right: side(sk[1]!, sk[3]!), others }, car.onGrass.filter(Boolean).length / 4, car.speed, { piece: T.pieceAt(car.s), s: car.s, startDist: Math.abs(T.gap(START, car.s)) });
  // the concrete's joints under the front and then the rear wheels
  { const J = T.spec.joints, a = Math.floor(car.s / J), b = Math.floor(lastS / J); if (a !== b && car.speed > 4 && !car.onGrass[0]) { snd.hit('joint', Math.min(1, car.speed / 30)); const delay = car.spec.wheelbase / car.speed * 1000; if (delay < 400) setTimeout(() => snd?.hit('joint', Math.min(1, car.speed / 30) * 0.8), delay); } lastS = car.s; }
  if (car.gear !== lastGear) { snd.hit('shift'); lastGear = car.gear; }
  if (Math.abs(car.speed - lastV) > 2.5) snd.hit('knock', Math.min(1.5, Math.abs(car.speed - lastV) / 4)); lastV = car.speed;
  const air = car.airborne.filter(Boolean).length >= 2; if (wasAir && !air && car.speed > 20) snd.hit('thud'); wasAir = air; }
/** how hard a wheel skids, 0..1: what lays its mark and sounds its squeal; and how (sideways, locked, spinning) */
function skidOf(c: Vehicle, i: number): Skid { if (c.airborne[i] || c.onGrass[i]) return { amount: 0, kind: 'side', load: 0 }; const sx = c.slipX[i]!, sa = Math.abs(c.slipA[i]!), sl = Math.max(Math.abs(sx) / 0.15, sa / 0.12), a = Math.max(0, Math.min(1, (sl - 1) / 0.6));
  return { amount: a, kind: sx < -0.3 ? 'lock' : sx > 0.3 ? 'spin' : 'side', load: Math.min(1.5, c.load[i]! / (c.spec.mass * 9.81 / 4)) }; }
let markTick = 0;
function marks(c: Vehicle) { markTick++; for (let i = 0; i < 4; i++) { const k = skidOf(c, i), sl = 1 + k.amount * 0.6; if (k.amount <= 0 || markTick % 2) continue;
    const [px, py] = c.wheelAt(i), cy = Math.cos(c.yaw), sy2 = Math.sin(c.yaw), x = c.x + px * cy - py * sy2, y = c.y + px * sy2 + py * cy, q = T.locate(x, y, c.s), z = T.height(q.s, q.off);
    skids.push({ x, y, z, a: Math.min(0.6, 0.12 + 0.45 * k.amount) * (k.kind === 'lock' ? 1.2 : 1) }); if (skids.length > 9000) skids.shift(); if (Math.random() < 0.12 * (0.3 + k.amount)) puffs.push({ x, y, z: z + 0.2, r: 0.3, a: 0.35, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 }); } }
/** every car in view, the farthest first */
/** the scenery and the cars together, the farthest first; decks over the track after them all */
function drawWorld() { const a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2, reach = Math.hypot(VW, VH / SP) * mm / 2000 + 30, items: { Y: number; draw: () => void }[] = [], over: (() => void)[] = [];
  const seen = (x: number, y: number) => Math.abs(x - camX) < reach && Math.abs(y - camY) < reach;
  const prop = (q: Placed) => { if (!seen(q.x, q.y)) return; const ps = propPic(q.kind); if (!ps) return; const [X, Y] = P(q.x, q.y, q.z ?? 0), f = ps.get(q.heading - a), d = () => ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); if (q.overhead) over.push(d); else items.push({ Y: P(q.x, q.y, 0)[1], draw: d }); };
  for (const q of SCN.props) prop(q); for (const q of trainCars()) prop(q);
  const cars = race ? race.cars.map(e => ({ c: e.car, sp: e.driver ? others.get(e)! : sprites, turn: e.wheelTurn })) : [{ c: car, sp: sprites, turn: wheelTurn }];
  for (const { c, sp, turn } of cars) { const z = T.height(c.s, c.off) + c.zb, [X, Y] = P(c.x, c.y, z); if (X < -150 || X > VW + 150 || Y < -150 || Y > VH + 150) continue;
    items.push({ Y: P(c.x, c.y, 0)[1], draw: () => { const f = sp.get(sp.key(c.yaw - a, c.tilt + c.roll * 1.5, c.steer, turn, c.speed)); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); } }); }
  items.sort((p, q) => p.Y - q.Y); for (const it of items) it.draw(); for (const d of over) d(); }
/** the train's pieces where it is on the line (locomotive, tender, three carriages), or none */
function trainCars(): Placed[] { if (train.d < 0) return []; const R = SCN.railway, out: Placed[] = []; let acc = 0; const at = (d: number): Placed | null => { acc = 0; for (let k = 0; k + 1 < R.length; k++) { const [x0, y0] = R[k]!, [x1, y1] = R[k + 1]!, n = Math.hypot(x1 - x0, y1 - y0); if (acc + n >= d) { const f = (d - acc) / n; return { kind: '', x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, heading: Math.atan2(y1 - y0, x1 - x0) }; } acc += n; } return null; };
  for (const [kind, back] of [['locomotive', 0], ['tender', 11.5], ['carriage', 26], ['carriage', 41.5], ['carriage', 57]] as const) { const q = at(train.d - back); if (q) out.push({ ...q, kind }); } return out; }
function drawCars() { if (!race) { drawCar(); return; } const a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2;
  const list = race.cars.map(e => { const c = e.car, z = T.height(c.s, c.off) + c.zb, [X, Y] = P(c.x, c.y, z); return { e, c, X, Y }; }).filter(q => q.X > -150 && q.X < VW + 150 && q.Y > -150 && q.Y < VH + 150).sort((p, q) => p.Y - q.Y);
  for (const { e, c, X, Y } of list) { const sp = e.driver ? others.get(e)! : sprites, f = sp.get(sp.key(c.yaw - a, c.tilt + c.roll * 1.5, c.steer, e.wheelTurn, c.speed)); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); } }
function drawCar() { const z = T.height(car.s, car.off) + car.zb, roll = car.tilt + car.roll * 1.5, a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2;
  const f = sprites.get(sprites.key(car.yaw - a, roll, car.steer, wheelTurn, car.speed)), [X, Y] = P(car.x, car.y, z); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); }
function drawPuffs() { for (const p of puffs) { ctx.fillStyle = `rgba(205,200,190,${p.a})`; const r = p.r * 1000 / mm; ctx.beginPath(); ctx.arc(...P(p.x, p.y, p.z), r, 0, Math.PI * 2); ctx.fill(); } }
const fmt = (t: number) => t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : '-';
function hud() { const kmh = car.speed * 3.6; $('spd').textContent = kmh.toFixed(0); $('gear').textContent = String(car.gear); $('rpm').textContent = car.rpm.toFixed(0);
  ($('rpmbar') as HTMLElement).style.width = `${Math.min(100, car.rpm / car.spec.redline * 100)}%`; ($('rpmbar') as HTMLElement).style.background = car.rpm > car.spec.hpRpm * 1.05 ? 'var(--warn)' : 'var(--accent)';
  $('lap').textContent = `이번 바퀴 ${lapStart >= 0 ? fmt(clock - lapStart) : '-'}`; $('last').textContent = `지난 ${fmt(lastLap)}`; $('best').textContent = `최고 ${fmt(bestLap)}`; $('where').textContent = T.pieceAt(car.s);
  { const h = car.health, w = h.warnings(car.rpm, car.spec.redline), cls = (k: string) => w.includes(k) ? (k === 'boil' ? 'boil' : 'hot') : '';
    $('heat').innerHTML = `<span class="${cls('boil') || cls('water')}">물 ${h.water.toFixed(0)}°</span><span class="${cls('oil')}">오일 ${h.oil.toFixed(0)}°</span>${h.level < 0.98 ? `<span class="hot">냉각수 ${(h.level * 100).toFixed(0)}%</span>` : ''}${w.includes('revs') ? '<span class="boil">과회전</span>' : ''}${h.failed ? `<span class="boil">${({ gasket: '개스킷 파손', valve: '밸브 손상', bearing: '베어링 소착', seized: '엔진 고착' } as Record<string, string>)[h.failed]}</span>` : ''}`; }
  if (car.lastFailure) { const f = car.lastFailure; car.lastFailure = null; snd?.hit('bang'); say(({ gasket: '헤드 개스킷이 나갔습니다 — 출력이 떨어지고 더 뜨거워집니다', valve: '과회전으로 밸브가 상했습니다 — 출력이 떨어집니다', bearing: '오일이 너무 뜨거워 베어링이 녹아붙었습니다 — 엔진이 멈췄습니다', seized: '과열로 엔진이 고착됐습니다 — 엔진이 멈췄습니다' } as Record<string, string>)[f]!); msgT = 6; }
  ($('gasbar') as HTMLElement).style.height = `${input.throttle * 100}%`; ($('brakebar') as HTMLElement).style.height = `${input.brake * 100}%`;
  $('bake').textContent = sprites.pending ? `그림 굽는 중 ${sprites.count}장` : ''; $('msg').textContent = msgT > 0 ? msg : '';
  if (race) { const me = race.player!, ord = race.order(), pos = ord.indexOf(me) + 1, wait = me.start - race.clock;
    $('lap').textContent = wait > 0 ? (race.mode === 'scratch' ? `출발 신호 ${Math.ceil(wait)}` : `출발까지 ${Math.ceil(wait)}초`) : race.clock - me.start < 1.2 && race.mode === 'scratch' ? '출발!' : me.finish ? `완주 ${fmt(me.finish - me.start)}` : `${Math.min(race.laps, me.lapAt.length)}/${race.laps}바퀴 · ${fmt(race.clock - me.start)}`;
    $('last').textContent = `${pos}/${race.cars.length}위`; $('best').textContent = '';
    $('board').innerHTML = ord.map((e, k) => `<li${e === me ? ' class="me"' : ''}>${k + 1}. ${e.name}${e === me ? ' (나)' : ''} <span>${e.finish ? fmt(e.finish - e.start) : race!.clock < e.start ? `출발 ${Math.ceil(e.start - race!.clock)}초 뒤` : `${(e.dist / 1000).toFixed(2)} km`}</span></li>`).join(''); } }
function results() { const r = race!, me = r.player!, ord = r.order(); $('results').dataset.shown = '1';
  say(`결승 ${ord.indexOf(me) + 1}위 — ${ord[0]!.name} 우승`); }
function startRace() { const laps = +$<HTMLSelectElement>('laps').value, pool = RACE_CARS.filter(id => id !== carId); raceSeed = (raceSeed * 48271) % 2147483647;
  const pick: string[] = []; let r = raceSeed; while (pick.length < 3) { r = (r * 16807) % 2147483647; const id = pool[r % pool.length]!; if (!pick.includes(id)) pick.push(id); }
  const mode = $<HTMLSelectElement>('mode').value as 'handicap' | 'scratch'; race = new Race(T, [carId, ...pick], laps, carId, raceSeed, mode); const me = race.player!; car = me.car; car.auto = st.auto; manualGear = 1; pilot = new Driver(T);
  others.clear(); const small = matchMedia('(pointer: coarse)').matches;
  for (const e of race.cars) if (e.driver) { const m = MESH_CARS.find(c => c.id === e.id)!, sp = new CarSprites(m.mesh(), mm, pitchDeg, e.car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 400 : 900); sp.prepare([0]); others.set(e, sp); }
  sprites = new CarSprites(MESH_CARS.find(c => c.id === carId)!.mesh(), mm, pitchDeg, car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 800 : 1800); sprites.prepare([0]); sprites.work(300);
  skids.length = 0; puffs.length = 0; delete $('results').dataset.shown; camX = car.x; camY = car.y; camAng = car.yaw;
  const starts = [...race.cars].sort((a, b) => a.start - b.start).map(e => `${e.name}${e.driver ? '' : ' (나)'} ${e.start ? `+${e.start.toFixed(0)}초` : '맨 먼저'}`).join(' · ');
  say(mode === 'scratch' ? `동시 출발 ${laps}바퀴 · 5초 뒤 출발` : `핸디캡 ${laps}바퀴 · ${starts}`); msgT = 8; $('race').textContent = '레이스 다시'; }
function stopRace() { race = null; others.clear(); $('board').innerHTML = ''; choose(carId); }
// ---- controls ----
// one press, from a key or a screen button
function press(k: string) { if (k === 'm') { st.auto = !st.auto; car.auto = st.auto; manualGear = car.gear; ($('auto') as HTMLInputElement).checked = st.auto; say(st.auto ? '자동 변속' : '수동 변속 (Q/E)'); }
  if (!st.auto && (k === 'e' || k === 'x')) manualGear = Math.min(car.spec.gears.length, manualGear + 1); if (!st.auto && (k === 'q' || k === 'z')) manualGear = Math.max(1, manualGear - 1);
  if (k === 'r') { car.place(car.s, 0, 0); say('트랙으로 복귀'); }
  if (k === 'c') setCine(!st.cine); }
addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); keys.add(k);
  if (!e.repeat) press(k); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
// the screen buttons: held while a finger is on them (several at once), a tap for gears and reset
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#pad button'))) { const k = b.dataset.key!, hold = k.startsWith('arrow');
  const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); if (hold) keys.add(k); else press(k); };
  const off = (e: PointerEvent) => { e.preventDefault(); b.classList.remove('on'); if (hold) keys.delete(k); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', () => { b.classList.remove('on'); if (hold) keys.delete(k); });
  b.addEventListener('contextmenu', e => e.preventDefault()); }
$<HTMLInputElement>('touch').checked = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('touch', $<HTMLInputElement>('touch').checked);
$<HTMLInputElement>('touch').addEventListener('change', e => document.body.classList.toggle('touch', (e.target as HTMLInputElement).checked));
const down = (...ks: string[]) => ks.some(k => keys.has(k));
function controls(dt: number): Controls { const left = down('arrowleft', 'a'), right = down('arrowright', 'd'), want = left === right ? 0 : left ? 1 : -1;
  input.steer += want === 0 ? -Math.sign(input.steer) * Math.min(Math.abs(input.steer), dt * 4) : Math.max(-dt * 2.6, Math.min(dt * 2.6, want - input.steer));
  input.throttle = Math.max(0, Math.min(1, input.throttle + (down('arrowup', 'w') ? (st.progressive ? 0.55 : 4) : (st.progressive ? -3 : -6)) * dt));   // the gauge mode: the pedal goes down as long as it is held input.brake = Math.max(0, Math.min(1, input.brake + (down('arrowdown', 's') ? 5 : -8) * dt)); input.hand = down(' ') ? 1 : 0;
  let steer = input.steer; if (st.assist) { const over = car.r - car.speed * T.at(car.s).k; if (Math.abs(over) > 0.1 && Math.sign(over) === Math.sign(-car.vy)) steer += Math.atan2(car.vy, Math.max(5, car.vx)) / (car.spec.steerLock * Math.PI / 180 / (1 + car.speed / 25)) * 0.7; }
  return { steer: Math.max(-1, Math.min(1, steer)), throttle: input.throttle, brake: input.brake, handbrake: input.hand, gear: manualGear }; }
// ---- the loop ----
let last = performance.now(), acc = 0;
function frame(now: number) { const el = Math.min(0.1, (now - last) / 1000); last = now; acc += el; clock += el; msgT -= el;
  while (acc >= DT) { acc -= DT; const u = st.pilot ? pilot.drive(car) : controls(DT);
    if (race) { race.step(DT, u); wheelTurn = race.player!.wheelTurn; if (race.done && !$('results').dataset.shown) results(); } else { car.step(DT, u); wheelTurn += (car.w[0]! + car.w[1]!) / 2 * DT; }
    for (const c of race ? race.cars.map(e => e.car) : [car]) marks(c);
    // lap: forward across the start line
    if (!race && T.gap(prevS, START) > 0 && T.gap(car.s, START) <= 0 && car.vx > 1) { if (lapStart >= 0) { lastLap = clock - lapStart; if (!bestLap || lastLap < bestLap) bestLap = lastLap; say(`한 바퀴 ${fmt(lastLap)}`); } lapStart = clock; }
    prevS = car.s;
    if (car.over) { say('뱅크 꼭대기를 넘어갔습니다 — 트랙으로 복귀'); car.over = false; car.place(car.s, 0, 0); } }
  for (const p of puffs) { p.x += p.vx * el; p.y += p.vy * el; p.z += 0.4 * el; p.r += 0.9 * el; p.a -= 0.4 * el; } while (puffs.length && puffs[0]!.a <= 0) puffs.shift(); for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.a <= 0) puffs.splice(i, 1);
  // the camera: on the car, a little ahead of where it is going
  const lead = Math.min(10, car.speed * 0.2), tx = car.x + Math.cos(car.yaw) * lead, ty = car.y + Math.sin(car.yaw) * lead, tz = T.height(car.s, car.off);
  camX += (tx - camX) * Math.min(1, el * 5); camY += (ty - camY) * Math.min(1, el * 5); camZ += (tz - camZ) * Math.min(1, el * 5);
  { const vh = car.speed > 2 ? Math.atan2(Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy, Math.cos(car.yaw) * car.vx - Math.sin(car.yaw) * car.vy) : car.yaw, d = Math.atan2(Math.sin(vh - camAng), Math.cos(vh - camAng)); camAng += d * Math.min(1, el * 2.5); }   // the turning camera follows where the car goes, gently
  if (st.cine) { const kinds = ['side', 'chase', 'side', 'top'] as const, passed = shot.kind === 'side' && shot.cam && T.gap(shot.cam.s, car.s) > 160;
    if (clock > shot.until || passed) { const kind = kinds[shotN++ % kinds.length]!; let cam = undefined as typeof shot.cam;
      if (kind === 'side') { let best = Infinity; for (const c of CAMS) { const g = T.gap(car.s, c.s); if (g > 40 && g < best && g < 600) { best = g; cam = c; } } }
      shot = { kind: kind === 'side' && !cam ? 'chase' : kind, cam, until: clock + (kind === 'side' ? 14 : kind === 'chase' ? 6 : 5) }; cut = true; }
    const want = shot.kind === 'side' && shot.cam ? Math.atan2(car.y - shot.cam.y, car.x - shot.cam.x) : shot.kind === 'top' ? Math.PI / 2 : car.yaw;
    const d = Math.atan2(Math.sin(want - camAng), Math.cos(want - camAng)); camAng = cut ? want : camAng + d * Math.min(1, el * 3); if (cut) { camX = car.x; camY = car.y; } cut = false; }
  turnCam();
  { const R = SCN.railway; let len = 0; for (let k = 0; k + 1 < R.length; k++) len += Math.hypot(R[k + 1]![0] - R[k]![0], R[k + 1]![1] - R[k]![1]);   // the train: now and then along the line
    if (train.d < 0) { train.wait -= el; if (train.wait <= 0) train.d = 0; } else { train.d += 24 * el; if (train.d > len + 80) { train.d = -1; train.wait = 70 + Math.random() * 120; } }
    if (snd) { const q = trainCars()[0]; snd.train = q ? Math.max(0, 1 - Math.hypot(q.x - car.x, q.y - car.y) / 400) : 0; } }
  drawTrack(); drawWorld(); drawPuffs(); drawSteam(el); if (st.cine) letterbox(); hud(); mini(); sounds(); sprites.work(5); for (const sp of others.values()) sp.work(2); requestAnimationFrame(frame); }
// ---- page ----
const pick = $<HTMLSelectElement>('car'); for (const id of RACE_CARS) pick.add(new Option(raceSpec(id).name, id)); pick.value = carId;
pick.addEventListener('change', () => { carId = pick.value; if (race) stopRace(); else choose(pick.value); pick.blur(); });
const setCine = (on: boolean) => { st.cine = on; ($('cine') as HTMLInputElement).checked = on; document.body.classList.toggle('cine', on); shot.until = 0; fit(); };
$<HTMLInputElement>('cine').addEventListener('change', e => setCine((e.target as HTMLInputElement).checked));
$<HTMLInputElement>('progressive').addEventListener('change', e => { st.progressive = (e.target as HTMLInputElement).checked; document.body.classList.toggle('progressive', st.progressive); });
$<HTMLInputElement>('sound').addEventListener('change', e => { if ((e.target as HTMLInputElement).checked) { snd = new Sound(); snd.volume = +$<HTMLInputElement>('vol').value; } else { snd?.close(); snd = null; } });
$<HTMLInputElement>('vol').addEventListener('input', e => { if (snd) snd.volume = +(e.target as HTMLInputElement).value; });
$('repair').addEventListener('click', e => { car.health = new Health(car.spec.hp, car.spec.cooling, Math.floor(Math.random() * 1e9)); say('엔진을 새것처럼 고쳤습니다'); (e.target as HTMLElement).blur(); });
// full screen: the picture alone; where the browser cannot (an iPhone), the page itself fills the screen
$('fs').addEventListener('click', () => { const el = document.querySelector('.screen') as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement) void document.exitFullscreen(); else if (document.body.classList.contains('fakefull')) document.body.classList.remove('fakefull');
  else if (el.requestFullscreen) void el.requestFullscreen().catch(() => document.body.classList.add('fakefull')); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else document.body.classList.add('fakefull');
  setTimeout(fit, 150); });
document.addEventListener('fullscreenchange', () => setTimeout(fit, 100));
$('race').addEventListener('click', e => { startRace(); (e.target as HTMLElement).blur(); });
$('practice').addEventListener('click', e => { stopRace(); $('race').textContent = '레이스 시작'; (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('auto').addEventListener('change', e => { st.auto = (e.target as HTMLInputElement).checked; car.auto = st.auto; manualGear = car.gear; });
$<HTMLInputElement>('pilot').addEventListener('change', e => { st.pilot = (e.target as HTMLInputElement).checked; if (st.pilot) { car.auto = true; } else car.auto = st.auto; });
$<HTMLInputElement>('assist').addEventListener('change', e => { st.assist = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('chase').addEventListener('change', e => { st.chase = (e.target as HTMLInputElement).checked; camAng = car.yaw; });
$<HTMLInputElement>('pitch').addEventListener('change', e => { pitchDeg = +(e.target as HTMLInputElement).value; SP = Math.sin(pitchDeg * Math.PI / 180); CP = Math.cos(pitchDeg * Math.PI / 180); const s0 = car.s, o0 = car.off, v0 = car.speed; choose(carId); car.place(s0, o0, v0); (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('pitch').addEventListener('input', e => { $('pitchv').textContent = `${(e.target as HTMLInputElement).value}°`; });
$<HTMLSelectElement>('scale').addEventListener('change', e => { mm = +(e.target as HTMLSelectElement).value; choose(carId); (e.target as HTMLElement).blur(); });
function fit() { if (document.fullscreenElement || document.body.classList.contains('fakefull')) { const k = Math.max(1, Math.round(innerWidth / 900)) * (st.cine ? 2 : 1); VW = Math.ceil(innerWidth / k / 2) * 2; VH = Math.ceil(innerHeight / k); cv.width = VW; cv.height = VH; cv.style.width = `${VW * k}px`; cv.style.height = `${VH * k}px`; ctx.imageSmoothingEnabled = false; return; }
  const box = document.querySelector('.track') as HTMLElement, room = Math.min(box.clientWidth - 14, 1600);
  // the height left on the screen below the picture's top (a phone on its side has little), at least a usable strip
  const availH = Math.max(200, innerHeight - Math.max(0, box.getBoundingClientRect().top + scrollY) - 16);
  const k = Math.max(1, Math.floor(Math.min(room / 768, availH / 432)));
  if (room >= 768 && availH >= 432) { VW = 768; VH = 432; cv.style.width = `${VW * k}px`; cv.style.height = `${VH * k}px`; }
  else { VW = Math.max(300, Math.floor(room / 2) * 2); VH = Math.min(Math.round(VW * (innerHeight > innerWidth ? 0.8 : 0.56)), Math.floor(availH)); cv.style.width = `${VW}px`; cv.style.height = `${VH}px`; }
  if (st.cine) { VW = Math.floor(VW / 4) * 2; VH = Math.floor(VH / 2); }   // the cinematic view: pixels twice the size (closer)
  cv.width = VW; cv.height = VH; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200)); fit(); choose(carId); camX = car.x; camY = car.y; camZ = 0; requestAnimationFrame(frame);
