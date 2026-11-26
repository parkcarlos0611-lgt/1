// The class ladder (docs/systems/115 §2): fifteen rungs across the eras, N1-N3 normal, S1-S3 sports, P1-P3 super,
// H1-H3 hyper, R1-R3 racing. A road car's rung is decided by its power alone (the doc's option a: no correction by hp a
// tonne); the top-speed figure of a rung is only its cap (a limiter, §3), never what places a car. The bounds are the
// §2-2 table exactly: a car belongs to the lowest rung whose power cap it does not pass (the cap itself included), so
// the floor of a rung is the cap of the one below. The racing rungs are cut by race rules (§9), which do not exist
// yet: they are listed so the ladder has its fifteen, but no road car lands on them.
// C1: the rung a design chooses (core/design.ts format 6's `tier`) is its wall: the builder holds its sliders and locks
// its options at the cap (ui/builder_tier.ts), and what passes it by another way is held by an intake restrictor (the
// power) and a speed limiter (the top speed) in the design's physics (race/design.ts). There is no floor: a car is
// named for the rung it reaches.

export type TierGroup = 'N' | 'S' | 'P' | 'H' | 'R';
export type TierId = `${TierGroup}${1 | 2 | 3}`;
export interface Tier {
  id: TierId; group: TierGroup; /** the rung inside its group, 1 to 3 */ n: 1 | 2 | 3;
  /** the power cap (hp, inclusive); Infinity for the open top rung and for the racing rungs (their rules not set) */ hpMax: number;
  /** the top-speed limiter (km/h); Infinity where there is none */ topMax: number;
  /** a road rung (the racing ones are cut by race rules, §9) */ road: boolean;
  /** when the rung opens: the 1990s' cars fill N, S and P; H is the 2000s' and later; R is not tied to an era */ era: '1990s' | '2000s' | 'any';
  /** a racing rung's rules are not written yet (a placeholder) */ pending?: boolean }

export const TIER_GROUPS: readonly TierGroup[] = ['N', 'S', 'P', 'H', 'R'];
/** the groups as the screens name them */
export const TIER_GROUP_NAME: Record<TierGroup, string> = { N: '일반', S: '스포츠', P: '슈퍼', H: '하이퍼', R: '레이싱' };

const road = (id: TierId, hpMax: number, topMax: number, era: Tier['era']): Tier => ({ id, group: id[0] as TierGroup, n: +id[1]! as 1 | 2 | 3, hpMax, topMax, road: true, era });
const race = (id: TierId): Tier => ({ id, group: 'R', n: +id[1]! as 1 | 2 | 3, hpMax: Infinity, topMax: Infinity, road: false, era: 'any', pending: true });
/** the fifteen rungs, lowest first (doc 115 §2-2; the table's hp-a-tonne column is not used and left out) */
export const TIERS: readonly Tier[] = [
  road('N1', 80, 160, '1990s'), road('N2', 130, 190, '1990s'), road('N3', 180, 220, '1990s'),
  road('S1', 230, 250, '1990s'), road('S2', 300, 280, '1990s'), road('S3', 400, 310, '1990s'),
  road('P1', 460, 330, '1990s'), road('P2', 540, 345, '1990s'), road('P3', 650, 390, '1990s'),
  road('H1', 800, 410, '2000s'), road('H2', 1200, 440, '2000s'), road('H3', Infinity, Infinity, '2000s'),
  race('R1'), race('R2'), race('R3')];
export const ROAD_TIERS: readonly Tier[] = TIERS.filter(t => t.road);
const BY_ID = new Map(TIERS.map(t => [t.id, t] as const));
/** a rung by its id (undefined for anything else) */
export const tierById = (id: string): Tier | undefined => BY_ID.get(id as TierId);
export const isTierId = (v: unknown): v is TierId => typeof v === 'string' && BY_ID.has(v as TierId);

/** what places a car: its power; the top speed is read only for the room under the limiter */
export interface TierFigures { hp: number; topKmh: number }

/** the rung a road car reaches: the lowest whose power cap it stays within (not a number reads as none: N1) */
export function tierOf(f: TierFigures): Tier {
  const hp = Number.isFinite(f.hp) ? f.hp : 0;
  return ROAD_TIERS.find(t => hp <= t.hpMax) ?? ROAD_TIERS[ROAD_TIERS.length - 1]!; }

/** a rung's floor: the cap of the road rung below it (0 for N1; the racing rungs have none) */
export function tierFloor(t: Tier): number { const i = ROAD_TIERS.indexOf(t); return i > 0 ? ROAD_TIERS[i - 1]!.hpMax : 0; }
/** the limiter of the road rung below (0 for N1): where a rung's top-speed meter starts */
export function tierTopFloor(t: Tier): number { const i = ROAD_TIERS.indexOf(t); return i > 0 ? ROAD_TIERS[i - 1]!.topMax : 0; }

/** the room a car has under a rung's caps: power and top speed (positive: under the cap; negative: past it, which C0
 *  only shows; Infinity: no cap), each also as the share of the cap it uses (0 where there is no cap) */
export interface TierRoom { hp: number; top: number; hpShare: number; topShare: number; overHp: boolean; overTop: boolean }
export function tierRoom(f: TierFigures, t: Tier = tierOf(f)): TierRoom {
  const hp = t.hpMax - f.hp, top = t.topMax - f.topKmh;
  return { hp, top, hpShare: Number.isFinite(t.hpMax) ? f.hp / t.hpMax : 0, topShare: Number.isFinite(t.topMax) ? f.topKmh / t.topMax : 0, overHp: hp < 0, overTop: top < 0 }; }

/** the rung as the screens write it: its code and its group's name, "S3 · 스포츠" */
export const tierLabel = (t: Tier): string => `${t.id} · ${TIER_GROUP_NAME[t.group]}`;
/** the rung inside its group as chevrons (doc 115 §3-7): 1 ‹, 2 ‹‹, 3 ‹‹‹ */
export const tierChevrons = (t: Tier): string => '‹'.repeat(t.n);
/** a room figure as the screens write it: "+18 hp", "−6 km/h", or "상한 없음" where there is no cap */
export function roomText(v: number, unit: string): string {
  if (!Number.isFinite(v)) return '상한 없음';
  const r = Math.round(v); return `${r < 0 ? '−' : '+'}${Math.abs(r).toLocaleString()} ${unit}`; }

/** why a rung cannot be chosen now (null: it can): the racing rungs' rules are not written ("준비 중"); the hyper rungs
 *  are the 2000s' and later, closed in the 1990s' sandbox unless its settings open the era (doc 115 §2-5) */
export function tierLock(t: Tier, eraOpen = false): string | null {
  if (t.pending) return '준비 중';
  if (t.era === '2000s' && !eraOpen) return '2000년대 이후';
  return null; }
/** a rung of the 2000s chosen in the 1990s' sandbox (the era's lock opened in the settings): "시대 밖" */
export const outOfEra = (t: Tier): boolean => t.era === '2000s';
/** the road rung a power needs (its own rung: the lowest whose cap it stays within) */
export const tierFor = (hp: number): Tier => tierOf({ hp, topKmh: 0 });
/** the rung's place on the ladder (0 for N1), to tell a move up from a move down */
export const tierIndex = (t: Tier): number => TIERS.indexOf(t);

/** each rung's line on the class pick: the kind of car it holds (the game's own names only, never a real one) */
export const TIER_NOTE: Record<TierId, string> = {
  N1: '경차', N2: '보통 세단·해치', N3: '빠른 세단', S1: '핫해치·가벼운 로드스터', S2: '옛 바탕 A', S3: '옛 바탕 B · 빠른 세단',
  P1: '포스터 599', P2: '시험 차 D', P3: '옛 바탕 C · 1990년대의 끝', H1: '2000년대 슈퍼카', H2: '1,000마력급', H3: '전기 하이퍼',
  R1: 'GT 경주차', R2: '프로토타입', R3: '포뮬러' };
/** each group's line on the class pick */
export const GROUP_NOTE: Record<TierGroup, string> = { N: '매일 타는 차', S: '스포츠카와 빠른 세단', P: '1990년대의 슈퍼카', H: '2000년대 이후의 급', R: '경주 규정으로 자름' };
