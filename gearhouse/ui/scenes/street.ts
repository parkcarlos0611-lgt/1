// Prototype A (reviews 33, 34): the front of the shop. A small 1930s house with a two-bay garage, a lawn, a concrete
// drive and path, the sidewalk and the road, seen from across the street (30 mm a pixel). The sky follows the hour, the
// season colours the lawn and the tree, rain darkens the concrete and leaves puddles that mirror what stands above them,
// snow settles. A customer's car comes along the road and stops at the kerb; the customer gets out, walks up the path
// and knocks. Turned away, they walk back and drive off; let in, the screen fades to the kitchen (next prototype) and
// they leave afterwards. Time runs a day in 60 s, slowing to a minute a second while something happens.
// The person is a stand-in drawn in code; the game's people come from sprite sheets made outside (review 34).
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix, BRASS, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import model from '../../data/cars/sedan29.json';

const W = 480, H = 270, BASE_Y = 168, YARD_Y = 172, WALK_Y = 200, KERB_Y = 211, ROAD_Y = 214, LANE_Y = 246;
type Mat = 0 | 1 | 2 | 3 | 4 | 5;                                         // 0 sky, 1 building, 2 lawn, 3 concrete, 4 road, 5 roof
const SEASONS = ['봄', '여름', '가을', '겨울'] as const, SKIES = ['맑음', '흐림', '비', '눈'] as const;
const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
  return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };

// ---------------- the stand-in person: a man in a hat and a long coat, four directions, four walking steps ----------------
type Dir = 'down' | 'up' | 'left' | 'right';
const SKIN = hex('#e2b48e'), SKIN2 = hex('#b88a68'), HAT = hex('#2c2a30'), BAND = hex('#6a4a32'), COAT = hex('#5a5048'), COAT2 = hex('#463e38'), COAT3 = hex('#6e6458'), TROUS = hex('#3a3a42'), SHOE = hex('#1c1a1c'), OUT = hex('#16141a');
/** the figure 20 x 58 px, as rows of colours (null = clear) */
function figure(dir: Dir, step: number): (RGB | null)[][] {
  const g: (RGB | null)[][] = Array.from({ length: 58 }, () => new Array<RGB | null>(20).fill(null)); const put = (x: number, y: number, c: RGB) => { if (x >= 0 && x < 20 && y >= 0 && y < 58) g[y]![x] = c; };
  const rect = (x: number, y: number, w: number, h: number, c: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
  const side = dir === 'left' || dir === 'right', ph = step % 4, swing = ph === 1 ? 2 : ph === 3 ? -2 : 0, bob = ph % 2 ? 1 : 0;
  // legs and shoes
  if (side) { rect(8 + swing, 42 - bob, 3, 12, TROUS); rect(9 - swing, 42 - bob, 3, 12, mix(TROUS, OUT, 0.3)); rect(7 + swing, 54 - bob, 5, 2, SHOE); rect(8 - swing, 54 - bob, 5, 2, SHOE); }
  else { const l = ph === 1 ? 2 : 0, r = ph === 3 ? 2 : 0; rect(6, 42, 3, 12 - l, TROUS); rect(11, 42, 3, 12 - r, TROUS); rect(5, 54 - l, 4, 2, SHOE); rect(11, 54 - r, 4, 2, SHOE); }
  // coat: long, a little wider at the hem; collar; buttons from the front
  for (let y = 13; y < 44; y++) { const half = y < 16 ? 6 : y < 30 ? 5 : 5 + Math.floor((y - 30) / 6); for (let x = 10 - half; x < 10 + half; x++) put(x, y - bob, x < 10 - half + 2 ? COAT2 : x > 10 + half - 3 ? COAT2 : COAT); }
  if (dir === 'down') { for (let y = 16; y < 42; y += 5) put(10, y - bob, BAND); rect(8, 13 - bob, 4, 3, hex('#d8d0c0')); put(9, 15 - bob, hex('#7a2a2a')); put(10, 16 - bob, hex('#7a2a2a')); }
  if (dir === 'up') for (let y = 15; y < 43; y++) put(10, y - bob, COAT2);
  // arms: swing against the legs from the side; hands
  if (side) { const ax = dir === 'right' ? 9 : 10; rect(ax - swing, 16 - bob, 3, 14, COAT3); rect(ax - swing, 30 - bob, 3, 2, SKIN2); }
  else { rect(3, 16 - bob, 2, 14, COAT2); rect(15, 16 - bob, 2, 14, COAT2); rect(3, 30 - bob, 2, 2, SKIN2); rect(15, 30 - bob, 2, 2, SKIN2); }
  // head and hat
  rect(7, 6 - bob, 6, 8, dir === 'up' ? hex('#4a3a2e') : SKIN); if (dir === 'up') rect(7, 11 - bob, 6, 2, SKIN2);
  if (dir === 'down') { put(8, 9 - bob, OUT); put(11, 9 - bob, OUT); rect(9, 12 - bob, 2, 1, SKIN2); }
  if (side) { const f = dir === 'right' ? 12 : 7; put(f, 9 - bob, OUT); put(dir === 'right' ? 13 : 6, 10 - bob, SKIN); }
  rect(5, 5 - bob, 10, 2, HAT); rect(7, 1 - bob, 6, 4, HAT); rect(7, 4 - bob, 6, 1, BAND); put(9, 1 - bob, mix(HAT, hex('#ffffff'), 0.2));
  // outline: a dark edge round the figure
  const o = g.map(r => r.slice()); for (let y = 0; y < 58; y++) for (let x = 0; x < 20; x++) if (!g[y]![x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy!]?.[x + dx!])) o[y]![x] = OUT;
  if (dir === 'left') return o.map(r => r.slice().reverse());
  return o;
}

export function streetScene(app: App): Scene {
  const ui = app.ui, S = app.S, base = model as unknown as CarModel;
  // the customer's car: the same 3D part model, seen from the left (it faces left), at 30 mm a pixel
  const carIm = rasterizeFlat(viewDesign(base, 'left'), { mm: 30, shadow: true });
  const FIG: Record<string, (RGB | null)[][]> = {}; for (const d of ['down', 'up', 'left', 'right'] as Dir[]) for (let k = 0; k < 4; k++) FIG[d + k] = figure(d, k);
  // ---------------- the place, drawn once per season into colours and materials ----------------
  const mat = new Uint8Array(W * H) as Uint8Array & { [i: number]: Mat }, col: RGB[] = new Array(W * H), puddle = new Float32Array(W * H), litWin: Rect[] = [];
  let season = 0, sky: typeof SKIES[number] = '맑음', minutes = 9 * 60, day = 0, wet = 0, snow = 0;
  const HOUSE = { x: 56, w: 232 }, GAR = { x: 296, w: 176 }, DOOR = { x: 160, y: 98, w: 22, h: 70 };
  /** where water stands first: in the gutter by the kerb, worn spots on the walk, the foot of the drive, dips in the road */
  const PUDDLES = [{ x: 96, y: 217, r: 26, flat: 0.16, seed: 1 }, { x: 250, y: 218, r: 34, flat: 0.15, seed: 2 }, { x: 420, y: 216, r: 22, flat: 0.17, seed: 3 }, { x: 60, y: 205, r: 14, flat: 0.22, seed: 4 },
    { x: 330, y: 206, r: 16, flat: 0.2, seed: 5 }, { x: 352, y: 192, r: 22, flat: 0.2, seed: 6 }, { x: 430, y: 186, r: 14, flat: 0.25, seed: 7 }, { x: 170, y: 236, r: 30, flat: 0.12, seed: 8 }, { x: 380, y: 252, r: 40, flat: 0.1, seed: 9 }];
  function build() {
    const se = season, lawn = [hex('#5e8a3a'), hex('#4e7a32'), hex('#8a8a40'), hex('#9a9478')][se]!, lawn2 = [hex('#4a7030'), hex('#3e6428'), hex('#6e6a32'), hex('#7a766a')][se]!;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; mat[i] = 0; col[i] = [0, 0, 0]; puddle[i] = 0; }
    const set = (x: number, y: number, m: Mat, c: RGB) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; mat[i] = m; col[i] = c; };
    // ground: lawn, the drive and the path in concrete, sidewalk, kerb, road
    for (let y = YARD_Y; y < H; y++) for (let x = 0; x < W; x++) {
      if (y < WALK_Y) { const g = vn(x / 3, y / 1.5, 4); set(x, y, 2, g > 0.62 ? lawn2 : g < 0.25 ? mix(lawn, hex('#ffffff'), 0.08) : lawn); }
      else if (y < KERB_Y) { const joint = (x % 24 === 0) || y === WALK_Y; set(x, y, 3, joint ? hex('#9a968c') : vn(x / 4, y, 7) > 0.6 ? hex('#c4c0b4') : hex('#b8b4a8')); }
      else if (y < ROAD_Y) set(x, y, 3, y === KERB_Y ? hex('#d0ccc0') : hex('#8e8a80'));
      else { const g = vn(x / 5, y / 2, 9); set(x, y, 4, g > 0.7 ? hex('#4e4c4a') : g < 0.25 ? hex('#3a3836') : hex('#444240')); if (y === LANE_Y - 18 && x % 30 < 16) set(x, y, 4, hex('#c8c2a8')); } }
    // the drive (in front of both garage doors) and the path to the porch
    for (let y = BASE_Y; y < WALK_Y; y++) { const t = (y - BASE_Y) / (WALK_Y - BASE_Y), x0 = Math.round(GAR.x + 6 - t * 6), x1 = Math.round(GAR.x + GAR.w - 4 + t * 4);
      for (let x = x0; x < x1; x++) set(x, y, 3, (y - BASE_Y) % 9 === 0 || x === Math.round((x0 + x1) / 2) ? hex('#a29e94') : vn(x / 3, y, 11) > 0.65 ? hex('#c6c2b6') : hex('#bab6aa'));
      for (let x = DOOR.x - 2; x < DOOR.x + DOOR.w + 2; x++) if (y > BASE_Y + 8) set(x, y, 3, (y % 6 === 0) ? hex('#a29e94') : hex('#bcb8ac')); }
    // puddle hollows: where water stands first (worn concrete, the gutter, the drive's foot)
    for (let y = YARD_Y; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mat[i] !== 3 && mat[i] !== 4) continue; const n = vn(x / 14, y / 3, 21) * 0.7 + vn(x / 5, y / 1.5, 22) * 0.3;
      let p = n; if (y >= ROAD_Y && y < ROAD_Y + 6) p += 0.25; if (y > BASE_Y + 20 && y < WALK_Y && x > GAR.x && x < GAR.x + GAR.w) p += 0.1; puddle[i] = p; }
    // the house: clapboard siding, a shingled gable roof, a porch with two posts, windows each side of the door, a chimney
    const wallTop = 86, sid = hex('#e6e0cc'), sid2 = hex('#c8c2ae'), trim = hex('#3e5e4a'), roof = hex('#4e4248'), roof2 = hex('#3e343a');
    for (let y = wallTop; y < BASE_Y; y++) for (let x = HOUSE.x; x < HOUSE.x + HOUSE.w; x++) set(x, y, 1, (y - wallTop) % 4 === 3 ? sid2 : sid);
    for (let x = HOUSE.x - 2; x < HOUSE.x + HOUSE.w + 2; x++) { set(x, BASE_Y, 1, hex('#7a7468')); set(x, BASE_Y + 1, 1, hex('#6a645a')); }
    const ridge = 34, cx = HOUSE.x + HOUSE.w / 2;
    for (let y = ridge; y < wallTop + 2; y++) { const half = (y - ridge) / (wallTop - ridge) * (HOUSE.w / 2 + 10); for (let x = Math.round(cx - half); x < cx + half; x++) { const row = Math.floor((y - ridge) / 4), sh = (x + (row % 2) * 5) % 10 === 0;
      set(x, y, 5, (y - ridge) % 4 === 3 || sh ? roof2 : vn(x / 3, y, 31) > 0.7 ? mix(roof, hex('#ffffff'), 0.1) : roof); } }
    for (let y = ridge + 14; y < wallTop; y++) for (let x = HOUSE.x + 170; x < HOUSE.x + 184; x++) set(x, y, 1, (y + (x % 8 < 4 ? 0 : 2)) % 4 === 0 ? hex('#6a3a2a') : hex('#8a4a34'));   // chimney
    for (let x = HOUSE.x + 168; x < HOUSE.x + 186; x++) { set(x, ridge + 13, 1, hex('#5a5a5a')); set(x, ridge + 12, 1, hex('#5a5a5a')); }
    // porch roof and posts, steps
    for (let y = 84; y < 92; y++) for (let x = DOOR.x - 22; x < DOOR.x + DOOR.w + 22; x++) set(x, y, 5, y < 86 ? roof2 : roof);
    for (const px of [DOOR.x - 18, DOOR.x + DOOR.w + 14]) for (let y = 92; y < BASE_Y; y++) for (let x = px; x < px + 4; x++) set(x, y, 1, x === px ? hex('#bab4a0') : hex('#f2eedc'));
    for (let k = 0; k < 3; k++) for (let x = DOOR.x - 10 + k * 2; x < DOOR.x + DOOR.w + 10 - k * 2; x++) { set(x, BASE_Y + 2 + k * 2, 3, hex('#b0aca0')); set(x, BASE_Y + 3 + k * 2, 3, hex('#8e8a80')); }
    // the front door: panelled, a small glass pane, a brass knob
    for (let y = DOOR.y; y < DOOR.y + DOOR.h; y++) for (let x = DOOR.x; x < DOOR.x + DOOR.w; x++) { const e = x === DOOR.x || x === DOOR.x + DOOR.w - 1 || y === DOOR.y; set(x, y, 1, e ? trim : (y - DOOR.y > 36 && ((x - DOOR.x) % 10 === 2 || (y - DOOR.y) % 16 === 6)) ? hex('#5a3a28') : hex('#6a4430')); }
    for (let y = DOOR.y + 6; y < DOOR.y + 26; y++) for (let x = DOOR.x + 5; x < DOOR.x + DOOR.w - 5; x++) set(x, y, 1, hex('#2a3038'));
    set(DOOR.x + DOOR.w - 5, DOOR.y + 40, 1, BRASS[4]!); set(DOOR.x + DOOR.w - 5, DOOR.y + 41, 1, BRASS[2]!);
    // windows: sash, mullions, curtains; remembered for the evening light
    for (const wx of [HOUSE.x + 22, HOUSE.x + 62, HOUSE.x + 154, HOUSE.x + 194]) { if (wx + 30 > HOUSE.x + HOUSE.w) continue; const r = { x: wx, y: 104, w: 28, h: 40 }; litWin.push(r);
      for (let y = r.y - 2; y < r.y + r.h + 3; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) set(x, y, 1, y >= r.y + r.h + 1 ? hex('#cfc8b2') : trim);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const mull = x === r.x + 13 || x === r.x + 14 || y === r.y + 19 || y === r.y + 20, curtain = x < r.x + 5 || x > r.x + r.w - 6;
        set(x, y, 1, mull ? hex('#f0ecdc') : curtain ? (y % 3 ? hex('#c8a878') : hex('#b0905e')) : hex('#3a4450')); } }
    // the garage: two bays of side-hung carriage doors, a low gable, the same siding
    const gTop = 92, gRidge = 66, gcx = GAR.x + GAR.w / 2;
    for (let y = gTop; y < BASE_Y; y++) for (let x = GAR.x; x < GAR.x + GAR.w; x++) set(x, y, 1, (y - gTop) % 4 === 3 ? sid2 : sid);
    for (let y = gRidge; y < gTop + 2; y++) { const half = (y - gRidge) / (gTop - gRidge) * (GAR.w / 2 + 8); for (let x = Math.round(gcx - half); x < gcx + half; x++) { const row = Math.floor((y - gRidge) / 4); set(x, y, 5, (y - gRidge) % 4 === 3 || (x + (row % 2) * 5) % 10 === 0 ? roof2 : roof); } }
    for (const bx of [GAR.x + 10, GAR.x + 92]) { const bw = 74, by = 100, bh = BASE_Y - 100;
      for (let y = by - 2; y < BASE_Y; y++) for (let x = bx - 2; x < bx + bw + 2; x++) set(x, y, 1, trim);
      for (let y = by; y < BASE_Y; y++) for (let x = bx; x < bx + bw; x++) { const leaf = x < bx + bw / 2 ? 0 : 1, lx = x - bx - leaf * (bw / 2), ly = y - by, plank = lx % 6 === 0, brace = Math.abs((ly - 18) - (lx * (bh - 22) / (bw / 2))) < 1.5 && ly > 18;
        const glass = ly > 4 && ly < 16 && lx > 3 && lx < bw / 2 - 3 && (lx - 3) % 10 !== 0;
        set(x, y, 1, x === bx + bw / 2 ? hex('#3a2418') : glass ? hex('#2c3440') : ly === 18 || ly === 17 ? hex('#8a5a36') : brace ? hex('#9a6a40') : plank ? hex('#5e3a24') : hex('#76482c')); } }
    // the tree in the yard (leaves by the season) and a street lamp at the kerb
    for (let y = 92; y < YARD_Y + 2; y++) for (let x = 22; x < 30; x++) set(x, y, 1, x === 22 ? hex('#3a2a1e') : vn(x, y / 4, 41) > 0.5 ? hex('#5a4030') : hex('#4a3426'));
    if (se !== 3) { const leaf = [[hex('#5a9a3a'), hex('#447a2c'), hex('#78b048')], [hex('#3e7a2a'), hex('#2e6020'), hex('#5a9238')], [hex('#c87a2a'), hex('#a85a1e'), hex('#e0a040')]][se]!;
      for (let y = 20; y < 110; y++) for (let x = 0; x < 60; x++) { const d = Math.hypot((x - 26) / 1.15, y - 62) - 36 + vn(x / 6, y / 6, 43) * 18; if (d > 0) continue; const n = vn(x / 3, y / 3, 44); set(x, y, 1, n > 0.62 ? leaf[2]! : n < 0.33 ? leaf[1]! : leaf[0]!); } }
    else for (const [ax, ay, bx2, by2] of [[26, 92, 8, 50], [26, 90, 44, 44], [27, 80, 30, 30], [26, 98, 4, 76], [27, 96, 50, 70]] as const) lineSet(ax, ay, bx2, by2, hex('#4a3426'), set);
    for (let y = 120; y < KERB_Y; y++) { set(452, y, 1, hex('#2a2a2e')); set(453, y, 1, hex('#3a3a40')); } for (let x = 448; x < 458; x++) { set(x, 118, 1, hex('#2a2a2e')); set(x, 119, 1, hex('#3a3a40')); }
    for (let y = 110; y < 118; y++) for (let x = 449; x < 457; x++) set(x, y, 1, y === 110 || x === 449 || x === 456 ? hex('#2a2a2e') : hex('#d8d0b0'));
    // the mailbox by the path
    for (let y = 186; y < 200; y++) set(150, y, 1, hex('#4a3426')); for (let y = 180; y < 187; y++) for (let x = 145; x < 156; x++) set(x, y, 1, y === 180 ? hex('#5a6470') : hex('#3a4450'));
  }
  function lineSet(x0: number, y0: number, x1: number, y1: number, c: RGB, set: (x: number, y: number, m: Mat, c: RGB) => void) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); set(x, y, 1, c); set(x + 1, y, 1, c); } }
  build();

  // ---------------- time, light, weather ----------------
  const hour = () => (minutes / 60) % 24;
  /** daylight 0..1 and the sky's colours for the hour */
  function light() { const h = hour(), up = Math.min(1, Math.max(0, (h - 5) / 2)), down = Math.min(1, Math.max(0, (20 - h) / 2)), L = Math.min(up, down), dusk = Math.max(0, 1 - Math.abs(h - 18.8) / 1.6) + Math.max(0, 1 - Math.abs(h - 6.2) / 1.4);
    const grey = sky === '맑음' ? 0 : sky === '흐림' ? 0.5 : 0.75; return { L: L * (1 - grey * 0.35), dusk: Math.min(1, dusk) * (1 - grey), grey }; }
  function skyAt(y: number, x: number, t: number, lt: ReturnType<typeof light>): RGB {
    const k = y / BASE_Y, day = mix(hex('#4a7ec8'), hex('#a8cce8'), k), night = mix(hex('#060a18'), hex('#1a2238'), k), duskC = mix(hex('#6a5a9a'), hex('#f0a060'), k);
    let c = mix(night, day, lt.L); c = mix(c, duskC, lt.dusk * 0.7); c = mix(c, mix(hex('#8a8e94'), hex('#b8bcc0'), k), lt.grey * (0.4 + lt.L * 0.5));
    const cl = vn((x + t * 3) / 40, y / 12, 61) * 0.7 + vn((x + t * 5) / 14, y / 6, 62) * 0.3, cover = 0.62 - lt.grey * 0.35; if (cl > cover && y < 120) c = mix(c, lt.L > 0.3 ? hex('#f4f4f2') : hex('#3a4054'), Math.min(0.8, (cl - cover) * 3) * (0.5 + lt.L * 0.5));
    if (lt.L < 0.2 && sky === '맑음' && rnd((x * 977 + y * 131) >>> 0) < 0.004) c = mix(c, hex('#ffffff'), 0.8 - lt.L * 4);
    return c; }

  // ---------------- the customer ----------------
  type Phase = 'none' | 'arrive' | 'out' | 'walkIn' | 'knock' | 'answer' | 'inside' | 'walkOut' | 'leave';
  const ev = { phase: 'none' as Phase, carX: W + 20, px: 0, py: 0, dir: 'left' as Dir, step: 0, t: 0, fade: 0, said: '' };
  const PARK_X = DOOR.x - 50, PATH_X = DOOR.x + DOOR.w / 2 - 10, DOOR_Y = BASE_Y + 2;
  const walkTo = (x: number, y: number, dt: number) => { const dx = x - ev.px, dy = y - ev.py, d = Math.hypot(dx, dy), sp = 26 * dt; if (d < sp) { ev.px = x; ev.py = y; return true; }
    ev.px += dx / d * sp; ev.py += dy / d * sp; ev.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; ev.step += dt * 7; return false; };
  function story(dt: number) { const e = ev; e.t += dt;
    if (e.phase === 'arrive') { const target = PARK_X, sp = Math.max(8, Math.min(90, (e.carX - target) * 1.4)); e.carX -= sp * dt; app.sound.ambient('engine', 0.8, 1 + sp / 90); if (e.carX - target < 0.5) { e.carX = target; e.phase = 'out'; e.t = 0; } }
    else if (e.phase === 'out') { app.sound.ambient('engine', e.t < 0.6 ? 0.5 : 0, 0.9); if (e.t > 0.9) { e.px = e.carX + carIm.w / 2 - 6; e.py = WALK_Y + 4; e.phase = 'walkIn'; e.dir = 'up'; } }
    else if (e.phase === 'walkIn') { if (Math.abs(e.px - PATH_X) > 0.5) walkTo(PATH_X, WALK_Y + 4, dt); else if (walkTo(PATH_X, DOOR_Y, dt)) { e.phase = 'knock'; e.t = 0; e.dir = 'up'; app.sound.once('knock'); } }
    else if (e.phase === 'knock') { if (e.t > 1.1) { e.phase = 'answer'; e.t = 0; } }
    else if (e.phase === 'inside') { e.fade = Math.min(1, e.fade + dt * 1.2); }
    else if (e.phase === 'walkOut') { e.fade = Math.max(0, e.fade - dt * 1.2); if (e.py < WALK_Y + 4 - 0.5) walkTo(PATH_X, WALK_Y + 4, dt); else if (walkTo(e.carX + carIm.w / 2 - 6, WALK_Y + 4, dt)) { e.phase = 'leave'; e.t = 0; } }
    else if (e.phase === 'leave') { app.sound.ambient('engine', e.t < 0.7 ? 0.5 : 0.9, e.t < 0.7 ? 0.9 : 1.4); if (e.t > 0.7) e.carX -= Math.min(110, (e.t - 0.7) * 60) * dt; if (e.carX < -carIm.w - 10) { e.phase = 'none'; app.sound.ambient('engine', 0); } }
  }
  const busyEvent = () => ev.phase !== 'none';

  // ---------------- drawing ----------------
  /** snow settling: on roofs it lies along the shingle rows first, on grass it speckles then covers, on concrete and the road it comes last and thinnest */
  const SNOW = hex('#eef3f8'), SNOW2 = hex('#cdd8e4'), SNOW3 = hex('#b4c2d2');
  function snowOn(x: number, y: number, m: Mat, c: RGB): RGB {
    const fine = vn(x / 1.7, y / 1.2, 72) * 0.75 + rnd((x * 7919 + y * 104729) >>> 0) * 0.25, broad = vn(x / 18, y / 6, 70);
    if (m === 5) { const rowTop = (y - 34) % 4 === 0 || (y - 66) % 4 === 0; if (snow > 0.45 + broad * 0.2) return rowTop || fine < 0.08 ? SNOW2 : SNOW; if (snow > 0.12 && rowTop) return SNOW; return c; }
    if (m === 2) { const cover = snow * 1.25 - broad * 0.3; if (cover > 0.85) return fine < 0.05 ? mix(c, SNOW2, 0.4) : fine < 0.3 ? SNOW2 : SNOW; if (fine < cover) return fine < cover * 0.5 ? SNOW : SNOW2; return c; }
    if (m === 3 || m === 4) { const clump = vn(x / 2.2, y / 1.4, 73), track = m === 4 && (Math.abs(y - (LANE_Y - 2)) < 2 || Math.abs(y - (LANE_Y - 22)) < 2), cover = (snow - (m === 4 ? 0.55 : 0.3)) * 2.2 - broad * 0.3 - (track ? 0.6 : 0);
      if (cover > 0.9) return clump < 0.3 ? SNOW3 : SNOW2; if (clump < cover) return clump < cover * 0.6 ? SNOW2 : SNOW3; return c; }
    if (m === 1 && snow > 0.3 && y > 0 && mat[(y - 1) * W + x] === 0 && fine < snow) return SNOW;   // a rim of snow on top of the posts, the lamp and the mailbox
    return c; }
  function draw(t: number) {
    const lt = light(), shade = (c: RGB, m: Mat): RGB => { const L = 0.28 + lt.L * 0.72; let k = mix([12, 16, 34], c, L); if (lt.dusk > 0) k = mix(k, [Math.min(255, k[0] * 1.15), k[1], k[2] * 0.85] as RGB, lt.dusk * 0.5); return m === 0 ? c : k; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, m = mat[i]! as Mat; let c: RGB;
      if (m === 0) c = skyAt(y, x, t, lt);
      else { c = col[i]!;
        if ((m === 3 || m === 4) && wet > 0) c = mix(c, mix(c, hex('#000000'), 0.45), Math.min(1, wet * 1.5));                                   // wet concrete and road go dark
        if (m === 2 && wet > 0) c = mix(c, mix(c, hex('#1a2a10'), 0.3), Math.min(1, wet));
        if (snow > 0.02) c = snowOn(x, y, m, c);
        c = shade(c, m); }
      S.px(x, y, c); }
    // lit windows at dusk and night, the street lamp's pool of light
    const night = 1 - lt.L; if (night > 0.35) { for (const r of litWin) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x + 5; x < r.x + r.w - 5; x++) if (x !== r.x + 13 && x !== r.x + 14 && y !== r.y + 19 && y !== r.y + 20) S.px(x, y, mix(hex('#f0c070'), hex('#ffe0a0'), (y - r.y) / r.h), (night - 0.35) * 1.4);
      for (let y = 110; y < 118; y++) for (let x = 450; x < 456; x++) S.px(x, y, hex('#fff0b0'), night); for (let y = 118; y < KERB_Y + 30 && y < H; y++) { const half = (y - 118) * 0.45; for (let x = Math.round(453 - half); x < 453 + half; x++) S.px(x, y, hex('#ffe8a0'), night * 0.12); } }
    // puddles: water stands in a few hollows (the gutter, worn spots on the walk and the drive) and grows with the rain;
    // each mirrors the house and the sky above it, upside down, broken by ripples while it rains
    if (wet > 0.08 && snow < 0.3) for (const pd of PUDDLES) { const rx = pd.r * (0.35 + wet * 0.75), ry = rx * pd.flat;
      for (let y = Math.floor(pd.y - ry); y <= pd.y + ry; y++) for (let x = Math.floor(pd.x - rx - 3); x <= pd.x + rx + 3; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dd = ((x - pd.x) / rx) ** 2 + ((y - pd.y) / ry) ** 2 + (vn(x / 4, y / 2, pd.seed) - 0.5) * 0.5; if (dd > 1) continue;
        const ripple = sky === '비' ? Math.round(Math.sin(y * 2.1 + t * 10 + x * 0.25) * 1.3 + Math.sin(t * 7 + x * 0.6) * 0.6) : 0;
        const src = S.get(Math.min(W - 1, Math.max(0, x + ripple)), Math.max(0, Math.min(BASE_Y - 1, BASE_Y - 44 - (y - (pd.y - ry)) * 9)));
        let c = mix(src, hex('#3a4a5a'), 0.28 + (1 - light().L) * 0.2); if (dd > 0.8) c = mix(c, col[y * W + x]!, 0.45); if (y === Math.floor(pd.y - ry) + 1 && dd < 0.9) c = mix(c, hex('#e8f0f4'), 0.25);
        S.px(x, y, c); } }
    // the car and the customer
    if (ev.phase !== 'none' && ev.phase !== 'inside') { const cx = Math.round(ev.carX), cy = LANE_Y - carIm.groundY;
      for (let y = 0; y < carIm.h; y++) for (let x = 0; x < carIm.w; x++) { const o = (y * carIm.w + x) * 4, a = carIm.rgba[o + 3]!; if (a < 10) continue; const c: RGB = [carIm.rgba[o]!, carIm.rgba[o + 1]!, carIm.rgba[o + 2]!]; S.px(cx + x, cy + y, mix([12, 16, 34], c, 0.28 + lt.L * 0.72), a / 255); }
      if (wet > 0.3) for (let y = 0; y < 10; y++) for (let x = 6; x < carIm.w - 6; x += 1) { const sy = LANE_Y - 2 - y * 2; const c = S.get(cx + x, sy); S.px(cx + x, LANE_Y + 1 + y, mix(c, hex('#101820'), 0.5 + y * 0.05), 0.5 - y * 0.045); }   // its reflection on the wet road
      if (night > 0.5) for (let y = -4; y <= 4; y++) for (let x = 1; x < 60; x++) if (Math.abs(y) < 1 + x * 0.12) S.px(cx - x, LANE_Y - 26 + y, hex('#fff2c0'), 0.18 * (1 - x / 60) * night); }
    if (['walkIn', 'knock', 'answer', 'walkOut'].includes(ev.phase) || (ev.phase === 'inside' && ev.fade < 1)) { const s = 0.86 + 0.14 * (ev.py - DOOR_Y) / (WALK_Y + 4 - DOOR_Y), f = FIG[ev.dir + (ev.phase === 'knock' || ev.phase === 'answer' ? 0 : Math.floor(ev.step) % 4)]!, fw = Math.round(20 * s), fh = Math.round(58 * s), ox = Math.round(ev.px + 10 - fw / 2), oy = Math.round(ev.py - fh);
      for (let x = 0; x < fw; x++) S.px(ox + x, oy + fh, [0, 0, 0], 0.25); for (let x = 2; x < fw - 2; x++) S.px(ox + x, oy + fh + 1, [0, 0, 0], 0.15);
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const c = f[Math.floor(y / s)]?.[Math.floor(x / s)]; if (c) S.px(ox + x, oy + y, mix([12, 16, 34], c, 0.3 + lt.L * 0.7)); }
      if (ev.phase === 'knock' && ev.t < 0.9) { const b = { x: ox + fw, y: oy - 10, w: 30, h: 11 }; S.fill(b.x, b.y, b.w, b.h, COL.card); S.text('똑똑', b.x + 4, b.y + 2, COL.ink); } }
    // rain and snow falling
    if (sky === '비') for (let k = 0; k < 220; k++) { const x0 = (rnd(k * 31) * W + t * 40) % W, y0 = (rnd(k * 17) * H + t * (260 + rnd(k) * 80)) % H; for (let j = 0; j < 5; j++) S.px(x0 - j * 0.3, y0 - j, hex('#c8d4e0'), 0.35 - j * 0.05);
      if (y0 > ROAD_Y && rnd((k * 7 + Math.floor(t * 8)) >>> 0) < 0.1) { S.px(x0 - 1, y0 - 1, hex('#e0e8f0'), 0.5); S.px(x0 + 1, y0 - 1, hex('#e0e8f0'), 0.5); } }
    if (sky === '눈') for (let k = 0; k < 160; k++) { const x0 = (rnd(k * 31) * W + Math.sin(t + k) * 8 + t * 6) % W, y0 = (rnd(k * 17) * H + t * (24 + rnd(k) * 20)) % H; S.px(x0, y0, hex('#ffffff'), 0.85); if (k % 3 === 0) S.px(x0 + 1, y0, hex('#ffffff'), 0.5); }
    if (season === 2 && sky !== '눈') for (let k = 0; k < 10; k++) { const x0 = (rnd(k * 91) * 70 + Math.sin(t * 1.3 + k) * 12 + t * 8 * (k % 2 ? 1 : 0.6)) % W, y0 = (rnd(k * 13) * 80 + 40 + t * 18) % (YARD_Y + 10); S.px(x0, y0, [hex('#c87a2a'), hex('#e0a040'), hex('#a85a1e')][k % 3]!); S.px(x0 + 1, y0, hex('#a85a1e')); }
    // into the house: a fade to black
    if (ev.fade > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.px(x, y, [0, 0, 0], ev.fade);
  }

  // ---------------- the plates ----------------
  const DATE0 = Date.UTC(1930, 3, 2);
  const dateStr = () => { const dd = new Date(DATE0 + Math.floor((minutes - 9 * 60) / 1440 + day) * 86400000), m = Math.floor(minutes) % 1440, hh = Math.floor(m / 60), mm = m % 60;
    return `${dd.getUTCFullYear()}년 ${dd.getUTCMonth() + 1}월 ${dd.getUTCDate()}일 ${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };
  return { id: 'street',
    frame(_a, dt) {
      // time: a day in 60 s; a minute a second while something happens; nothing while the customer is inside
      const rate = ev.phase === 'inside' ? 0 : busyEvent() ? 1 : 24; minutes += dt * rate;
      const raining = sky === '비', snowing = sky === '눈', gm = dt * rate;
      wet = Math.max(0, Math.min(1, wet + (raining ? gm / 150 + dt / 40 : -gm / (snowing ? 900 : 400))));
      snow = Math.max(0, Math.min(1, snow + (snowing ? gm / 240 : -gm / (season === 3 ? 2000 : 300))));
      app.sound.ambient('rain', raining ? 0.9 : 0); app.sound.ambient('wind', snowing ? 0.6 : sky === '흐림' ? 0.3 : 0.12);
      story(dt); draw(performance.now() / 1000);
      // the date plate
      const plate = { x: 4, y: 4, w: 208, h: 16 }; ui.panel(plate, 'enamel'); ui.label({ x: 10, y: 8, w: 196, h: 9 }, `${dateStr()} · ${SEASONS[season]} · ${sky}`, COL.cream);
      ui.label({ x: 218, y: 8, w: 140, h: 9 }, busyEvent() ? (ev.phase === 'inside' ? '시간 멈춤 (상담 중)' : '느리게: 1초에 1분') : '하루 60초', COL.lit);
      // the customer at the door
      if (ev.phase === 'answer') { const r = { x: 150, y: 40, w: 180, h: 44 }; ui.panel(r, 'card'); ui.label({ x: r.x + 8, y: r.y + 5, w: r.w - 16, h: 9 }, '손님이 문을 두드린다', COL.ink);
        const [a, b] = split({ x: r.x + 8, y: r.y + 22, w: r.w - 16, h: 16 }, ['*', '*'], 6);
        if (ui.button('let-in', a!, '맞이한다')) { ev.phase = 'inside'; ev.t = 0; } if (ui.button('turn-away', b!, '돌려보낸다')) { ev.phase = 'walkOut'; ev.t = 0; ev.dir = 'down'; } }
      if (ev.phase === 'inside' && ev.fade >= 1) { const r = { x: 120, y: 90, w: 240, h: 70 }; ui.panel(r, 'card'); ui.label({ x: r.x + 8, y: r.y + 6, w: r.w - 16, h: 9 }, '주방 탁자에서 상담', COL.ink);
        ui.paragraph({ x: r.x + 8, y: r.y + 20, w: r.w - 16, h: 22 }, '집 안 장면(주방, 차 · 커피, 대화 선택지)은 다음 견본. 상담 중에는 시간이 흐르지 않는다.', COL.inkSoft);
        if (ui.button('done-talk', { x: r.x + r.w - 88, y: r.y + r.h - 20, w: 80, h: 14 }, '상담 끝')) { ev.phase = 'walkOut'; ev.dir = 'down'; } }
      // the prototype's switches
      const bar = split({ x: 228, y: 254, w: 248, h: 13 }, [62, 44, 44, '*'], 3);
      if (ui.button('call', bar[0]!, '손님 부르기', { disabled: busyEvent() })) { ev.phase = 'arrive'; ev.carX = W + 10; ev.t = 0; ev.fade = 0; }
      if (ui.button('season', bar[1]!, SEASONS[season]!)) { season = (season + 1) % 4; day = season * 91 - Math.floor((minutes - 9 * 60) / 1440); if (season === 3) sky = '눈'; build(); }
      if (ui.button('sky', bar[2]!, sky)) sky = SKIES[(SKIES.indexOf(sky) + 1) % SKIES.length]!;
      if (ui.button('time', bar[3]!, '시간 +3시간')) minutes += 180;
    } };
}
