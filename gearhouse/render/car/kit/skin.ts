// The body's shared grids: the standard section laid at every station (the flank's chains), and the caps and panels
// that meet them (the front top, the nose, the glasshouse, the deck and the spoiler's blade, the tail). Each grid's
// border is made of the very points of its neighbour's, so the panels cut from them close without a gap.
import { gp, lerp, mix, sm, curve, sub, len, type Grid, type V } from './geom';
import type { Lines } from './lines';
import { flank, FLANK, NK, TOP, type Flank } from './section';
import { frameOf, type CarKit } from './spec';

export interface Skin {
  L: Lines; F: Flank;
  /** the stations and the chain at each */
  SF: number[]; CH: Grid; CJ: V[]; CT: V[];
  /** the front top's surface; the crest's line (y, z) and the nose's plan (x of the crest at half-width y) */
  zTop(x: number, y: number): number; yK(x: number): number; zK(x: number): number; crestX(y: number): number;
  /** the front top: rows from the nose's crest round to the screen's bowed foot; TOP.N columns */
  TFG: Grid; iXJ: number; iA: number;
  /** the nose: rows going round from the centre line to the front arch, each a standard section */
  NSG: Grid;
  /** the glasshouse: roof, screen, the side strip (pillar line D, rail T, glass, belt E), rear glass */
  RFG: Grid; SCR: Grid; US: Grid; RGL: Grid; RGX: number[]; SU: number[];
  glassPt(x: number, sh: number): V; upper(x: number): V[];
  /** the tail's shell going round from the last chain to the centre line, and the same stood in: the lamp panel, the valance */
  TLG: Grid; LG: Grid; VG: Grid;
  /** the deck behind the glass; the blade's top and its underside */
  DKG: Grid; BT: Grid; BU: Grid; iBl: number; iDk: number;
}

export function makeSkin(L: Lines, K: CarKit): Skin {
  const T = K.top, C = K.canopy, D = K.deck, TL = K.tail, SF = L.stations;
  if (K.nose.kind !== 'round' && K.nose.kind !== 'pointed') throw new Error(`kit: nose kind ${K.nose.kind} is not built yet`);
  if (C.kind !== 'canopy') throw new Error(`kit: canopy kind ${C.kind} is not built yet`);
  if (T.shares.length !== TOP.N - 1 || T.noseCols.length !== TOP.N - 2) throw new Error('kit: the top needs TOP.N - 1 columns');
  const XJ = SF[0]!, XA = L.X(K.lines.centre.screen), X0 = L.X(K.lines.nose.tip), np = K.lines.nose.pow, KW = L.crest(XJ)[0];
  const crestX = (y: number) => X0 + (XJ - X0) * gp(y / KW, np);
  const yK = (x: number) => L.crest(x)[0];
  const c0 = L.X(T.crownAt[0]), c1 = L.X(T.crownAt[1]);
  const zTop = (x: number, y: number) => { const sh = Math.min(1, y / (x < XJ ? KW : yK(x))); return L.z('bonnet')(x) + T.crown * sm(c0, c1, x) * sh * sh - T.roll * sh ** 4; };
  // the crest's height: the front top's surface up to the screen's foot, then its own line (joined there)
  const zKt = L.zTab('crest'), ZKB = curve([[zKt[0]![0], zTop(zKt[0]![0], yK(zKt[0]![0]))], ...zKt.slice(1)]);
  const zK = (x: number) => x <= XA ? zTop(x, yK(x)) : ZKB(x);
  const F = flank(L, K.section, x => [x, yK(x), zK(x)]);
  const CH = SF.map(x => F.chain(x)), CJ = CH[0]!, CT = CH[CH.length - 1]!, iA = L.at(K.lines.centre.screen);

  // ---- the front top ----
  const SH = [0, ...T.shares], FC = [0, ...T.noseCols].map(f => f * KW), S0 = crestX(FC[TOP.EDGE]!), SL = L.X(T.rows[0]!), capTo = L.X(T.capTo);
  const b0 = L.X(T.blend[0]), b1 = L.X(T.blend[1]), ysc = L.Y(T.screenHalf);
  const topRow = (s: number, r: number): V[] => { const kx = s < 0 ? lerp(S0, capTo, r) : s < XJ ? s + T.lead * (1 - sm(SL, XJ, s)) : s, ykx = yK(kx), t = s < 0 ? 0 : sm(b0, b1, s), bow = s > XJ ? T.bow.depth * ((s - XJ) / (XA - XJ)) ** T.bow.pow : 0;
    const row: V[] = FC.slice(0, TOP.K).map((y0, j) => { const y = lerp(y0, SH[j]! * ysc, t), x = s < 0 ? lerp(crestX(y), SL, r) : s - bow * (1 - Math.min(1, y / ykx) ** T.bow.edge); return [x, y, zTop(x, y)] as V; }); row.push([kx, ykx, zK(kx)]); return row; };
  const SN = T.rows.map(L.X), iXJ = T.capRows.length + SN.length;
  const TFG: Grid = [...T.capRows.map(r => topRow(-1, r)), ...SN.map(s => topRow(s, 1)), ...SF.slice(0, iA + 1).map(s => topRow(s, 1))];

  // ---- the nose: rows going round from the centre line to the front arch ----
  const N = K.nose, noseK: V[] = [...TFG[0]!.slice(0, TOP.K), ...TFG.slice(1, iXJ + 1).map(r => r[TOP.K]!)], NN = noseK.length, nS = FLANK.SHOULDER.length;
  const NSG: Grid = noseK.map((Kp, i) => { const f = i === NN - 1 ? 1 : Kp[1] / KW, t = sm(N.turn, 1, f), ys = f ** lerp(N.spread, 1, t), row: V[] = [Kp, Kp, Kp, Kp];
    for (let k = FLANK.H; k <= NK; k++) { const z = lerp(N.levels[k - FLANK.H]! + (k === FLANK.H ? N.lampRise * f : 0), CJ[k]![2], t), rx = N.reach[k - FLANK.H]!; row.push([rx + (XJ - rx) * gp(ys, N.pow), CJ[k]![1] * ys, z]); }
    for (let k = 1; k <= nS; k++) row[k] = F.band(Kp, row[FLANK.H]!, k / (nS + 1)); return row; });

  // ---- the glasshouse ----
  const XR0 = L.X(C.roof.from), XR1 = L.X(C.roof.to), YD = L.Y(C.roof.half), CR = C.roof.crown, CP = C.roof.pow, ZR = L.z('roof'), XQ = L.X(C.slantFoot), XG = L.X(K.lines.centre.glassFoot);
  const xRoof = (s: number, sh: number) => s - C.roof.bow * (1 - sh * sh) * (1 - (s - XR0) / (XR1 - XR0));
  // the slanting edge from the roof's back corner down to the crest (with buttresses: the buttress's outer top edge,
  // made to end on the crest at its foot; behind that the crest itself)
  const BU_ = C.buttress, sT = L.zTab('slant'), wT = L.wTab('slant');
  const ZS = curve([[sT[0]![0], ZR(XR1) - CR], ...(BU_ ? [...sT.slice(1, -1), [XQ, zK(XQ)] as [number, number]] : sT.slice(1))]);
  const YS = BU_ ? curve([...wT.slice(0, -1), [XQ, yK(XQ)]]) : L.w('slant'), GY = BU_ ? yK : L.w('glass');
  const glassEdge = (x: number): V => x <= XQ ? [x, YS(x), ZS(x)] : [x, GY(x), zK(x)];
  const glassPt = (x: number, sh: number): V => { const e = glassEdge(x); return [x, e[1] * sh, ZR(x) - (ZR(x) - e[2]) * sh ** CP]; };
  const RFG: Grid = L.span(C.roof.from, C.roof.to).map(s => SH.map(sh => { const x = xRoof(s, sh); return [x, sh * YD, ZR(x) - CR * sh ** CP] as V; }));
  const sFoot = TFG[TFG.length - 1]!, sTop = RFG[0]!;
  const SCR: Grid = C.screen.rows.map(v => sFoot.map((p, j) => { const q = mix(p, sTop[j]!, v), bl = C.screen.bow * 4 * v * (1 - v) * (1 - (j / (TOP.N - 1)) ** 2); return [q[0] - bl * 0.4, q[1], q[2] + bl * 0.92] as V; }));
  const A0 = sFoot[TOP.N - 1]!, A1 = sTop[TOP.N - 1]!, Sd = C.side, ra0 = L.X(Sd.railAt[0]), ra1 = L.X(Sd.railAt[1]), rEnd = L.X(Sd.railEnd), bi0 = L.X(Sd.blowIn[0]), bi1 = L.X(Sd.blowIn[1]), bo0 = L.X(Sd.blowOut[0]), bo1 = L.X(Sd.blowOut[1]);
  const upper = (x: number): V[] => { const E: V = [x, yK(x), zK(x)], Dp: V = x <= XR0 ? mix(A0, A1, (x - XA) / (XR0 - XA)) : x <= XR1 ? [x, YD, ZR(x) - CR] : glassEdge(x);
    const w = sm(ra0, ra1, x), dE = sub(E, Dp), lE = len(dE) || 1, r = x <= XR1 ? w : 1 - sm(XR1, rEnd, x), k0 = x <= XR1 ? Math.min(Sd.pillar, lE) * (1 - w) : Math.min(Sd.edge, lE * 0.5), k = Sd.taper ? lerp(k0, lE, sm(L.X(Sd.taper[0]), L.X(Sd.taper[1]), x)) : k0;
    const Tp: V = [Dp[0] + dE[0] / lE * k, Dp[1] + dE[1] / lE * k + L.my(Sd.rail[0]) * r, Dp[2] + dE[2] / lE * k + Sd.rail[1] * r];
    const bl = Sd.blow * sm(bi0, bi1, x) * (1 - sm(bo0, bo1, x)), out = (v: number): V => { const p = mix(Tp, E, v); return [p[0], p[1] + bl * 0.9 * 4 * v * (1 - v), p[2] + bl * 0.4 * 4 * v * (1 - v)]; }; return [Dp, Tp, out(1 / 3), out(2 / 3), E]; };
  const SU = L.span(K.lines.centre.screen, Sd.to), US: Grid = SU.map(upper);
  const RGX = C.rear.map(L.X);
  // with buttresses one grid runs on behind the roof: each column a width and a height line, eased from the roof's back edge
  const roofBack = RFG[RFG.length - 1]!, XE = BU_ ? L.X(BU_.ease) : XR1, lift = deckLift(K, L);
  const rearAim = (x: number, j: number): V => { if (j === TOP.N - 1) return glassEdge(x); const [wy, wz] = j === 0 ? [0, 0] : BU_!.cols[j - 1]!;
    const y = typeof wy === 'number' ? L.my(wy) : L.w(wy)(x); return [x, y, typeof wz === 'number' ? L.centre(x) - wz : L.z(wz)(x)]; };
  const rear = (x: number): V[] => SH.map((_, j) => { const p = rearAim(x, j); if (j === TOP.N - 1) return p; const a = rearAim(XR1, j), r = roofBack[j]!, t = 1 - sm(XR1, XE, x);
    return [x, p[1] + (r[1] - a[1]) * t, p[2] + (r[2] - a[2]) * t + lift(x, j)]; });
  const RGL: Grid = BU_ ? RGX.map(rear) : RGX.map(x => SH.map(sh => glassPt(x, sh)));

  // ---- the tail's shell: the last chain carried round the corner to the centre line ----
  const XT1 = SF[SF.length - 1]!, tp = (k: number) => k <= TL.split ? TL.pow[0] : TL.pow[1], duck = TL.kind === 'ducktail', FT = duck ? null : frameOf(TL);
  const TLG: Grid = TL.shares.map(f => CT.map((c, k) => { const p = tp(k); return [XT1 + (L.mx(TL.reach[k]!) - XT1) * (1 - f ** p) ** (1 / p), c[1] * f, c[2]] as V; }));
  const LG: Grid = FT ? TLG.map(r => r.map(p => [p[0] - FT.lampIn, p[1], p[2]] as V)) : [], VG: Grid = FT ? TLG.map(r => r.map(p => [p[0] - FT.valIn, p[1], p[2]] as V)) : [];

  // ---- the deck behind the glass: rows at the stations, the tail's shares across; its last row the lamp panel's top edge (the frame's outboard) ----
  const ZD = L.z('deck'), e0 = L.X(D.edge.blend[0]), e1 = L.X(D.edge.blend[1]);
  const zDeck = (x: number, y: number) => { const zc = x <= XG ? zK(x) : ZD(x), u = sm(e0, e1, x); return zc + (zK(x) - zc) * sm(L.my(lerp(D.edge.y0[0], D.edge.y0[1], u)), L.my(lerp(D.edge.y1[0], D.edge.y1[1], u)), y); };
  const iDk = L.at(D.from), NR = TL.shares.length, DC = TL.shares.slice().reverse();
  if (BU_ && NR !== TOP.N) throw new Error('kit: with buttresses the tail needs TOP.N rows (the deck runs on the same columns)');
  // its last row: the frame's top edge (the lamp panel's top across the slot), or the ducktail's lip
  const tailTop = duck ? TLG.map(r => r[0]!).reverse() : TLG.map((r, i) => i >= FT!.frameRows ? LG[i]![3]! : r[0]!).reverse();
  const DKG: Grid = [...SF.slice(iDk).map(s => BU_ ? rear(s) : DC.map(t => [s, t * yK(s), zDeck(s, t * yK(s))] as V)), tailTop];
  if (duck) return { L, F, SF, CH, CJ, CT, zTop, yK, zK, crestX, TFG, iXJ, iA, NSG, RFG, SCR, US, RGL, RGX, SU, glassPt, upper, TLG, LG, VG, DKG, BT: [], BU: [], iBl: DKG.length - 1, iDk };
  // the spoiler's blade bridging the wings over the deck's last rows: its top (level with the ridges), its underside, its leading edge
  const Bl = FT!.blade, BC = DC.slice(0, Bl.cols), bx = L.X(Bl.from);
  const BT: Grid = [...[bx, XT1].map(s => BC.map(t => [s, t * yK(s), zK(s)] as V)), BC.map((_, j) => TLG[NR - 1 - j]![0]!)];
  const BU: Grid = [BC.map((_, j) => TLG[NR - 1 - j]![2]!), BC.map(t => [XT1, t * yK(XT1), Bl.under] as V), BC.map(t => [bx + Bl.lead[0], t * yK(bx), Bl.lead[1]] as V)];
  const iBl = L.at(Bl.from) - iDk;
  return { L, F, SF, CH, CJ, CT, zTop, yK, zK, crestX, TFG, iXJ, iA, NSG, RFG, SCR, US, RGL, RGX, SU, glassPt, upper, TLG, LG, VG, DKG, BT, BU, iBl, iDk };
}

/** the louvred cover's raised centre panel: how far each column of the buttress grid stands up at x */
function deckLift(K: CarKit, L: Lines): (x: number, j: number) => number {
  const P = K.deck.louvre?.panel; if (!P) return () => 0; const a = L.mx(P.from), b = L.mx(P.to);
  return (x, j) => j < P.cols ? P.rise * sm(a - P.ease, a, x) * (1 - sm(b, b + P.ease, x)) : 0; }
