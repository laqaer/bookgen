# Direction: The Registry

The page is laid out like a ledger in an archive reading room. A red double margin rule runs down the whole page, and each section's margin holds a catalogue field with a real count. Charts sit on midnight plates, index cards hold the labels, and a typewriter face sets the data. The six styles are presented like specimens in a drawer. Every chart on the page is computed from `web/src/samples/victoria.ged` (Wikidata, CC0). None of them are drawn by hand.

## Palette

| Token | Name | Hex | Use | Contrast |
|---|---|---|---|---|
| `--paper` | Reading-room paper | `#EAE9E1` | Page ground. Cooler and greyer than the brief's bone, which avoids the warm-cream default. | |
| `--paper-2` | Drawer grey | `#E0DFD5` | Specimen trays, footer | |
| `--card` | Index-card stock | `#F8F7F2` | Drop zone, plate label, cards | |
| `--ink` | Iron-gall ink | `#141B26` | Text, rules | 14.2:1 on paper |
| `--ink-2` | Faded ink | `#434C5A` | Secondary text | 7.1:1 on paper |
| `--rule` / `--rule-2` | Ledger blue | `#B4C4CE` / `#8FA6B4` | Ruled lines and hairlines. Never used for text. | |
| `--red` | Accession red | `#A3281A` (hover `#7F1D11`) | The only accent: margin rule, field labels, the one filled CTA | 6.0:1 on paper; white on red 7.3:1 |
| `--midnight` | Plate midnight | `#0B1024` / `#131A36` | Hero plate, privacy band, GEDCOM card | |
| `--gilt` | Gilt | `#C9A45C` | Rules and keylines on midnight only | |
| `--gilt-text` | Gilt type | `#DDBE78` | Type on midnight | 10.5:1 on midnight |
| `--mist` | Moonlit blue-grey | `#9AA7CB` | Secondary type on midnight | 7.9:1 on midnight |

Changes from the brief's draft tokens:
- **Bone becomes a cooler paper.** Bone read too close to the cream cliché.
- **Oxblood becomes accession red.** It is brighter, so the CTA stands out, and it still gives AAA contrast with white.
- **Sage is dropped.** One accent is enough.
- **Gold still never appears on a light ground.**

Red is never placed on midnight.

## Type

| Role | Face | Coverage (checked in the cmap of the shipped files) |
|---|---|---|
| Display: h1, h2, prices, big numerals | **Old Standard TT** 400 and italic. A Scotch modern, the face of 19th-century catalogues and registers. | Latin Ext and Cyrillic. **No Greek.** Use only for fixed site copy, never for user names. |
| Text and **UI face**: body, buttons, nav, forms | **Brygada 1918** 400, italic and 600. A revival of a 1918 Polish book face; sturdy at 18–20px. | Latin Ext, **Greek (monotonic)**, **Cyrillic**, Vietnamese. No polytonic Greek (U+1F00 is missing). The subset woff2 keeps U+0370–03FF and U+0400–052F. |
| Data: labels, accession fields, dates, GEDCOM | **Courier Prime** 400 and 700. A typewriter face, like the typed catalogue card. | Latin only. Never use it for names. If a label must hold a Cyrillic name, fall back to IBM Plex Mono. |
| Charts (product rules) | EB Garamond for names, Cormorant Garamond 600 for the inner rings, Inter for the Nordic style | EB Garamond covers Latin, Greek, Cyrillic and Vietnamese. **Cormorant Garamond has no Greek** (verified), so the brief's fallback to EB Garamond is required. |

- **Sizes:** body 19px on desktop and 18px on phones; lead text 20px; buttons 19px/600 with a 52px minimum height; mono labels 14–16px.
- **Balancing:** headings use `text-wrap: balance`.
- **Hosting:** all fonts are OFL and self-hosted as subset woff2 in `fonts/`, about 530 KB in total.

## Layout concept

- **Ledger margin.** On desktop the grid is a 150px margin column, a 56px gutter with the red double rule in it, then the main column. In each section the margin holds a field name and a count that are true:
  - Styles 6
  - Method 3 steps
  - Uploaded 0 bytes of your file
  - Gifts 3 ways to give
  - Prices 3 paid once
  - Questions 4 asked first

  The only numerals are real sequences: step 1–3, "Style n of 6" and wifi-off steps 1–3.
- **Frontispiece.** On the left: headline, lead, the drop zone as an index card (red head rule, blue ruled lines), "No file? Build it in 3 minutes" and "Try a sample family". On the right, a midnight plate with a gilt keyline bleeds to the edge of the viewport. It holds:
  - The 7-generation, 270° Victoria fan in Midnight Gilt.
  - A generation scale (I–VII) along the open edge of the fan.
  - An index-card label: Plate I, `victoria.ged`, Ahnentafel entries No. 1–3, and the computed facts "7 generations · 117 people · 8 of them appear more than once" (pedigree collapse).
- **Specimen drawer.** The six styles sit in trays with typed labels. Each specimen is a real chart from the same file, and together they cover all three engines:
  - Ivory: fan, 180°
  - Midnight Gilt: fan, 270°
  - Botanical: two families (bowtie of Edward and Victoria of Saxe-Coburg, 4 generations a side)
  - Letterpress: pedigree
  - Nordic: fan, 360°
  - Cartographer: 270° with Atlas colours by birthplace
- **How it works.** The rows are ruled like a ledger.
  - Step 1 shows the actual GEDCOM record (`0 @I1@ INDI … 2 DATE 24 MAY 1819`) becoming the register entry "No. 1 Victoria b. 24 May 1819".
  - Step 2 has line glyphs for the three chart types.
  - Step 3 draws paper sizes to one scale, each marked with the number of generations it holds (6, 6, 7, 8, from brief §4.4).
- **Privacy.** A midnight band with the brief's line as its h2, the three wifi-off steps, and a log of what happens when you drop a file. The log uses the real counts of the sample file (298 people, 152 families) and shows "Sent to Gildroot: Nothing".
- **Gifts.** The three gift paths from brief §6, plus a mock of the 5×7 folded card with a small fan, a dedication, a message and a redeem block.
- **Pricing.** A ledger table built with CSS subgrid: row labels in mono, then $29 / $59 / $79 with the brief's scope, households, devices and re-export terms. It is followed by the free tier, the refund policy and a link. On phones it becomes three stacked index cards with visible field names.
- **FAQ.** Four `<details>` elements: where to find the GEDCOM file, whether anything is uploaded, sizes and generations, and scripts (states the CJK, Hebrew and Arabic limit before payment).
- **Footer.** The mark, "Your roots, gilded.", the descriptor, links, and the line "Gildroot is independent and not affiliated with Ancestry.com."
- **Phone (390px).**
  - The margin rule moves to 7px and the field labels sit inline above each h2.
  - The plate goes full width under the headline, followed by the drop card.
  - The styles become a scroll-snap strip, which is keyboard-focusable only while it scrolls.
  - There is no horizontal overflow; the harness confirms this.
- **Logo mark.** A real three-generation quarter fan: the root wedge is filled red, then 2 parents, then 4 grandparents (Ahnentafel 1 / 2–3 / 4–7). It is drawn as inline SVG and reused in `favicon.svg`.

## Motion

- **Bloom.** The hero fan's rings grow from the medallion outward. Each ring takes 0.9s, the start times are 170ms apart, and the chart title lands last at about 2.2s. The generation scale fades in after it.
- **Trace (pointer devices).** Hovering any wedge lights its line back to No. 1. The plate label then shows the entry in register form, for example "No. 45 Sophie Henriette of Waldeck-Eisenberg / 1662–1702 · Gen. VI · father's side / 45 → 22 → 11 → 5 → 2 → 1". The brief's "hovering a person lights their line back to the centre" is taught right on the homepage.
- **Drop zone.** While a file is dragged over the hero, the dashed border turns solid red, the card lifts 2px and the title reads "Drop your family tree file here: release it". The status line then names the file.
- **Style trays.** The poster zooms 3.5% on hover.
- **Reduced motion.** `prefers-reduced-motion` turns off all animation and transitions.
- **Focus.** Every interactive element has a 3px Accession-red focus ring with a 3px offset, which turns gilt on midnight. The page also has a skip link.

## What makes it distinctive

- **Genealogy vernacular is the interface, not decoration:**
  - Ahnentafel numbers in the label and in the trace
  - generation numerals on the plate
  - "b. 1819"
  - a real GEDCOM record
  - pedigree collapse stated as a fact
  - `victoria.ged` named as the source

  A Keeper recognises their own hobby in it, and a gift buyer still gets plain sentences.
- **Every number is true and computed:**
  - 117 people
  - 8 repeats
  - 298 people and 152 families
  - the generations each paper size holds
  - the Atlas percentages

  There are no testimonials, logos, badges or invented stats.
- **The charts are generated, not screenshots.** `tools/chart.py` measures names with the real font metrics and fits them with an abbreviation ladder. This page is also a working prototype of the fan, bowtie and pedigree engines in SVG.
- **One accent colour, used as a ruling system** (margin rule, field labels, the CTA), not sprinkled across the page. The gold stays inside the midnight plates, where it reads as gilding.
- **What it avoids from the cliché list:**
  - not cream plus terracotta
  - no gradient hero
  - Inter only inside the Nordic specimen
  - no emoji
  - left-aligned, asymmetric grid
  - square 2px corners
  - soft shadows only on the gift card and the phone menu

## Risks

- **Mono sizes.** Mono labels are 14–15px, which is small for readers over 70. Every essential fact also appears in body text at 18px or larger. If testing shows strain, raise the mono labels to 16px.
- **Old Standard TT hairlines** get thin below about 26px on low-DPI screens, so the face is limited to 26px and above. It has no Greek, so it must never set user content.
- **Font budget.** The page uses five families (three for the site, EB Garamond, Cormorant Garamond and Inter for the charts). The fonts total about 530 KB and `index.html` is 186 KB with the SVG charts inlined. Production should subset per page and lazy-load the specimen SVGs.
- **The ledger look can tip into "school notebook"** if the ruled paper spreads. Keep the ruled ground to the two ledger sections (method and pricing) and the index cards.
- **The generation scale and the trace are website annotations.** They are not part of the printed product, so the build team must not ship them into exports.
- **Hover trace is pointer-only.** Keyboard and touch users get the static register. The studio should add a keyboard path, such as arrowing between people.
- **Name ladder.** The ladder in `tools/chart.py` is tuned for royal styles ("Edward, Duke of Kent"). Real user names follow the brief's ladder in §4.3.
- **Wikidata quirk.** Georg August zu Erbach-Schönberg is recorded as born in "Waldenburg, Switzerland"; Waldenburg in Germany is more likely. The Cartographer specimen therefore shows "Switzerland 3%". Fix it in the sample or add a note.
- **Placeholders.** The QR code on the gift card is a drawn pattern. Links point to the planned URLs from brief §7 (`/make/`, `/gift/`, `/export/`, `/pricing/`, `/privacy/`, `/help/`, `/print/`), which do not exist in this mockup.
- **No dark mode.** Only the light theme is designed; the midnight bands suggest how a dark theme could look. Accession red must not be used on a dark ground.
- **Below the fold.** At 1440×900 the plate's index-card label starts just below the fold. The fan, the headline and all three hero actions are above it.

## Files

- `index.html`, `styles.css` and `favicon.svg`: the mockup.
- `fonts/*.woff2`: subset, self-hosted fonts.
- `charts/*.svg`: generated charts, also inlined into `index.html` between `<!--chart:name-->` markers.
- `tools/chart.py` and `tools/ged.py`: regenerate everything with `python3 tools/chart.py`.
- `img/registry-desktop.png` and `img/registry-mobile.png`: final screenshots, full page at 1440 and 390 wide.
- To view it: `python3 -m http.server 4302 -d design/directions/registry`.
