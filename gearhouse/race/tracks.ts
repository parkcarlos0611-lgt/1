// The tracks the drive page offers (review 162): each its centre line, its surroundings, its name for the picture,
// and how coarsely its level concrete may be laid for the live picture (a metre where it has shape). The surroundings
// are cleared to the woods and given a real circuit's edge (docs/systems/111 T1: race/trackside.ts); the old plans stay in race/scenery.ts.
import type { Track } from './track';
import { millbrook } from './millbrook';
import { roadCourse } from './roadcourse';
import { speedway } from './speedway';
import { millbrookScenery, roadScenery, speedwayScenery, type Scenery } from './scenery';
import { cleanScenery } from './trackside';

export interface TrackDef { id: string; label: string; title: string; make: () => Track; scenery: (T: Track) => Scenery; /** the ground's longest step on level concrete (m) */ groundStep: number }
export const TRACKS: TrackDef[] = [
  { id: 'millbrook', label: '밀브룩 아우터 서킷 (뱅크, 4.45 km)', title: 'MILLBROOK', make: millbrook, scenery: T => cleanScenery(T, millbrookScenery(T)), groundStep: 1 },
  { id: 'road', label: '애시콤 파크 (평평한 로드 코스, 3.77 km)', title: 'ASHCOMBE PARK', make: roadCourse, scenery: T => cleanScenery(T, roadScenery(T)), groundStep: 1 },
  { id: 'speed', label: '스피드 볼 (15 km 직선 시험장, 한 바퀴 37.5 km)', title: 'SPEED BOWL', make: speedway, scenery: T => cleanScenery(T, speedwayScenery(T), 5), groundStep: 25 }];
export const trackDef = (id: string): TrackDef => TRACKS.find(t => t.id === id) ?? TRACKS[0]!;
