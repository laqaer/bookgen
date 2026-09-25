# Gildroot: company brief v1.0

Date: 2026-09-25 · Author: founding CEO · Audience: build swarm, agent operating team, owner

The concept is "Stemma" from the finalists, renamed **Gildroot**. Section 2 explains why the name had to change.

---

## 1. Decision and why

### Decision

We build the **Stemma family** of concepts under the name Gildroot. The product turns a family tree file (GEDCOM) or a few typed-in generations into a chart good enough to frame. It runs entirely in the browser and sells for one-time prices.

- **Base variant:** C7. It has the tightest scope (three chart engines, 4–6 generations by default), the no-GEDCOM gift wizard, the bowtie chart for weddings and anniversaries, and the $29 entry price.
- **From C9:** the Atlas colour-by-birthplace mode as the signature feature, and the "drop your file on the homepage and watch it bloom" moment.
- **From C14:** tiled home printing, a print guide, the cousin calculator (aimed at "cousin calculator", not "cousin chart"), gift keys with a printable gift card, and the Professional tier.
- **Red-team fixes, all mandatory:**
  - Position first for Ancestry users.
  - Replace jsPDF/svg2pdf with direct PDFKit drawing.
  - Use static fonts with Greek and Cyrillic coverage, and check every name for missing glyphs before export.
  - Parse with read-gedcom.
  - Give sparse trees their own layout rules.
  - Add the "Ask the family" link, which carries the partial tree in the URL fragment so no server is involved.
  - Make light, print-safe styles the default.
  - Cap raster exports so they work on iOS.
  - Make the Q4 plan depend on owner posts plus creators, not on SEO.
- **Graft from the typesetter runner-up:** the Paged.js engine that the spike verified. v1 uses it to pre-render a free "Family Stories Journal" at build time. v1.5 turns it into a paid **Family History Book**, targeted for March 2027 ahead of Mother's Day. That market has uncontested searches: "family history book" gets 1,000 US searches a month at KD 0 and "family history book template" 260 at KD 0.
- **From Firmament:** nothing. Adding a sky panel brings astronomy-accuracy risk and an unresolved licence question on d3-celestial's Milky Way data (`mw.json`), and nothing shows it would lift conversion.

### Evidence

| Concept | Market red team | Tech red team | Month-6 revenue (red team) | Judges | Verdict |
|---|---|---|---|---|---|
| **Stemma / Gildroot** | Not killed, 4/10 | Not killed, 6/10 | $150–2,000 and $500–4,000 | C7: "strongest combination of an underserved, affluent audience that pays and a huge design gap". C14: "best-monetised", with "the strongest organic acquisition of any concept" | **Winner** |
| Browser typesetter | **Killed**, 3/10 | 4/10 | $100–1,500 and $300–2,000 | "Red ocean"; "sales lag traffic"; "interiors do not spread on their own" | Lost |
| Firmament (night sky) | **Killed**, 2/10 | 6.5/10 (build only) | $100–1,500 and $100–2,000 | "The category is commoditized"; "digital-only at $19 caps order value" | Lost |

Why Gildroot wins:

- It is the only finalist that neither red-teamer killed.
- It has the highest month-6 upper bound.
- It is the only one that fits the Q4 gift window.
- Its output is proven. The spike (`company/reference/fan-spike-victoria.png`) produced a gallery-grade 9-generation Queen Victoria fan in gold on midnight from CC0 Wikidata.
- Marginal cost per customer is near zero.
- Both typesetter red-teamers said "if the owner has to pick one company, pick Stemma".

### Why the runners-up lost

- **Typesetter.** Every differentiator is already on sale:
  - Atticus is $147 and runs in the browser on Windows, Linux and Chromebook.
  - Koberger uses our exact model (free preview, pay at export) at $9.99 per book.
  - Reedsy Studio and Kindle Create are free. Lacuna and Cambric already sell "local-first".
  - Buying-intent search is tiny: "vellum alternative" gets 50 a month, and "kdp formatting" gets 260 at an $11.32 CPC.
  - It has no viral loop and no gift season. A 122K-word run through Paged.js also showed real print defects: variable fonts turned into Type 3, 30% of pages had force-justified last lines, and drop caps were dropped.
- **Firmament.** The category has shrunk 60–96% from its peak ("personalized star map" went from 4,400 to 170 a month). Gift the Stars and GreaterSkies already sell $19 instant downloads with planets. Listify and MyLaserTools give watermark-free files away free. Etsy sells files for $5–10. CPCs of $4–8 cannot pay back a $22 order.

### What we accept from the red team (corrections to the pitch)

1. **We are not unique on features.** FamilySearch's free fan chart already colours ancestors by birth country (4–7 generations). MyHeritage offers 18 chart styles free. familytreechart.com has sold "beautiful, modern" charts since 2020. FamilyPDF charges $19.99 for a GEDCOM fan chart. We compete on:
   - typographic craft
   - Ancestry users, who have the weakest options
   - bowtie charts for couples
   - the gift flow
   - privacy
   - instant results

   Banned claims: "nobody else offers", "incumbents look like 1998".
2. **Search demand is small.** "family tree poster" gets 720 a month, "fan chart" 390, "gedcom viewer" 320. The large numbers ("family tree template" 27.1K, "pedigree chart" 12.1K) are mostly school homework traffic. SEO compounds slowly and will not carry the launch.
3. **Q4 2026 is a soft launch and a learning period.** The real revenue windows are Mother's Day (9 May 2027), Father's Day (20 June 2027), summer reunions and Q4 2027. Q4 2026 revenue depends on three owner posts and creator seeding.
4. **jsPDF + svg2pdf is banned.** In the spike it silently dropped every curved name, every gradient stroke and every filter, and substituted fonts.
5. **Costco photo centres closed on 14 Feb 2021.** "Print at Costco in an hour" is out. Same-day printing means Walgreens (11×14, 12×18, 16×20, 20×30, 24×36), CVS, FedEx Office and Staples.

### Honest expectation

This is a small, seasonal niche business that is profitable from day one. It is not a venture rocket.

- Base case: about $4K gross in Q4 2026, about $1K a month by March 2027, about $14K in the first 12 months.
- Upside: $40–50K in year one if a mid-size genealogy creator features us.
- Kill and pivot gates are in section 11.

---

## 2. Company

### Name candidates

Checked on 2026-09-25 with WebSearch and RDAP domain lookups.

| Name | Rationale | Collision check | Verdict |
|---|---|---|---|
| **Gildroot** | "Gild" (gold leaf, heirloom craft, our gold-on-midnight signature) plus "root" (roots, ancestry). Two familiar words form one coined name. Spelled as it sounds, 8 letters, reads like an old English place name. | No genealogy or software use found. Only hits: a herb in a fantasy game (Genfanad) and a furniture product called "GildRoot table". **gildroot.com unregistered** (RDAP 404). | **Pick** |
| Lineagram | Lineage plus diagram; says exactly what it is. | No collisions; lineagram.com unregistered. | Runner-up. "-gram" reads like a social app and it has less gift warmth. |
| Whence | "Whence we came"; ties to the Atlas migration story. | whence.com taken; whence.family unregistered. As a dictionary word it is hard to trademark and hard to search for. | Rejected |
| *Stemma* (working name) | Latin for the Roman ancestral garland. | **Crowded in genealogy:** mystemma.com (family tree platform), "Stemma Board – Family Tree" (iOS/Mac app with PDF/PNG export), ADZirid/STEMMA ("100% local genealogical charts"), lucafluri/stemma (browser GEDCOM viewer), StemmaFiles, stemmagenealogy.com, stemma.life. | **Rejected. Do not use.** |
| Kinfolio / Kinwheel / Kinloom | Kin compounds. | KinFolio is dog-breeder *pedigree* software; kinwheel.com and kinloom.com are registered. | Rejected |

- **Name:** Gildroot.
- **Domain:** gildroot.com. The owner buys it today. gildroot.co is an optional redirect.
- **Trademark:** the owner runs a USPTO knockout search (classes 9, 42, 40) before filing.

### Tagline, descriptor and mission

- **Tagline:** *Your roots, gilded.*
- **Descriptor (one line under the logo):** Heirloom family-tree charts from any family tree file. Made privately in your browser, ready to print today.
- **Mission:** People spend years researching their family. We turn that work into something the whole family will look at, keep and hang on the wall. We do it privately, beautifully, and for a fair one-time price.

### Brand personality: "the archivist with a letterpress"

- **We are:** warm, exacting, unhurried, quietly proud of craft, and delighted by families.
- **We are not:** cute, twee, techy, salesy, nostalgic kitsch, or "AI-powered".
- **Visual tokens** (the design swarm finalises these):

| Token | Value | Use |
|---|---|---|
| Paper | bone `#F3EDE2` | Site background (light) |
| Ink | `#16140F` | Text |
| Accent | oxblood `#6E1F1B` | The only CTA colour |
| Gold leaf | `#B8913A` | Ornaments and hairlines only; never text on a light background |
| Midnight | `#0B1024` | Hero and dark-mode ground |
| Sage | `#6B7A5A` | Secondary |

- **Type:** Cormorant Garamond for display, EB Garamond for text and chart names, Inter for the UI. All OFL, all self-hosted as **static** instances.
- **Motifs:** hairline double rules, a gilt medallion, engraved laurel, a compass rose.
- **Logo:** wordmark plus a small quarter-fan glyph (three concentric arcs), which is also the favicon.
- **No stock photos of elderly people.** Use real proof prints photographed by the owner, and CSS frame mockups.

### Voice rules

1. Write for a 70-year-old reading on an iPad: plain words, short sentences, 17–18px body text.
2. Whenever data is involved, say exactly what happens to it. Example: "Your file is read on this computer. Nothing is uploaded."
3. Use numbers, not adjectives. Example: "8 generations on a 24×36 poster."
4. Never claim uniqueness we can't prove. Never disparage competitors. Comparisons must be factual and carry a date.
5. Banned: "revolutionary", "magic", "AI-powered", "unlock your legacy", exclamation marks, emoji, fake urgency.
6. Treat ancestors as people. No jokes about death, illegitimacy, adoption or cousin marriage. Describe pedigree collapse neutrally.
7. Be inclusive by default: "partner" alongside husband and wife. Same-sex couples, adoptive families and step-families work in both the copy and the product.
8. Use sentence-case headings and US English. Charts show dates as "24 May 1819" by default.
9. State limits before payment. Example: "Names in Chinese, Japanese, Korean, Hebrew or Arabic script can't be printed yet. We'll show you which ones before you buy."
10. One clear next step per page, and never more than two CTAs.

Sample lines:

- Hero: *"The beautiful way to print your family tree."*
- Paywall: *"Your chart is ready. Make it a poster for $29: every size, every style, re-export it forever."*
- Error: *"We couldn't place 14 birthplaces. Tell us which country each is in and we'll colour them."*

---

## 3. Customer and positioning

### Customer segments

| Segment | Who | Job to be done | Trigger | Buys |
|---|---|---|---|---|
| **1. The Keeper** (primary, year-round) | Hobby genealogist aged 50–75, often an Ancestry subscriber, tree of 200–10,000 people, affluent, privacy-conscious | "When I've spent years on my tree, I want it in a form my family will actually look at, so the work outlives my laptop." | Reunion, holiday visit, finishing a research line, a birthday | Family Historian $59, Family Pack $79 |
| **2. The Gift Giver** (Q4, Mother's and Father's Day) | Aged 30–55, buying for a parent or grandparent; often has **no GEDCOM** | "When I need a meaningful gift for a parent who has everything, I want something personal and beautiful I can finish tonight and print tomorrow." | Gift deadline | Heirloom $29, gift keys |
| **3. The Couple / Occasion buyer** | Engaged couples, children planning a 25th or 50th anniversary | "I want a picture of two families becoming one." | Wedding or anniversary date | Heirloom $29 (bowtie) |
| **4. The Organizer** | Reunion organizers, genealogical society officers, professional genealogists, Etsy chart sellers | "I need charts for other people, fast, that make me look good." | Reunion or client deliverable | Professional $149 |

### Positioning statement

For family historians and the people who love them, Gildroot turns a family tree file into a chart worth framing. It takes about a minute, runs privately in the browser, and costs $29 once. FamilySearch and MyHeritage give free charts only for trees kept on their own sites. Gildroot works with any tree, especially Ancestry's, and is typeset for the wall rather than the filing cabinet. Unlike custom designers, it is instant and uses all of your research rather than a few retyped names.

### Message pillars, in order

1. **Beautiful:** typeset for the wall.
2. **Yours:** any file, all your research, and you can fix anything on the chart.
3. **Private:** nothing is uploaded; it works with wifi off.
4. **Now:** print today, give it tonight.
5. **Fair:** one-time price, re-export forever.

**Ancestry landing page** (`/print-ancestry-tree/`): *"The beautiful way to print your Ancestry tree."* Include the disclaimer: "Gildroot is independent and not affiliated with Ancestry.com."

### Our edge over each competitor

Prices verified by the red team or by us on 2026-09-25.

| Competitor | What they offer and price | Our edge |
|---|---|---|
| FamilySearch fan chart | Free, 4–7 generations, PDF, birth-country view, FamilySearch data only | Any source (Ancestry, MyHeritage, RootsMagic…); poster sizes to 24×36; 8 generations; bowtie; print-grade typography; Atlas with legend and place resolution |
| MyHeritage charts | Free, 18 styles, unlimited PDF, locked to MyHeritage trees; paid poster printing | Works with trees kept outside MyHeritage; design quality; privacy |
| Ancestry + MyCanvas | Ancestry has basic print and an on-screen fan view. MyCanvas posters from $50, 3 designs, 5–9 generations, physical only, no download | $29 digital, 6 styles, instant, print anywhere, re-export forever |
| familytreechart.com | $34.95–$459.95 (digital, print, framed), GEDCOM or FamilySearch import, up to 10 generations, since 2020 | Self-serve with live preview; bowtie; Atlas; private; cheaper; unlimited re-exports |
| FamilyPDF | $19.99 one-time to remove the watermark; fan design, 4–6 generations plus up to 12 children; GEDCOM up to 5 MB | We cost $9 more, so the output must look visibly better. We add up to 8 generations, 3 chart types, 6 styles, tiled home print and photo-lab JPEGs, and a free 5-generation Letter PDF |
| Family ChartMasters | $30–40 fill-in, $49 self-designed, $90–120 pre-filled; designer proofs and shipping | Instant; a fraction of the price |
| TreeSeek | Free charts from FamilySearch; blank charts on Amazon | Ancestry support, design, sizes |
| Etsy designers | $5–150 per custom design, 3–10 days, usually 3–4 generations retyped by hand | Instant, your full tree, no retyping, you can fix it yourself |
| Canva templates | Free; every name typed by hand | Built automatically from your file |

---

## 4. Product v1 spec

### 4.1 The promise and the 60-second moment

- The homepage hero is a live canvas. A 7-generation fan of Queen Victoria's ancestors (CC0 Wikidata; source file at `web/src/samples/victoria.ged`) blooms ring by ring in Midnight Gilt.
- The whole hero is a drop zone. A visitor drops a `.ged` file, and within about 3 seconds for a 5,000-person tree **their own chart blooms in its place.** No signup.
- Two secondary buttons sit under the drop zone: *"No file? Build it in 3 minutes"* and *"Try a sample family."*

### 4.2 User flows

**A. Keeper with a file (desktop or iPad)**

1. Land on `/` or `/print-ancestry-tree/`. Drop a file or click "Choose file". Toast: "Reading 4,212 people on this computer. Nothing is uploaded."
2. Root picker suggests a starting person (GEDCOM `_HOME`/`HEAD` hints, otherwise the person with the most known ancestors) with type-ahead search.
3. The chart blooms in the default Ivory fan, at auto depth. Auto depth is the deepest generation that is at least 25% filled, capped by the chosen size.
4. **Studio** (`/make/`) layout:
   - Left rail: Chart · Style · Colour · Size · Generations · Title and dedication · People (edit) · Privacy.
   - Centre: canvas preview with zoom and hover. Hovering a person lights their line back to the centre.
   - Toggles: "On the wall" (CSS frame mockup) and "Printed paper" (simulated dulling from CMYK printing).
5. Two export buttons: "Download free Letter PDF (5 generations)" and "Make it a poster, $29".
6. Lemon Squeezy (LS) hosted checkout opens in a new tab. The buyer returns and pastes the key (auto-detected from the clipboard on focus, with permission). The key activates and exports unlock.
7. After export, a "Where to print it" panel gives advice for that exact size: same-day stores, online printers, paper choice, frame size.

**B. Gift giver without a file (phone-first)**

1. `/gift/` → "Build it from what you know". **Quick Builder** is a guided form with up to 15 slots:
   - recipient → parents → grandparents → great-grandparents
   - each slot: name, birth year (or "about"), birthplace (country or US-state picker), optional death year
2. **"Ask the family" link.** The partial tree is compressed into a URL fragment (lz-string), so the data never reaches a server. The link is shared through the phone's share sheet (Web Share API) or copied.
   - An aunt or cousin opens it on a phone, sees "Help Anna finish the family tree", fills in blanks and taps "Send back".
   - Anna opens the returned link and merges it in one tap. Conflicts are highlighted for her to choose.
   - Tip shown: "Ask an aunt or cousin to keep it a surprise."
3. The chart renders in **keepsake** layout: at 4 or fewer generations, type is large, full places and dates are shown, and an ornamental frame is added.
4. Buy Heirloom → export → print same day. Or buy a gift key and print a gift card instead (flow E).

**C. Couple (bowtie)**

1. Choose "Two families". Pick two people from the file, or build both sides.
2. Enter the wedding date and place for the centre medallion. Choose a style.

**D. Returning user**

- The project autosaves to IndexedDB and resumes on return.
- The key is remembered on this device. A new device needs the key pasted again, which counts against the activation limit.

**E. Gift redemption**

- The recipient opens `/redeem#k=…&to=…&from=…&m=…` and sees the message.
- The studio opens with the key prefilled. The key activates on first paid export.

### 4.3 Features (exhaustive for v1)

**Inputs**

| Format | Handling |
|---|---|
| `.ged` (GEDCOM 5.5 / 5.5.1 / 7.0) | Decodes UTF-8, UTF-16, ANSEL, CP1252, CP850 and MacRoman |
| `.zip` containing a `.ged` | Unzipped with fflate |
| `.gdz` (GEDZIP 7.0) | Unzipped with fflate |
| Quick Builder | Manual entry, up to 15 people |
| Ask-the-family links | Merged into the project |
| `.gildroot` project file | Save and load |
| Sample family | Fictional "Almeida–Novak family", 6 generations, deliberately sparse, with diacritics (Seán, Dvořák, Ødegård, Nguyễn), a Greek name and a pedigree collapse. Clearly labelled fictional. |

**Tree handling**

- Normalise every name to NFC.
- Dates handled: `ABT`, `BEF`, `AFT`, `BET … AND`, `CAL`, `EST`, dual dating ("1731/32") and partial dates. Display examples: "c. 1843", "b. 1791".
- A person counts as **living** if they have no death event and were born less than 100 years ago. Default display for living people: name shown, dates hidden. Alternatives: "Living" only, or show all.
- **Pedigree collapse** is detected and marked with a small numbered marker. The legend reads "appears 3 times".
- Adoption (`FAMC PEDI`): birth parents are used by default, with a per-person switch to adoptive parents.
- Same-sex couples, multiple marriages and missing sex are all supported.

**Chart engines (exactly three)**

1. **Fan**
   - Spans: 180° (default at 5 or fewer generations, landscape), 270° (default at 6–8, the Victoria look), 360°.
   - Rings 1–3 set names along the arc, with each glyph placed on the curve.
   - Rings 4 and beyond set names radially.
   - Ring depths are solved from the length of the text they must hold.
   - Paternal line on the left, maternal on the right.
   - Empty slots show as faint hairline wedges; option to trim empty branches.
2. **Bowtie ("Two families")**
   - Two 180° half-fans facing outward from a centre medallion for the couple (both names, "&", marriage date and place).
   - 3–6 generations per side.
3. **Pedigree**
   - Classic horizontal ancestor chart, landscape, 4–6 generations.
   - Boxes with elbow connectors; each box holds name, birth and death dates, and places.

**Styles (exactly six).** Each has tokens for all three colour modes.

| Style | Look | Notes |
|---|---|---|
| Ivory (default) | Bone ground, sepia ink, engraved double rule | Print-safe; the free style |
| Midnight Gilt | Midnight ground, gold hairlines and names | Label: "best on photo or matte poster paper" |
| Botanical | Warm white, olive/ochre/rose tints, engraved laurel base | |
| Letterpress | Cream, two inks (black and vermilion), bold small-caps title | |
| Nordic | White, charcoal, pale blue-grey, Inter | |
| Cartographer | Pale map-blue ground, faint graticule, compass rose | Pairs with Atlas |

**Colour modes (exactly three)**

1. **Style tones.**
2. **Family line:** paternal and maternal lines tinted differently.
3. **Atlas:** ancestors coloured by birthplace.
   - An alias table of about 600 entries resolves place names: countries in English and native spellings, historical states, US states and their abbreviations, Canadian provinces, the four UK nations, Irish counties.
   - Ambiguous historical places (Austria-Hungary, Russian Empire, Galicia) go to a list for the user to assign.
   - The panel shows coverage ("resolved 212 of 240 birthplaces") and lists unresolved places by frequency. Each can be assigned in two clicks.
   - Palette: 7 hues plus "other", checked for colour-blindness, with a legend showing counts ("Where they were born: Ireland 41%…").
   - Toggle: "Show US states separately".

**Text system**

- Names use EB Garamond, which covers Latin Extended, Greek, Cyrillic and Vietnamese. Titles use Cormorant Garamond, falling back to EB Garamond when a glyph is missing. Nordic uses Inter.
- **Abbreviation ladder:**
  1. "Johann Georg Friedrich Weber 1791–1854"
  2. "Johann Georg F. Weber"
  3. "Johann G. Weber"
  4. "J. G. Weber"
  5. "Weber"
  6. initials

  Names are never hyphenated.
- Minimum printed size is 6pt, with a hard floor of 5.5pt. Minimum stroke is 0.35pt.
- **Glyph preflight:** before export, the app lists any name containing characters the fonts can't render (CJK, Hebrew, Arabic in v1) and offers "enter a romanized form" per person.

**Edit panel**

- Click any segment to change the displayed name, dates or place, hide the person, mark them "unknown" or make them the root.
- Edits are stored as project overrides. The source file is never modified.

**Title block**

- Auto-generated title ("The Ancestors of Margaret Rose Kowalski") and subtitle ("Seven generations · 1791–1962"), both editable.
- Dedication line ("For Mom, Christmas 2026").
- Atlas legend when Atlas is on.
- Free exports carry a one-line colophon: "Made with Gildroot · gildroot.com".

**Preview**

- Canvas preview with zoom, pan and hover highlight.
- "On the wall" mockup: CSS frame, mat and shadow on a wall colour. "Printed paper" simulation.
- Phones can view, buy and export, and Quick Builder and Ask links are phone-first. Detailed editing is designed for screens 768px and wider.

**Exports**

| Export | Detail | Tier |
|---|---|---|
| Vector PDF | Fonts embedded as subsets; exact trim size; optional 0.125in bleed and crop marks | Paid (Letter/A4 ≤5 generations free) |
| Tiled home print | Poster split across Letter/A4 sheets with 0.25in overlap, crop marks and tile labels, plus a page-1 assembly map | Paid |
| JPEG for photo counters | sRGB, quality 0.92. Desktop: 200 dpi up to 18×24, 150 dpi above. iOS/iPadOS capped at 16.7 MP (24×36 comes out at about 139 dpi), labelled honestly | Paid |
| Share image | 1080×1350 PNG with a small mark | Free |
| Gift card | 5×7 folded card PDF and a Letter sheet PDF | With gift keys |
| Project file | `.gildroot` JSON: settings, overrides, and optionally the people used | Free |

**Offline and trust**

- A service worker caches the studio, so after the first load it works with wifi off. The privacy page tells users to try it.

### 4.4 Sizes and maximum generations (enforced in the UI)

| Size | Fan | Bowtie (per side) | Pedigree |
|---|---|---|---|
| Letter / A4 (free up to 5 generations) | 6 | 4 | 5 |
| 11×14 | 6 | 5 | 5 |
| 16×20 / 18×24 / A2 | 7 | 5 | 6 |
| 20×30 / 24×36 / A1 | 8 | 6 | 6 |

- Orientation is chosen automatically: 180° fans, bowties and pedigrees are landscape; 270° and 360° fans can be either.
- **Non-goals:** 36×48 posters and 9 or more generations.

### 4.5 Free vs paid

| | Free | Paid (any tier) |
|---|---|---|
| Load any file, Quick Builder, Ask link | Yes | Yes |
| All charts, styles and colour modes on screen; editing; saved projects | Yes | Yes |
| Share image 1080×1350 | With mark | With mark or clean |
| PDF | Letter/A4, fan or pedigree, up to 5 generations, Ivory only, colophon line | All sizes to 24×36/A1, up to 8 generations, all styles, all colour modes, bowtie, no colophon, bleed |
| Tiled home print, photo-lab JPEGs | No | Yes |
| Re-exports | Unlimited | Unlimited, forever |

### 4.6 Technical architecture (client-side only)

**Hosting and build**

- GitHub Pages serves the static site, built by GitHub Actions.
- Build tools: npm, esbuild 0.28.2 for the app bundle, Eleventy 3.1.6 for the content site.
- **No runtime CDN calls.** Every library is a pinned build vendored into `/vendor/` from npm or jsDelivr, with SHA-384 hashes in `/vendor/manifest.json`. This keeps "nothing leaves your computer" auditable and lets the CSP be `'self'`.

**Runtime libraries (pinned)**

| Library | Version, licence | Job |
|---|---|---|
| PDFKit | 0.20.2, MIT | Vector PDF writer, font subset embedding, and **all text measurement** (its bundled fontkit). Loaded as `js/pdfkit.standalone.js` (~1.4 MB, ~352 KB gz), lazy-loaded when the studio opens. Spike: 8-gen fan exported in 226–280 ms (236 KB); 10-gen in 632 ms. |
| read-gedcom | 0.3.2, MIT | Decoding (ANSEL → composed Unicode verified: "Seán /Dvořak/") and parsing, in a Web Worker. First-hour check: confirm the es6 build runs in the browser. Fallback: our own line parser plus the ANSEL table. |
| fflate | 0.8.3, MIT | .zip and .gdz |
| d3-shape | 3.2.0, ISC (+ d3-path 3.1.0) | Arc path strings, used by both canvas (`Path2D`) and PDFKit (`doc.path()`) |
| lz-string | 1.5.0, MIT | Ask-the-family link codec |
| idb-keyval | 6.3.0, Apache-2.0 | Autosave |
| Preact + htm | 10.29.8, MIT + 3.1.1, Apache-2.0 | UI. No JSX; do not mix with other frameworks. |
| qrcode-generator | 2.0.4, MIT | QR code on the gift card |
| Paged.js | 0.4.3, MIT | **Build time only**: Family Stories Journal now, Family Book in v1.5 |

**Explicitly banned:** jsPDF, svg2pdf.js, SVG filters or gradient text in any exportable layer, variable fonts, Google Fonts CSS2 files.

**Fonts**

- OFL static TTFs are generated at build time with fontTools `varLib.instancer` from the Google Fonts variable sources and committed to `/assets/fonts/`:
  - EB Garamond 400, 400 italic, 600
  - Cormorant Garamond 500, 600
  - Inter 400, 500, 600
- Each file is fetched once as an ArrayBuffer. The same bytes go to `new FontFace()` for canvas and to `doc.registerFont()` for PDFKit, so screen and PDF use identical fonts.

**One scene, three renderers.** This fixes the red team's preview-versus-PDF mismatch.

```
GEDCOM ─worker→ Model{people, families, overrides}
  → Layout(fan|bowtie|pedigree, size, style, colourMode)
  → Scene IR (points) → CanvasRenderer (preview + JPEG)
                      → PdfRenderer (PDFKit)
                      → TileRenderer (PDF pages clipping the same Scene)
```

- The lead agent freezes the IR in hour 0:
  - `Scene{wPt,hPt,bg,items[]}`
  - item types: `path{d,fill,stroke,sw}`, `text{x,y,rot,str,font,size,color,tracking,anchor}`, `glyphs{font,size,color,g:[{ch,x,y,rot}]}`, `image{x,y,w,h,src}` (raster textures only), `group{clip?,items}`
  - `hits[]`: `{personId, shape:'annulusSector'|'rect', …}`
- Layout measures text **only** through PDFKit metrics and keeps at least 4% slack on fitted text.
- Arc names are placed one glyph at a time, with kerning computed as `w(ab)−w(a)−w(b)`. Ligatures are disabled in names.
- Ornaments are single-colour SVG path data drawn with `doc.path(d)`. Textures (paper grain) are pre-rendered JPEGs placed under vector text.

**Privacy enforcement**

- A `<meta http-equiv="Content-Security-Policy">` on `/make/` and all tool pages:
  - `connect-src 'self' https://api.lemonsqueezy.com https://api-cors-anywhere.lemonsqueezy.com https://plausible.io`
  - `script-src 'self'`
- Analytics events carry buckets only (for example `gens=7`, `people=1k–5k`, `style=ivory`). They never carry names, places or dates.

**Performance budgets**

| Operation | Budget |
|---|---|
| Parse a 50K-person file in the worker | Under 5 s on a CPU throttled 4× |
| Preview re-render (8-gen fan) | Under 150 ms |
| PDF export, 24×36 8-gen | Under 2 s |
| Home LCP on 4G | Under 2.5 s (studio code loads on idle or first drop) |
| Studio JS before PDFKit | 500 KB gz or less |

### 4.7 What makes the output look this good (non-negotiable craft rules)

1. A real serif typeface, set correctly: curved names on inner rings, radial names on outer rings, balanced two-line splits, old-style figures in dates, tracked small-caps titles.
2. Generous margins (at least 6% of the short edge) and a title cartouche with a hairline double rule.
3. Hairlines of 0.35–0.5pt. Gold is used only for rules, ornaments and dark grounds.
4. Sparse trees look deliberate: keepsake layout, faint "unknown" wedges, trim-empty option. A sparse tree must never look broken.
5. The centre medallion always carries the root name and dates in the largest type on the page.
6. Atlas legend and a one-line migration summary ("Born in 6 countries across 7 generations").
7. Pedigree-collapse markers and a legend line.
8. Light, print-safe styles are the default. The dark style warns about paper before export.
9. **Screen and PDF match**, and CI enforces it.
10. Every style is reviewed at 100% zoom as a printed 24×36 would look, and scored by an LLM judge panel. Only styles scoring 8/10 or higher ship.

### 4.8 QA gate (definition of done; blocks deploy)

**Corpus**

- `victoria.ged` (Wikidata)
- royal92.ged (public domain)
- Synthetic files: 50K-person, ANSEL, UTF-16, GEDCOM 7 / .gdz, an Ancestry-style export, a MyHeritage-style export
- The sample family
- A diacritics/Greek/Cyrillic/Vietnamese file
- Edge cases: a 3-generation sparse tree, pedigree collapse, same-sex couple, adoption, missing sex, multiple marriages, a CJK name (must trigger the preflight)

**Checks, for every chart × style × colour mode × size (about 380 renders)**

- Playwright + PyMuPDF 1.28.2:
  - MediaBox equals the requested size
  - every font embedded; no Type 3 fonts
  - extracted text contains every displayed name (NFC-normalised)
  - zero "NO GLYPH" occurrences
  - no text below 5.5pt
  - stroke count above 0
- Visual diff of the PDF raster against the canvas raster stays under threshold.

**Other gates**

- Privacy test: Playwright intercepts all network traffic during a full session and asserts that nothing leaves except static GETs, LS license calls and bucketed analytics.
- Performance budgets from 4.6.
- WCAG AA; full keyboard use; 44px touch targets.
- LLM design judge: 3 judges score 8/10 or higher per style on the sample family.
- Fact-check: every node of the Victoria hero chart checked against Wikipedia and Wikidata.
- Reuse the `.harness/` screenshot harness already in the repo for visual QA.

**Reference artifacts in the repo**

| Path | Content |
|---|---|
| `tools/showcase/fan-spike-reference.html`, `company/reference/fan-spike-victoria.png` | Visual target |
| `company/reference/pdfkit-fan-spike.html` | Working PDFKit path |
| `web/src/assets/fonts/*.ttf` | Static Cormorant instances |
| `company/reference/read-gedcom-ansel-proof.cjs` | read-gedcom ANSEL proof |

### 4.9 v1 non-goals

- Accounts, servers, sync, or any upload of tree data.
- Direct FamilySearch, Ancestry or MyHeritage API import. v2 may apply for a FamilySearch developer key.
- Physical print fulfilment or framing. v1 gives guides only.
- Descendant, hourglass, constellation and map charts. The descendant chart comes in v1.2 (January, capped at 4 generations or 150 people).
- Photos and portraits, 9 or more generations, posters larger than 24×36/A1.
- CJK and right-to-left scripts in exports (the preflight explains this).
- SVG export, a commercial template marketplace, UI languages other than English.
- The Family History Book (v1.5; v1 has a waitlist only).
- A famous-family SEO programme (the Victoria demo only).
- AI features of any kind. We never generate or invent ancestors or stories.
- Subscriptions, social login, paid ads.

### 4.10 Swarm work breakdown

Run these in parallel after the IR freeze in hour 0.

| Workstream | Scope |
|---|---|
| WS1 Parser and model | Worker, read-gedcom, dates, living detection, collapse, adoption, overrides, fixtures |
| WS2 Fonts and text | Instancing, registry, measurement, arc fitting, abbreviation ladder, glyph preflight |
| WS3 Layout | Fan 180/270/360, bowtie, pedigree, keepsake rules, title block → IR |
| WS4 Renderers | Canvas preview, hover and zoom, PDFKit, JPEG with the iOS cap, tiling, share image, gift card |
| WS5 Styles and Atlas | 6 styles × 3 colour modes, path ornaments, textures, alias table, legend |
| WS6 Studio UI | Preact app, root picker, Quick Builder, Ask link, edit panel, autosave, service worker, accessibility |
| WS7 Commerce | Checkout links, license module, unlock, redeem, upgrade, analytics events |
| WS8 Site | Eleventy, every page in section 7, structured data, sitemap, OG images, Ancestry landing page |
| WS9 Free tools | Section 5, including the build-time Paged.js journal, applying the red team's Paged.js fixes (static fonts, section wrapping + `text-align-last` override, `@page :blank`) |
| WS10 QA and CI | Section 4.8 and GitHub Actions |

---

## 5. Free tools and SEO lead magnets

Volumes are US monthly figures from OpenSEO/DataForSEO, taken from the red-team pulls of 2026-09-25. "Unmeasured" means our OpenSEO credits ran out today; the SEO agent measures these in week 1.

| # | Tool and URL | Target keywords | What it does | Call to action |
|---|---|---|---|---|
| 1 | Cousin and relationship calculator `/tools/cousin-calculator/` | "cousin calculator" 1K, KD 6; "second cousin once removed" (unmeasured). Avoid "cousin chart"; FamilySearch and Ancestry own it. | Grid mode (generations from the common ancestor), or pick two people from your own file privately. Returns the relationship in plain English with a diagram. | "See how you're related on a chart" |
| 2 | Private GEDCOM viewer and tree report `/tools/gedcom-viewer/` | "gedcom viewer" 320, KD 3; "gedcom" 1.9K | Drop a file and get: people count, generations, top surnames, birthplaces by country (Atlas preview), date range, data-quality report, searchable list | "Chart this tree" |
| 3 | Blank printable fan and pedigree charts `/templates/…` | "fan chart" 390, KD 0; "genealogy fan chart" 210; "printable family tree" 1.3K; "pedigree chart" 12.1K and "family tree template" 27.1K (both mostly school traffic) | 5-gen and 6-gen fans, 4-gen and 5-gen pedigrees, a blank wedding bowtie; Ivory and Nordic; Letter and A4; drawn by our own engine. Direct download, no email wall. | "Fill it automatically from your file" |
| 4 | Poster print planner `/print/` | "family tree printing" 1.3K, KD 5; "family tree poster" 720, KD 0 | Pick a size to see how many generations fit, where to print it today, paper choice and frame size | "Make yours at this size" |
| 5 | Export-your-tree guides `/export/…` | "how to print family tree from ancestry" 170; "export gedcom from ancestry / familysearch / myheritage" (unmeasured) | One tested guide per platform: Ancestry (desktop only), MyHeritage, FamilySearch (via RootsMagic Essentials or Ancestral Quest Basics), RootsMagic, Family Tree Maker, Gramps, Geni, WikiTree. Illustrated with our own diagrams. | "Drop the file here" |
| 6 | Ancestor calculator `/tools/ancestor-calculator/` | "how many ancestors do i have" (unmeasured) | Ancestors per generation and year ranges, pedigree collapse explained. With a file: "You know 38% of your 5th-great-grandparents." Shareable image. | "Chart the ones you know" |
| 7 | Family Stories Journal (free printable) `/journal/` | "family history book" 1K, KD 0; "family history book template" 260, KD 0; "questions to ask grandparents" (unmeasured) | A 40-page interview booklet typeset at build time with Paged.js, in 6×9 and Letter. A Thanksgiving activity; feeds the Family Book waitlist. | "Join the Family Book waitlist" |

**Email capture.** Every tool offers an optional newsletter opt-in. The only gated item is the "Holiday Heritage Kit" bundle: all templates, the journal, and reunion activity sheets. Single opt-in is clearly labelled, with one-click unsubscribe.

---

## 6. Pricing and packaging

### Products

All one-time. Lemon Squeezy is the merchant of record, charging 5% + $0.50 per sale.

| Product | Price | Scope | Activations |
|---|---|---|---|
| Free | $0 | Section 4.5 | – |
| **Heirloom** | **$29** | One family: one root person or one couple. All charts, styles and sizes, unlimited re-exports forever. | 3 |
| **Family Historian** | **$59** | Unlimited trees and roots; all current and future chart styles and chart types | 5 |
| **Family Pack** | **$79** | Family Historian rights for up to 3 households. Turns "forward the file to my sister" into a sale. | 9 |
| **Professional** | **$149** | Commercial licence (genealogists, reunion organizers, societies, Etsy sellers); "Prepared by [business]" line; colophon removable | 10 |
| Upgrade Heirloom → Historian | $30 | Checkout link shown only after an Heirloom key validates | – |
| Gift: Heirloom / Gift: Family Historian | $29 / $59 | Same keys; separate variants for reporting and gift receipt wording | as above |
| *v1.5 Family History Book* | *$49* | *$29 for Historian and Pack owners. Target March 2027.* | – |

**Heirloom binding.** On activation the key binds to a fingerprint of the root person or couple (a hash of name and birth year), stored with the local activation record. Changing the root prompts "Upgrade for $30." This is an honor system, accepted as such.

### Checkout and license-key unlock

**Checkout**

- Plain links to LS hosted checkout, opened in a new tab so the chart stays open: `https://gildroot.lemonsqueezy.com/buy/<variant>?checkout[custom][src]=<page>&checkout[custom][cell]=<period>`
- lemon.js is **not** loaded, so no third-party script runs on the studio page.
- The LS receipt page and receipt email show the key. The thank-you note links to `gildroot.com/unlock`.

**Activate**

- `POST https://api.lemonsqueezy.com/v1/licenses/activate` with `{license_key, instance_name:"gildroot-<tier>-<rootHash8>-<deviceId>"}`.
- **Check** `meta.store_id` equals our store and `meta.product_id` is in the allowed list.
- Store `{key, instance_id, variant, validatedAt}` in localStorage and IndexedDB.

**Validate**

- `POST /v1/licenses/validate` with `{license_key, instance_id}` on each paid export when online.
- Offline grace period: 30 days since the last successful validation.
- A refunded or disabled key re-locks the paid exports.
- **CORS re-verified today:** the preflight returned `204` with `access-control-allow-origin: *`.

**Fallback chain if CORS or the API ever breaks**

1. LS's documented proxy `https://api-cors-anywhere.lemonsqueezy.com`.
2. If both fail, accept a well-formed UUID key as "pending verification", unlock, and re-check on later visits. **We never block a paying customer because of our own infrastructure.**
3. Platform fallback if the LS store isn't approved by 9 Oct: Gumroad (also merchant of record) with the same honor-system unlock.

Client-side unlocking can be bypassed through devtools. We accept that; this audience pays.

### Refund policy

- 30 days, no questions. Reply to the receipt or email support@.
- The Support agent refunds through LS and confirms the key is disabled. If LS doesn't disable it automatically, the agent disables it via the license-key API.
- The policy is stated in plain words on the pricing and checkout pages.

### Gift purchase flow

1. `/gift/` offers three paths:
   - **Make it for them:** build it yourself, buy Heirloom, print and frame.
   - **Give a key:** buy Gift Heirloom $29 or Gift Historian $59.
   - **Family Pack** for siblings.
2. After buying a key, `/gift/card/`:
   - Paste the key and enter to/from names and a message. The key is validated, not activated.
   - The page generates a **printable gift card**: a 5×7 folded card whose front carries a small fan in the chosen style, and whose inside holds the message, a QR code and the redeem link.
   - It also generates an e-card link: `/redeem#k=…&to=…&from=…&m=…`. The fragment is never sent to our server.
3. The recipient redeems (flow E).
4. A deadline table on `/gift/` lists same-day printing through 23 Dec and online-printer ship-by dates. Agents verify each printer's holiday dates before publishing.

### Offers (honest and dated; no countdown timers, no fake scarcity)

| Offer | Window | Terms |
|---|---|---|
| **Founding families** | 5 Oct – Sun 8 Nov 2026 | Family Historian $49 (regular $59). The first 200 buyers get a Family Book beta invitation; no price promise. |
| Black Friday / Cyber Monday | 27 Nov – 1 Dec | Family Pack $59 (regular $79). No sitewide discount. |
| Partner codes | Always on | Societies and creators: 15% off |
| Price tests | From 9 Nov | **Sequential two-week price periods** for Heirloom ($29 → $34 → $24), not per-visitor splits. Everyone sees the same price at the same time. Decision metric: revenue per activated user, after at least 150 checkouts per period. |

---

## 7. Website map

| URL | Purpose | Key sections |
|---|---|---|
| `/` | Convert and wow | Hero dropzone over the live Victoria fan; "No file? Build it in 3 minutes"; style strip (6 styles on the sample family); how it works in 3 steps; "On the wall" gallery (owner's real proof photos plus CSS frames); privacy block ("Nothing is uploaded. Try it with wifi off."); pricing preview; FAQ (8 questions); footer with "not affiliated" line |
| `/make/` | The studio | Section 4 |
| `/print-ancestry-tree/` | Ancestry-first landing page | "The beautiful way to print your Ancestry tree"; export steps; sample; CTA |
| `/gift/` | Gift buyers | Three gift paths; Ask-the-family explainer; deadline table; gift card preview |
| `/gift/card/` | Gift card | Key + message → card PDF and e-card link |
| `/redeem/`, `/unlock/`, `/thanks/` | Key handling | Paste or deep-link key; activation states; next steps |
| `/pricing/` | Plans | Tier table; free vs paid; refund policy; licence summary; FAQ |
| `/charts/fan-chart/` · `/charts/bowtie-chart/` · `/charts/pedigree-chart/` · `/charts/atlas-birthplace-map/` | Product and SEO pages per chart type | Examples at 3 sizes; generations-per-size; CTA |
| `/occasions/wedding/` · `/occasions/anniversary/` · `/occasions/family-reunion/` · `/occasions/christmas/` (later `/mothers-day/`, `/fathers-day/`) | Occasion intent | Why this chart for the occasion; example; timing |
| `/print/` | Print planner and guide | Size → generations; same-day stores; online printers; paper; framing; tiled home print how-to |
| `/export/` and 8 platform guides | Getting the file out | Tested steps, diagrams, "stuck?" help |
| `/tools/cousin-calculator/` · `/tools/gedcom-viewer/` · `/tools/ancestor-calculator/` | Free tools | Section 5 |
| `/templates/` and child pages | Blank printables | Previews, direct downloads, CTA |
| `/journal/` | Family Stories Journal and Book waitlist | Download, sample pages, waitlist |
| `/samples/` | Judge print quality before buying | Victoria chart as a PDF per style; photos of the proof prints |
| `/compare/` | Honest comparisons (dated) | vs FamilySearch, MyHeritage, familytreechart.com, FamilyPDF, Family ChartMasters, Etsy |
| `/privacy/` | Trust | How in-browser processing works; network proof; exactly what analytics we collect; CSP |
| `/help/` | Support | FAQ and troubleshooting: strange characters, big files, iPad, which size, unplaced birthplaces |
| `/about/` | Who we are | Owner-led independent studio. **Plain disclosure** that the software and guides are built and run with AI agents under human ownership, and that charts are computed only from the user's data and never invented. |
| `/affiliates/` | Partner programme | Terms, apply link, creator kit, society programme |
| `/guides/` | Evergreen articles | Printing, framing, reunion planning, "bring the tree to Thanksgiving" |
| `/changelog/` | Visible momentum | Weekly entries |
| `/legal/terms/` · `/legal/licence/` · `/legal/refunds/` | Legal | Plain language |

---

## 8. Go-to-market

### Principles

- A real human voice in communities: **the owner's three posts only.**
- Agents run content, email, Pinterest, creators and societies.
- No paid ads in v1.
- Q4 2026 is the learning launch; the plan is built toward Mother's Day and Q4 2027.

### First 30 days

| Dates | Actions |
|---|---|
| 26 Sep – 2 Oct | Swarm builds v1 and passes the QA gate. Owner completes setup (section 10); LS approval runs in parallel. Owner orders the two proof prints. |
| **Mon 5 Oct** | Soft launch: site, studio, free tools. Checkout live, or Gumroad if LS approval is late. Search Console and Bing submitted. First 20 Pinterest pins. |
| 5–12 Oct | Fix anything from real-world files. Publish 8 export guides, 5 templates and the journal. Creator seeding starts (10 emails). |
| **Tue 13 Oct** | Owner posts **Show HN** (morning ET) and **r/Genealogy**, then stays 2 hours to answer. Agents draft replies. |
| **Wed 14 Oct** | Owner posts to **one large general genealogy Facebook group** whose rules allow sharing free tools; the owner reads the rules first. |
| 14–31 Oct | 2–3 SEO pages a week; 30 pins a week; 10 creator and society emails a week; first newsletter (27 Oct); fix the top 5 issues from real files. |
| 31 Oct | **Gate G1** (section 11). |

### Q4 plan

| Window | Theme | Assets |
|---|---|---|
| 5 Oct – 8 Nov | Founding families ($49 Historian) | Launch posts, sample PDFs |
| 9 – 25 Nov | "Bring the tree to Thanksgiving" (Thu 26 Nov) | Ask-the-family link, journal, reunion sheets; email 17 Nov |
| 27 Nov – 1 Dec | Family Pack $59 | Emails 27 Nov and 1 Dec |
| 2 – 16 Dec | "A gift they'll frame" | Online-printer ship-by table; gift card; email 8 Dec |
| 17 – 23 Dec | "Print it today" | Same-day guide (Walgreens, CVS, FedEx Office, Staples); email 17 Dec |
| 24 – 31 Dec | "Give it as a card" | Printable gift card; email 23 Dec |

Release freeze runs 12–27 Dec, hotfixes only. January brings the descendant chart for reunion planning and the Family Book beta.

### Channels, ranked

1. Owner launch posts.
2. Creator and affiliate seeding.
3. Email list.
4. Pinterest: wall-art and gift pins from mid-October. Holiday planners pin early.
5. Society partnerships.
6. SEO (slow and compounding).
7. Directory listings (Cyndi's List).
8. RootsTech 2027 virtual expo (March; decide in January).

### Communities

| Community | Approach |
|---|---|
| r/Genealogy | Owner post, then only genuinely helpful replies from the owner's account |
| r/AncestryDNA | The cousin calculator is the relevant contribution |
| r/UsefulCharts | Victoria chart as original content, with its data source cited |
| Two large general genealogy Facebook groups | Rules confirmed by the owner |
| WikiTree forums, Gramps community | The GEDCOM viewer is the contribution |

No persona accounts and no sockpuppets.

### Launch post drafts (owner edits and posts)

**Show HN:** *"Show HN: Gildroot – print-ready family-tree fan charts from a GEDCOM, entirely in the browser."* Body:

- What it does.
- Nothing is uploaded; it works offline after the first load.
- How we typeset curved names with PDFKit and embedded font subsets.
- Why we avoided svg2pdf.
- The free tier (Letter PDF, 5 generations) and what's paid.
- A request for feedback on the typography.

**r/Genealogy:** *"We made a free, private way to turn your GEDCOM into a printable fan chart. Nothing gets uploaded."*

- Victoria image and a sample-family image.
- Discloses up front that large posters are paid ($29) and everything on screen is free.
- Asks which export problems people hit with Ancestry and FamilySearch.

**Facebook:** the same content, shorter, with the Letter PDF and the cousin calculator links first.

### Affiliate and partner programme

- **LS affiliates:** 30% of first orders, 30-day cookie, auto-approve. LS handles payouts.
- **Creator kit:** a free Professional key, sample files, brand assets, and early access to new styles.
  - Targets: genealogy YouTubers, bloggers and podcasters (Family History Fanatics, Genealogy TV, Amy Johnson Crow, FamilyLocket, Legacy Family Tree Webinars, Genealogy Gems, Extreme Genes).
  - At most 10 personalised emails a week from hello@, at most one follow-up, and no automated sequences.
- **Society fundraising programme:** members get a 15% code, and the society earns 20% through an LS affiliate account in its own name.
  - Targets: state and county genealogical societies with newsletters, NGS, lineage-society chapters.
- **Reunion organizers:** Professional licence plus a free "reunion kit" (blank sheets, Ask link).

---

## 9. Agent operating team

### Roles

| Seat | Owns | Weekly output |
|---|---|---|
| **Operator (lead)** | Plan, priorities, gates, weekly memo to the owner | 1-page memo every Monday: KPIs, 3 priorities, decisions needed |
| **Studio engineer** | Product features, bugs, performance | Tuesday and Thursday release trains |
| **Render QA gatekeeper** | CI gate, corpus, visual diffs, privacy test. **Veto on deploys.** | Gate report per release; new fixtures from support |
| **Style designer** | New styles and seasonal palettes, judge panel | One new style every 2 weeks (Celtic knotwork, Scandinavian folk, Christmas Heirloom…) |
| **Content and SEO** | Guides, tool pages, comparisons, refreshing pages ranked 8–20 in Search Console | 2–3 pages a week |
| **Growth and partnerships** | Email, Pinterest, affiliates, societies, price periods | Pins, outreach batch, experiment readout |
| **Support** | Inbox, FAQ, refunds, key issues | First reply within 24h on weekdays; recurring issues turned into fixtures |
| **Fact-checker** | Verifies every external claim before publication: export steps, printer sizes and deadlines, competitor prices, historical trees | Sign-off on each content PR |

### Weekly cadence

| Day | Activity |
|---|---|
| Mon | Operator pulls KPIs (LS API, Plausible API, Search Console via OpenSEO), writes the memo, sets priorities |
| Tue | Release train 1 (merge → QA gate → deploy) |
| Wed | Content publish day; Pinterest batch; outreach batch |
| Thu | Release train 2; style release every other week |
| Fri | Support review → fixtures; experiment readout; backlog grooming |
| Daily | Support triage; uptime cron (site plus LS license endpoint) |

### KPIs and 90-day targets

| KPI | Target |
|---|---|
| Activation (chart rendered ÷ visitors to home, studio or tool pages) | 20% or more |
| Chart rendered → paid | 3% or more |
| Visitor → paid | 0.6% or more |
| AOV | $40 or more |
| Refund rate | 5% or less |
| Export error rate | Under 1% |
| Support first reply | Under 24h; 90% or more resolved without the owner |
| Email subscribers | 500 by 31 Dec |
| Active affiliates or societies | 5 by 31 Dec |
| Organic clicks | 1,000 a month by 31 Mar |
| LCP | 2.5 s or less |

### Autonomy boundaries

**Green: do it and log it.**

- Ship code that passes the gate.
- Publish content that passes fact-check.
- Ship styles that score 8/10 or higher.
- Answer support and refund on request within 30 days.
- Replace keys.
- Pins: 10 a day or fewer.
- Newsletters to opted-in subscribers: at most 1 a week, 2 a week in Q4.
- Copy tests.
- Price periods within $24–34 for Heirloom.
- Discount codes up to 20%.
- Creator and society outreach within the owner-approved policy (10 a week, personalised, one follow-up).

**Amber: propose; the owner approves by reply. No answer within 72h means no.**

- List-price changes outside the band.
- Any new paid service.
- New chart types outside the roadmap.
- Any change to the privacy model or to what analytics collect.
- Affiliate rate changes.
- Partnerships involving money or logos.
- Anything posted under the owner's identity.
- Press replies.
- Legal page changes.
- Paid ads.

**Red: never.**

- Collect or upload tree data, or add third-party scripts to the studio or tools.
- Fake reviews, testimonials, scarcity or countdowns.
- Persona or sockpuppet accounts; buying followers or links.
- Bulk unsolicited email; scraping personal data.
- Generate or invent ancestors, stories or "AI family history".
- Publish unverified claims about real people.
- Misleading use of competitor trademarks.
- Dark patterns: pre-checked boxes, hidden charges, confirmshaming.

---

## 10. Owner's one-time setup checklist

Roughly 6–8 hours in total, plus Lemon Squeezy's approval wait. Agents supply click-by-click specs for each step.

1. **Domain:** buy gildroot.com, plus gildroot.co as an optional redirect. 10 minutes.
2. **GitHub:** create the `gildroot` repo (archive the bookgen book assets separately). Enable Pages from Actions, set the custom domain, enforce HTTPS.
   - DNS: A records `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`; `www` CNAME → `<user>.github.io`.
   - Require the QA check before merges to main. Give the agent sessions push access.
   - 30 minutes.
3. **Lemon Squeezy:** create the account and store "gildroot"; verify identity and payouts; submit for activation.
   - Create the 9 variants from section 6 with license keys, activation limits and no expiry.
   - Receipt note links to `gildroot.com/unlock`.
   - Affiliates on: 30%, auto-approve, 30-day cookie.
   - Confirm that refunds disable keys.
   - Create an API key and store it as GitHub secret `LS_API_KEY` and in the agent environment.
   - 60–90 minutes.
4. **Fallback:** create a Gumroad account only if LS isn't approved by Fri 9 Oct. 15 minutes.
5. **Plausible:** add the site, create goals (`file_loaded`, `chart_rendered`, `checkout_click`, `unlock_success`, `export_paid`, `export_free`, `ask_link_created`, `template_download`), and create an API key. 10 minutes.
6. **Buttondown:** account, sending-domain DNS records, API key. 15 minutes.
7. **Mail:** set up hello@ and support@ through Cloudflare Email Routing or the registrar, forwarding to a new Gmail inbox. Connect the Gmail connector for agent sessions. 20 minutes.
8. **Search:** verify Search Console and Bing Webmaster by DNS TXT. Connect Search Console to OpenSEO. Top up OpenSEO credits (they ran out today) for agent keyword research. 15 minutes.
9. **Pinterest:** business account, claim the domain, apply for API access, hand the token to agents. If access isn't granted, skip Pinterest. 20 minutes.
10. **Sign off section 9** (autonomy and outreach policy). 10 minutes.
11. **Proof prints:** order two, about $40–60 and 1 hour:
    - a Walgreens 24×36 photo poster of the sample chart in Midnight Gilt
    - a FedEx Office or Staples 24×36 in Ivory

    Photograph both on a wall in daylight and add the photos to `/assets/photos/`.
12. **Launch posts** (section 8): Tue 13 Oct and Wed 14 Oct from your own accounts. Stay about 2 hours each time to reply. About 3 hours total.
13. **Optional:** USPTO knockout search for "Gildroot"; Cyndi's List submission; FamilySearch developer-programme application for v2 direct import.

---

## 11. Financial model

Gross revenue before LS fees. Ranges are low / base / high.

| | Month 1 (Oct 2026) | Month 3 (Dec 2026) | Month 6 (Mar 2027) | Month 12 (Sep 2027) |
|---|---|---|---|---|
| Visitors | 1,000 / 4,000 / 15,000 | 2,000 / 5,000 / 15,000 | 2,000 / 4,000 / 10,000 | 2,500 / 7,000 / 18,000 |
| Activation (chart rendered) | 15% / 18% / 14% | 15% / 20% / 20% | 12% / 18% / 20% | 12% / 18% / 20% |
| Rendered → paid | 2% / 3% / 3.5% | 3% / 4.5% / 5.5% | 2% / 3.5% / 4.5% | 2% / 3.5% / 5% |
| Orders | 3 / 22 / 74 | 9 / 45 / 165 | 5 / 25 / 90 | 6 / 44 / 180 |
| AOV | $38 / $40 / $42 | $38 / $42 / $45 | $38 / $42 / $45 | $40 / $48 / $52 |
| **Gross** | **$110 / $880 / $3,100** | **$340 / $1,900 / $7,400** | **$190 / $1,050 / $4,000** | **$240 / $2,100 / $9,400** |

**Cumulative estimates**

- Q4 2026: low about $0.6K, base about $3.8K, high about $15K.
- First 12 months: low about $2.5K, base about $14K, high about $50K.

These sit between the two red teams' ranges.

**Assumptions**

- Month 1 depends almost entirely on the three owner posts. The high case assumes Show HN reaches the front page, which brings mostly tech visitors and therefore lower activation.
- Month 3 includes gift intent, email, early Pinterest and one or two creator mentions.
- Month 6 falls in the post-holiday trough before Mother's Day, with SEO from 60–80 pages.
- Month 12 adds the Family Book (raising AOV) and matured SEO (150+ pages), ahead of Q4 2027.
- Base product mix: 55% Heirloom, 25% Historian, 10% Pack, 5% Pro, 5% upgrades.

**Unit economics.** Net per $42 order is about $35.8 (about 85%): LS 5% + $0.50, affiliates at 30% on about 15% of orders, refunds about 4%.

**Costs**

- Fixed: about $10–40 a month (domain about $1, Plausible $9, Buttondown $0–29, optional OpenSEO credits).
- Agent compute runs on the owner's Claude plan and is not included here.
- Marginal cost per customer is about $0, because all rendering happens on the customer's machine.

**Gates**

| Gate | Date | Rule |
|---|---|---|
| G1 | 31 Oct | At least 1,500 activations **and** either 25 orders or rendered → paid of 2.5% or more: continue. Activations fine but conversion under 1.5%: fix the paywall and the design, not traffic. Under 500 activations: distribution problem; double creator seeding. |
| G2 | 31 Dec | 100 or more cumulative orders: fund the Family Book v1.5 and the descendant chart. Under 40: reassess (lean into Professional/B2B for genealogists, or run it as a low-maintenance side product). |
| G3 | 31 Jan | Family Book waitlist of 300 or more: ship the Book by 15 April for Mother's Day. |
| Ads | – | Considered only once rendered → paid is 3% or more across at least 2,000 activations, and only with owner approval. |

---

## 12. Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Preview and PDF don't match (curved text, gradients, fonts) | High if built naively / fatal | Single IR, direct PDFKit drawing, the same font bytes, jsPDF/svg2pdf banned, CI text-extraction and visual-diff gate |
| Missing glyphs (Greek, Hebrew, CJK) | Medium / high | EB Garamond coverage, a preflight listing names before payment, romanized-name override, honest limits in the FAQ |
| Sparse trees look weak | High for gift buyers / high | Keepsake layout at 4 or fewer generations, auto depth, trim-empty option, large type |
| Hard to get a GEDCOM (Ancestry desktop-only; no FamilySearch export) | High / high | Tested guides per platform, Quick Builder, Ask-the-family link, the Ancestry landing page |
| Small search demand and a slow new domain | Certain / medium | SEO treated as compounding only; launch through owner posts, creators, societies, email; bottom-funnel keywords at KD 0–12 |
| Launch depends on 3 human posts | High / high | Posts drafted and scheduled with the owner as a one-time task; creator seeding as the backstop |
| Free substitutes (FamilySearch, MyHeritage, FamilyPDF $19.99) | Certain / medium | Visible design gap, generous free Letter PDF, poster sizes and bowtie as the paid line, honest comparison pages, a $24 price period |
| Forwarded files eat sales | Medium / medium | $79 Family Pack, activation limits, the "make one for your side" CTA sells rather than gives away |
| Seasonality | Certain / medium | Plan around Mother's Day, Father's Day, reunions and weddings; Family Book; Professional tier |
| iOS canvas limits break JPEG export | High if ignored / medium | 16.7 MP cap, honest dpi labels, PDF as the primary export |
| Wrong "same-day" or printer claims | Medium / medium | Fact-checker verifies each print claim; no Costco claims |
| LS store approval delay or platform change | Medium / high | Gumroad fallback, LS CORS proxy, honor-system unlock that never blocks payers |
| Honor-system bypass | Certain / low | Accepted; this audience pays |
| Name or trademark conflict | Low / medium | "Stemma" already dropped; owner runs the USPTO knockout search before filing |
| Backlash against AI-run businesses | Medium / medium | Honest disclosure on `/about/`; never generate family content; human-quality craft; no persona accounts |
| Errors about real people (Victoria demo) | Low / medium | Only one famous tree in v1, fully fact-checked, sources cited on the page |
| Support load from an older audience | High / medium | Large type, plain words, FAQ from real tickets, parser fixtures |
| Paged.js is frozen (0.4.3, 2023) | Certain / low for v1 | Used at build time only, pinned and vendored; red-team CSS fixes applied; the v1.5 Book gets its own QA gate |
| Wedge copied (Ancestry or MyHeritage improve charts) | Medium / high | Speed of style releases, bowtie and Atlas craft, the gift flow, privacy; keep costs near zero so a small niche stays profitable |

---

### Sources checked 2026-09-25

- Name collisions: [mystemma.com](https://www.mystemma.com/) · [Stemma Board (App Store)](https://apps.apple.com/il/app/stemma-board-family-tree/id6792719817) · [ADZirid/STEMMA](https://github.com/ADZirid/STEMMA) · [lucafluri/stemma](https://github.com/lucafluri/stemma) · [StemmaFiles](https://stemmafiles.com/) · [KinFolio](https://www.kinfolio.app/) · [Gildroot search result (game item)](https://genfanad.fandom.com/wiki/Gildroot) · [GildRoot table](https://www.furniturejunqtion.com/product/gildroot-brass-tree-base-round-table/)
- Competitors: [FamilyPDF](https://www.familypdf.com/) · [familytreechart.com](https://familytreechart.com/)
- Printing: [Costco photo centers closed (KIRO 7)](https://www.kiro7.com/news/trending/costco-closing-photo-centers-all-warehouses/4HGXKZLGGFHCVJFFB46MV4P3HU/) · [Walgreens same-day posters](https://photo.walgreens.com/store/poster-details)
- Checkout: [Lemon Squeezy License API](https://docs.lemonsqueezy.com/api/license-api/validate-license-key). The CORS preflight was re-tested today and returned 204 with `access-control-allow-origin: *`.
- Library versions checked against the npm registry and jsDelivr today.
- All market, keyword and CPC figures come from the red-team evidence in the task, from OpenSEO/DataForSEO pulls dated 2026-09-25.

Reference files in this repo:

- `web/src/samples/victoria.ged`
- `tools/showcase/fan-spike-reference.html`
- `company/reference/fan-spike-victoria.png`
- `company/reference/pdfkit-fan-spike.html`
- `company/reference/read-gedcom-ansel-proof.cjs`
- `web/src/assets/fonts/*.ttf`