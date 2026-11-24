// The machinery's two looks (docs/systems/109 section 10): the realistic one the powertrain and the suspension were
// first built in ('real': true sections, small fittings), and the drift-game one ('drift': few, chunky, exaggerated
// parts in bold colours, drawn with the thick outline and two bands of light of the renderer's look 4). The drift look
// changes only what a part looks like: the builders lay out the same parts by the same rules, with the same names on
// the same bones; the engine's fit, its scale and what the checks read are measured on the realistic shapes.
// Everything the drift look sets is data here, so a customisation screen can change it later:
//   PART_KIND      what kind of thing each named part is (a pipe, a hose, a belt, a link, a casting, a box, ...)
//   DRIFT_RULES    each kind's rules: how much thicker its round sections are drawn and the least they may be on the
//                  screen, its boxes' chamfer, its round sections' sides
//   DRIFT_PALETTE  the colours by role; DRIFT_PAINT which roles each part takes (its first colour, its second, ...)
import type { Kind } from '../mesh';

export type PartStyle = 'real' | 'drift';
let current: PartStyle = 'real';
/** the look machinery is built in where a builder is not told (the game's look setting sets it: styleForLook) */
export const partStyle = (): PartStyle => current;
export function setPartStyle(s: PartStyle): void { current = s; }
/** the machinery's look for a renderer look: the drift-game look (4) has its own, every other the realistic one */
export const styleForLook = (look: number): PartStyle => look === 4 ? 'drift' : 'real';

export type PartKind = 'pipe' | 'exhaust' | 'runner' | 'header' | 'hose' | 'line' | 'belt' | 'link' | 'shaft' | 'arm' | 'frame' | 'spring' | 'casting' | 'cover' | 'box' | 'plate' | 'round';
/** a kind's rules. Round sections (tubes, cylinders, bars) are drawn `scale` times as thick and never thinner than
 *  `minPx` pixels across in the reference view; a box's edges are cut by `bevel` mm (never more than a share of its
 *  thinnest side); a kind with no tubes of its own (`seg` 0) has no box side thinner than `minPx` either; `seg`: the
 *  sides of its tubes (0: as the builder says) */
export interface KindRule { scale: number; minPx: number; bevel: number; seg: number }
/** the reference view the least thicknesses are given in: an engine bay filling a phone's picture, 2.5 mm a pixel */
export const REF_MM_PER_PX = 2.5;
export const DRIFT_RULES: Record<PartKind, KindRule> = {
  pipe: { scale: 1.75, minPx: 24, bevel: 0, seg: 10 },     // charge and water pipes: the references' thick yellow and blue ones
  exhaust: { scale: 1.1, minPx: 16, bevel: 0, seg: 8 },    // under the floor and into the body's own tips: little thicker than true
  runner: { scale: 1.3, minPx: 18, bevel: 0, seg: 6 },
  header: { scale: 1.25, minPx: 16, bevel: 0, seg: 6 },
  hose: { scale: 1.5, minPx: 14, bevel: 0, seg: 8 },
  line: { scale: 1.5, minPx: 9, bevel: 0, seg: 5 },
  belt: { scale: 1.4, minPx: 10, bevel: 0, seg: 0 },
  link: { scale: 1.6, minPx: 8, bevel: 0, seg: 6 },
  shaft: { scale: 1.5, minPx: 16, bevel: 0, seg: 8 },
  arm: { scale: 1.9, minPx: 14, bevel: 0, seg: 6 },
  frame: { scale: 1.2, minPx: 16, bevel: 0, seg: 6 },
  spring: { scale: 1.7, minPx: 7, bevel: 0, seg: 4 },
  casting: { scale: 1, minPx: 0, bevel: 7, seg: 0 },
  cover: { scale: 1, minPx: 0, bevel: 14, seg: 0 },
  box: { scale: 1, minPx: 0, bevel: 12, seg: 0 },
  plate: { scale: 1, minPx: 4, bevel: 0, seg: 0 },
  round: { scale: 1, minPx: 0, bevel: 0, seg: 0 },
};
/** the least a kind's round section may be across (mm) */
export const minDiameter = (k: PartKind, rules: Record<PartKind, KindRule> = DRIFT_RULES): number => rules[k].minPx * REF_MM_PER_PX;

/** what kind each part is (a part not listed is a casting) */
export const PART_KIND: Record<string, PartKind> = {
  // the engine
  engineBlock: 'casting', sump: 'casting', cylinderHead: 'casting', timingCover: 'casting', camCover: 'cover', coilPack: 'round', oilPump: 'round', oilFilter: 'round', starter: 'round',
  pulley: 'round', belt: 'belt', alternator: 'round', waterPump: 'round', exhaustManifold: 'header', heatShield: 'plate', turbo: 'round', wastegate: 'round', airFilter: 'round', exhaustDownpipe: 'exhaust',
  intakePlenum: 'cover', intakeRunner: 'runner', intakeTrumpet: 'round', throttleBody: 'round', throttleLinkage: 'link', fuelRail: 'link', intakeActuator: 'round', intakeLabel: 'plate', airbox: 'box',
  intakeHose: 'hose', intercooler: 'box', boostPipe: 'pipe', thermostat: 'casting', coolantHose: 'hose', oilFiller: 'round', dipstick: 'line',
  // the drivetrain and the exhaust
  clutchHousing: 'round', gearbox: 'casting', shiftActuator: 'box', shiftLinkage: 'link', differential: 'round', driveshaft: 'shaft', cvJoint: 'round', cvBoot: 'round', shaftBearing: 'round',
  centreDiff: 'round', propShaft: 'shaft', propJoint: 'round', frontDifferential: 'round', exhaustPipe: 'exhaust', catalyst: 'round', muffler: 'round', tailpipe: 'exhaust',
  // what stands round the engine
  radiator: 'box', radiatorFan: 'round', coolantPipe: 'hose', expansionTank: 'box', battery: 'box', fuelTank: 'round', fuelFiller: 'runner', fuelLine: 'line', oilCooler: 'box', oilLine: 'line',
  oilTank: 'round', subframe: 'frame', subframeFront: 'frame', strutBrace: 'frame', engineMount: 'frame',
  // the bay's own (the drift look's)
  washerTank: 'box', fuseBox: 'box', bayTub: 'box', radiatorPanel: 'frame', lampBack: 'box',
  // the suspension
  wishboneLower: 'arm', wishboneUpper: 'arm', upright: 'casting', hubFlange: 'round', caliper: 'box', brakeDisc: 'round', tieRod: 'link', toeLink: 'link', damper: 'round', damperRod: 'link',
  spring: 'spring', antiRollBar: 'link', dropLink: 'link', steeringRack: 'shaft',
};
export const kindOf = (name: string): PartKind => PART_KIND[name] ?? 'casting';

export interface Paint { col: string; gloss: number; kind: Kind }
const P = (col: string, gloss = 0.25, kind: Kind = 'plain'): Paint => ({ col, gloss, kind });
/** the drift look's colours by role: bold and few (silver and grey castings, black rubber, white plastic, red caps,
 *  yellow and blue pipes). Flat finishes: the look's two bands of light do the shading */
export const DRIFT_PALETTE = {
  casting: P('#c2c6cb', 0.3), castingDark: P('#878c93', 0.3), steel: P('#d9dce0', 0.45), iron: P('#5c6066', 0.25), black: P('#1d1e21', 0.2), rubber: P('#17181a', 0.1),
  pipeBoost: P('#f2c12e', 0.4), pipeWater: P('#2f6fd6', 0.4), pipeAlu: P('#dfe2e6', 0.45), pipeExhaust: P('#a9aeb5', 0.4), exhaustHot: P('#8b6f5c', 0.3), coupler: P('#2456c8', 0.3),
  hose: P('#202124', 0.15), capRed: P('#dc2a1f', 0.4), capYellow: P('#f4cc1f', 0.4), capBlue: P('#2a63d4', 0.4), capBlack: P('#1a1b1d', 0.3),
  plasticWhite: P('#f0efe8', 0.3), plasticBlack: P('#232427', 0.2), core: P('#9aa0a8', 0.3), coreDark: P('#5b6068', 0.25), filter: P('#d5301f', 0.25), filterBlue: P('#2456c8', 0.35),
  gold: P('#d6a531', 0.4), red: P('#d8281e', 0.4), battery: P('#1c1d20', 0.25), batteryTop: P('#34363b', 0.2), terminalPlus: P('#dc2a1f', 0.4), terminalMinus: P('#2b2d31', 0.4),
  frame: P('#2b2d31', 0.25), tub: P('#151618', 0.12), tubLip: P('#222326', 0.15), lamp: P('#3a3d42', 0.3), brace: P('#e3e5e8', 0.5), tank: P('#3a3d42', 0.3), shield: P('#cfd2d6', 0.4),
  // the suspension and the brakes (the caliper's is the one a player chooses: red, yellow, green, orange, blue, purple, black)
  arm: P('#2a2c30', 0.3), upright: P('#b7bbc1', 0.3), caliper: P('#d8281e', 0.5, 'paint'), disc: P('#c9ccd1', 0.45), discHole: P('#3a3c40', 0.2), discBell: P('#4a4d53', 0.3),
  spring: P('#e8c21e', 0.4, 'paint'), damper: P('#3b6fd0', 0.35), rod: P('#e3e5e8', 0.5), bush: P('#17181a', 0.1),
} satisfies Record<string, Paint>;
export type PaletteRole = keyof typeof DRIFT_PALETTE;
export type Palette = Record<PaletteRole, Paint>;
/** the calipers a player may choose among (the reference's row of colours) */
export const CALIPER_COLOURS = ['#d8281e', '#f0c81e', '#27a844', '#f08a1e', '#2456c8', '#8a3fc8', '#1c1d20'] as const;

/** each part's roles: its first colour as built takes the first, its second the second, and so on (null, or none
 *  left: it keeps the colour the builder gives, the engine's own: its block, heads, covers and intake) */
export const DRIFT_PAINT: Record<string, (PaletteRole | null)[]> = {
  engineBlock: [null], sump: [null, 'black'], cylinderHead: [null], camCover: [null, null], timingCover: ['castingDark'], intakePlenum: [null], intakeRunner: [null], intakeLabel: [null],
  coilPack: ['black'], oilPump: ['steel'], oilFilter: ['filterBlue'], starter: ['black', 'steel'], pulley: ['steel'], belt: ['rubber'], alternator: ['casting'], waterPump: ['castingDark'],
  exhaustManifold: ['exhaustHot', 'exhaustHot'], heatShield: ['shield'], turbo: ['iron', 'castingDark', 'steel'], wastegate: ['gold'], airFilter: ['filter'], exhaustDownpipe: ['exhaustHot'],
  intakeTrumpet: ['steel', 'black'], throttleBody: ['steel'], throttleLinkage: ['steel'], fuelRail: ['red'], intakeActuator: ['gold'], airbox: ['plasticBlack', 'black'], intakeHose: ['hose'],
  intercooler: ['core', 'pipeAlu', 'coreDark'], boostPipe: ['pipeBoost'], thermostat: ['casting'], coolantHose: ['hose'], oilFiller: ['capYellow'], dipstick: ['capYellow'],
  clutchHousing: ['casting'], gearbox: ['casting', 'castingDark'], shiftActuator: ['black', 'gold'], shiftLinkage: ['black', 'steel'], differential: ['castingDark', 'casting'], driveshaft: ['iron'],
  cvJoint: ['castingDark'], cvBoot: ['rubber'], shaftBearing: ['castingDark'], centreDiff: ['castingDark'], propShaft: ['iron'], propJoint: ['castingDark'], frontDifferential: ['castingDark'],
  exhaustPipe: ['exhaustHot', 'pipeExhaust'], catalyst: ['pipeExhaust'], muffler: ['pipeExhaust'], tailpipe: ['steel'],
  radiator: ['core', 'pipeAlu', 'coreDark'], radiatorFan: ['black', 'plasticBlack'], coolantPipe: ['pipeWater'], expansionTank: ['plasticWhite', 'capRed'], battery: ['battery', 'batteryTop', 'terminalPlus', 'terminalMinus'],
  fuelTank: ['tank'], fuelFiller: ['steel'], fuelLine: ['iron'], oilCooler: ['core', 'pipeAlu'], oilLine: ['pipeWater'], oilTank: ['pipeAlu', 'capBlack'],
  subframe: ['frame'], subframeFront: ['frame'], strutBrace: ['brace'], engineMount: ['rubber', 'steel'],
  washerTank: ['plasticWhite', 'capBlue'], fuseBox: ['plasticBlack', 'black'], bayTub: ['tub', 'tubLip'], radiatorPanel: ['frame'], lampBack: ['lamp'],
  wishboneLower: ['arm', 'bush'], wishboneUpper: ['arm', 'bush'], upright: ['upright'], hubFlange: ['iron'], caliper: ['caliper', 'black'], brakeDisc: ['disc', 'discBell', 'discHole'],
  tieRod: ['rod', 'iron'], toeLink: ['rod', 'iron'], damper: ['damper', 'iron'], damperRod: ['rod', 'iron', 'bush'], spring: ['spring'], antiRollBar: ['iron'], dropLink: ['rod'], steeringRack: ['casting', 'rubber', 'casting'],
};

/** the drift look as a collector takes it: the rules, the palette, the parts' roles */
export interface DriftStyle { rules: Record<PartKind, KindRule>; palette: Palette; paint: Record<string, (PaletteRole | null)[]>; kinds: Record<string, PartKind> }
/** the drift look, with what a customisation changes laid over the standard */
export function driftStyle(over: { palette?: Partial<Palette>; rules?: Partial<Record<PartKind, Partial<KindRule>>>; paint?: Record<string, (PaletteRole | null)[]> } = {}): DriftStyle {
  const rules = { ...DRIFT_RULES }; for (const k of Object.keys(over.rules ?? {}) as PartKind[]) rules[k] = { ...rules[k], ...over.rules![k] };
  return { rules, palette: { ...DRIFT_PALETTE, ...over.palette }, paint: { ...DRIFT_PAINT, ...over.paint }, kinds: PART_KIND }; }
/** what a builder is asked for as a collector's style: 'real' (or the setting's) none, 'drift' the standard, or a customised one */
export type StyleOpt = PartStyle | DriftStyle;
export const resolveStyle = (s?: StyleOpt): DriftStyle | null => { const v = s ?? current; return v === 'real' ? null : v === 'drift' ? driftStyle() : v; };
