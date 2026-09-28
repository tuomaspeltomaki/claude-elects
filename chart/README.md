# chart

Turns the ledger in `../data` into finished social-media graphics.

    cd chart
    npm install          # once
    npm run chart        # renders every preset, every size, into out/

    node render.mjs --chart trend-fi            # one preset, all its sizes
    node render.mjs --chart trend-fi --size x   # one preset, one size
    node render.mjs --chart trend-fi --html     # HTML instead of PNG, for debugging

## How it fits together

    data/*.csv  ->  lib/data.mjs  ->  charts/trend.mjs  ->  render.mjs  ->  out/*.png
                    (parse)           (build the page)      (screenshot)

`charts/trend.mjs` returns a complete HTML page. The headline, subhead and
source line are real HTML; only the plot itself is SVG. That split is the point
— it is what lets the type wrap properly, mix weights, and carry a party name
coloured inline mid-sentence, none of which SVG text does well.

`render.mjs` opens that page in headless Chromium and screenshots it at exact
pixel dimensions, 2x for retina. Fonts are inlined as base64, so a page renders
identically offline and will still render years from now.

## Editing a post

`presets.mjs` is the file to touch. A new post is a new entry: headline,
subhead, which parties carry colour, which sizes to render. Everything else is
handled for you — scales, label placement, collision avoidance, typography.

Sizes live in `lib/theme.mjs` (`ig`, `igsq`, `x`, `story`). Add a row there and
it is immediately renderable.

## Two things worth knowing

**The line is smoothed, the dots are not.** Taloustutkimus and Verian alternate
and each has a house effect. Joining their raw readings into one line produces
a sawtooth that looks like support lurching every fortnight — it isn't, it's
the gap between two houses. So each poll is drawn as its own faint dot and the
line through them is a weighted five-poll moving average. The dots keep the
chart honest about spread; the line carries the trend. The footnote says so on
every chart, and it should stay there.

**Party colours are tuned for screen.** `data/parties.csv` holds each party's
official colour; `lib/theme.mjs` holds a chart variant with the same hue but
usable lightness. PS `#FFDB00` has a contrast ratio of 1.33:1 against white —
as a line it is effectively invisible. The variants fix that without changing
which party reads as which.

Finnish party colours also collide by nature: two blues (KOK/KD), two greens
(KESK/VIHR), two yellows (PS/RKP), two reds (SDP/VAS). No palette fixes this
while keeping party identity, so the chart never runs more than about three
parties at full colour, mutes the rest, and direct-labels every visible line.
Identity never rests on colour alone.

## Predictions

`charts/trend.mjs` already draws the prediction overlay: a dashed continuation
from the last poll to the predicted value, with a hollow endpoint. It draws
nothing while `data/predictions.csv` is still a header row, and will appear on
its own once the ledger has entries.
