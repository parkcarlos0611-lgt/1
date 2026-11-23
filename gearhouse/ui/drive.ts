// The test drive at Millbrook (review 85, step 4): drive one car round the Outer Circuit, seen from a fixed 40-degree
// height and following the car. The track is drawn from its data each frame (concrete shaded by the banking's height,
// its joints and edges, the bridges); the car is its 3D mesh baked at the track's scale; the physics runs at 200 Hz.
// Keys: up/W throttle, down/S brake, left/right or A/D steer, space handbrake, Q/E gears (manual), M automatic or
// manual, R back on the track. Lap times on the start line.
import { millbrook } from '../race/millbrook';
import { raceSpec, RACE_CARS, EXP_CARS, NEW_CARS, EXP_ENGINE, steering } from '../race/cars';
import { Vehicle, usefulLock, type Controls } from '../race/vehicle';
import { CarSprites, PropSprites } from '../race/sprites';
import { millbrookScenery, type Placed } from '../race/scenery';
import { PROPS } from '../render/props/index';
import { renumber, wheelsOf, type Mesh } from '../render/car/mesh';
import { Damage } from '../race/damage';
import { LiveRenderer } from '../render/live/renderer';
import { groundData, fenceData } from '../render/live/ground';
import { Smoke, type SmokeKind } from '../race/smoke';
import { Debris } from '../race/debris';
import { fenceChunk, pieceMesh, CHUNK } from '../render/live/fence';
import { mul as m4mul, translate as m4t, rot as m4rot, scale as m4s } from '../render/live/gpu';
import texAlb from '../assets/textures/pbr/albedo.jpg';
import texNor from '../assets/textures/pbr/normal.jpg';
import texRgh from '../assets/textures/pbr/rough.jpg';
import texMeta from '../assets/textures/pbr/pbr.json';
import artMeta from '../assets/art/art.json';
import { canonical } from '../render/live/artgroups';
import artBmw from '../assets/art/bmw315.png'; import artBuick from '../assets/art/buick28.png'; import artChev from '../assets/art/chevAB28.png'; import artDodge from '../assets/art/dodgeV28.png';
import artDueA from '../assets/art/dueA21.png'; import artSSJ from '../assets/art/dueSSJ35.png'; import artFN from '../assets/art/fnTT33.png'; import artFord from '../assets/art/fordT23.png';
import artPlym from '../assets/art/plymU29.png'; import artPont from '../assets/art/pontiac29.png'; import artWillys from '../assets/art/willys27.png';
import { MESH_CARS } from '../render/car/meshcars';
import { Driver } from '../race/driver';
import { Race, type Entrant } from '../race/race';
import { Health, WARN } from '../race/health';
import { Sound, type Skid } from './sound';
import specsData from '../data/cars/specs.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const T = millbrook(), cv = $<HTMLCanvasElement>('view'), main = cv.getContext('2d')!; let ctx = main;
// the layer behind the player's car: the ground, the scenery and the other cars, smeared along the motion; the car stays sharp
const bg = document.createElement('canvas'), bgx = bg.getContext('2d')!; let lampsOn = false, blurOn = true, lastCamX = 0, lastCamY = 0, shake = 0;
let SP = Math.sin(30 * Math.PI / 180), CP = Math.cos(30 * Math.PI / 180), pitchDeg = 30; const DT = 1 / 200, START = T.spec.landmarks.find(l => l.kind === 'line')!.s;
let VW = 768, VH = 432, mm = 50;                                               // the picture's own pixels, millimetres a pixel
const st = { auto: true, assist: false, pilot: false, chase: false, progressive: false, cine: false, free: false };
const turning = () => st.chase || st.cine || st.free;
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
const propPic = (kind: string, arg?: number) => { const key = arg ? `${kind}@${arg}` : kind; let p = propSprites.get(key); if (!p) { const f = PROPS[kind]; if (!f) return null; p = new PropSprites(f(arg), mm, pitchDeg); propSprites.set(key, p); } return p; };
let race: Race | null = null; const others = new Map<Entrant, CarSprites>(); let raceSeed = 7;
// race numbers (review 96): the player's from the page, the others' 1, 2, 3... by the entry list, skipping the player's;
// laid on the cars' number decals (only cars with number discs show them)
let myNum = '6';
const meshOf = (id: string, num: string) => renumber(MESH_CARS.find(c => c.id === id)!.mesh(), num);
const numOf = (e: Entrant): string => { if (!race) return myNum; let k = 0; for (const x of race.cars) { if (x === race.player) continue; k++; if (String(k) === myNum) k++; if (x === e) return String(k); } return myNum; };
// ---- the live renderer (review 99): the scene drawn every frame by WebGL2, where the browser has it; the baked pictures otherwise ----
const glCanvas = document.createElement('canvas'); let live: LiveRenderer | null = null, liveFence = -1;
try { live = new LiveRenderer(glCanvas); live.setGround(groundData(T, SCN, START)); } catch (e) { console.warn('live renderer unavailable', e); live = null; }
// the PBR detail textures (Poly Haven, CC0): loaded once, laid on when ready
if (live) { const L = live, im = [texAlb, texNor, texRgh].map(src => { const i = new Image(); i.src = src; return i; });
  void Promise.all(im.map(i => i.decode())).then(() => L.setTextures(im[0]!, im[1]!, im[2]!, (texMeta as { layers: { size_m: number; luma_mean: number; rough_mean: number }[] }).layers)).catch(e => console.warn('textures', e)); }
// the cars' age in the live picture (review 104): the player's set on the page, its dirt growing as it is driven (fast on
// the grass); the others' by their entry, a mixed field
const smoke = new Smoke(); const SK: Record<SmokeKind, number> = { tyre: 0, dust: 1, steam: 2, exhaust: 3 };   /* the live picture's smoke (review 107) */
const myWear: [number, number, number] = [0, 0, 0]; let dirtGrows = true, wearTick = 0;
const wearOf = (c: Vehicle, k: number): [number, number, number] => { if (c === car) return myWear; const h = (n: number) => ((Math.sin(k * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1; return [h(1) * 0.35, h(2) * 0.6, 0.1 + h(3) * 0.35]; };
// each car's 2D art (its part model's views), laid on its mesh in the live picture (review 105), loaded when first wanted
const ART: Record<string, string> = { bmw315: artBmw, buick28: artBuick, chevAB28: artChev, dodgeV28: artDodge, dueA21: artDueA, dueSSJ35: artSSJ, fnTT33: artFN, fordT23: artFord, plymU29: artPlym, pontiac29: artPont, willys27: artWillys };
const artAsked = new WeakSet<object>(); let artOn = true, raysOn = true, texK = 1, lightK = 1, mbK = 1.6, aoK = 1, reflK = 1.3, bloomK = 1, deep = 1, day = 1, dof = 0.5, outW = 1, outK = 1, inK = 1, innerOn: 'auto' | 'on' | 'off' = 'auto';   /* the outline (review 110) */
function artFor(L: LiveRenderer, g: ReturnType<LiveRenderer['car']>, id: string, M: import('../render/car/mesh').Mesh) { if (artAsked.has(g) || !ART[id] || !M.names?.some(Boolean)) return; artAsked.add(g);   // only a mesh with its parts named can take it
  const meta = artMeta as unknown as { mm: number; groups: string[]; cars: Record<string, { C: number; views: Record<string, number[]> }> }, groups = M.names!.map(n => n ? meta.groups.indexOf(canonical(n)) + 1 : 0);
  void fetch(ART[id]!).then(r => r.blob()).then(b => createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })).then(bm => L.setArt(g, bm, { mm: meta.mm, ...meta.cars[id]! }, groups)).catch(e => console.warn('art', e)); }
const liveOK = !!live; let liveR = live; let look: 'baked' | 'stepped' | 'pbr' | 'split' = 'pbr';   /* the light and materials: the baked pictures' stepped light, or physically based (review 102) */
function drawLive(el: number) { const L = live!; void el;
  if (++wearTick % 30 === 0 && document.activeElement?.id !== 'wdirt') $<HTMLInputElement>('wdirt').value = myWear[2].toFixed(2);   /* the dirt slider follows the dirt */
  if (broken.size !== liveFence) { liveFence = broken.size; for (const k of [...fenceGpu.keys()]) if (dirtyChunks.has(k)) fenceGpu.delete(k); dirtyChunks.clear(); }
  glCanvas.width = VW; glCanvas.height = VH;
  const list = race ? race.cars.map(e => ({ c: e.car, sp: e.driver ? others.get(e)! : sprites, turn: e.wheelTurn })) : [{ c: car, sp: sprites, turn: wheelTurn }];
  if (DAMAGE) for (const { c, sp } of list) bend(c, sp.mesh, L); else for (const { c } of list) c.hits.length = 0;
  const cars = list.map(({ c, sp, turn }, k) => ({ wear: wearOf(c, k), g: (() => { const M = dmg.get(c)?.M ?? sp.mesh, g = L.car(M); artFor(L, g, c.spec.id, M); return g; })(), tyres: c.rings, ...(() => { const b = c.base; return { x: b[0], y: b[1], z: b[2] - (c.rings[0]!.rest + c.rings[2]!.rest) / 2 }; })(),   /* the body where it is in 3D (review 120), drawn lower by the tyres' standing give */ yaw: c.yaw, roll: c.rollW + c.roll * 0.5, pitch: c.pitchW, travel: c.travel, camber: c.camber, steerL: c.steerAt(0), steerR: c.steerAt(1), spin: turn, player: c === car, lamps: lampsOn ? 1 : 0, brake: c === car && input.brake > 0.1 }));
  const props: import('../render/live/renderer').LiveProp[] = [...SCN.props, ...trainCars()].flatMap(q => { const f = PROPS[q.kind]; return f ? [{ g: L.prop(q.arg ? `${q.kind}@${q.arg}` : q.kind, () => f(q.arg)), x: q.x, y: q.y, z: q.z ?? 0, h: q.heading }] : []; });
  // the fence (review 112): solid, in chunks near the camera, lit, shadowed and outlined as everything else; its loose pieces
  { const near = T.locate(camX, camY, car.s).s, nC = Math.ceil(T.length / CHUNK); for (let d = -5; d <= 5; d++) for (const side of [-1, 1]) { const c = ((Math.floor(near / CHUNK) + d) % nC + nC) % nC, key = `${side}:${c}`;
      let f = fenceGpu.get(key); if (f === undefined) { const ch = fenceChunk(T, side, c, fenceOk); f = ch ? { g: L.car(ch.mesh), m: m4mul(m4t(...ch.origin), m4s(1 / 1000)), x: ch.origin[0], y: ch.origin[1] } : null; fenceGpu.set(key, f); }
      if (f) props.push({ g: f.g, x: f.x, y: f.y, z: 0, h: 0, m: f.m, outline: 1 }); }
    for (const p of debris3.pieces) { if (p.kind === 'part') { const g = L.prop(p.key!, () => p.mesh!), sh = Math.min(1, p.life / 1.5) / 1000;   /* a part come off a car: its own mesh (the mesh's x runs back from the nose) */
        props.push({ g, x: p.x, y: p.y, z: p.z, h: 0, outline: 1, key: `d${p.id}`, m: m4mul(m4t(p.x, p.y, p.z), m4mul(m4rot('z', p.yaw), m4mul(m4rot('y', p.pitch), m4mul(m4rot('x', p.roll), new Float32Array([-sh, 0, 0, 0, 0, sh, 0, 0, 0, 0, sh, 0, 0, 0, 0, 1]))))) }); continue; }
      const g = L.prop(`fence_${p.kind}`, () => pieceMesh(p.kind as 'post' | 'rail')), shrink = Math.min(1, p.life / 1.5), sx = (p.kind === 'rail' ? p.len : 1) * shrink / 1000;
      props.push({ g, x: p.x, y: p.y, z: p.z, h: 0, outline: 1, key: `d${p.id}`, m: m4mul(m4t(p.x, p.y, p.z), m4mul(m4rot('z', p.yaw), m4mul(m4rot('y', p.pitch), m4mul(m4rot('x', p.roll), new Float32Array([sx, 0, 0, 0, 0, shrink / 1000, 0, 0, 0, 0, shrink / 1000, 0, 0, 0, 0, 1]))))) }); } }
  // the smoke: exhaust from the tail when the throttle is opened hard low in the revs (rich old engines); then a step
  { const ex = (c0: Vehicle) => { const L = c0.spec.wheelbase * c0.spec.frontShare + 0.9, z = T.height(c0.s, c0.off); smoke.emit('exhaust', c0.x - Math.cos(c0.yaw) * L, c0.y - Math.sin(c0.yaw) * L, z + 0.35, -Math.cos(c0.yaw) * 2 + c0.vx * Math.cos(c0.yaw) * 0.6, -Math.sin(c0.yaw) * 2 + c0.vx * Math.sin(c0.yaw) * 0.6, 0.3, 1, z); };
    if (input.throttle > 0.7 && car.rpm < car.spec.hpRpm * 0.6 && Math.random() < 0.25) ex(car); smoke.step(Math.min(0.05, el)); }
  const sp8 = new Float32Array(smoke.parcels.length * 8); smoke.parcels.forEach((q, k) => sp8.set([q.x, q.y, q.z, q.r, q.rho, q.T, SK[q.kind], q.seed], k * 8));
  const view = { x: camX, y: camY, z: camZ, ang: turning() ? camAng : Math.PI / 2, pitch: pitchDeg, mm, W: VW, H: VH, cy: st.chase && !st.cine ? 0.66 : 0.55 };
  ctx = main; main.clearRect(0, 0, VW, VH);
  if (look === 'split') {   // the three looks side by side, the same moment: each a third of the picture, its name over it
    const w3 = Math.floor(VW / 3), names = ['기존 (단계 조명)', 'PBR 단계화', 'PBR 연속'];
    for (let k = 0; k < 3; k++) { L.render(view, cars, props, skids, { glass: 0.8, look: k, art: artOn, rays: raysOn, texK, lightK, aoK, reflK, bloomK, deep, day, dof, mb: blurOn ? mbK : 0, outW, outK, inner: innerOn === 'auto' ? undefined : innerOn === 'on', inK, smoke: { p: sp8, n: smoke.parcels.length, time: smoke.time } }); main.drawImage(glCanvas, k * w3, 0, w3, VH, k * w3, 0, w3, VH); }
    main.fillStyle = 'rgba(0,0,0,0.55)'; main.fillRect(0, VH - 20, VW, 20); main.fillStyle = '#f2ead6'; main.font = '11px sans-serif'; main.textAlign = 'center';
    for (let k = 0; k < 3; k++) main.fillText(names[k]!, k * w3 + w3 / 2, VH - 6); main.fillStyle = '#000'; for (let k = 1; k < 3; k++) main.fillRect(k * w3 - 1, 0, 2, VH); main.textAlign = 'left'; }
  else { L.render(view, cars, props, skids, { glass: 0.8, look: look === 'stepped' ? 1 : look === 'pbr' ? 2 : 0, art: artOn, rays: raysOn, texK, lightK, aoK, reflK, bloomK, deep, day, dof, mb: blurOn ? mbK : 0, outW, outK, inner: innerOn === 'auto' ? undefined : innerOn === 'on', inK, smoke: { p: sp8, n: smoke.parcels.length, time: smoke.time } }); main.drawImage(glCanvas, 0, 0); }
  drawDebris(el);
  if (car.speed > 30) { const v = Math.min(1, (car.speed - 30) / 30) * 0.35, g = main.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${v})`); main.fillStyle = g; main.fillRect(0, 0, VW, VH); } }

function choose(id: string) { carId = id; propSprites.clear(); broken.clear(); debris.length = 0; debris3.pieces.length = 0; fenceGpu.clear(); const spec = raceSpec(id), m = MESH_CARS.find(c => c.id === id)!;
  car = new Vehicle(spec, T); car.auto = st.auto; car.place(START + 30, 0, 0); manualGear = 1;
  sprites = new CarSprites(meshOf(id, myNum), mm, pitchDeg, spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, matchMedia('(pointer: coarse)').matches ? 1200 : 2400); sprites.prepare([0]); (live ? 0 : sprites.work(500)); sprites.prepare([-1, 1, -2, 2, -3, -4, -5]); camAng = car.yaw;
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
    for (const o of [-(W2 + 1.5), W2 + 1.5]) { if (!fenceOk(Math.sign(o), Math.floor(s))) continue; const a = T.point(s, o), b = T.point(s + 1.05, o), za = T.height(s, o) + 0.9, zb = T.height(s + 1.05, o) + 0.9; ctx.strokeStyle = 'rgba(232,227,214,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, za)); ctx.lineTo(...P(b.x, b.y, zb)); ctx.stroke(); }   // the fence's rail
    if (Math.round(s) % 3 === 0) for (const o of [-(W2 + 1.5), W2 + 1.5]) { if (!fenceOk(Math.sign(o), Math.floor(s))) continue; const z = T.height(s, o), [X, Y] = P(T.point(s, o).x, T.point(s, o).y, z), [, Yt] = P(T.point(s, o).x, T.point(s, o).y, z + 1); ctx.fillStyle = '#e8e3d6'; ctx.fillRect(Math.round(X), Math.round(Yt), 1, Math.max(1, Math.round(Y - Yt))); }
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
/** the dials (temporary): a speedometer and a revolution counter, bottom left, period faces */
function dials() { const r = Math.max(26, Math.min(46, Math.round(VH * 0.11))), y = VH - r - 8, top = Math.ceil(car.spec.topKmh / 20) * 20 + 20, maxR = Math.ceil(car.spec.redline * 1.2 / 500) * 500;
  const dial = (cx: number, v: number, max: number, step: number, label: string, red: number, sub: string) => { const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (x: number) => a0 + (a1 - a0) * Math.min(1, Math.max(0, x / max));
    main.fillStyle = 'rgba(18,16,14,0.82)'; main.beginPath(); main.arc(cx, y, r, 0, Math.PI * 2); main.fill(); main.strokeStyle = '#b9a77e'; main.lineWidth = 2; main.stroke();
    if (red < max) { main.strokeStyle = '#c0392b'; main.lineWidth = 3; main.beginPath(); main.arc(cx, y, r - 4, ang(red), ang(max)); main.stroke(); }
    main.strokeStyle = '#efe7d2'; main.fillStyle = '#efe7d2'; main.font = `${Math.max(6, Math.round(r * 0.22))}px Oswald, sans-serif`; main.textAlign = 'center'; main.textBaseline = 'middle';
    for (let x = 0; x <= max + 1e-6; x += step / 2) { const a = ang(x), big = Math.abs(x / step - Math.round(x / step)) < 1e-6, r0 = r - (big ? 8 : 5); main.lineWidth = big ? 1.5 : 1; main.beginPath(); main.moveTo(cx + Math.cos(a) * r0, y + Math.sin(a) * r0); main.lineTo(cx + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); main.stroke();
      if (big && r > 30) main.fillText(String(Math.round(x / (label === 'rpm' ? 1000 : 1))), cx + Math.cos(a) * (r - 15), y + Math.sin(a) * (r - 15)); }
    const a = ang(v); main.strokeStyle = '#ff9f40'; main.lineWidth = 2; main.beginPath(); main.moveTo(cx - Math.cos(a) * 5, y - Math.sin(a) * 5); main.lineTo(cx + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); main.stroke();
    main.fillStyle = '#d8c9a3'; main.beginPath(); main.arc(cx, y, 3, 0, Math.PI * 2); main.fill(); main.fillStyle = '#efe7d2'; main.fillText(sub, cx, y + r * 0.45); main.font = `${Math.max(5, Math.round(r * 0.16))}px Oswald, sans-serif`; main.fillText(label === 'rpm' ? 'RPM ×1000' : 'KM/H', cx, y - r * 0.38); main.textAlign = 'left'; };
  dial(8 + r, car.speed * 3.6, top, top > 160 ? 40 : 20, 'km/h', top, `${(car.speed * 3.6).toFixed(0)}`);
  dial(8 + r * 3 + 8, car.rpm, maxR, 1000, 'rpm', car.spec.redline, `${car.gear}단`);
  // the steering wheel as the driver's hands have it (review 100): turned by the road wheels' angle times the ratio
  { const cx = 8 + r * 5 + 16, rr = r * 0.8, a = -car.sw, S = steering(car.spec), l2l = 2 * car.spec.steerLock * S.ratio / 360;
    main.save(); main.translate(cx, y); main.fillStyle = 'rgba(18,16,14,0.55)'; main.beginPath(); main.arc(0, 0, rr + 4, 0, Math.PI * 2); main.fill();
    main.rotate(a); main.strokeStyle = '#2b2622'; main.lineWidth = 6; main.beginPath(); main.arc(0, 0, rr, 0, Math.PI * 2); main.stroke(); main.strokeStyle = '#8a6a44'; main.lineWidth = 4; main.stroke();
    main.strokeStyle = '#c9c3b4'; main.lineWidth = 2; for (const k of [0, 1, 2]) { const t = Math.PI / 2 + k * Math.PI * 2 / 3; main.beginPath(); main.moveTo(0, 0); main.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); main.stroke(); }
    main.fillStyle = '#c0392b'; main.fillRect(-2, -rr - 3, 4, 6); main.fillStyle = '#d8c9a3'; main.beginPath(); main.arc(0, 0, rr * 0.22, 0, Math.PI * 2); main.fill(); main.restore();
    main.fillStyle = '#efe7d2'; main.font = `${Math.max(6, Math.round(r * 0.2))}px Oswald, sans-serif`; main.textAlign = 'center'; main.fillText(`핸들 ${Math.round(car.sw * 180 / Math.PI)}°`, cx, y + rr + 4 + Math.max(6, r * 0.2)); main.fillText(`${S.ratio}:1 · ${l2l.toFixed(1)}회전`, cx, y - rr - 9); main.textAlign = 'left'; } }
function letterbox() { const b = Math.round(VH * 0.1); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, b); ctx.fillRect(0, VH - b, VW, b);
  ctx.fillStyle = '#e9e4d8'; ctx.font = `${Math.max(7, Math.round(b * 0.42))}px Oswald, sans-serif`; ctx.textBaseline = 'middle';
  const me = race?.player, lap = me ? `${Math.min(race!.laps, me.lapAt.length)}/${race!.laps}바퀴 · ${race!.order().indexOf(me) + 1}위` : T.pieceAt(car.s);
  ctx.fillText(`${car.spec.name}  ·  ${(car.speed * 3.6).toFixed(0)} km/h  ·  ${lap}`, Math.round(b * 0.5), VH - b / 2); ctx.fillText('MILLBROOK', Math.round(b * 0.5), b / 2); }
function drawSteam(el: number) { const h = car.health; if ((h.water >= WARN.boil || h.failed === 'gasket') && Math.random() < 0.5) { const f = car.spec.wheelbase * (1 - car.spec.frontShare) + 0.4; steam.push({ x: car.x + Math.cos(car.yaw) * f, y: car.y + Math.sin(car.yaw) * f, z: T.height(car.s, car.off) + 1.2, r: 0.3, a: 0.5 }); smoke.emit('steam', car.x + Math.cos(car.yaw) * f, car.y + Math.sin(car.yaw) * f, T.height(car.s, car.off) + 1.1, car.vx * Math.cos(car.yaw) * 0.5, car.vx * Math.sin(car.yaw) * 0.5, 0.8, 1, T.height(car.s, car.off)); }
  for (const p of steam) { p.z += 1.2 * el; p.r += 0.8 * el; p.a -= 0.35 * el; } for (let i = steam.length - 1; i >= 0; i--) if (steam[i]!.a <= 0) steam.splice(i, 1);
  if (!live) for (const p of steam) { ctx.fillStyle = `rgba(245,245,245,${p.a})`; ctx.beginPath(); ctx.arc(...P(p.x, p.y, p.z), p.r * 1000 / mm, 0, Math.PI * 2); ctx.fill(); } }
// ---- sounds ----
const ENGINE = (specsData as { cars: Record<string, { engine: { kind: string; layout: string } }> }).cars;
const voiceOf = (id: string) => { const e = ENGINE[id]?.engine ?? EXP_ENGINE[id]!; return { cylinders: +e.layout.replace(/\D/g, '') || 4, kind: (e.kind === 'sleeve' ? 'sleeve' : e.kind === 'ohv' ? 'ohv' : 'sv') as 'sv' | 'ohv' | 'sleeve', supercharged: id === 'dueSSJ35' || !!EXP_ENGINE[id]?.supercharged }; };
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
function marks(c: Vehicle) { markTick++; for (let i = 0; i < 4; i++) { const k = skidOf(c, i), sl = 1 + k.amount * 0.6;
    if (c.onGrass[i] && c.speed > 4 && markTick % 2 === 0 && Math.random() < Math.min(0.5, c.speed / 60)) { const [px, py] = c.wheelAt(i), cy = Math.cos(c.yaw), sy2 = Math.sin(c.yaw), x = c.x + px * cy - py * sy2, y = c.y + px * sy2 + py * cy;
      smoke.emit('dust', x, y, 0.2, -cy * 1.5 + (Math.random() - 0.5) * 2, -sy2 * 1.5 + (Math.random() - 0.5) * 2, 1.2, Math.min(1, c.speed / 25), 0); }   /* dust thrown up off the grass */
    if (k.amount <= 0 || markTick % 2) continue;
    const [px, py] = c.wheelAt(i), cy = Math.cos(c.yaw), sy2 = Math.sin(c.yaw), x = c.x + px * cy - py * sy2, y = c.y + px * sy2 + py * cy, q = T.locate(x, y, c.s), z = T.height(q.s, q.off);
    if (Math.random() < 0.22 * k.amount) { const vx = c.vx * Math.cos(c.yaw) * 0.25, vy = c.vx * Math.sin(c.yaw) * 0.25; smoke.emit('tyre', x, y, z + 0.15, vx + (Math.random() - 0.5), vy + (Math.random() - 0.5), 0.6, k.amount, z); }   /* the live picture's tyre smoke */
    skids.push({ x, y, z, a: Math.min(0.6, 0.12 + 0.45 * k.amount) * (k.kind === 'lock' ? 1.2 : 1) }); if (skids.length > 9000) skids.shift(); if (Math.random() < 0.12 * (0.3 + k.amount)) puffs.push({ x, y, z: z + 0.2, r: 0.3, a: 0.35, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 }); } }
/** every car in view, the farthest first */
/** the scenery and the cars together, the farthest first; decks over the track after them all */
/** what the scene holds this frame, each with its depth (screen Y of its ground point), its picture and where it lands */
interface Drawn { Y: number; img: HTMLCanvasElement; X0: number; Y0: number; car?: Vehicle; over?: boolean; glints?: [number, number][] }
function scene(): Drawn[] { const a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2, reach = Math.hypot(VW, VH / SP) * mm / 2000 + 30, out: Drawn[] = [];
  const seen = (x: number, y: number) => Math.abs(x - camX) < reach && Math.abs(y - camY) < reach;
  const prop = (q: Placed) => { if (!seen(q.x, q.y)) return; const ps = propPic(q.kind, q.arg); if (!ps) return; const [X, Y] = P(q.x, q.y, q.z ?? 0), f = ps.get(q.heading - a);
    out.push({ Y: P(q.x, q.y, 0)[1], img: f.canvas, X0: Math.round(X - f.ax), Y0: Math.round(Y - f.ay), over: q.overhead }); };
  for (const q of SCN.props) prop(q); for (const q of trainCars()) prop(q);
  const cars = race ? race.cars.map(e => ({ c: e.car, sp: e.driver ? others.get(e)! : sprites, turn: e.wheelTurn })) : [{ c: car, sp: sprites, turn: wheelTurn }];
  for (const { c, sp, turn } of cars) { const z = T.height(c.s, c.off) + c.zb, [X, Y] = P(c.x, c.y, z); if (X < -150 || X > VW + 150 || Y < -150 || Y > VH + 150) continue;
    const f = sp.get(sp.key(c.yaw - a, c.tilt + c.roll * 1.5, c.steer, turn, c.speed)); out.push({ Y: P(c.x, c.y, 0)[1], img: f.canvas, X0: Math.round(X - f.ax), Y0: Math.round(Y - f.ay), car: c, glints: f.glints }); }
  return out.sort((p, q) => (p.over ? 1 : 0) - (q.over ? 1 : 0) || p.Y - q.Y); }
const boxes = (a: Drawn, b: Drawn) => a.X0 < b.X0 + b.img.width && b.X0 < a.X0 + a.img.width && a.Y0 < b.Y0 + b.img.height && b.Y0 < a.Y0 + a.img.height;
const alphas = new WeakMap<HTMLCanvasElement, Uint8Array>();
const alphaOf = (c: HTMLCanvasElement) => { let a = alphas.get(c); if (!a) { const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; a = new Uint8Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]!; alphas.set(c, a); } return a; };
/** does b cover any of a at all (a few solid pixels: a tree's trunk across a car counts) */
function covers(a: Drawn, b: Drawn): boolean { if (!boxes(a, b)) return false; const A = alphaOf(a.img), B = alphaOf(b.img), aw = a.img.width, bw = b.img.width; let n = 0;
  const x0 = Math.max(a.X0, b.X0), x1 = Math.min(a.X0 + aw, b.X0 + bw), y0 = Math.max(a.Y0, b.Y0), y1 = Math.min(a.Y0 + a.img.height, b.Y0 + b.img.height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A[(y - a.Y0) * aw + (x - a.X0)]! > 128 && B[(y - b.Y0) * bw + (x - b.X0)]! > 128 && ++n > 3) return true;
  return false; }
/** the car's outline only where the things before it hide it (their solid pixels, not their shadows), in one light colour */
const hidCv = document.createElement('canvas'), hidCx = hidCv.getContext('2d')!;
function hiddenPart(c: Drawn, by: Drawn[]): HTMLCanvasElement | null { const w = c.img.width, h = c.img.height, A = alphaOf(c.img); if (hidCv.width < w || hidCv.height < h) { hidCv.width = Math.max(hidCv.width, w); hidCv.height = Math.max(hidCv.height, h); }
  const im = hidCx.createImageData(w, h), d = im.data; let any = false;
  for (const o of by) { const B = alphaOf(o.img), bw = o.img.width, x0 = Math.max(0, o.X0 - c.X0), x1 = Math.min(w, o.X0 + bw - c.X0), y0 = Math.max(0, o.Y0 - c.Y0), y1 = Math.min(h, o.Y0 + o.img.height - c.Y0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; if (A[i]! > 128 && B[(y + c.Y0 - o.Y0) * bw + (x + c.X0 - o.X0)]! > 128) { d[i * 4] = 255; d[i * 4 + 1] = 226; d[i * 4 + 2] = 168; d[i * 4 + 3] = 255; any = true; } } }
  if (!any) return null; hidCx.clearRect(0, 0, hidCv.width, hidCv.height); hidCx.putImageData(im, 0, 0); return hidCv; }
/** the whole picture: the layer behind (blurred by the camera's motion), the player's car sharp, what stands before it, the hidden cars' outlines */
// ---- crash damage (review 121): each car's structure of nodes and beams (race/damage.ts), built at its first blow; the
// blows the physics recorded bend it, the skin drawn bent (rebuilt at most five times a second), a wheel knocked askew
// steers the car off true, a crushed radiator cools less and leaks, a part come away flies off as a piece ----
/** off for now (review 122): the driving, the pictures and the game come first; the structure comes back later as detail */
const DAMAGE = false;
const dmg = new WeakMap<Vehicle, { D: Damage; M: Mesh; t: number }>();
function bend(c: Vehicle, base: Mesh, L: LiveRenderer) { let e = dmg.get(c);
  if (c.hits.length) { if (!e) { e = { D: new Damage(base), M: base, t: 0 }; dmg.set(c, e); } const D = e.D, len = base.length, rest = c.rings[0]!.rest, cg = c.spec.cgH;
    for (const h of c.hits.splice(0)) D.impact([len / 2 - h.at[0] * 1000, h.at[1] * 1000, (h.at[2] + cg + rest) * 1000], [-h.dir[0], h.dir[1], h.dir[2]], h.E, h.r * 1000);
    for (const w of wheelsOf(base)) { const i = (w.front ? 0 : 2) + (w.hy > 0 ? 0 : 1), a = D.askew([w.hx, w.hy, w.hz]); c.toeDmg[i] = a.toe; c.camDmg[i] = a.camber; }
    c.health.radiator = 1 - 0.9 * D.radiator;
    for (const l of D.loose.splice(0)) { const m = D.piece(l), wp = c.toWorld([(len / 2 - l.centre[0]) / 1000, l.centre[1] / 1000, l.centre[2] / 1000 - cg - rest]), v = c.velAt(wp); let ext = 0; for (let q = 0; q < m.pos.length; q++) ext = Math.max(ext, Math.abs(m.pos[q]!));
      debris3.add({ kind: 'part', len: ext / 500, mesh: m, key: `loose${c.spec.id}${l.part}${Math.random()}`, x: wp[0], y: wp[1], z: wp[2], vx: v[0] * 0.8 + (Math.random() - 0.5) * 3, vy: v[1] * 0.8 + (Math.random() - 0.5) * 3, vz: 1.5 + Math.random() * 3,
        yaw: c.yaw + Math.PI, pitch: 0, roll: 0, wy: (Math.random() - 0.5) * 8, wp: (Math.random() - 0.5) * 8, wr: (Math.random() - 0.5) * 8, life: 120 }); } }
  if (e && e.D.dirty && performance.now() - e.t > 200) { const old = e.M; e.M = e.D.rebuild(); L.swapCar(old, e.M); e.t = performance.now(); } }

// ---- the fence: a car that reaches it smashes a few metres of it into flying pieces ----
const debris3 = new Debris(), dirtyChunks = new Set<string>(), fenceGpu = new Map<string, { g: ReturnType<LiveRenderer['car']>; m: Float32Array; x: number; y: number } | null>();   /* the fence as solid things, its pieces as bodies (review 112) */
const broken = new Set<string>(), debris: { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; len: number; col: string; life: number }[] = [];
const FENCE = T.spec.width / 2 + 1.5, fenceOk = (side: number, m: number) => !broken.has(`${side}:${((m % Math.round(T.length)) + Math.round(T.length)) % Math.round(T.length)}`);
function fence(c: Vehicle) { const side = Math.sign(c.off), reach = Math.abs(c.off) + c.spec.track / 2 + 0.3; if (reach < FENCE || Math.abs(c.off) > FENCE + 3) return; const m = Math.floor(c.s); if (!fenceOk(side, m)) return;
  const sp = Math.hypot(c.vx, c.vy); if (sp < 2) return;
  for (let k = -2; k <= 3; k++) broken.add(`${side}:${((m + k) % Math.round(T.length) + Math.round(T.length)) % Math.round(T.length)}`);
  const vxW = c.vx * Math.cos(c.yaw) - c.vy * Math.sin(c.yaw), vyW = c.vx * Math.sin(c.yaw) + c.vy * Math.cos(c.yaw), n = 10 + Math.floor(Math.min(14, sp / 3));
  for (let k = -2; k <= 3; k++) dirtyChunks.add(`${side}:${Math.floor((((m + k) % Math.round(T.length)) + Math.round(T.length)) % Math.round(T.length) / CHUNK)}`);
  for (let k = 0; k < n; k++) { const p = T.point(c.s + (Math.random() - 0.3) * 5, side * FENCE), post = Math.random() < 0.3, f = 0.35 + Math.random() * 0.6;
    debris3.add({ kind: post ? 'post' : 'rail', len: post ? 1 : 0.6 + Math.random() * 1.6, x: p.x, y: p.y, z: T.height(c.s, side * FENCE) + 0.4 + Math.random() * 0.6, vx: vxW * f + (Math.random() - 0.5) * 5, vy: vyW * f + (Math.random() - 0.5) * 5, vz: 2 + Math.random() * sp * 0.22,
      yaw: T.at(c.s).h + (Math.random() - 0.5), pitch: post ? 0 : (Math.random() - 0.5) * 0.4, roll: 0, wy: (Math.random() - 0.5) * 16, wp: (Math.random() - 0.5) * 18, wr: (Math.random() - 0.5) * 18, life: 40 });
    debris.push({ x: p.x, y: p.y, z: T.height(c.s, side * FENCE) + 0.3 + Math.random() * 0.7, vx: vxW * f + (Math.random() - 0.5) * 5, vy: vyW * f + (Math.random() - 0.5) * 5, vz: 2 + Math.random() * sp * 0.22, a: Math.random() * 6, va: (Math.random() - 0.5) * 22, len: post ? 0.9 : 0.6 + Math.random() * 1.6, col: post ? '#d9d2bf' : '#efe9dc', life: 6 + Math.random() * 3 }); }
  while (debris.length > 160) debris.shift();
  c.vx *= 0.86; c.vy *= 0.9; c.r += (Math.random() - 0.5) * 0.4;   // the blow costs speed and turns the car a little
  { const h = T.at(c.s).h, into: [number, number, number] = [Math.sin(h) * side, -Math.cos(h) * side, 0], at = c.toWorld([0.3, side * c.box.hw * Math.sign(Math.cos(c.yaw - h) || 1), 0.1]); c.blow(at, into, Math.min(25000, 0.5 * c.spec.mass * sp * sp * 0.03), 0.6); }   /* the rails and posts dent its flank (review 121) */
  if (c === car) { snd?.crash(Math.min(1.3, sp / 20)); shake = 4; } else { const d = Math.hypot(c.x - car.x, c.y - car.y); if (d < 120) snd?.crash(Math.min(1, sp / 20) / (1 + (d / 25) ** 2)); } }
function stepDebris3(el: number) { const cs = (race ? race.cars.map(e => e.car) : [car]).map(c => ({ x: c.x, y: c.y, vx: c.vx * Math.cos(c.yaw) - c.vy * Math.sin(c.yaw), vy: c.vx * Math.sin(c.yaw) + c.vy * Math.cos(c.yaw), r: c.spec.wheelbase * 0.7 }));
  debris3.step(Math.min(0.05, el), (x, y) => { const q = T.locate(x, y, car.s); return Math.abs(q.off) < T.spec.width / 2 ? T.height(q.s, q.off) : 0; }, cs); }
function drawDebris(el: number) { stepDebris3(el); if (!live) for (const d of debris3.pieces) { const L2 = (d.kind === 'rail' ? d.len : 1) / 2, ex = Math.cos(d.yaw) * Math.cos(d.pitch) * L2, ey = Math.sin(d.yaw) * Math.cos(d.pitch) * L2, ez = (d.kind === 'post' ? Math.cos(d.pitch) : Math.sin(d.pitch)) * L2;
    const [X, Y] = P(d.x - ex, d.y - ey, d.z - ez), [X2, Y2] = P(d.x + ex, d.y + ey, d.z + ez); main.globalAlpha = Math.min(1, d.life / 1.5); main.strokeStyle = '#3a352c'; main.lineWidth = 3; main.beginPath(); main.moveTo(X, Y); main.lineTo(X2, Y2); main.stroke(); main.strokeStyle = '#efe9dc'; main.lineWidth = 1.5; main.beginPath(); main.moveTo(X, Y); main.lineTo(X2, Y2); main.stroke(); main.globalAlpha = 1; }
  return;  for (let k = debris.length - 1; k >= 0; k--) { const d = debris[k]!; d.life -= el; if (d.life <= 0) { debris.splice(k, 1); continue; }
    d.vz -= 9.81 * el; d.x += d.vx * el; d.y += d.vy * el; d.z += d.vz * el; d.a += d.va * el; const q = T.locate(d.x, d.y, car.s), floor = Math.abs(q.off) < T.spec.width / 2 ? T.height(q.s, q.off) : 0;
    if (d.z < floor) { d.z = floor; d.vz = Math.abs(d.vz) * 0.3; d.vx *= 0.6; d.vy *= 0.6; d.va *= 0.6; if (Math.abs(d.vz) < 0.5) { d.vz = 0; d.va *= 0.8; } }
    const [X, Y] = P(d.x, d.y, d.z), [X2, Y2] = P(d.x + Math.cos(d.a) * d.len, d.y + Math.sin(d.a) * d.len, d.z + Math.sin(d.a * 0.7) * d.len * 0.3);
    main.globalAlpha = Math.min(1, d.life / 1.5); main.strokeStyle = '#3a352c'; main.lineWidth = 3; main.beginPath(); main.moveTo(X, Y); main.lineTo(X2, Y2); main.stroke(); main.strokeStyle = d.col; main.lineWidth = 1.5; main.beginPath(); main.moveTo(X, Y); main.lineTo(X2, Y2); main.stroke(); main.globalAlpha = 1; } }
function drawWorld(el: number) { if (live) { drawLive(el); return; } const all = scene(), cars = all.filter(d => d.car), props = all.filter(d => !d.car);
  if (bg.width !== VW || bg.height !== VH) { bg.width = VW; bg.height = VH; } ctx = bgx; bgx.imageSmoothingEnabled = false; drawTrack();
  // the still world (ground and buildings) on the layer behind; what stands before a car is drawn again over it
  const front = new Set<Drawn>(); for (const d of props) { bgx.drawImage(d.img, d.X0, d.Y0); for (const c of cars) if ((d.over || d.Y > c.Y) && covers(c, d)) front.add(d); }
  ctx = main;
  // motion blur by each thing's own motion across the picture: the ground by the camera's, a car by its speed against the camera's
  const cvx = (camX - lastCamX) / Math.max(el, 1e-3), cvy = (camY - lastCamY) / Math.max(el, 1e-3); lastCamX = camX; lastCamY = camY;
  const streak = (vx: number, vy: number): [number, number] => { const [x0, y0] = P(camX, camY, camZ), [x1, y1] = P(camX + vx * 0.05, camY + vy * 0.05, camZ); const bx = x1 - x0, by = y1 - y0, l = Math.hypot(bx, by); return l > 40 ? [bx / l * 40, by / l * 40] : [bx, by]; };
  shake = car.speed > 25 ? (car.speed - 25) * 0.012 + Math.min(1.5, Math.abs(car.vzb) * 3) : Math.min(1.5, Math.abs(car.vzb) * 3);
  const jx = Math.round((Math.random() - 0.5) * shake), jy = Math.round((Math.random() - 0.5) * shake);
  const smear = (img: CanvasImageSource, x: number, y: number, b: [number, number]) => { main.drawImage(img, x + jx, y + jy); const l = Math.hypot(b[0], b[1]); if (!blurOn || l < 1.5) return;
    const n = 6; for (let k = 1; k <= n; k++) { main.globalAlpha = 0.42 * (1 - k / (n + 1)); main.drawImage(img, Math.round(x + jx - b[0] * k / n), Math.round(y + jy - b[1] * k / n)); } main.globalAlpha = 1; };
  main.clearRect(0, 0, VW, VH); { const b = streak(cvx, cvy); smear(bg, 0, 0, [-b[0], -b[1]]); }   // the ground streams back against the camera
  for (const c of cars) { const v = c.car!, wx = v.vx * Math.cos(v.yaw) - v.vy * Math.sin(v.yaw), wy = v.vx * Math.sin(v.yaw) + v.vy * Math.cos(v.yaw); smear(c.img, c.X0, c.Y0, streak(wx - cvx, wy - cvy)); }
  for (const d of [...front].sort((a, b) => (a.over ? 1 : 0) - (b.over ? 1 : 0) || a.Y - b.Y)) main.drawImage(d.img, d.X0 + jx, d.Y0 + jy);
  // a car hidden by anything that stands before it (a stand, a tree, a bush, the railway, a bridge): its outline, faint,
  // over just the part that is hidden; the rest of the car shows as itself
  for (const c of cars) { const by = props.filter(d => (d.over || d.Y > c.Y) && covers(c, d)); if (!by.length) continue; const s = hiddenPart(c, by); if (!s) continue;
    main.globalAlpha = c.car === car ? 0.6 : 0.4; main.drawImage(s, 0, 0, c.img.width, c.img.height, c.X0 + jx, c.Y0 + jy, c.img.width, c.img.height); main.globalAlpha = 1; }
  drawDebris(el);
  // speed: the edges darken a little
  if (car.speed > 30) { const v = Math.min(1, (car.speed - 30) / 30) * 0.35, g = main.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${v})`); main.fillStyle = g; main.fillRect(0, 0, VW, VH); } }
/** the train's pieces where it is on the line (locomotive, tender, three carriages), or none */
function trainCars(): Placed[] { if (train.d < 0) return []; const R = SCN.railway, out: Placed[] = []; let acc = 0; const at = (d: number): Placed | null => { acc = 0; for (let k = 0; k + 1 < R.length; k++) { const [x0, y0] = R[k]!, [x1, y1] = R[k + 1]!, n = Math.hypot(x1 - x0, y1 - y0); if (acc + n >= d) { const f = (d - acc) / n; return { kind: '', x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, heading: Math.atan2(y1 - y0, x1 - x0) }; } acc += n; } return null; };
  for (const [kind, back] of [['locomotive', 6], ['tender', 15.9], ['carriage', 27.3], ['carriage', 42.5], ['carriage', 57.7]] as const) { const q = at(train.d - back); if (q) out.push({ ...q, kind }); } return out; }
function drawCars() { if (!race) { drawCar(); return; } const a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2;
  const list = race.cars.map(e => { const c = e.car, z = T.height(c.s, c.off) + c.zb, [X, Y] = P(c.x, c.y, z); return { e, c, X, Y }; }).filter(q => q.X > -150 && q.X < VW + 150 && q.Y > -150 && q.Y < VH + 150).sort((p, q) => p.Y - q.Y);
  for (const { e, c, X, Y } of list) { const sp = e.driver ? others.get(e)! : sprites, f = sp.get(sp.key(c.yaw - a, c.tilt + c.roll * 1.5, c.steer, e.wheelTurn, c.speed)); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); } }
function drawCar() { const z = T.height(car.s, car.off) + car.zb, roll = car.tilt + car.roll * 1.5, a = (turning() ? camAng : Math.PI / 2) - Math.PI / 2;
  const f = sprites.get(sprites.key(car.yaw - a, roll, car.steer, wheelTurn, car.speed)), [X, Y] = P(car.x, car.y, z); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); }
function drawPuffs() { if (live) return; for (const p of puffs) { ctx.fillStyle = `rgba(205,200,190,${p.a})`; const r = p.r * 1000 / mm; ctx.beginPath(); ctx.arc(...P(p.x, p.y, p.z), r, 0, Math.PI * 2); ctx.fill(); } }
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
  for (const e of race.cars) if (e.driver) { const sp = new CarSprites(meshOf(e.id, numOf(e)), mm, pitchDeg, e.car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 400 : 900); sp.prepare([0]); others.set(e, sp); }
  sprites = new CarSprites(meshOf(carId, myNum), mm, pitchDeg, car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 800 : 1800); sprites.prepare([0]); (live ? 0 : sprites.work(300));
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
  input.throttle = Math.max(0, Math.min(1, input.throttle + (down('arrowup', 'w') ? (st.progressive ? 0.55 : 4) : (st.progressive ? -3 : -6)) * dt));   /* the gauge mode: the pedal goes down as long as it is held */
  input.brake = Math.max(0, Math.min(1, input.brake + (down('arrowdown', 's') ? 5 : -8) * dt)); input.hand = down(' ') ? 1 : 0;
  let steer = input.steer; if (st.assist) { const over = car.r - car.speed * T.at(car.s).k; if (Math.abs(over) > 0.1 && Math.sign(over) === Math.sign(-car.vy)) steer += Math.atan2(car.vy, Math.max(5, car.vx)) / usefulLock(car.spec, car.speed, car.tyre.mu) * 0.7; }
  const most = car.spec.steerLock * Math.PI / 180 / usefulLock(car.spec, car.speed, car.tyre.mu);
  return { steer: Math.max(-most, Math.min(most, steer)), throttle: input.throttle, brake: input.brake, handbrake: input.hand, gear: manualGear }; }
// ---- the loop ----
let last = performance.now(), acc = 0;
function frame(now: number) { const el = Math.min(0.1, (now - last) / 1000); last = now; acc += el; clock += el; msgT -= el;
  while (acc >= DT) { acc -= DT; const u = st.pilot ? pilot.drive(car) : controls(DT);
    if (race) { race.step(DT, u); wheelTurn = race.player!.wheelTurn; if (race.done && !$('results').dataset.shown) results(); } else { car.step(DT, u); wheelTurn += (car.w[0]! + car.w[1]!) / 2 * DT; }
    for (const c of race ? race.cars.map(e => e.car) : [car]) { marks(c); fence(c); }
    // lap: forward across the start line
    if (!race && T.gap(prevS, START) > 0 && T.gap(car.s, START) <= 0 && car.vx > 1) { if (lapStart >= 0) { lastLap = clock - lapStart; if (!bestLap || lastLap < bestLap) bestLap = lastLap; say(`한 바퀴 ${fmt(lastLap)}`); } lapStart = clock; }
    prevS = car.s;
    if (dirtGrows && car.speed > 1) { const grass = car.onGrass.filter(Boolean).length / 4; myWear[2] = Math.min(1, myWear[2] + DT * car.speed * (grass * 0.0012 + 0.000004)); }   /* mud off the grass quickly, road dust slowly */
    if (car.over) { say('뱅크 꼭대기를 넘어갔습니다 — 트랙으로 복귀'); car.over = false; car.place(car.s, 0, 0); } if (car.upset && car.speed < 3) { say('차가 뒤집혔습니다 — 트랙으로 복귀'); car.place(car.s, 0, 0); } }
  for (const p of puffs) { p.x += p.vx * el; p.y += p.vy * el; p.z += 0.4 * el; p.r += 0.9 * el; p.a -= 0.4 * el; } while (puffs.length && puffs[0]!.a <= 0) puffs.shift(); for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.a <= 0) puffs.splice(i, 1);
  // the camera: on the car, a little ahead of where it is going
  const lead = Math.min(10, car.speed * 0.2), tx = car.x + Math.cos(car.yaw) * lead, ty = car.y + Math.sin(car.yaw) * lead, tz = T.height(car.s, car.off);
  camX += (tx - camX) * Math.min(1, el * 5); camY += (ty - camY) * Math.min(1, el * 5); camZ += (tz - camZ) * Math.min(1, el * 5);
  if (!st.free) { const vh = car.speed > 2 ? Math.atan2(Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy, Math.cos(car.yaw) * car.vx - Math.sin(car.yaw) * car.vy) : car.yaw, d = Math.atan2(Math.sin(vh - camAng), Math.cos(vh - camAng)); camAng += d * Math.min(1, el * 2.5); }   // the turning camera follows where the car goes, gently
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
  drawWorld(el); drawPuffs(); drawSteam(el); if (st.cine) letterbox(); else dials(); hud(); mini(); sounds(); (live ? 0 : sprites.work(5)); if (!live) for (const sp of others.values()) sp.work(2); requestAnimationFrame(frame); }
// ---- page ----
const pick = $<HTMLSelectElement>('car'); for (const id of RACE_CARS) pick.add(new Option(raceSpec(id).name, id));
{ const g = document.createElement('optgroup'); g.label = '새 3D 차 (레퍼런스 시트로 제작)'; for (const id of NEW_CARS) g.append(new Option(raceSpec(id).name, id)); pick.append(g); }
{ const g = document.createElement('optgroup'); g.label = '실험: 시대 밖의 차'; for (const id of EXP_CARS) g.append(new Option(`${raceSpec(id).name} — ${raceSpec(id).era}`, id)); pick.append(g); }
pick.value = carId;
pick.addEventListener('change', () => { carId = pick.value; if (race) stopRace(); else choose(pick.value); pick.blur(); });
const setCine = (on: boolean) => { st.cine = on; ($('cine') as HTMLInputElement).checked = on; document.body.classList.toggle('cine', on); shot.until = 0; fit(); };
$<HTMLInputElement>('cine').addEventListener('change', e => setCine((e.target as HTMLInputElement).checked));
$<HTMLInputElement>('blur').addEventListener('change', e => { blurOn = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('lamps').addEventListener('change', e => { lampsOn = (e.target as HTMLInputElement).checked; });   /* the head lamps (review 117) */
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
// ---- the free camera: drag to turn it round the car and tilt it, the wheel or a pinch to come closer or go further ----
// The pictures are baked for one height and one scale, so a new height or scale bakes them again (a moment after the
// gesture ends); turning needs nothing new (the pictures are kept for 64 headings).
const ZOOM = [4, 6, 8, 12, 16, 20, 25, 30, 40, 50, 65, 80, 100, 130], PMIN = 15, PMAX = 85;
let bakeT = 0;
function rebake(full = !live) { SP = Math.sin(pitchDeg * Math.PI / 180); CP = Math.cos(pitchDeg * Math.PI / 180); ($('pitch') as HTMLInputElement).value = String(pitchDeg); $('pitchv').textContent = `${pitchDeg}°`; camShow(); if (!full) return;   // live: nothing to bake
  propSprites.clear(); const small = matchMedia('(pointer: coarse)').matches;
  sprites = new CarSprites(meshOf(carId, myNum), mm, pitchDeg, car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 1200 : 2400); sprites.prepare([0]); (live ? 0 : sprites.work(300));
  for (const e of [...others.keys()]) { const sp = new CarSprites(meshOf(e.id, numOf(e)), mm, pitchDeg, e.car.spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, small ? 400 : 900); sp.prepare([0]); others.set(e, sp); }
  ($('pitch') as HTMLInputElement).value = String(pitchDeg); $('pitchv').textContent = `${pitchDeg}°`; camShow(); }
const camShow = () => { $('camv').textContent = `${st.free ? '자유' : st.chase ? '따라 돎' : '북쪽 위'} · 높이 ${pitchDeg}° · ${mm} mm/픽셀 · 방향 ${Math.round(((90 - camAng * 180 / Math.PI) % 360 + 360) % 360)}°`; };
/** a new height or scale, baked once the gesture has rested */
function want(p: number, m: number) { p = Math.max(PMIN, Math.min(PMAX, Math.round(p / (live ? 1 : 5)) * (live ? 1 : 5)));   /* live: any whole degree, at once */ if (p === pitchDeg && m === mm) return; pitchDeg = p; mm = m; SP = Math.sin(p * Math.PI / 180); CP = Math.cos(p * Math.PI / 180);
  ($('scale') as HTMLSelectElement).value = String(m); camShow(); clearTimeout(bakeT); if (live) rebake(); else bakeT = setTimeout(rebake, 250) as unknown as number; }
const zoom = (step: number) => { const i = ZOOM.indexOf(mm), k = Math.max(0, Math.min(ZOOM.length - 1, (i < 0 ? ZOOM.findIndex(z => z >= mm) : i) + step)); want(pitchDeg, ZOOM[k]!); };
const setFree = (on: boolean) => { st.free = on; ($('free') as HTMLInputElement).checked = on; if (!on) camAng = car.yaw; camShow(); };
{ const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0, pitch0 = 0, dy0 = 0;
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); pitch0 = pitchDeg; dy0 = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a!.x - b!.x, a!.y - b!.y); } });
  cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { if (st.cine) setCine(false); if (!st.free) setFree(true); camAng -= dx * 0.008; dy0 += dy; const np = Math.max(PMIN, Math.min(PMAX, pitch0 + dy0 * 0.25)); if (Math.round(np / (live ? 1 : 5)) * (live ? 1 : 5) !== pitchDeg) want(np, mm); camShow(); }
    else if (ptrs.size === 2 && pinch0 > 0) { const [a, b] = [...ptrs.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (d / pinch0 > 1.3) { zoom(-1); pinch0 = d; } else if (pinch0 / d > 1.3) { zoom(1); pinch0 = d; } } });
  const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  cv.addEventListener('dblclick', () => setFree(false));
  addEventListener('keydown', e => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return; const k = e.key;
    if (k === ',' || k === '<') { if (!st.free) setFree(true); camAng += 0.12; camShow(); } if (k === '.' || k === '>') { if (!st.free) setFree(true); camAng -= 0.12; camShow(); }
    if (k === '-' || k === '_') zoom(1); if (k === '=' || k === '+') zoom(-1);
    if (k === 'PageUp') { e.preventDefault(); want(pitchDeg + 5, mm); } if (k === 'PageDown') { e.preventDefault(); want(pitchDeg - 5, mm); } if (k === 'Home') setFree(false); }); }
{ const t = $<HTMLInputElement>('live'); t.checked = liveOK; t.disabled = !liveOK; if (!liveOK) $('livenote').textContent = '이 브라우저는 WebGL2가 없어 구운 그림으로 그립니다';
  t.addEventListener('change', () => { live = t.checked ? liveR : null; if (!live) rebake(true); t.blur(); }); }
$<HTMLSelectElement>('look').addEventListener('change', e => { look = (e.target as HTMLSelectElement).value as typeof look; (e.target as HTMLElement).blur(); });
for (const [id, k] of [['wrust', 0], ['wfade', 1], ['wdirt', 2]] as const) $<HTMLInputElement>(id).addEventListener('input', e => { myWear[k] = +(e.target as HTMLInputElement).value; });
for (const [id, set] of [['mbK', (v: number) => { mbK = v; }], ['aoK', (v: number) => { aoK = v; }], ['reflK', (v: number) => { reflK = v; }], ['bloomK', (v: number) => { bloomK = v; }], ['deep', (v: number) => { deep = v; }], ['day', (v: number) => { day = v; }], ['dof', (v: number) => { dof = v; }]] as const) $<HTMLInputElement>(id).addEventListener('input', e => set(+(e.target as HTMLInputElement).value));
$<HTMLInputElement>('outW').addEventListener('input', e => { outW = +(e.target as HTMLInputElement).value; });
$<HTMLInputElement>('outK').addEventListener('input', e => { outK = +(e.target as HTMLInputElement).value; });
$<HTMLInputElement>('inK').addEventListener('input', e => { inK = +(e.target as HTMLInputElement).value; });
$<HTMLSelectElement>('innerOn').addEventListener('change', e => { innerOn = (e.target as HTMLSelectElement).value as typeof innerOn; (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('texK').addEventListener('input', e => { texK = +(e.target as HTMLInputElement).value; });
$<HTMLInputElement>('lightK').addEventListener('input', e => { lightK = +(e.target as HTMLInputElement).value; });
$<HTMLInputElement>('raysOn').addEventListener('change', e => { raysOn = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('artOn').addEventListener('change', e => { artOn = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('wgrow').addEventListener('change', e => { dirtGrows = (e.target as HTMLInputElement).checked; });
$('wclean').addEventListener('click', e => { myWear[2] = 0; $<HTMLInputElement>('wdirt').value = '0'; say('차를 씻었습니다'); (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('num').addEventListener('change', e => { const el = e.target as HTMLInputElement, v = el.value.replace(/\D/g, '').slice(0, 3); el.value = v || myNum; if (v && v !== myNum) { myNum = v; rebake(true); say(`차 번호 ${v}`); } el.blur(); });
$<HTMLInputElement>('free').addEventListener('change', e => setFree((e.target as HTMLInputElement).checked));
$<HTMLInputElement>('pitch').addEventListener('change', e => { want(+(e.target as HTMLInputElement).value, mm); (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('pitch').addEventListener('input', e => { $('pitchv').textContent = `${(e.target as HTMLInputElement).value}°`; if (live) want(+(e.target as HTMLInputElement).value, mm); });
$<HTMLSelectElement>('scale').addEventListener('change', e => { want(pitchDeg, +(e.target as HTMLSelectElement).value); (e.target as HTMLElement).blur(); });
function fit() { if (document.fullscreenElement || document.body.classList.contains('fakefull')) { const k = Math.max(1, Math.round(innerWidth / 900)) * (st.cine ? 2 : 1); VW = Math.ceil(innerWidth / k / 2) * 2; VH = Math.ceil(innerHeight / k); cv.width = VW; cv.height = VH; cv.style.width = `${VW * k}px`; cv.style.height = `${VH * k}px`; ctx.imageSmoothingEnabled = false; return; }
  const box = document.querySelector('.track') as HTMLElement, room = Math.min(box.clientWidth - 14, 1600);
  // the height left on the screen below the picture's top (a phone on its side has little), at least a usable strip
  const availH = Math.max(200, innerHeight - Math.max(0, box.getBoundingClientRect().top + scrollY) - 16);
  const k = Math.max(1, Math.floor(Math.min(room / 768, availH / 432)));
  if (room >= 768 && availH >= 432) { VW = 768; VH = 432; cv.style.width = `${VW * k}px`; cv.style.height = `${VH * k}px`; }
  else { VW = Math.max(300, Math.floor(room / 2) * 2); VH = Math.min(Math.round(VW * (innerHeight > innerWidth ? 0.8 : 0.56)), Math.floor(availH)); cv.style.width = `${VW}px`; cv.style.height = `${VH}px`; }
  if (st.cine) { VW = Math.floor(VW / 4) * 2; VH = Math.floor(VH / 2); }   // the cinematic view: pixels twice the size (closer)
  cv.width = VW; cv.height = VH; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200)); fit(); choose(carId); camX = car.x; camY = car.y; camZ = 0; camShow(); requestAnimationFrame(frame);
(globalThis as { __drive?: unknown }).__drive = { get car() { return car; }, get damage() { const e = dmg.get(car); return e ? { worst: e.D.worst, taken: e.D.taken } : null; }, SCN, T };   // for the page tests (tools): place the car, read the scenery
