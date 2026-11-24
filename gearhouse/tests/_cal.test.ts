import { it } from 'vitest';
import { raceSpec } from '../race/cars';
import { designSpec, designFigures, dragArea, zeroTo100 } from '../race/design';
import { DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1 } from '../core/design';
import { engineMass, enginePackage } from '../race/designparts';
it('cal', () => {
  const real: Record<string, { mass: number; hp: number; top: number; torque?: number; cdA?: number }> = { mclarenf1: { mass: 1140 + 75, hp: 627, top: 386 } };
  for (const id of ['nsx', 'f355', 'diablo', 'eb110', 'xj220']) { const r = raceSpec(id); real[id] = { mass: r.mass, hp: r.hp, top: r.topKmh, torque: r.torquePeak, cdA: dragArea(r) }; }
  for (const d of [DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1]) {
    const s = designSpec(d), f = designFigures(d), R = real[d.id]!, pc = (a: number, b: number) => ((a / b - 1) * 100).toFixed(1) + '%';
    console.log(d.id, 'mass', Math.round(s.mass), pc(s.mass, R.mass), 'hp', Math.round(s.hp), '@', s.hpRpm, pc(s.hp, R.hp), 'T', Math.round(s.torquePeak!), '@', s.torqueRpm, R.torque ? pc(s.torquePeak!, R.torque) : '', 'top', s.topKmh, pc(s.topKmh, R.top), 'cdA', dragArea(s).toFixed(3), R.cdA?.toFixed(3), 'cg', s.cgH.toFixed(3), 'front', s.frontShare.toFixed(3), '0-100', zeroTo100(s).toFixed(2), 'final', s.final.toFixed(2), 'em', Math.round(engineMass(d)),
      JSON.stringify(enginePackage(d), (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
    console.log('   ', f.perfLabel, 'cost', f.cost, 'rel', f.reliability, f.serviceKm, f.fit.map(x => `${x.part}:${x.verdict}${x.verdict !== 'ok' ? '(' + x.reason + ' | ' + x.fixes.map(y => y.label).join(', ') + ')' : ''}`).join(' '));
  }
});
