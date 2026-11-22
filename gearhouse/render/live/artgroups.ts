// Which 2D part a mesh part answers to (review 105): both sides' names brought to one canonical name (the sheet's
// mirrored copies '~', numbered pieces, and the pieces a mesh part takes in: the cowl and deck are the mesh's body...).
const SAME: Record<string, string> = { cowl: 'body', deck: 'body', bodyTop: 'body', sill: 'body', apronF: 'body', apron: 'body', door: 'body', tonneauFront: 'tonneau', seatBack: 'seat', seatL: 'seat', seatR: 'seat', seatLBack: 'seat', seatRBack: 'seat',
  bumperFend: 'bumperF', bumperFgap: 'bumperF', bumperFiron2: 'bumperFiron', bumperRend: 'bumperR', lampBar: 'lampStand', radCap: 'shell', screen: 'screenPane', screenCentre: 'screenPost', screenFoot: 'screenFrame', markerR: 'fenderR', markerF: 'fenderF' };
export function canonical(name: string): string { const n = name.replace(/~$/, '').replace(/\d+$/, ''); return SAME[n] ?? n; }
