# Broadside: a design direction for Gildroot

The homepage is a single printed sheet, set in two inks. Black does the work and vermilion marks what matters. The product's own output, a real fan chart of Queen Victoria's ancestors, is proofed on the page like a printer's specimen, with crop marks and registration targets around it.

- **Page:** `index.html`, built from `src/index.html` by `python3 design/directions/broadside/tools/build.py`
- **Assets:** `css/broadside.css`, `js/broadside.js`, `fonts/` (11 self-hosted WOFF2 files), `images/favicon.svg`
- **Screenshots:** `screens/broadside-desktop.png` (1440 wide) and `screens/broadside-mobile.png` (390 wide)
- **Preview:** `python3 -m http.server 4303 -d design/directions/broadside`

## Palette

Two inks on bright white. Nothing else appears on the page except inside the six style proofs, which are product output.

| Name | Hex | Use | Contrast |
|---|---|---|---|
| Bright white (stock) | `#FFFFFF` | Page ground. It is deliberately not cream. | – |
| Press black | `#141210` | Text, rules, the black privacy plate | 18.7:1 on white |
| Grey ink | `#4A4642` | Secondary text and captions | 9.4:1 |
| **Vermilion** (second ink) | `#D8341C` | The only CTA colour. Also used for rubrication (Ahnentafel numbers, italic emphasis, prices, step numerals) and the gift plate. | 4.7:1 on white; white on vermilion 4.7:1 |
| Vermilion pressed | `#A8260F` | Hover and pressed states, small red caps labels | 7.1:1 |
| Proof pink | `#FCE4DD` | Lineage trace on hover, drag-over state | Ink on it 15.4:1 |
| Blind rule | `#D8D4CE` | Quiet hairlines only, never text | – |
| Vermilion on black | `#FF5A36` / `#FF7A5C` | The red ink on the black plate (headline, labels) | 6.0:1 / 7.3:1 on black |

Rules come in three weights: an 8px "heavy" rule for running heads and the footer, a 3px rule for boxes and tables, and a 1px hairline. The masthead carries a thick-and-thin Oxford rule.

Focus is a 3px outline in press black, offset 4px. It is white on the black plate, and it stays black on the vermilion plate (3.9:1, above the 3:1 needed for non-text contrast).

## Type pairing

| Role | Face | Cut | Why |
|---|---|---|---|
| Display | **Noto Serif Display** | ExtraCondensed Black (wdth 62.5, wght 900) and Bold 700; SemiCondensed Black Italic (wdth 75) for words set in the second ink | A condensed fat-face Didone that reads like 19th-century wood type on a broadside. At 140px it is loud and very legible. It is used only at 26px and above, so its hairlines never break up. |
| Text | **Source Serif 4** | opsz 20, 400 / 400 italic / 600 | A sturdy transitional serif in the Fournier tradition. Body is 19px on phones and 20px on desktop. Its x-height (0.475) is larger than EB Garamond's (0.40), which matters for readers aged 70 on an iPad. |
| UI | **Source Sans 3** | 400 / 600 / 700 | Built on the lessons of Franklin Gothic and News Gothic, the American gothic that shared broadsides with fat faces. Labels, buttons, captions, nav. |
| Chart names | **EB Garamond** | 400 / 600 | The product's chart face, used inside the specimens only, so the page shows what the product really prints. |

**Coverage.** Each file was subset with pyftsubset to Latin, Latin Extended A/B/Additional (which includes Vietnamese), Greek and Cyrillic, with OpenType layout features kept. I checked the UI face's cmap after subsetting. **Source Sans 3 covers all 56 basic Greek letters (U+0391–03C9, excluding the unassigned U+03A2) and all 64 basic Cyrillic letters (U+0410–044F), plus Vietnamese** (ễ, ư, ơ). Every other face on the page passes the same check. So names such as Ελένη, Анна, Nguyễn, Dvořák and Ødegård set correctly in the UI, the text and the display type. The FAQ shows them.

All four families are under the OFL. They are static instances cut from the variable fonts through the Google Fonts CSS2 API (for example `Noto+Serif+Display:wdth,wght@62.5,900`) and are self-hosted. The page makes no font requests to any other host. The 11 files come to about 700 KB.

Inter is not used. Source Sans 3 has the same coverage and a better story for this direction.

## Layout concept

The page is laid out as a broadside, not as a set of cards.

- **12-column asymmetric grid.** The hero headline runs across the full measure. Below it the copy takes columns 1 to 5 and the specimen takes 6 to 12. Section heads sit on the left and their content on the right, or the other way round. Only the chart-type pictograms are centred.
- **Running heads instead of eyebrows.** Each section opens with an 8px rule, a red section name on the left and a factual note on the right, for example "6 styles × 3 charts × 3 colour modes", "About a minute from file to chart", "One-time prices, US dollars".
- **Two solid plates.** The privacy section is a black plate ("*Nothing* is uploaded.") and the gift headline sits on a vermilion plate, with the gift card overlapping its edge. Every other section is white stock.
- **No card chrome.** There are no rounded corners and no soft shadows. The only "shadows" are solid offset blocks (a red one under the GEDCOM galley, a black one under the gift card), which read as a second printing.
- **Pricing as a tariff.** It is a price list with dotted leaders and large red numerals, not three pricing cards. It keeps its leaders at 390px wide.
- **Sign-off.** The page ends with "Your roots, *gilded.*" at up to 300px.

### Genealogy vernacular as structure

- **The specimen is real data.** `tools/build.py` parses `web/src/samples/victoria.ged` (Wikidata, CC0), computes the Ahnentafel numbers and lays out a 270° fan: 7 generations, names on the arc for rings 2 to 4 and radial beyond that. Names are fitted with the product's abbreviation ladder against real EB Garamond advance widths, and the font steps down to 78% before a name is shortened. Nothing is invented.
- **Ahnentafel numbers are printed in red** at each wedge. The generation scale runs down one open edge in Roman numerals (II–VII) and the ancestor count per ring (2, 4, 8 … 64) runs down the other.
- **Pedigree collapse** is marked with red dots showing how many times the person appears. Ernest I, Duke of Saxe-Gotha, appears 3 times.
- A **"How to read a fan chart"** key sits beside the specimen. It explains the numbering rule: a father is double his child's number, and a mother is double plus one.
- **Point at any name** on the specimen and its line back to Victoria lights up (n, n/2, … 1).
- The privacy plate shows a **GEDCOM galley**: Victoria's real record (`2 DATE 24 MAY 1819`) and her parents' family.
- "How it works" gives the **real export click paths** for Ancestry and MyHeritage. It also has **poster sizes drawn to scale**, Letter to 24×36, each holding a fan at its real maximum depth (6, 6, 7, 7 and 8 generations).
- The **style strip** renders the same five-generation family in all six styles. Each style is drawn from its own tokens: Ivory with its double rule, Midnight Gilt, Botanical with grandparent-line tints and a laurel, Letterpress, Nordic set in the sans, and Cartographer with a graticule and compass rose.

### Logo: "the sort"

The mark is a square black block, like a piece of type, with a quarter fan cut out of it. The vermilion quarter disc is person 1, the root. Around it sit 2 parents, then 4 grandparents. It holds up at 16px as the favicon (`images/favicon.svg`). The wordmark is "Gildroot" in the display Black.

I tried the brief's bare quarter fan of three arcs first. It read as a **wifi icon**, which is a bad accident for a brand whose privacy line is "Try it with wifi off". The solid block fixes that and looks like it came off the press.

## Motion

Motion is limited to one printing metaphor and a few quiet hover states. Every animation is switched off under `prefers-reduced-motion`.

1. **Ink pass (page load).** The specimen's rings print from the centre outward, fading in 150ms apart.
2. **Registration (page load).** The second-ink plate (Ahnentafel numbers, root disc, collapse dots, generation scale, title rule) then drops into register: it slides from a 5px, −4px offset to 0 over 800ms. The drop zone's red top bar does the same. The red elements sit in a separate SVG group for exactly this reason, the way a real second plate would.
3. **Lineage trace (hover).** The wedges from the pointed-at ancestor back to the root fill with proof pink, their names turn red, and the rest of the chart dims.
4. **Proof cards (hover)** lift 6px and tilt −0.6°. **Link arrows** nudge 4px.
5. **Drop zone.** When a file is dragged over the page, the zone turns proof pink and says "let go". On drop, `FileReader` counts the records locally and reports, for example, "Read 4,212 people and 1,530 families from smith.ged on this computer. Nothing was uploaded." That is a small, true demonstration of the privacy claim.

There is no parallax, no scroll-jacking and no autoplay.

## What makes it distinctive

- **It prints; it doesn't glow.** It uses bright white, black and one hot red. It has no gradients, no cream and no gold on the page. The brand name says "gild" and the page answers by rubricating, the way family Bibles and early title pages printed red and black.
- **The type is the loudest thing on the page.** A condensed Black Didone at 140px is set flush left and deliberately oversized. It does not look like a template.
- **The product is proofed, not mocked up.** It is a real 127-slot chart with printer's marks, a slug line and a colour bar, and it can be read and hovered.
- **The genealogy is the ornament.** Ahnentafel numbers, Roman generation numerals, pedigree-collapse counts, GEDCOM lines and generations-per-size replace the usual icons, emoji and badges.
- **The copy is honest and exact.** The page carries no testimonials, logos, counters, badges or "most popular" flags. Every number on it comes from the brief or from the data.

## Risks

1. **Vermilion near the terracotta cliché.** On cream it would slide straight into the warm-cream, serif and terracotta default look. It only works on true white and at full saturation. Never warm the ground, and never brown the red.
2. **A Didone can read as a fashion magazine.** The condensed Black keeps it on the poster side, and the genealogy content grounds it. Keep it at 26px and above, and never set body copy in it.
3. **Red can mean "error".** Here red is the brand ink and the CTA colour. Error states need their own pattern (a black ruled box with a plain sentence), never red text alone.
4. **Two plates is the limit.** One black plate and one red plate per page. A third makes the page shout.
5. **The Letterpress chart style.** The brief specifies a cream ground. I propose bright white instead, because Ivory is already bone and the two proofs looked alike side by side. This needs a product decision.
6. **Weight.** The inline SVG specimen and proofs bring the page to about 210 KB of HTML, and the fonts to about 700 KB. For production: render the hero with the product's canvas renderer (the brief wants it live anyway), and split the fonts by `unicode-range` so Greek, Cyrillic and Vietnamese load only when used.
7. **Hover is desktop-only.** Touch users get the static "How to read a fan chart" key instead. The 127 wedges are deliberately not keyboard-focusable, because that would add 127 tab stops before the drop zone.
8. **The GEDCOM galley uses the system monospace** (ui-monospace, Menlo, Consolas or DejaVu), so it differs slightly by platform.
9. **The gift card is an example.** It uses example names taken from the brief: "For Mom, Christmas 2026", Anna, and "The ancestors of Margaret Rose Kowalski". It is captioned as the printable card, not as a customer's.
10. **At 390px the outer rings of the specimen are texture, not readable text.** That is honest, since a phone is not the poster. The inner rings, the title and the key stay legible.
