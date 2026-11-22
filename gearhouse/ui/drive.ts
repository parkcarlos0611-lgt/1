// The test drive at Millbrook (review 85, step 4): drive one car round the Outer Circuit, seen from a fixed 40-degree
// height and following the car. The track is drawn from its data each frame (concrete shaded by the banking's height,
// its joints and edges, the bridges); the car is its 3D mesh baked at the track's scale; the physics runs at 200 Hz.
// Keys: up/W throttle, down/S brake, left/right or A/D steer, space handbrake, Q/E gears (manual), M automatic or
// manual, R back on the track. Lap times on the start line.
import { millbrook } from '../race/millbrook';
import { raceSpec, RACE_CARS } from '../race/cars';
import { Vehicle, type Controls } from '../race/vehicle';
import { CarSprites } from '../race/sprites';
import { MESH_CARS } from '../render/car/meshcars';
import { Driver } from '../race/driver';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const T = millbrook(), cv = $<HTMLCanvasElement>('view'), ctx = cv.getContext('2d')!;
let SP = Math.sin(30 * Math.PI / 180), CP = Math.cos(30 * Math.PI / 180), pitchDeg = 30; const DT = 1 / 200, START = T.spec.landmarks.find(l => l.kind === 'line')!.s;
let VW = 768, VH = 432, mm = 50;                                               // the picture's own pixels, millimetres a pixel
const st = { auto: true, assist: false, pilot: false, chase: false }; let pilot = new Driver(T), camAng = Math.PI / 2, wheelTurn = 0;   // camAng: the world heading that shows as up the screen let pilot = new Driver(T);
let car!: Vehicle, sprites!: CarSprites, carId = 'chevAB28', camX = 0, camY = 0, camZ = 0;
const keys = new Set<string>(), input = { steer: 0, throttle: 0, brake: 0, hand: 0 }; let manualGear = 1;
const skids: { x: number; y: number; z: number; a: number }[] = [], puffs: { x: number; y: number; z: number; r: number; a: number; vx: number; vy: number }[] = [];
let lapStart = -1, lastLap = 0, bestLap = 0, clock = 0, prevS = 0, msg = '', msgT = 0;

function choose(id: string) { carId = id; const spec = raceSpec(id), m = MESH_CARS.find(c => c.id === id)!;
  car = new Vehicle(spec, T); car.auto = st.auto; car.place(START + 30, 0, 0); manualGear = 1;
  sprites = new CarSprites(m.mesh(), mm, pitchDeg, spec.steerLock * Math.PI / 180, { outline: 3, glass: 0.8 }, matchMedia('(pointer: coarse)').matches ? 1200 : 2400); sprites.prepare([0]); sprites.work(500); sprites.prepare([-1, 1, -2, 2, -3, -4, -5]); camAng = car.yaw;
  pilot = new Driver(T); lapStart = -1; lastLap = 0; bestLap = 0; skids.length = 0; puffs.length = 0; say(`${spec.name} · 출발선 뒤에서 시작`); }
function say(t: string) { msg = t; msgT = 3; }
// ---- the world to the picture ----
// world to picture: the camera turned so that the heading camAng points up the screen (fixed camera: north up)
let cA = 0, sA = 1; const turnCam = () => { const a = (st.chase ? camAng : Math.PI / 2) - Math.PI / 2; cA = Math.cos(a); sA = Math.sin(a); };
const P = (x: number, y: number, z: number): [number, number] => { const dx = x - camX, dy = y - camY, rx = dx * cA + dy * sA, ry = -dx * sA + dy * cA; return [rx * 1000 / mm + VW / 2, (-ry * SP - (z - camZ) * CP) * 1000 / mm + VH * (st.chase ? 0.66 : 0.55)]; };
const sx = (x: number, y = camY) => P(x, y, 0)[0], sy = (y: number, z: number, x = camX) => P(x, y, z)[1]; void sx; void sy;
function drawTrack() {
  // grass, with a little texture fixed to the ground
  ctx.fillStyle = '#5d7348'; ctx.fillRect(0, 0, VW, VH);
  const cell = 2.4, reach = Math.hypot(VW, VH / SP) * mm / 2000 + 4, gx0 = Math.floor((camX - reach) / cell), gx1 = Math.ceil((camX + reach) / cell), rng = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h >>> 8) / 16777216; };
  const vy0 = camY - reach, vy1 = camY + reach;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = Math.floor(vy0 / cell); gy <= Math.ceil(vy1 / cell); gy++) { const v = rng(gx, gy); if (v < 0.55) continue; const [X, Y] = P(gx * cell + rng(gy, gx) * cell, gy * cell, 0); if (X < -2 || Y < -2 || X > VW || Y > VH) continue; ctx.fillStyle = v > 0.85 ? '#6b8253' : '#53683f'; ctx.fillRect(Math.round(X), Math.round(Y), 2, 1); }
  // the concrete: strips across the track from far to near, every metre in view
  const near = T.locate(camX, camY, car.s).s, W2 = T.spec.width / 2, span = 70;
  const strips: { s: number; y: number }[] = []; for (let d = -span; d <= span; d += 1) { const s = near + d, n = T.at(s); strips.push({ s, y: -(n.x - camX) * sA + (n.y - camY) * cA }); }
  strips.sort((a, b) => b.y - a.y);   // far first
  for (const { s } of strips) { const L = 9; for (let k = 0; k < L; k++) { const o0 = -W2 + k * 2 * W2 / L, o1 = o0 + 2 * W2 / L;
      const p = [T.point(s, o0), T.point(s, o1), T.point(s + 1.05, o1), T.point(s + 1.05, o0)], z = (p[0]!.z + p[1]!.z) / 2, slope = Math.abs(T.slope(s, (o0 + o1) / 2).across);
      const g = Math.round(156 + z * 5 - slope * 34);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 9})`; ctx.beginPath(); p.forEach((q, i) => { const [X, Y] = P(q.x, q.y, q.z); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); ctx.fill(); }
    if (Math.abs((s % T.spec.joints + T.spec.joints) % T.spec.joints) < 1) { const a = T.point(s, -W2), b = T.point(s, W2); ctx.strokeStyle = 'rgba(70,66,58,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(a.x, a.y, a.z)); ctx.lineTo(...P(b.x, b.y, b.z)); ctx.stroke(); }   // the expansion joints across
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
function drawCar() { const z = T.height(car.s, car.off) + car.zb, roll = car.tilt + car.roll * 1.5, a = (st.chase ? camAng : Math.PI / 2) - Math.PI / 2;
  const f = sprites.get(sprites.key(car.yaw - a, roll, car.steer, wheelTurn, car.speed)), [X, Y] = P(car.x, car.y, z); ctx.drawImage(f.canvas, Math.round(X - f.ax), Math.round(Y - f.ay)); }
function drawPuffs() { for (const p of puffs) { ctx.fillStyle = `rgba(205,200,190,${p.a})`; const r = p.r * 1000 / mm; ctx.beginPath(); ctx.arc(...P(p.x, p.y, p.z), r, 0, Math.PI * 2); ctx.fill(); } }
const fmt = (t: number) => t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : '-';
function hud() { const kmh = car.speed * 3.6; $('spd').textContent = kmh.toFixed(0); $('gear').textContent = String(car.gear); $('rpm').textContent = car.rpm.toFixed(0);
  ($('rpmbar') as HTMLElement).style.width = `${Math.min(100, car.rpm / car.spec.redline * 100)}%`; ($('rpmbar') as HTMLElement).style.background = car.rpm > car.spec.hpRpm * 1.05 ? 'var(--warn)' : 'var(--accent)';
  $('lap').textContent = lapStart >= 0 ? fmt(clock - lapStart) : '-'; $('last').textContent = fmt(lastLap); $('best').textContent = fmt(bestLap); $('where').textContent = T.pieceAt(car.s);
  $('bake').textContent = sprites.pending ? `그림 굽는 중 ${sprites.count}장` : ''; $('msg').textContent = msgT > 0 ? msg : ''; }
// ---- controls ----
// one press, from a key or a screen button
function press(k: string) { if (k === 'm') { st.auto = !st.auto; car.auto = st.auto; manualGear = car.gear; ($('auto') as HTMLInputElement).checked = st.auto; say(st.auto ? '자동 변속' : '수동 변속 (Q/E)'); }
  if (!st.auto && (k === 'e' || k === 'x')) manualGear = Math.min(car.spec.gears.length, manualGear + 1); if (!st.auto && (k === 'q' || k === 'z')) manualGear = Math.max(1, manualGear - 1);
  if (k === 'r') { car.place(car.s, 0, 0); say('트랙으로 복귀'); } }
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
  input.throttle = Math.max(0, Math.min(1, input.throttle + (down('arrowup', 'w') ? 4 : -6) * dt)); input.brake = Math.max(0, Math.min(1, input.brake + (down('arrowdown', 's') ? 5 : -8) * dt)); input.hand = down(' ') ? 1 : 0;
  let steer = input.steer; if (st.assist) { const over = car.r - car.speed * T.at(car.s).k; if (Math.abs(over) > 0.1 && Math.sign(over) === Math.sign(-car.vy)) steer += Math.atan2(car.vy, Math.max(5, car.vx)) / (car.spec.steerLock * Math.PI / 180 / (1 + car.speed / 25)) * 0.7; }
  return { steer: Math.max(-1, Math.min(1, steer)), throttle: input.throttle, brake: input.brake, handbrake: input.hand, gear: manualGear }; }
// ---- the loop ----
let last = performance.now(), acc = 0;
function frame(now: number) { const el = Math.min(0.1, (now - last) / 1000); last = now; acc += el; clock += el; msgT -= el;
  while (acc >= DT) { acc -= DT; const u = st.pilot ? pilot.drive(car) : controls(DT); car.step(DT, u); wheelTurn += (car.w[0]! + car.w[1]!) / 2 * DT;
    // marks and smoke where the tyres slide
    for (let i = 0; i < 4; i++) { const sl = Math.max(Math.abs(car.slipX[i]!) / 0.15, Math.abs(car.slipA[i]!) / 0.12); if (sl < 1 || car.airborne[i] || car.onGrass[i]) continue; if (Math.random() > 0.35) continue;
      const [px, py] = car.wheelAt(i), c = Math.cos(car.yaw), s = Math.sin(car.yaw), x = car.x + px * c - py * s, y = car.y + px * s + py * c, q = T.locate(x, y, car.s), z = T.height(q.s, q.off);
      skids.push({ x, y, z, a: Math.min(0.55, 0.15 * sl) }); if (skids.length > 9000) skids.shift(); if (Math.random() < 0.25) puffs.push({ x, y, z: z + 0.2, r: 0.3, a: 0.35, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 }); }
    // lap: forward across the start line
    if (T.gap(prevS, START) > 0 && T.gap(car.s, START) <= 0 && car.vx > 1) { if (lapStart >= 0) { lastLap = clock - lapStart; if (!bestLap || lastLap < bestLap) bestLap = lastLap; say(`한 바퀴 ${fmt(lastLap)}`); } lapStart = clock; }
    prevS = car.s;
    if (car.over) { say('뱅크 꼭대기를 넘어갔습니다 — 트랙으로 복귀'); car.over = false; car.place(car.s, 0, 0); } }
  for (const p of puffs) { p.x += p.vx * el; p.y += p.vy * el; p.z += 0.4 * el; p.r += 0.9 * el; p.a -= 0.4 * el; } while (puffs.length && puffs[0]!.a <= 0) puffs.shift(); for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.a <= 0) puffs.splice(i, 1);
  // the camera: on the car, a little ahead of where it is going
  const lead = Math.min(10, car.speed * 0.2), tx = car.x + Math.cos(car.yaw) * lead, ty = car.y + Math.sin(car.yaw) * lead, tz = T.height(car.s, car.off);
  camX += (tx - camX) * Math.min(1, el * 5); camY += (ty - camY) * Math.min(1, el * 5); camZ += (tz - camZ) * Math.min(1, el * 5);
  { const vh = car.speed > 2 ? Math.atan2(Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy, Math.cos(car.yaw) * car.vx - Math.sin(car.yaw) * car.vy) : car.yaw, d = Math.atan2(Math.sin(vh - camAng), Math.cos(vh - camAng)); camAng += d * Math.min(1, el * 2.5); }   // the turning camera follows where the car goes, gently
  turnCam();
  drawTrack(); drawCar(); drawPuffs(); drawBridges(); hud(); sprites.work(6); requestAnimationFrame(frame); }
// ---- page ----
const pick = $<HTMLSelectElement>('car'); for (const id of RACE_CARS) pick.add(new Option(raceSpec(id).name, id)); pick.value = carId;
pick.addEventListener('change', () => { choose(pick.value); pick.blur(); });
$<HTMLInputElement>('auto').addEventListener('change', e => { st.auto = (e.target as HTMLInputElement).checked; car.auto = st.auto; manualGear = car.gear; });
$<HTMLInputElement>('pilot').addEventListener('change', e => { st.pilot = (e.target as HTMLInputElement).checked; if (st.pilot) { car.auto = true; } else car.auto = st.auto; });
$<HTMLInputElement>('assist').addEventListener('change', e => { st.assist = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('chase').addEventListener('change', e => { st.chase = (e.target as HTMLInputElement).checked; camAng = car.yaw; });
$<HTMLInputElement>('pitch').addEventListener('change', e => { pitchDeg = +(e.target as HTMLInputElement).value; SP = Math.sin(pitchDeg * Math.PI / 180); CP = Math.cos(pitchDeg * Math.PI / 180); const s0 = car.s, o0 = car.off, v0 = car.speed; choose(carId); car.place(s0, o0, v0); (e.target as HTMLElement).blur(); });
$<HTMLInputElement>('pitch').addEventListener('input', e => { $('pitchv').textContent = `${(e.target as HTMLInputElement).value}°`; });
$<HTMLSelectElement>('scale').addEventListener('change', e => { mm = +(e.target as HTMLSelectElement).value; choose(carId); (e.target as HTMLElement).blur(); });
function fit() { const box = document.querySelector('.track') as HTMLElement, room = Math.min(box.clientWidth - 14, 1600);
  // the height left on the screen below the picture's top (a phone on its side has little), at least a usable strip
  const availH = Math.max(200, innerHeight - Math.max(0, box.getBoundingClientRect().top + scrollY) - 16);
  const k = Math.max(1, Math.floor(Math.min(room / 768, availH / 432)));
  if (room >= 768 && availH >= 432) { VW = 768; VH = 432; cv.style.width = `${VW * k}px`; cv.style.height = `${VH * k}px`; }
  else { VW = Math.max(300, Math.floor(room / 2) * 2); VH = Math.min(Math.round(VW * (innerHeight > innerWidth ? 0.8 : 0.56)), Math.floor(availH)); cv.style.width = `${VW}px`; cv.style.height = `${VH}px`; }
  cv.width = VW; cv.height = VH; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200)); fit(); choose(carId); camX = car.x; camY = car.y; camZ = 0; requestAnimationFrame(frame);
