# Atlas: design direction notes

**Idea in one line:** Gildroot as a scholarly atlas of your family. The page is a map sheet, the fan chart is the plate, and the hook is *where they were born*.

Files: `index.html` (built), `css/atlas.css`, `js/atlas.js`, `fonts/` (self-hosted WOFF2), `favicon.svg`, `screens/`. Charts and the map are computed, not drawn by hand: `build/build.mjs` reads `web/src/samples/victoria.ged` (Wikidata CC0), fetches birthplace coordinates from Wikidata (`build/wikidata.mjs`), projects Natural Earth coastlines with d3-geo and writes the SVG into `index.html`. Rebuild with `cd build && ./setup.sh` (network once), then `node build.mjs`.

## Palette

Grounds and inks. Contrast figures are WCAG ratios.

| Token | Hex | Name | Use |
|---|---|---|---|
| `--paper` | `#F6F8F5` | Survey paper | Page ground. Cool, faintly green white: deliberately not cream. |
| `--paper-hi` | `#FAFBF8` | Land | Map land, panels, chart root, drop zone |
| `--sea` | `#E4ECEC` | Sea tint | Hero, gift band and map ground |
| `--grat` | `#9DB5BD` | Graticule | Hairlines, hatching for unplaced birthplaces |
| `--ink` | `#14232E` | Survey ink | Text. 15.0:1 on paper, 13.4:1 on sea |
| `--ink-2` | `#43535E` | Pencil | Secondary text. 7.5:1 on paper, 6.6:1 on sea |
| `--red` | `#A23122` | Boundary red | The only CTA colour; the dash-dot boundary around the drop zone; the route line. White on it is 7.0:1 |
| `--gold` | `#B8913A` | Gold leaf | Compass rose and ornament only, never text on light |
| `--gold-light` | `#E3C77A` | Gilt on night | Text and lines on midnight. 11.4:1 on midnight |
| `--midnight` | `#0B1024` | Night chart | Privacy band; the Midnight Gilt style |

**Atlas hues: the brand's colour system.** Seven hues plus Stone for "other", in a fixed order assigned by rank (the most common birthplace gets slot 1). Charts use a pale tint of each hue behind the names (28–36% of the hue on Land; ink on the tints is 9–11:1). Dots, arcs and legend chips use the full hue.

| Slot | Hex | Name |
|---|---|---|
| 1 | `#9C7A22` | Gilt |
| 2 | `#2F6DAA` | Lake |
| 3 | `#B5443A` | Madder |
| 4 | `#00897B` | Verdigris |
| 5 | `#C4691C` | Sienna |
| 6 | `#7050A8` | Heather |
| 7 | `#5A8A33` | Moss |
| other | `#85837A` | Stone |
| none | hatch on `#FAFBF8` | Birthplace missing or unclear |

I ran this order through the dataviz palette validator on the sea ground. It passes lightness, chroma, adjacent-pair colour-blind separation (worst ΔE 9.4, deuteranopia) and contrast against the ground (every hue at least 3:1). Slot 1 is gilt on purpose. In most trees one country dominates, so the typical chart comes out mostly gold, which suits the name Gildroot.

The site's other colours come from this set: the logo's quarter fan is Gilt, and the chart-type icons in "how it works" use Gilt, Lake, Madder and Verdigris.

## Type

| Role | Face | Where |
|---|---|---|
| Display | **Cormorant Garamond** 500/600, 500 italic | Headlines, wordmark, chart titles set as wide-tracked capitals ("THE ANCESTORS OF QUEEN VICTORIA"), prices. This is the lettering of an engraved atlas title. |
| Text | **EB Garamond** 400/400 italic/600 | Body copy at 20px desktop and 19px phone, names on every chart, italic "water labels" (North Sea, English Channel) |
| UI and labels | **Fira Sans** 400/500/600 | Buttons, nav, legends, kickers, map place names, the generation ladder. Its x-height is 0.53 em, against 0.40 for EB Garamond and 0.46 for Alegreya Sans, so it stays readable at 15–18px on an iPad. It comes from Spiekermann's wayfinding lineage, so it suits a map. |

**Script coverage** (checked glyph by glyph with opentype.js on the files we ship):
- Fira Sans: Latin Extended, **Greek, Cyrillic** and Vietnamese all pass (Ελένη Παπαδοπούλου, Анна Жукова Ёлкина, Nguyễn Thị Hương, Seán Dvořák Ødegård).
- EB Garamond: Latin, Greek, Cyrillic and Vietnamese all pass.
- Cormorant Garamond: Cyrillic and Vietnamese pass; **Greek is missing**. For Greek titles we fall back to EB Garamond, as BRIEF §4.3 already says.
- I rejected Sofia Sans because it has no Vietnamese, and Inter because the brief asked us to move off it (Nordic keeps Inter inside the charts).
- The WOFF2 files are subset to Latin, Latin Extended, Greek, Cyrillic and Vietnamese plus punctuation. Nine files total about 616 KB, and the page preloads three of them.

## Layout concept: the atlas plate

- **Hero as a map sheet.** The ground is sea tint, framed by a neat line with alternating black-and-white degree bars (the border of a printed map). The fan sits where a map's plate would, with a compass rose in the corner. Behind the fan is a faint real map of Europe in a conic projection, **centred on Kensington, where Victoria was born**, so the chart literally radiates from her birthplace.
- **The chart's empty gap holds real content.** The open bottom of the 270° fan contains a ladder: *Parents 2–3 · Grandparents 4–7 · Great-grandparents 8–15 … 4th great-grandparents 64–127*. Generation names sit on the left and Ahnentafel ranges on the right, joined by dotted leaders like a gazetteer. The root reads "No. 1". Hovering any wedge lights its line back to the centre and shows "No. 37 Magdalena Sibylle of Saxe-Weissenfels · b. 1648 · Halle (Saale), Germany", the way the studio does.
- **The drop zone is a boundary.** It is drawn with the dash-dot line maps use for international borders, in boundary red. That matches the privacy promise: your file stays inside the border.
- **"Where they were born" is a full-width atlas plate**, drawn from real data: 1 dot per birthplace, and 1 arc for each parent-to-child pair (parent's birthplace to child's birthplace) over 8 generations. The arcs converge on London. The legend sits in the Atlantic as on a real map, with a scale bar, lat/long ticks, italic water names and letterspaced country names. On phones the plate scrolls sideways inside its frame and opens on Germany; the page itself never scrolls sideways.
- **The hook is a fact, not an adjective:** "Queen Victoria reigned over Britain for 63 years. Of her 107 ancestors in this chart with a known birthplace, 96 were born in what is now Germany." The build computes it from the file.
- **How it works is a route:** a dashed red route line joins three waypoints. These are real steps, so the numbers are real. Step 3 draws Letter, 11×14, 18×24 and 24×36 to scale, with the maximum fan generations for each (6/6/7/8).
- **Privacy is a night chart:** the midnight band has a gold dash-dot border drawn around "This computer", with your file and your chart inside it and gildroot.com outside ("sends you the page, never receives your tree").
- **Pricing is a ruled gazetteer table,** not three shadowed cards, with gilt diamond bullets.
- Everything is left-aligned. Corners are square, edges are hairlines and there are no drop shadows (the gift card's offset "second sheet" is a flat rule). Focus is a 3px ink outline, gold on the dark bands. There are no emoji and no fake testimonials, and all copy comes from BRIEF §2–§6 in US English.

## Motion

- **Bloom:** the hero fan appears ring by ring. Each generation fades and turns 4° into place, 120 ms apart, and the map, ladder and title then fade in (about 2 s in all).
- **Migration:** when the atlas plate first scrolls into view, the arcs draw themselves, oldest generation first, converging on London (2.4 s per arc, staggered by generation). Arcs are visible by default; the animation only replays them, so no-JS readers and print see the finished map.
- **Tracing:** hovering a wedge dims the chart to 38% and lights that ancestor's line back to No. 1.
- **Drop:** on drag-over, the red boundary thickens and its dashes march. Choosing a file really counts the people on this computer ("Read 298 people from victoria.ged") with no network call.
- With `prefers-reduced-motion`, all of this is off except the static states.

## What makes it distinctive

1. The colour system comes from the product. Atlas colouring by birthplace is a real feature, and its 7 hues become the brand palette, so marketing and output share one language.
2. It is the only direction where the headline visual carries two real datasets at once: the pedigree and the geography. The fan is centred on the real birthplace, and the arcs are real parent-to-child moves.
3. Genealogy vernacular carries structure: Ahnentafel numbers, generation names, "b. 1648", GEDCOM, pedigree collapse ("some ancestors appear more than once").
4. It avoids every cliché on the list. The ground is cool survey paper (not cream), accents are boundary red and gilt (not terracotta or acid green), there are no gradients, and it uses Fira rather than Inter. The layout is asymmetric and left-aligned, with hairlines instead of rounded shadowed cards, and the only numbered markers are the real sequence of 3 steps.
5. The logo mark is a quarter fan (three rings of 1, 2 and 4 wedges) set in the north-east quadrant of a graticule cross with a north arrow: a fan chart on a map. It works at 16px as the favicon (`favicon.svg`).

## Risks

- **Victoria is almost all Germany (104 of 126 places).** That is an honest and surprising hook, but the flagship sample under-shows the multi-hue system. A typical American tree (Ireland, Germany, England, Norway, several US states) will look far more varied. The fictional Almeida–Novak sample (BRIEF §4.3) should be built to show that range.
- **Colour-blind safety only holds for neighbours in order.** A fan behaves like a map, where any two hues can touch, and no 7-hue palette passes every pair. So Atlas must always ship its legend with counts, white gaps between wedges and hatching for "unplaced", plus the hover label. I would also add texture to slots 5–7 in print.
- **Data quality shows.** Wikidata records "Waldenburg, Switzerland" for one count and a region called "Bavarian" (claimed by Austria and Germany) for another. I left the Bavarian birth unplaced rather than guess. A fact-checker should review the sample before launch, as `CLAUDE.md` requires.
- **Small text on phones.** The hero fan's outer rings are texture, not reading, at 390px. The map scrolls sideways on phones, which is a small extra gesture for older users. iPads (820px and up) show names clearly.
- **Pale grounds and printing.** The sea tint and gilt tints sit close together in lightness. On uncalibrated screens or when printed, the Cartographer style could look washed out. We should check it against the "Printed paper" simulation.
- **CTA count.** The header's "Open the studio" is a third button next to "Choose a file" and "No file? Build it in 3 minutes". It goes to the same place as the drop zone, but a strict reading of voice rule 10 would demote it to a text link.
- **Build weight.** The page is 356 KB of HTML because the charts and map are inline SVG with real names and coastlines. That is fine for a mockup; in production the hero should be the live canvas from BRIEF §4.1, and the map a cached SVG file.
- **US spelling vs the brief.** The brief's sample line says "we'll colour them". I followed its own rule 8 (US English) and changed it to "color" everywhere a visitor reads it. The brief's copy should be aligned the same way.
