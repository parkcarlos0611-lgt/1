# dueA21 — notes for the know-how

## Methods
- **Views first** (`work/mkviews.py`): check which way each view faces before reading anything. This sheet's plan
  has the front to the right; the tools want it to the left. Turn it once into `views/` and read plan x as
  (view length - sheet x). Also look at the cut's edges for pieces of the neighbouring drawing and clear them.
- **Black on black**: no snapping (`fit` unused). Outlines read off 8x gridded crops (`work/grid.py`), then every
  outline drawn over the sheet (`work/over.py <view> <zoom>`) before trusting scores. The pale rim lines the artist
  draws on wing edges, roof edge and belt are the landmarks.
- **Side window** (`WIN` loop): frame, dark reveal, glass, each `on` the one below, own thin `y` at the body's half
  width; takes the frame's and the glass's corners and a corner radius.
- **Upright two-pane screen**: frame by `frrect`, one glass pane `pair=True`, centre bar; glass is the whole opening
  (the pale patches on the sheet are reflections, the rest shows the inside, which is not drawn).
- **Nickel shell**: side wedge, front arch as a half outline, plan strip; core `on` it with `cells`.
- **Drum lamp**: side profile, `fell` face, plan wedge, lens with `bowl`, post in the front view only.
- **Blade wing with inner sweep**: side as outer edge then inner edge back (about 30 points); front view as the crown
  blob plus the thin sweep down to the frame as one polygon.
- **Dark masses** (`vis_axleF`, `vis_axleR`, `vis_frameF/R`, `under`, `underTop`): after the first build the
  comparison's blue areas show where the sheet has car and the model none; fill each with one flat black part of the
  right element behind the rest.
- **White walls**: `whitewall` = (white band's width) / (tyre radius - rim radius); the band starts at 0.12 in the
  renderer, so measure from just outside the rim.
- **Handle feature**: `len` must be divided by the part's width in `part()` (some scripts' `part()` lack the line;
  without it the handle draws as a streak across the car).

## Details caught (* = the draft had it wrong or missing)
- [x] * plan view faces the other way
- [x] * two side windows a side, not three; one door a side
- [x] * no spare, no bumpers, no steps on the board
- [x] * white-wall tyres; wire wheels in black, small nickel cap
- [x] nickel radiator shell, * filler cap with mascot, * badge
- [x] * 24 bonnet louvres, belt pinstripe along bonnet, cowl and body, centre hinge
- [x] * two-pane screen and two-pane rear window
- [x] * red tail lamp in nickel rim on each rear wing (2)
- [x] * fuel tank between the frame horns behind the body (rear, plan)
- [x] * front cross tube ahead of the radiator (plan, front, side)
- [x] board with bright edge; valance under the doors
- [ ] corner posts with narrow panes, lamp stays, wing edge mouldings, mascot wings

## Pitfalls
- Reading picture pixels instead of grid labels on the plan crop gave a roof 290 units long on the first reading;
  the whole-view picture showed it at once. Always read the labels.
- A tight alpha cut does not mean the drawing is centred: the plan's body is 7 units off the middle of its wings.
- The rear view's gap between body, tank and wings only showed in the comparison's difference picture.
