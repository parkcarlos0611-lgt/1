// The suspension's part names and the bone each hangs on (kinematics.ts BONES). Nothing is imported here, so the mesh's
// own code (render/car/mesh.ts wheelsOf) can read it: a suspension part is never a wheel's, though the caliper, the
// disc and the hub sit inside one (the renderer moves them by their bones; the disc's bone turns with the wheel).
/** -1: it stands still on the chassis */
export const PART_BONE: Record<string, number> = { wishboneLower: 0, wishboneUpper: 1, upright: 2, hubFlange: 2, caliper: 2, brakeDisc: 3, tieRod: 4, toeLink: 4,
  damper: 5, damperRod: 6, spring: 7, antiRollBar: 8, dropLink: 9, steeringRack: -1 };
export const isSuspPart = (name: string): boolean => name in PART_BONE;
/** the parts a wheel's face hides: the builder's suspension view takes these off (the tyre and the rim's barrel stay) */
export const WHEEL_FACE = ['wheel', 'hub'];
