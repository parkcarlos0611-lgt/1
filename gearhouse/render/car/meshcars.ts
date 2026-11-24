// Every car's low-polygon mesh by its id (brief 70), with the name the preview shows.
import type { Mesh } from './mesh';
import { mesh as dueSSJ35 } from './mesh_ssj';
import { mesh as dueA21 } from './mesh_dueA21';
import { mesh as fnTT33 } from './mesh_fnTT33';
import { mesh as bmw315 } from './mesh_bmw315';
import { mesh as buick28 } from './mesh_buick28';
import { mesh as willys27 } from './mesh_willys27';
import { mesh as dodgeV28 } from './mesh_dodgeV28';
import { mesh as pontiac29 } from './mesh_pontiac29';
import { mesh as plymU29 } from './mesh_plymU29';
import { mesh as chevAB28 } from './mesh_chevAB28';
import { mesh as fordT23 } from './mesh_fordT23';
import { mesh as napier33 } from './mesh_napier33';
import { mesh as jagD55 } from './mesh_jagD55';
import { mesh as auburn851 } from './mesh_auburn851';
import { mesh as mb540k } from './mesh_mb540k';
import { mesh as eb110 } from './mesh_eb110';
import { mesh as xj220 } from './mesh_xj220';
import { mesh as diablo } from './mesh_diablo';
import { mesh as nsx } from './mesh_nsx_kit';   // review 171: the NSX now from the shared car kit (closed shell; the hand-built mesh_nsx.ts kept as the reference)
import { mesh as f355 } from './mesh_f355_kit';   // review 175: the F355 from the car kit (the Fable build, chosen over the Opus build; the hand-built mesh_f355.ts kept as the reference)
export const MESH_CARS: { id: string; name: string; mesh: (spin?: number) => Mesh }[] = [
  { id: 'dueSSJ35', name: '1935 Duesenberg SSJ', mesh: dueSSJ35 }, { id: 'dueA21', name: '1921 Duesenberg Model A', mesh: dueA21 },
  { id: 'fnTT33', name: '1933 Frazer Nash TT Replica', mesh: fnTT33 }, { id: 'bmw315', name: '1935 BMW 315/1', mesh: bmw315 },
  { id: 'buick28', name: '1928 Buick Standard Six', mesh: buick28 }, { id: 'willys27', name: '1927 Willys-Knight 70A', mesh: willys27 },
  { id: 'dodgeV28', name: '1928 Dodge Victory Six', mesh: dodgeV28 }, { id: 'pontiac29', name: '1929 Pontiac 6-29', mesh: pontiac29 },
  { id: 'plymU29', name: '1929 Plymouth U', mesh: plymU29 }, { id: 'chevAB28', name: '1928 Chevrolet National', mesh: chevAB28 },
  { id: 'fordT23', name: '1923 Ford Model T', mesh: fordT23 },
  // experimental (review 94): outside the game's period
  { id: 'napier33', name: '1933 Napier-Railton (실험)', mesh: napier33 }, { id: 'jagD55', name: '1955 Jaguar D-type (실험)', mesh: jagD55 },
  // built 3D-first from the user's sheet (review 115), parts named
  { id: 'auburn851', name: '1935 Auburn 851 Speedster', mesh: auburn851 }, { id: 'mb540k', name: '1936 Mercedes-Benz 540 K Special Roadster', mesh: mb540k },
  // review 125: 1990s technology test
  { id: 'eb110', name: '1991 Bugatti EB110 GT (실험)', mesh: eb110 },
  { id: 'xj220', name: '1992 Jaguar XJ220 (실험)', mesh: xj220 },
  // review 141: the wedge, built panel by panel
  { id: 'diablo', name: '1990 Lamborghini Diablo (실험)', mesh: diablo },
  // review 153: the floating canopy, the engine under the rear glass
  { id: 'nsx', name: '1990 Honda NSX (실험)', mesh: nsx },
  // review 158: the F355 (and the F1-gearbox car on the same body)
  { id: 'f355', name: '1994 Ferrari F355 (실험)', mesh: f355 }, { id: 'f355f1', name: '1997 Ferrari F355 F1 (실험)', mesh: f355 }];
