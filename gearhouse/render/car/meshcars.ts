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
export const MESH_CARS: { id: string; name: string; mesh: (spin?: number) => Mesh }[] = [
  { id: 'dueSSJ35', name: '1935 Duesenberg SSJ', mesh: dueSSJ35 }, { id: 'dueA21', name: '1921 Duesenberg Model A', mesh: dueA21 },
  { id: 'fnTT33', name: '1933 Frazer Nash TT Replica', mesh: fnTT33 }, { id: 'bmw315', name: '1935 BMW 315/1', mesh: bmw315 },
  { id: 'buick28', name: '1928 Buick Standard Six', mesh: buick28 }, { id: 'willys27', name: '1927 Willys-Knight 70A', mesh: willys27 },
  { id: 'dodgeV28', name: '1928 Dodge Victory Six', mesh: dodgeV28 }, { id: 'pontiac29', name: '1929 Pontiac 6-29', mesh: pontiac29 },
  { id: 'plymU29', name: '1929 Plymouth U', mesh: plymU29 }, { id: 'chevAB28', name: '1928 Chevrolet National', mesh: chevAB28 },
  { id: 'fordT23', name: '1923 Ford Model T', mesh: fordT23 }];
