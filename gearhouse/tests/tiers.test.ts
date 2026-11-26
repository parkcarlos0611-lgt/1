// The class ladder (docs/systems/115 C0, option a: the rung by power alone, the bounds the §2-2 table's): the fifteen
// rungs in order, the reference designs on the rungs the doc puts them (by the game's own computed power), the
// doc's other cars by their real figures, the room to the caps, and the labels.
import { describe, it, expect } from 'vitest';
import { TIERS, ROAD_TIERS, tierOf, tierRoom, tierFloor, tierLabel, tierChevrons, roomText, tierById, isTierId } from '../race/tiers';
import { designFigures } from '../race/design';
import { DESIGN_NSX, DESIGN_F355, DESIGN_P959, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1, type Design } from '../core/design';
import { stockP959 } from '../core/bodies';

describe('the ladder', () => {
  it('fifteen rungs, N S P H R, three each; the road caps the §2-2 table exactly, rising', () => {
    expect(TIERS.map(t => t.id)).toEqual(['N1', 'N2', 'N3', 'S1', 'S2', 'S3', 'P1', 'P2', 'P3', 'H1', 'H2', 'H3', 'R1', 'R2', 'R3']);
    expect(ROAD_TIERS.map(t => t.hpMax)).toEqual([80, 130, 180, 230, 300, 400, 460, 540, 650, 800, 1200, Infinity]);
    expect(ROAD_TIERS.map(t => t.topMax)).toEqual([160, 190, 220, 250, 280, 310, 330, 345, 390, 410, 440, Infinity]);
    expect(TIERS.filter(t => !t.road).every(t => t.group === 'R' && t.pending)).toBe(true);
    expect(ROAD_TIERS.filter(t => t.era === '2000s').map(t => t.id)).toEqual(['H1', 'H2', 'H3']);
    expect(tierById('P3')!.hpMax).toBe(650); expect(isTierId('S2')).toBe(true); expect(isTierId('X9')).toBe(false);
  });
  it('the cap belongs to its rung, a horsepower more to the next; the floor is the cap below', () => {
    expect(tierOf({ hp: 80, topKmh: 0 }).id).toBe('N1'); expect(tierOf({ hp: 80.5, topKmh: 0 }).id).toBe('N2');
    expect(tierOf({ hp: 650, topKmh: 0 }).id).toBe('P3'); expect(tierOf({ hp: 651, topKmh: 0 }).id).toBe('H1');
    expect(tierOf({ hp: 5000, topKmh: 0 }).id).toBe('H3'); expect(tierOf({ hp: NaN, topKmh: 0 }).id).toBe('N1');
    expect(tierFloor(tierById('N1')!)).toBe(0); expect(tierFloor(tierById('P2')!)).toBe(460);
  });
  it('the top speed never places a car (a 400 km/h car of 200 hp is S1; a 150 km/h car of 700 hp is H1)', () => {
    expect(tierOf({ hp: 200, topKmh: 400 }).id).toBe('S1'); expect(tierOf({ hp: 700, topKmh: 150 }).id).toBe('H1');
  });
});

describe('the cars on the ladder (doc 115 §2-3, column a)', () => {
  // the repo's designs, by the power the game works out for them (the doc's "게임" figures: the EB110 581, the
  // three-seat 1993 car 646, just under P3's 650)
  const REF: [Design, string, number][] = [[DESIGN_NSX, 'S2', 269], [DESIGN_F355, 'S3', 375], [DESIGN_P959, 'P1', 442], [DESIGN_DIABLO, 'P2', 498],
    [DESIGN_XJ220, 'P3', 543], [DESIGN_EB110, 'P3', 581], [DESIGN_MCLAREN_F1, 'P3', 646]];
  for (const [d, id, hp] of REF) it(`${d.id}: ${hp} hp, ${id}`, () => { const f = designFigures(d); expect(f.hp).toBe(hp); expect(tierOf(f).id).toBe(id); });
  it('the stock car of the one-make is P1, like its design', () => expect(tierOf(designFigures(stockP959())).id).toBe('P1'));
  // the doc's other cars, by their real figures [~]: the light ones by their raw power (no correction), the later
  // super and hyper cars on H, none of the 1990s' above P3
  const REAL: [string, number, string][] = [['a 1990s ordinary saloon', 90, 'N2'], ['a 16-valve hot hatch', 150, 'N3'], ['a 1990 small roadster', 115, 'N2'],
    ['a 1996 lightweight roadster', 118, 'N2'], ['a 1992 fast saloon', 335, 'S3'], ['a 1987 twin-turbo V8 coupé', 471, 'P2'],
    ['a 2002 V12 hypercar', 660, 'H1'], ['a 2005 W16 hypercar', 987, 'H2'], ['a 2013 hybrid hypercar', 950, 'H2'], ['a 2016 W16 hypercar', 1479, 'H3'],
    ['a 2020s electric hypercar', 1914, 'H3'], ['a 2020s electric saloon', 1020, 'H2']];
  for (const [name, hp, id] of REAL) it(`${name}: ${hp} hp, ${id}`, () => expect(tierOf({ hp, topKmh: 0 }).id).toBe(id));
});

describe('the room and the labels', () => {
  it('the room to the caps: the 599 18 hp and 4 km/h, the three-seat car 4 hp; the open top has no cap', () => {
    const a = tierRoom(designFigures(DESIGN_P959)); expect(a.hp).toBe(18); expect(a.top).toBe(4); expect(a.overHp || a.overTop).toBe(false); expect(a.hpShare).toBeCloseTo(442 / 460, 6);
    expect(tierRoom(designFigures(DESIGN_MCLAREN_F1)).hp).toBe(4);
    const o = tierRoom({ hp: 1500, topKmh: 420 }); expect(o.hp).toBe(Infinity); expect(o.top).toBe(Infinity); expect(o.hpShare).toBe(0);
    const over = tierRoom({ hp: 300, topKmh: 300 }, tierById('S2')!); expect(over.overTop).toBe(true); expect(over.top).toBe(-20);
  });
  it('the labels: code and group, the chevrons, the room', () => {
    expect(tierLabel(tierById('S3')!)).toBe('S3 · 스포츠'); expect(tierLabel(tierById('P3')!)).toBe('P3 · 슈퍼'); expect(tierLabel(tierById('N1')!)).toBe('N1 · 일반');
    expect(tierLabel(tierById('H2')!)).toBe('H2 · 하이퍼'); expect(tierLabel(tierById('R1')!)).toBe('R1 · 레이싱');
    expect(tierChevrons(tierById('P3')!)).toBe('‹‹‹'); expect(tierChevrons(tierById('S1')!)).toBe('‹');
    expect(roomText(18, 'hp')).toBe('+18 hp'); expect(roomText(-20, 'km/h')).toBe('−20 km/h'); expect(roomText(Infinity, 'hp')).toBe('상한 없음');
  });
});
