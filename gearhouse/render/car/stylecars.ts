// The cars the drift-game style is checked on (docs/systems/109, step S1): the style check page (ui/stylecheck.ts)
// shows them one at a time on the turntable. A car is one line here; the 959 (render/car/p959) joins when it is built:
//   { id: 'p959', name: '1987 Porsche 959', mesh: () => p959Mesh() },
import type { Mesh } from './mesh';
import { nsxKitMesh } from './mesh_nsx_kit';
import { mesh as f355KitMesh } from './mesh_f355_kit';
import { mesh as eb110KitMesh } from './mesh_eb110_kit';
import { p959Mesh } from './p959';

export interface StyleCar { id: string; name: string; mesh: () => Mesh }
export const STYLE_CARS: StyleCar[] = [
  { id: 'p959', name: '1987 Porsche 959', mesh: () => p959Mesh() },
  { id: 'nsx', name: '1990 Honda NSX (키트)', mesh: () => nsxKitMesh() },
  { id: 'f355', name: '1994 Ferrari F355 (키트)', mesh: () => f355KitMesh() },
  { id: 'eb110', name: '1991 Bugatti EB110 (키트)', mesh: () => eb110KitMesh() },
];
