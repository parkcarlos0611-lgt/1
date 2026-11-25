// The parts library's rendered thumbnails (docs/systems/110 §2-6): each swap of the model body (the bumpers, the head
// lamps, the wheels) and the body itself drawn alone by the game's own renderer (render/live/renderer.ts, the drift
// look with its outline and drawn lines), from one of three fixed views, so that every card of a kind is seen from the
// same side at the same scale. The pictures are made lazily, a few a frame, only for the cards on screen, in the
// corner of the shared canvas just before the builder's own frame is drawn over it; read back, the plain background
// keyed out, shrunk two to one (smooth edges) and kept per part, view and pixel ratio. Without WebGL, or if a render
// fails, the cards keep their drawn pictures (ui/builder_pics.ts).
import type { Mesh, MeshLine, V } from '../render/car/mesh';
import { p959Model, P959_LUMP, type P959Model } from '../render/car/p959';
import { n33Model, N33_LUMP } from '../render/car/n33';
import { N33_CABIN } from '../render/car/bodies';
import { interiorMesh, INTERIORS } from '../render/car/interior';
import { freeGpu } from '../render/live/gpu';
import { STYLE, screenPx, lineWeight } from '../render/live/style';
import type { LiveRenderer } from '../render/live/renderer';
import { BUMPERS_ALL, LAMPS959, WHEELS_ALL } from '../core/design';
import { Build } from '../render/car/mesh';
import { planeSkin } from '../render/car/skin';
import { fitAt, drawFit } from '../render/car/attach';
import { crestUV } from '../render/car/p959/badge';
import { freshPart, type FreeId } from '../core/placed';

export type ThumbView = 'front' | 'side' | 'top';
/** the parts' kinds, and the builder's first steps' cards (docs/systems/115 F1): the lump, its glass sets, its interior sets */
export type ThumbKind = 'bumperF' | 'bumperR' | 'lamp' | 'wheel' | 'base' | 'frame' | 'glass' | 'interior' | 'plateF' | 'plateR'
  /** the free surface parts (docs/systems/115 P1): a kind a group of the library */ | 'pMirror' | 'pWing' | 'pExhaust' | 'pBadge' | 'pMarker' | 'pVent'
  /** the hole parts (P2) */ | 'pLamp' | 'pTail' | 'pIntake' | 'pVentCut';
export interface ThumbSpec { kind: ThumbKind; v: string }
export const VIEWS: ThumbView[] = ['front', 'side', 'top'];
export const VIEW_NAME: Record<ThumbView, string> = { front: '정면', side: '측면', top: '위' };
/** the view rule: a part is seen from the way it faces out of the body. A part facing forward or back is seen head on
 *  (a rear part from behind), one facing sideways (a wheel, a side intake, a mirror, the body as a whole) from the left
 *  side, one facing up (a louvre, a bonnet duct) from above. A rear wing: from the side (its profile and its stands) */
export const KIND_VIEW: Record<ThumbKind, ThumbView> = { bumperF: 'front', bumperR: 'front', lamp: 'front', wheel: 'side', base: 'side', frame: 'side', glass: 'side', interior: 'top', plateF: 'front', plateR: 'front',
  /** the free parts: a mirror from the front (its housing and arm), a wing from the side (its blade's section and its
   *  legs), the tips from behind, the crest and the vents head on, a marker from the side */ pMirror: 'front', pWing: 'side', pExhaust: 'front', pBadge: 'front', pMarker: 'side', pVent: 'front',
  /** the hole parts head on (a tail lamp from behind) */ pLamp: 'front', pTail: 'front', pIntake: 'front', pVentCut: 'front' };
/** the camera of a view: the heading the screen looks along (as LiveView's ang) and the tilt down (degrees). Front and
 *  side a little above the eye line, so a part's top shows as a sliver; the top view straight down, the nose up */
export const PITCH = 8;
export function camera(kind: ThumbKind, view: ThumbView): { ang: number; pitch: number } {
  if (view === 'top') return { ang: 0, pitch: 90 };
  if (view === 'side') return { ang: 1.5 * Math.PI, pitch: PITCH };
  return { ang: kind === 'bumperR' || kind === 'plateR' || kind === 'pExhaust' || kind === 'pTail' ? 0 : Math.PI, pitch: PITCH }; }

// ---- the parts taken out of the model ----
const BUMPER_F = new Set(['bumperF', 'indicatorF', 'ventF', 'intakeF', 'lipF']), BUMPER_R = new Set(['bumperR', 'ventR', 'diffuser', 'exhaustSlot']);
const LAMP = new Set(['lampBezel', 'headLamp', 'lampReflector', 'lampRing']), WHEEL = /^(tyre|rim|wheel|hub)/, PLATE = /^plate/;
/** the variants of a kind, in the library's order */
export const VARIANTS: Record<ThumbKind, readonly string[]> = { bumperF: BUMPERS_ALL, bumperR: BUMPERS_ALL, lamp: LAMPS959, wheel: WHEELS_ALL, base: ['p959'], frame: ['A959', 'B33'], glass: ['none', 'stock', 'noQuarter', 'louvre', 'B33:none', 'B33:stock', 'B33:noQuarter', 'B33:louvre'], interior: ['stock', 'drift', 'B33:stock', 'B33:drift'],
  /** the plates (docs/systems/115 P1a): each its own card, cut from the stock car where its plate sits at its own place */ plateF: ['plateF'], plateR: ['plateR'],
  pMirror: ['mirror'], pWing: ['wingRing', 'wingGT'], pExhaust: ['exhaust1', 'exhaust2'], pBadge: ['badge'], pMarker: ['marker'], pVent: ['vent', 'louvre'],
  pLamp: ['lampRound', 'lampEllipsoid', 'lampSquare'], pTail: ['tailBand', 'tailRound'], pIntake: ['grille', 'sideIntake'], pVentCut: ['ventCut', 'louvreCut'] };
/** a free part's card: the kind of its group */
export const PART_THUMB: Record<FreeId, ThumbKind> = { mirror: 'pMirror', wingRing: 'pWing', wingGT: 'pWing', exhaust1: 'pExhaust', exhaust2: 'pExhaust', badge: 'pBadge', marker: 'pMarker', vent: 'pVent', louvre: 'pVent',
  lampRound: 'pLamp', lampEllipsoid: 'pLamp', lampSquare: 'pLamp', tailBand: 'pTail', tailRound: 'pTail', grille: 'pIntake', sideIntake: 'pIntake', ventCut: 'pVentCut', louvreCut: 'pVentCut' };
/** a free part alone, at its kind's defaults, stood on a flat skin facing the way its view looks at it (a mirror on the
 *  car's left side, a wing on a deck, the tips on a tail, the crest and the vents on a nose, a marker on a side): one of
 *  a pair, no twin */
export function partAlone(id: FreeId): Mesh { const g = PART_THUMB[id], [o, n]: [V, V] = g === 'pMirror' || g === 'pMarker' ? [[1680, 880, 860], [0, 1, 0]] : g === 'pWing' ? [[3900, 0, 950], [0, 0, 1]] : g === 'pExhaust' || g === 'pTail' ? [[4250, 300, 300], [1, 0, 0]] : [[0, 0, 500], [-1, 0, 0]];
  // a hole part (P2) shown as the builder's drag shows it: its footprint laid on the flat skin, its insides lifted to it (the
  // tail lamp band shorter, so its wrapped ends still meet the plane)
  const skin = planeSkin(o, n, 2000), pt = skin.hit([o[0] + n[0] * 100, o[1] + n[1] * 100, o[2] + n[2] * 100], [-n[0], -n[1], -n[2]])!, f = fitAt(skin, pt, { ...freshPart(id, { f: 0, u: 0, v: 0 }), one: true, ...(id === 'tailBand' ? { scale: 0.6, sx: 0.8 } : {}) });
  if (f.hole) { const M = f.hole.preview(); return { ...M, length: 4260 }; }
  const b = new Build(), cr = drawFit(b, f, '#b8bcc2'), M = b.mesh(4260); if (cr.length) M.uv = crestUV(M, cr); return M; }
/** the model a variant is cut from: the n-th of each list together (four builds give every swap; the first is the stock
 *  car, the fourth the lump's blank bumper and steel wheel with the stock lamp) */
export function modelIndex(s: ThumbSpec): number { return Math.max(0, VARIANTS[s.kind].indexOf(s.v)); }
export function buildModel(i: number): P959Model { return p959Model({ bumperF: BUMPERS_ALL[i], bumperR: BUMPERS_ALL[i], lamp: LAMPS959[i], wheel: WHEELS_ALL[i], brake: false }); }
/** the models of the first steps' cards: the lump; the lump with each glass set (none: the cabin in body colour); each
 *  interior set alone (its cabin's parts, no driver) */
const SETS = new Set<ThumbKind>(['frame', 'glass', 'interior', 'pMirror', 'pWing', 'pExhaust', 'pBadge', 'pMarker', 'pVent', 'pLamp', 'pTail', 'pIntake', 'pVentCut']);
export function buildSet(kind: ThumbKind, v: string): P959Model { if (kind.startsWith('p') && kind !== 'plateF' && kind !== 'plateR') return { mesh: partAlone(v as FreeId), shell: undefined as never, normals: new Float32Array(0), shellTris: 0 };
  if (v.startsWith('B33:')) { const w = v.slice(4);   // 차체 B's sets (docs/systems/117 R2): its glass on its lump, its own interiors in its cabin
    if (kind === 'interior') return { mesh: interiorMesh({ ...INTERIORS[w === 'drift' ? 'n33Sport' : 'n33Stock'], cabin: N33_CABIN, driver: false }), shell: undefined as never, normals: new Float32Array(0), shellTris: 0 };
    return n33Model({ ...N33_LUMP, brake: false, glass: w === 'none' ? null : w as never }); }
  if (kind === 'interior') { const mesh = interiorMesh({ ...INTERIORS[v as 'stock' | 'drift'], driver: false });
    return { mesh, shell: undefined as never, normals: new Float32Array(0), shellTris: 0 }; }
  if (kind === 'frame' && v === 'B33') return n33Model({ ...N33_LUMP, brake: false });   // 차체 B: the N33's lump (docs/systems/117 R1)
  return p959Model({ ...P959_LUMP, brake: false, ...(kind === 'glass' ? { glass: v === 'none' ? null : v as never } : {}) }); }
/** the cache's key of a card's model: the parts' kinds share the four builds; each set's card has its own */
const modelKey = (s: ThumbSpec) => SETS.has(s.kind) ? `${s.kind}|${s.v}` : `m|${modelIndex(s)}`;
/** a line far under the ground (clipped off every view): a part that keeps none of the body's lines is not given lines
 *  found at its hard edges either, as on the car */
const NO_LINE: MeshLine = { kind: 'trim', pts: [[0, 0, -1e5], [0, 10, -1e5]] };
const within = (p: V, b: Box, m: number) => p[0] >= b[0][0] - m && p[0] <= b[1][0] + m && p[1] >= b[0][1] - m && p[1] <= b[1][1] + m && p[2] >= b[0][2] - m && p[2] <= b[1][2] + m;
export type Box = [V, V];
/** the part alone: its triangles (a bumper is a region of the shell; the lamp and the wheel are the left front one of the
 *  modules hung after it), and the body's drawn lines and creases lying on it. `near`: a bumper's left half only (seen
 *  from the side, an open strip would show the inside of its far half through its near one) */
export function isolate(md: P959Model, kind: ThumbKind, near = false): Mesh { const M = md.mesh; if (kind === 'base' || SETS.has(kind)) return M;
  const nm = (t: number) => M.names?.[M.part[t]!] ?? '', cy = (t: number) => (M.pos[t * 9 + 1]! + M.pos[t * 9 + 4]! + M.pos[t * 9 + 7]!) / 3, cx = (t: number) => (M.pos[t * 9]! + M.pos[t * 9 + 3]! + M.pos[t * 9 + 6]!) / 3;
  const keep = (t: number) => kind === 'bumperF' ? t < md.shellTris && BUMPER_F.has(nm(t)) : kind === 'bumperR' ? t < md.shellTris && BUMPER_R.has(nm(t))
    : kind === 'lamp' ? t >= md.shellTris && LAMP.has(nm(t)) && cy(t) > 0 : kind === 'plateF' || kind === 'plateR' ? t >= md.shellTris && PLATE.test(nm(t)) && (cx(t) < M.length / 2) === (kind === 'plateF')
    : t >= md.shellTris && WHEEL.test(nm(t)) && cy(t) > 0 && cx(t) < M.length / 2;
  const T: number[] = []; for (let t = 0; t < M.n; t++) if (keep(t) && (!near || cy(t) > -1)) T.push(t);
  const n = T.length, pos = new Float32Array(n * 9), col = new Uint8Array(n * 3), gloss = new Float32Array(n), part = new Int16Array(n), kd = new Uint8Array(n), tex = new Uint8Array(n), uv = M.uv && M.uv.length === M.n * 9 ? new Float32Array(n * 9) : undefined;
  T.forEach((t, j) => { pos.set(M.pos.subarray(t * 9, t * 9 + 9), j * 9); col.set(M.col.subarray(t * 3, t * 3 + 3), j * 3); gloss[j] = M.gloss[t]!; part[j] = M.part[t]!; kd[j] = M.kind[t]!; tex[j] = M.tex[t]!; if (uv) uv.set(M.uv!.subarray(t * 9, t * 9 + 9), j * 9); });
  const out: Mesh = { n, pos, col, gloss, part, kind: kd, tex, length: M.length, decals: [], ...(M.names ? { names: M.names } : {}), ...(uv ? { uv } : {}) }, b = meshBox(out);
  const lines = (M.lines ?? []).filter(l => l.pts.every(p => within(p, b, 6)));
  out.lines = lines.length ? lines : [NO_LINE]; out.creases = (M.creases ?? []).filter(([p, q]) => within(p, b, 1) && within(q, b, 1));
  return out; }
/** a mesh's bounds (its own axes, mm) */
export function meshBox(M: Mesh): Box { const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < M.pos.length; i += 3) for (let k = 0; k < 3; k++) { const x = M.pos[i + k]!; if (x < lo[k]!) lo[k] = x; if (x > hi[k]!) hi[k] = x; } return [lo, hi]; }
export const union = (a: Box, b: Box): Box => [[0, 1, 2].map(k => Math.min(a[0][k]!, b[0][k]!)) as V, [0, 1, 2].map(k => Math.max(a[1][k]!, b[1][k]!)) as V];
/** the framing of a view: the target (world, m: the car's middle on the origin, its nose toward +x) and the scale (mm a
 *  pixel) that fit the box into `fill` of a W x H picture; the same box (all the kind's variants together) gives every
 *  card of the kind the same scale and place */
export function fit(box: Box, len: number, cam: { ang: number; pitch: number }, W: number, H: number, fill = 0.86): { x: number; y: number; z: number; mm: number } {
  const w = (p: V): V => [(len / 2 - p[0]) / 1000, p[1] / 1000, p[2] / 1000], a = cam.ang - Math.PI / 2, SP = Math.sin(cam.pitch * Math.PI / 180), CP = Math.cos(cam.pitch * Math.PI / 180);
  const rx: V = [Math.cos(a), Math.sin(a), 0], up: V = [-Math.sin(a) * SP, Math.cos(a) * SP, CP], d = (p: V, q: V) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < 8; k++) { const c = w([box[k & 1 ? 1 : 0][0], box[k & 2 ? 1 : 0][1], box[k & 4 ? 1 : 0][2]]); x0 = Math.min(x0, d(c, rx)); x1 = Math.max(x1, d(c, rx)); y0 = Math.min(y0, d(c, up)); y1 = Math.max(y1, d(c, up)); }
  const lo = w(box[0]), hi = w(box[1]), mid: V = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return { x: mid[0], y: mid[1], z: mid[2], mm: Math.max((x1 - x0) / (W * fill), (y1 - y0) / (H * fill)) * 1000 }; }
/** the light of a view: from the viewer's upper left, whichever way the camera looks (toward the sun, world axes) */
export function sunFor(cam: { ang: number; pitch: number }): [number, number, number] { const a = cam.ang - Math.PI / 2, SP = Math.sin(cam.pitch * Math.PI / 180), CP = Math.cos(cam.pitch * Math.PI / 180);
  const rx = [Math.cos(a), Math.sin(a), 0], ry = [-Math.sin(a), Math.cos(a), 0], up = [ry[0]! * SP, ry[1]! * SP, CP], vd = [ry[0]! * CP, ry[1]! * CP, -SP];
  return [0, 1, 2].map(k => -vd[k]! * 0.7 + up[k]! * 0.55 - rx[k]! * 0.45) as [number, number, number]; }
/** the style's ink as it comes out of the picture (sRGB) */
export const INK_RGB: [number, number, number] = [12, 12, 15];
/** a picture read back (rows bottom up, RGBA) to the shown one: the background (the colour in its corner) keyed out;
 *  the outline `ring` pixels wide laid round the silhouette where the inverted hull left none (an open part alone, a
 *  bumper or a lamp's bezel, has no back faces to make it, and with no ground behind it the outline pass has nothing to
 *  draw on): measured from the part's own pixels, not from ink already there, so a closed part's outline is not
 *  doubled; then `ss` x `ss` pixels to one (top row first, straight alpha) */
export function keyDown(px: Uint8Array, W: number, H: number, ss: number, ring = 0): Uint8ClampedArray { const w = Math.floor(W / ss), h = Math.floor(H / ss), out = new Uint8ClampedArray(w * h * 4), bg = [px[0]!, px[1]!, px[2]!];
  const N = W * H, isBg = new Uint8Array(N); for (let q = 0; q < N; q++) { const R = px[q * 4]!, G = px[q * 4 + 1]!, B = px[q * 4 + 2]!; isBg[q] = Math.abs(R - bg[0]!) <= 4 && Math.abs(G - bg[1]!) <= 4 && Math.abs(B - bg[2]!) <= 4 ? 1 : 0; }
  let inkAt: Uint8Array | null = null;
  if (ring > 0) { // a chamfer distance (3-4, in thirds of a pixel) from the part's pixels that are not ink
    const D = new Float32Array(N), INF = 1e9; for (let q = 0; q < N; q++) { const R = px[q * 4]!, G = px[q * 4 + 1]!, B = px[q * 4 + 2]!, ink = Math.max(R, G, B) <= 26 && Math.max(R, G, B) - Math.min(R, G, B) <= 8; D[q] = !isBg[q] && !ink ? 0 : INF; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * W + x; let d = D[q]!; if (x > 0) d = Math.min(d, D[q - 1]! + 3); if (y > 0) { d = Math.min(d, D[q - W]! + 3); if (x > 0) d = Math.min(d, D[q - W - 1]! + 4); if (x < W - 1) d = Math.min(d, D[q - W + 1]! + 4); } D[q] = d; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const q = y * W + x; let d = D[q]!; if (x < W - 1) d = Math.min(d, D[q + 1]! + 3); if (y < H - 1) { d = Math.min(d, D[q + W]! + 3); if (x < W - 1) d = Math.min(d, D[q + W + 1]! + 4); if (x > 0) d = Math.min(d, D[q + W - 1]! + 4); } D[q] = d; }
    inkAt = new Uint8Array(N); for (let q = 0; q < N; q++) if (isBg[q] && D[q]! <= ring * 3) { inkAt[q] = 1; isBg[q] = 0; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let n = 0, r = 0, g = 0, b = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const q = (H - 1 - (y * ss + j)) * W + x * ss + i; if (isBg[q]) continue; n++;
      if (inkAt?.[q]) { r += INK_RGB[0]; g += INK_RGB[1]; b += INK_RGB[2]; } else { r += px[q * 4]!; g += px[q * 4 + 1]!; b += px[q * 4 + 2]!; } }
    const o = (y * w + x) * 4; if (n) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255 * n / (ss * ss); } }
  return out; }

// ---- the cache and the queue (per page: the models, the parts, the pictures) ----
const MODELS = new Map<string, P959Model>(), PARTS = new Map<string, Mesh>(), BOXES = new Map<ThumbKind, Box>(), PICS = new Map<string, string>();
/** a part as a view shows it: a bumper from the side its near half */
export const nearHalf = (kind: ThumbKind, view: ThumbView) => view === 'side' && (kind === 'bumperF' || kind === 'bumperR');
const partOf = (s: ThumbSpec, near = false): Mesh => { const k = `${s.kind}|${modelKey(s)}|${near}`; let m = PARTS.get(k); if (!m) { m = isolate(MODELS.get(modelKey(s))!, s.kind, near); PARTS.set(k, m); } return m; };
/** the picture's size on the card (CSS px, 4:3: the card's picture plate) */
export const PIC_W = 160, PIC_H = 120;
const CSS = `.gk-card-pic.gk-has-thumb{position:relative}.gk-card-pic.gk-has-thumb>svg{visibility:hidden}
.gk-card-pic img.gk-thumb{position:absolute;inset:4%;width:92%;height:92%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
.gk-card:disabled .gk-card-pic img.gk-thumb,.gk-card.gk-locked .gk-card-pic img.gk-thumb{filter:grayscale(1) brightness(.92);opacity:.75}
.gk-tviews{display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle}.gk-tviews .gk-opt{padding:2px 7px;font-size:.7rem;min-height:0;line-height:1.3}`;

export interface PartThumbs { /** a card to picture: its plate gets the rendered picture when it is made */ want(card: HTMLElement, spec: ThumbSpec): void;
  /** the small toggle of a kind's view (front, side, top): every card of the kind turns together */ viewChips(kind: ThumbKind): HTMLElement;
  /** make the pictures due for the cards on screen; true if the canvas was drawn on (the caller draws its own frame over it next) */
  pump(L: LiveRenderer, cv: HTMLCanvasElement): boolean }
export function partThumbs(): PartThumbs {
  if (typeof document !== 'undefined' && !document.getElementById('gk-thumbs-css')) { const s = document.createElement('style'); s.id = 'gk-thumbs-css'; s.textContent = CSS; document.head.append(s); }
  const cards = new Map<HTMLElement, { spec: ThumbSpec; shown: string }>(), view = new Map<ThumbKind, ThumbView>(), chips: [ThumbKind, ThumbView, HTMLButtonElement][] = [];
  let off = false, idle = 0;
  const dpr = () => Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const key = (s: ThumbSpec) => `${s.kind}|${s.v}|${view.get(s.kind) ?? KIND_VIEW[s.kind]}|${dpr()}`;
  const show = (card: HTMLElement, url: string) => { const pic = card.querySelector('.gk-card-pic'); if (!pic) return; let img = pic.querySelector('img.gk-thumb') as HTMLImageElement | null;
    if (!img) { img = new Image(); img.className = 'gk-thumb'; img.alt = ''; img.decoding = 'async'; pic.append(img); } img.src = url; pic.classList.add('gk-has-thumb'); };
  const syncChips = () => { for (const [k, v, b] of chips) b.setAttribute('aria-pressed', String((view.get(k) ?? KIND_VIEW[k]) === v)); };
  /** one picture: the part on its own, the kind's framing, read back from the canvas's corner */
  function shoot(L: LiveRenderer, cv: HTMLCanvasElement, s: ThumbSpec): string { const v = view.get(s.kind) ?? KIND_VIEW[s.kind], cam = camera(s.kind, v), r = dpr();
    let W = Math.round(PIC_W * r), H = Math.round(PIC_H * r), ss = 2; if (cv.width < W * ss || cv.height < H * ss) ss = 1;
    const k = Math.min(1, cv.width / (W * ss), cv.height / (H * ss)); W = Math.max(8, Math.floor(W * k)); H = Math.max(6, Math.floor(H * k));
    const M = partOf(s, nearHalf(s.kind, v)), f = fit(BOXES.get(s.kind)!, M.length, cam, W * ss, H * ss), gl = L.gl, g = L.car(M);
    try { L.render({ x: f.x, y: f.y, z: f.z, ang: cam.ang, pitch: cam.pitch, mm: f.mm, W: W * ss, H: H * ss, cy: 0.5 },
        [{ g, x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, steerL: 0, steerR: 0, spin: 0, player: false }], [], [],
        { look: 4, glass: 0.8, rays: false, bloomK: 0, dof: 0, sun: sunFor(cam), style: { dpr: r * ss } });
      const px = new Uint8Array(W * ss * H * ss * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W * ss, H * ss, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d')!.putImageData(new ImageData(keyDown(px, W * ss, H * ss, ss, screenPx(STYLE.outlinePx * lineWeight.k, H * ss, r * ss)), W, H), 0, 0); return c.toDataURL('image/png'); }
    finally { freeGpu(gl, g); L.forget(M); } }
  return {
    want(card, spec) { cards.set(card, { spec, shown: '' }); idle = 0; },
    viewChips(kind) { const box = document.createElement('span'); box.className = 'gk-tviews'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', '썸네일 보기');
      for (const v of VIEWS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-opt'; b.textContent = VIEW_NAME[v]; if (kind === 'bumperR' && v === 'front') b.title = '뒤에서 본 정면';
        b.addEventListener('click', () => { view.set(kind, v); idle = 0; syncChips(); }); chips.push([kind, v, b]); box.append(b); }
      syncChips(); return box; },
    pump(L, cv) { if (off) return false;
      let due = [...cards].filter(([, j]) => j.shown !== key(j.spec)); if (!due.length) return false;
      if (idle > 0) { idle--; return false; }
      due = due.filter(([c]) => c.isConnected && c.getClientRects().length > 0); if (!due.length) { idle = 20; return false; }   // none on screen: look again in a third of a second
      for (const [c, j] of due) { const u = PICS.get(key(j.spec)); if (u) { show(c, u); j.shown = key(j.spec); } }
      due = due.filter(([, j]) => j.shown !== key(j.spec)); if (!due.length) return false;
      // the models of the first kind due: one build a frame (about a tenth of a second each), then its framing from all of them
      const kind = due[0]![1].spec.kind, specs: ThumbSpec[] = (kind === 'base' ? ['p959'] : VARIANTS[kind]).map(v => ({ kind, v }));
      const miss = specs.find(sp => !MODELS.has(modelKey(sp))); if (miss) { try { MODELS.set(modelKey(miss), SETS.has(kind) ? buildSet(kind, miss.v) : buildModel(modelIndex(miss))); } catch (e) { console.warn('part thumbnails', e); off = true; } return false; }
      if (!BOXES.has(kind)) BOXES.set(kind, specs.map(sp => meshBox(partOf(sp))).filter(b => Number.isFinite(b[0][0])).reduce(union));
      const t0 = performance.now(), scene = L.takeScene(); let drew = false;
      try { for (const [c, j] of due) { if (j.spec.kind !== kind) continue; const k = key(j.spec); let u = PICS.get(k);
          if (!u) { if (performance.now() - t0 > 30 && drew) break; u = shoot(L, cv, j.spec); drew = true; PICS.set(k, u); } show(c, u); j.shown = k; } }
      catch (e) { console.warn('part thumbnails: kept the drawn pictures', e); off = true; }
      finally { L.putScene(scene); }
      return drew; } }; }
