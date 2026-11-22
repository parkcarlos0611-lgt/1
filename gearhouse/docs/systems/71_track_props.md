# 71 · Millbrook scenery props: build rules

The track's buildings and things are low-poly meshes drawn by the cars' renderer (render/car/mesh.ts), baked at the
track's scale and shown with the cars. Reference: `render/props/stands.ts` (grandstand bay, clock tower, timing box,
scoreboard, bridge). Read it and render/car/mesh.ts first; docs/systems/70_mesh_car_rules.md explains `Build`
(`mat(colour, gloss, kind)`, `box`, `bar`, `loft`, `lathe`, `quad`, `tri`) and the material kinds.

## A prop
- A function in a file under `render/props/`, returning `Mesh` (`b.mesh(length)`), mm units, real sizes.
- Axes: x along its length 0..length, y across (the side it faces is -y: a building's front, a stand's open side),
  z up from the ground; it stands on its anchor, the middle of its length at y = 0, z = 0.
- Long things are cut into pieces of at most about 15 m (the drawing sorts by each piece's anchor): a long shed is a
  bay repeated, a train is a locomotive and separate carriages.
- 200-2500 triangles a prop; what does not show at 50 mm a pixel from 30-40 degrees up is not worth triangles.
- 1930s England, a motor course and aerodrome: brick, timber, corrugated iron, cream and green paint, tarred roofs.
  No real brand names or logos (advertising boards: plain colour panels and stripes).
- Kinds: painted surfaces `paint`, timber `wood`, iron sheet and rails `metal`, glass `glass`, cloth `canvas`.

## Checking
`npx tsx tools/ref/propshot.ts <out.png> file=render/props/<file>.ts name=<function> mm=50` draws four headings from
30 degrees up and one from the side. Look at every picture you make (Read the PNG). Put pictures under
/tmp/claude-0/-home-user-1/0b845933-8226-57c8-b442-07d308e42630/scratchpad/props/.
