# chevAB (1928 Chevrolet National AB) — direct, main session

Started from the automatic draft (draft/chevAB_auto.json); script chevAB.py rewrites the parts the draft had wrong.

## Changed from the draft (side view)
- fenderF, fenderR: redrawn point by point off a gridded zoom of the sheet. The draft's wings were snapped onto the
  wrong lines (the front wing pulled down to the frame); flood fills and colour classes both failed because the wings
  are the same black as the tyres and the louvre panel, so the outline was read by hand, as the template's was.
- hood, cowl: traced from the sheet's paint class (the bonnet was a thin strip in the draft, the engine showed).
- quarter (new part, canvas, on the body): this car's black top comes down the sides over the window band, the
  pillars and the rear quarter to the belt; the template's roof lies behind the body and cannot show that.
- glass0..2: traced from the pale panes, convex hull (the steering wheel seen through the front glass is not a notch).
- wframe0..2: a slim black surround round each pane, on the quarter panel.
- shell, lamp: traced (chrome / whole lamp, hull); the lamp's shell black.
- canvas colour #2a2a2d (the draft's sample took the top's grey highlight).
- Front, rear and top views: left as the draft (scores were already at the draft's level; no time spent).

## Scores (autocmp)
| view | draft sil / lines | direct sil / lines |
|---|---|---|
| side | 0.934 / 0.720 | 0.937 / 0.698 |
| front | 0.934 / 0.645 | 0.934 / 0.636 |
| rear | 0.955 / 0.535 | 0.955 / 0.535 |
| top | 0.913 / 0.646 | 0.913 / 0.643 |

The scores hardly move although the side view is much closer to the sheet by eye (wing shapes, black top, glass,
bonnet): the silhouette score is dominated by the body's outline, which the draft already had. Judge by the pictures.

## Still wrong
- The front, rear and top views were not reworked (wings in the front view, the lamp bar, the radiator shell).
- The wheel wells: the dark under the arches is body paint in the model.
- The bonnet's louvres are the template's count and place.

## Effort
About eight iterations in the main session (trace, draw, look). The first three were spent finding that
flood fill and colour classes do not separate black wings from black tyres; point reading off a gridded zoom is what
worked.
