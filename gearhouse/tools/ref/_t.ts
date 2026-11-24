import { buildFree } from '../../render/car/free/build';
import { NSX_DUCT } from '../../render/car/free/library';
import { CANOPY } from '../../render/car/free/presets';
console.log(buildFree(CANOPY, { fixtures: [{ fixture: NSX_DUCT }] }).fixtures[0]!.why);
