// The cars the drift-game style is checked on (docs/systems/109, step S1): the style check page (ui/stylecheck.ts)
// shows them one at a time on the turntable. A car is one line here; the 959 (render/car/p959) joins when it is built:
//   { id: 'p959', name: '1987 Porsche 959', mesh: () => p959Mesh() },
import type { Mesh } from './mesh';
import { nsxKitMesh } from './mesh_nsx_kit';
import { mesh as f355KitMesh } from './mesh_f355_kit';
import { mesh as eb110KitMesh } from './mesh_eb110_kit';
import { interiorMesh, INTERIORS } from './interior';
import { p959Mesh } from './p959';

export interface StyleCar { id: string; name: string; mesh: () => Mesh }
export const STYLE_CARS: StyleCar[] = [
  { id: 'p959', name: '1987 Porsche 959', mesh: () => p959Mesh() },
  { id: 'nsx', name: '1990 Honda NSX (키트)', mesh: () => nsxKitMesh() },
  { id: 'f355', name: '1994 Ferrari F355 (키트)', mesh: () => f355KitMesh() },
  { id: 'eb110', name: '1991 Bugatti EB110 (키트)', mesh: () => eb110KitMesh() },
  // the interior on its own (docs/systems/109 section 4), in the 959's cabin: as built in three trims, stripped for drifting, and each behind a plain shell's windscreen
  { id: 'interior', name: '실내: 순정 (검정)', mesh: () => interiorMesh(INTERIORS.stock) },
  { id: 'interiorBrown', name: '실내: 순정 (갈색)', mesh: () => interiorMesh({ ...INTERIORS.stock, trim: 'brown' }) },
  { id: 'interiorTan', name: '실내: 순정 (황갈색)', mesh: () => interiorMesh({ ...INTERIORS.stock, trim: 'tan' }) },
  { id: 'interiorDrift', name: '실내: 드리프트 (버킷, 케이지)', mesh: () => interiorMesh(INTERIORS.drift) },
  { id: 'interiorOpen', name: '실내: 순정 (갈색), 운전석 문 열림', mesh: () => interiorMesh({ ...INTERIORS.stock, trim: 'brown', doors: 'R' }) },
  { id: 'interiorDriftOpen', name: '실내: 드리프트, 운전석 문 열림', mesh: () => interiorMesh({ ...INTERIORS.drift, doors: 'R' }) },
  { id: 'interiorBare', name: '실내: 순정 (갈색), 운전자·문 없음', mesh: () => interiorMesh({ ...INTERIORS.stock, trim: 'brown', doors: 'none', driver: false }) },
  { id: 'interiorDriftBare', name: '실내: 드리프트, 운전자·문 없음', mesh: () => interiorMesh({ ...INTERIORS.drift, doors: 'none', driver: false }) },
  { id: 'interiorShell', name: '실내: 순정, 유리 너머', mesh: () => interiorMesh({ ...INTERIORS.stock, trim: 'brown', preview: '#d8d6cf' }) },
  { id: 'interiorDriftShell', name: '실내: 드리프트, 유리 너머', mesh: () => interiorMesh({ ...INTERIORS.drift, preview: '#2f6fb5' }) },
];
