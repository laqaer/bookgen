# Gilt Night: design direction notes

The site is a jewel box. A midnight ground, gold used only where real gold leaf would go (hairlines, ornaments, the mark, gold text on dark), and warm vellum text that is large enough for a 70-year-old on an iPad. The product's own output is the hero. It is not a picture of a chart: it is a live 7-generation fan of Queen Victoria's ancestors, typeset in the browser from `data/victoria.ged`, and it blooms ring by ring when the page loads.

Run it with `python3 -m http.server 4301 -d design/directions/gilt-night` and open http://localhost:4301/. It has no build step and makes no network calls. Fonts are self-hosted.

## Palette

All ratios are WCAG contrast against Midnight `#0B1024` unless noted.

| Name | Hex | Use | Contrast |
|---|---|---|---|
| Midnight | `#0B1024` | Page ground (the brief's token, kept) | n/a |
| Vault | `#070B19` | Footer, deepest ground | n/a |
| Lapis | `#111936` | Raised plates (how-it-works art) | Vellum on it: 14.3:1 |
| Gallery wall | `#121A38` | The style-strip wall | Mist on it: 8.2:1 |
| Vellum | `#F1E9D8` | Body text and headings (warm, never pure white) | 15.6:1 |
| Vellum shade | `#CFC6B3` | Secondary text | 11.1:1 |
| Moonlit mist | `#A9B3D6` | Dates, metadata, captions (the pale blue of the reference print) | 9.1:1 |
| Leaf | `#E6C98A` | Gold text on dark, primary button fill | 11.7:1 (Ink on Leaf: 11.5:1) |
| Gilt | `#C9A45C` | Hairlines, ornaments, diamonds, focus corners | 8.0:1 |
| Old gold | `#8E6F33` | Shadow side of gold, frame gradients | n/a |
| Velvet lining | `#2B0C12` → `#4C1520` | Gift section ground, the box's lining | Vellum on it: 14.9:1 |
| Oxblood | `#6E1F1B` | Ink on the paper gift card | n/a |
| Sage (for dark) | `#A7B994` | Privacy checks and "nothing uploaded" signals | 9.0:1 |
| Ink | `#16140F` | Text on gold | n/a |
| Focus | `#F6E2A8` | 3px focus outline, 3px offset, on every control | n/a |

**Changed from the brief's draft tokens.** Oxblood is no longer the CTA color. Oxblood on midnight reads as mud at 1.7:1, so the one filled button is Leaf gold with Ink text. Oxblood moves to the gift section as a velvet lining and to ink on paper. Brand sage `#6B7A5A` is only 4.1:1 on midnight (under AA for small text), so it is lightened to `#A7B994` for dark grounds. Gold is used as text only on dark grounds, which follows the brief's rule.

The six chart styles keep their own tokens (in `js/home.js`): Ivory (bone `#F3EDE2`, sepia `#6B4E2E`/`#3A2A1A`), Midnight Gilt (`#0B1024`, gold `#E8CB8A`, hairline `#C9A45C`), Botanical (`#FBF8F1`, olive `#6F7A45`, ochre `#9A6D35`, rose tints), Letterpress (cream `#F4EEDC`, black `#1B1A17`, vermilion `#C8402A`), Nordic (white, charcoal `#2A2F35`, blue-grey `#DDE5EC`), and Cartographer (map blue `#E3EBEE`, slate `#3F5663`, and an 8-color Atlas set).

## Type

| Role | Face | Where | Size |
|---|---|---|---|
| Display | Cormorant Garamond 500, 500 italic, 600 | H1 (46–78px), H2 (36–56px), prices, card script | Tight leading, 1.02–1.1 |
| Text | EB Garamond 400, 400 italic, 600 | Body 20px/1.6 (19px on phones), chart names in outer rings | Its small x-height makes 20px read like 17–18px in most faces |
| Titling | Cormorant SC 600 | Eyebrows, ledger labels, chart titles; real small caps, tracked 0.08–0.14em | Never below 17px |
| UI | Alegreya Sans 400, 500, 700 | Buttons, nav, metadata, captions | 16–19px, lining figures forced |
| Chart only | Inter 400/600 | The Nordic style (as specified in the brief) | n/a |

**Why Alegreya Sans instead of Inter.** Alegreya Sans is a humanist sans with calligraphic roots, so it sits next to the Garamonds without the cold "startup UI" feel. It keeps clear shapes at button sizes. It avoids the "Inter as the safe face" default. Inter stays only inside the Nordic chart style.

**Script coverage (checked in the shipped WOFF2 files with fontTools):**
- Alegreya Sans (UI): Latin, Latin Extended, Vietnamese, **Greek (all 56 basic letters, U+0391–03C9)** and **Cyrillic (all 64, U+0410–044F)**.
- EB Garamond: Latin Extended, Vietnamese, Greek (56) and Cyrillic (64).
- Cormorant Garamond and Cormorant SC: Latin Extended, Vietnamese and Cyrillic, but **no Greek**. Every Cormorant stack falls back to EB Garamond, in both CSS and SVG, so Greek names still set in a matching serif. This was tested by dropping a file that contains Παπαδόπουλος, Екатерина Иванова and Dvořáková.
- All fonts are static instances, subset to Latin, Latin Extended, Greek, Cyrillic and Vietnamese, and served as WOFF2 from `fonts/` (14 files, about 700 KB in total; 13 of them are used on this page). EB Garamond and Cormorant Garamond were converted from the repo's own static TTFs. Alegreya Sans, Cormorant SC and Inter were downloaded as static TTFs from Google Fonts. All are OFL.

Cormorant Garamond and Alegreya Sans default to old-style figures. The CSS forces lining figures for prices, sizes and UI, and leaves old-style figures in dates inside the charts, as craft rule 4.7 requires.

## Layout concept: the museum after hours

- **Hero.** The grid is asymmetric, 5/7. Copy sits on the left: the tagline "Your roots, gilded." as a gold italic eyebrow, then the plain H1 "The beautiful way to print your family tree." Under the H1 is the drop zone, drawn as a chart title cartouche (double hairline with diamond corners), and under that the two secondary actions and the privacy line. The live fan sits on the right. Its own title, "The Ancestors of Queen Victoria", is set in the empty wedge below the medallion, just as it prints. Beneath the fan is a **register**, a museum label that updates as you point at a name. It shows the Ahnentafel number, full name, "b. 24 May 1819, Kensington Palace", the relationship ("Victoria's paternal grandmother") and the line of descent ("1 → 2 → 5"). The whole hero is a working drop zone: drop a `.ged` or choose one and your own ancestors bloom in place, read locally.
- **Section heads** use a margin column, the way a genealogical register does. On the left sits a small-caps eyebrow and an italic marginal note that states a fact ("All six drawn from the same file: victoria.ged, 298 people", "About 3 seconds for a tree of 5,000 people"). The H2 sits on the right. Each head starts with a gilt double hairline and a small diamond, the brief's "hairline double rule" motif.
- **Style strip as a gallery wall.** Six real prints hang in CSS frames (walnut, gilt, oak, black, ash) with mats. Each rests on a picture ledge under a small brass picture light. All six are rendered live from the same GEDCOM and between them cover all three chart engines: Ivory fan, Midnight Gilt "Two families" (Edward & Victoria, m. 1818), Botanical half-fan over a laurel, Letterpress pedigree, Nordic full circle, and Cartographer with birthplace colors, legend and compass rose. The labels read like museum cards: style name, one plain line, then "Fan · 6 generations · 18×24".
- **How it works** is a real sequence, so it is numbered. The three medallion numerals sit on one hairline, like a pedigree connector. Each step has proof rather than an icon: the real first lines of `victoria.ged`, the chart and style chooser, and print sizes drawn to scale with the most generations each one holds (Letter 6, 11×14 6, 16×20 7, 18×24 7, 24×36 8).
- **Privacy** gets the largest type after the H1: "Your file is read on this computer. Nothing is uploaded." Next to it is a ledger with sage checks (file, names, finished chart, what we count, account) and a three-step "Try it with wifi off" test.
- **Gift** is the one warm room: the box's velvet lining in oxblood. It lists three gift paths and shows a printed 5×7 card, a fictional Kowalski family fan in Ivory next to its handwritten inside, "For Mom".
- **Pricing** is a price list, not cards. It has three columns ruled by hairlines, prices in display figures with "one time", and the middle tier flagged by a small-caps label on a double rule. The free tier and the 30-day refund are stated in plain words.
- **FAQ** has four real questions in `<details>`: how to export from Ancestry, whether anything is uploaded, gaps in the tree, and accents, Greek and Cyrillic (with the CJK, Hebrew and Arabic limit stated before payment).
- **Footer** holds the mark and wordmark, the tagline, the descriptor, three link columns, "Gildroot is independent and not affiliated with Ancestry.com.", the Wikidata CC0 credit and a printer's colophon.

**Logo.** The mark is a half-fan: a gold half-disc medallion (the root) with two rings of segments, 2 then 4, which is the Ahnentafel doubling. It stands on a hairline ground. Filled segments and radial gaps keep it from reading as a wifi symbol, which matters on a site that says "try it with wifi off". The rings step in tone from pale leaf to old gold. The wordmark is Cormorant Garamond 600 with slight tracking. The favicon is `images/mark.svg`.

**Responsive.** At 900px and below the hero becomes one column in this order: headline, lead, fan, drop zone, secondary actions, privacy line. On phones the register appears only after a name is tapped, so the drop zone sits right under the fan. The gallery goes to two columns per ledge and the steps, pricing and FAQ stack. At 390px there is no horizontal overflow (checked by the harness). Buttons are at least 56px tall and go full width on phones. Touch devices see "Start with your family tree file" instead of "Drop…".

## Motion

- **Bloom.** On load the medallion rises from 70% scale. Each ring then fades in from 90% scale and -7°, one ring every 180ms, with a cubic-bezier(.16,.84,.3,1) ease over 1.15s, so the fan seems to unfold outward from the root. The fading echo arcs follow, and the chart title fades in last at 1.5s. The whole sequence takes about 2.6s. The same bloom runs when your own file is dropped. Transforms use `transform-box: view-box` around the fan's center. The glow is a CSS gradient, not an SVG filter, so each frame stays cheap on an older iPad.
- **Trace the line.** Hovering, tapping or using the arrow keys on the focused chart lights the ancestor's wedge in old gold and every wedge between them and the root in a quieter tone. The register announces it through `aria-live`.
- Other motion is kept small: 0.2s color transitions and a 3px arrow nudge on text links. There is no scroll-triggered animation, no parallax and no looping shimmer. `prefers-reduced-motion` shows the finished chart at once.

## What makes it distinctive

1. **The real product is the hero.** It is typeset live from a real GEDCOM, follows the brief's abbreviation ladder and ring rules, is interactive, and swaps to your own family when you drop a file. It is not a stock image.
2. **Genealogy vernacular is the structure.** It shows Ahnentafel numbers and lines of descent in the register, GEDCOM lines as the step 1 visual, "b. 1819", generations per print size, a marginal-notes register layout, pedigree-connector step numbering, and a colophon.
3. **The gallery wall.** Six styles hang as framed prints on a ledge, lit like a museum after closing. The page itself shows what "good enough to frame" looks like.
4. **Dark without the dark-mode clichés.** The ground is blue-black with warm vellum text, so there is no pure black and no acid accent. The gold is leaf-toned and rationed, and the oxblood velvet room gives the page one warm pause. Nothing is centered except the chart titles, which are centered because charts are.
5. **Plain, numeric copy.** For example: "Up to 8 generations, as large as 24×36 inches", "about 3 minutes", "$29 one time", "Use it on 3 devices". There are no adjectives doing the selling, no exclamation marks and no testimonials.

## Risks

- **Dark sites print badly and can feel "techy".** The brief makes light, print-safe styles the product default, and Midnight Gilt carries a paper warning. The dark hero could make buyers expect a dark chart. Mitigation: Ivory is first in the gallery and labelled "The free style", and the gallery is mostly light prints. A light "Ivory room" version of this layout should be A/B-tested against it.
- **Older eyes and light-on-dark.** Contrast is high (body 15.6:1), but some readers with astigmatism find light text on dark harder over long passages. The body text stays at 20px, the long FAQ answers are short, and all readable text is 17px or larger. The exceptions are the gallery meta line on phones (16px) and the small captions inside decorative illustrations, which are `aria-hidden` (14–16px).
- **EB Garamond at text size on screens.** Its x-height is small. It is set at 20px, which makes the page taller. If the LLM judges or users call it faint, move the body text to EB Garamond at 21px or pair with a sturdier text serif.
- **Chart text in the hero is texture, not reading.** Outer rings hold 5–7px text on screen. That is why the register exists. It also means the hero is not a legibility proof. The gallery and `/samples/` PDFs have to do that job.
- **Performance.** The hero fan is 651 SVG nodes animating in 8 groups. The six gallery charts and the gift card add about 2,100 more, for about 3,200 DOM elements in total. It has not yet been profiled on an older iPad. Fallback: lazy-render the gallery with `IntersectionObserver`, or pre-render the thumbnails at build time. All 13 font files load because every chart face is measured up front (about 650 KB WOFF2). The gallery could load its fonts lazily.
- **Mockup parser.** `js/gedcom.js` is a small line parser (UTF-8 only, BIRT/CHR and DEAT/BURI, first FAMC). It exists so the drop demo is honest. It is not the product parser (read-gedcom in a worker). ANSEL or CP1252 files will show wrong accents here.
- **Accessibility of the chart widget.** The fan is `role="img"` with `tabindex="0"` and arrow-key stepping. A screen reader gets the label plus the live register. A full chart would need a proper list or tree alternative.
- **Links are the planned URLs** (`/make/`, `/gift/`, `/export/` and so on) and go nowhere in the mockup.
- **Gallery facts.** Cartographer colors come from the birthplaces in the file. Victoria's ancestors are about 90% German-born, so that print is mostly one hue. It is honest, but the chart looks less varied than a typical American immigrant tree would.
- **The gift card family is fictional** (Kowalski, Byrne, Doyle, Wąsowska). It is an illustration of the product, not a testimonial. It should stay clearly an illustration.

## Files

- `index.html`: the homepage mockup
- `css/site.css` (tokens at the top) and `css/fonts.css`
- `js/home.js` (page, hero, drop zone, gallery and card renders), `js/charts.js` (fan, bowtie and pedigree SVG engine, the abbreviation ladder, laurel, compass rose), `js/gedcom.js` (mockup parser, Ahnentafel, living rule)
- `data/victoria.ged` (Wikidata, CC0, copied from `web/src/samples/`)
- `fonts/*.woff2` (static, subset, OFL)
- `images/mark.svg` (favicon and mark) and `images/victoria-fan-9gen.jpg` (no-JS fallback, resized from `company/reference/fan-spike-victoria.png`)
