# Gildroot architecture (frozen contract v1)

This file is the contract between workstreams. Change it only with a note in `docs/DECISIONS.md`.
Product and brand intent live in `company/BRIEF.md`; this file says how the code is shaped.

## Principles

1. **Nothing leaves the browser.** Tree data is parsed, laid out and exported on the visitor's machine. No runtime CDN calls: every library is vendored in `web/src/vendor/`, every font in `web/src/assets/fonts/`.
2. **One scene, many renderers.** Layout produces a resolution-independent *Scene* (points, 1/72 in). The canvas preview, the PDF, tiles, JPEG and share images all draw the same Scene. Text is measured with the same font bytes that are embedded in the PDF, so screen and paper match.
3. **No build step for the app.** Native ES modules, loaded as-is. The site pages go through the tiny builder `web/build.mjs` (partials + front matter only).
4. **Plain words, real data.** No lorem ipsum, no invented ancestors, no fake testimonials.

## Layout of the repo

```
company/            brief, decision log, reference spikes
docs/               this file, DECISIONS.md, runbooks
ops/                agent operating team: playbooks, KPIs, calendars
tools/              data pipelines (Wikidata showcase), QA scripts
web/
  build.mjs         site builder (node web/build.mjs [--serve])
  src/
    _data/site.json site config (checkout variant URLs, prices, analytics, newsletter)
    _layouts/       base.html (+ others)
    _partials/      header.html, footer.html, head-meta.html, ...
    assets/
      css/          site.css (design system), studio.css
      fonts/        static TTF (+ WOFF2 for the site) — see "Fonts"
      img/          logo, favicons, og images, photos
    vendor/         pinned third-party code (see "Vendored libraries")
    app/            product code (ES modules, no DOM in engine/)
      engine/       parsing + family model (pure JS, runs in Node for tests)
      charts/       layout -> Scene, styles, renderers, export
      commerce/     license + checkout helpers
      ui/           shared UI helpers used by /make/ and tools
    make/           the studio page (index.html + studio.js)
    tools/          free tools (cousin calculator, GEDCOM viewer, ancestor calculator)
    samples/        victoria.ged (CC0 Wikidata), almeida-novak.ged (fictional sample)
    ...pages...
  test/             node:test unit tests (engine) + Playwright specs (charts, pages)
```

## Vendored libraries (pinned, in `web/src/vendor/`)

| File | Library | Use |
|---|---|---|
| `pdfkit.standalone.js` | PDFKit 0.20.2 (MIT) | Global `PDFDocument`. PDF writing, font embedding, **all text measurement** (bundled fontkit). Lazy-load: only when the studio needs layout or export. |
| `preact-htm.module.js` | htm 3.1.1 preact/standalone (MIT/Apache) | `import { html, render, useState, ... } from '/vendor/preact-htm.module.js'`. The only UI framework. |
| `lz-string.min.js` | lz-string 1.5.0 (MIT) | Global `LZString`. Ask-the-family links, gift/redeem fragments. |
| `fflate.module.js` | fflate 0.8.2 (MIT) | `.zip` / `.gdz` input. |
| `idb-keyval.module.js` | idb-keyval 6.2.1 (Apache-2.0) | Autosave projects. |
| `qrcode.js` | qrcode-generator 1.4.4 (MIT) | Global `qrcode`. Gift card QR. |
| `paged.polyfill.min.js` | Paged.js 0.4.3 (MIT) | Build-time printables only. Never on product pages. |

Banned: jsPDF, svg2pdf.js, any runtime CDN, variable fonts in export paths, SVG filters/gradients in exportable layers, third-party scripts on `/make/` and `/tools/` other than the Lemon Squeezy license API (fetch) and Plausible.

## Fonts

Static TTFs in `web/src/assets/fonts/` (OFL). Font keys used everywhere in code:

| Key | File | Role |
|---|---|---|
| `ebg-400` | `EBGaramond-400.ttf` | Names, dates (Latin Ext, Greek, Cyrillic, Vietnamese) |
| `ebg-400i` | `EBGaramond-400i.ttf` | Places, dedications |
| `ebg-600` | `EBGaramond-600.ttf` | Root name, inner-ring names |
| `cg-500` | `CormorantGaramond-500.ttf` | Titles (no Greek: fall back to `ebg-*`) |
| `cg-500i` | `CormorantGaramond-500i.ttf` | Title italics |
| `cg-600` | `CormorantGaramond-600.ttf` | Title emphasis |
| `sans-400`, `sans-600` | chosen by the design panel (must cover Latin Ext + Greek + Cyrillic) | Nordic style, UI labels on charts |

`web/src/app/charts/fonts.js` owns the registry: it fetches each TTF once as an `ArrayBuffer`, registers the same bytes with `new FontFace()` (for canvas) and with PDFKit (`doc.registerFont(key, bytes)`), and exposes:

```js
await loadFonts(keys)                      // idempotent
measure(fontKey, sizePt, str) -> widthPt   // via fontkit (PDFKit), kerning on, ligatures off for names
metrics(fontKey) -> { ascender, descender, capHeight, xHeight, unitsPerEm } // in em units (divide by unitsPerEm)
hasGlyphs(fontKey, str) -> { ok: boolean, missing: string[] }
fontFaceName(fontKey) -> CSS family name used on canvas (e.g. "gr-ebg-400")
```

In Node tests, `measure` is backed by the npm `pdfkit@0.20.2` package (devDependency in `web/package.json`), same metrics.

## Engine (`web/src/app/engine/`) — pure JS, no DOM

### Data model

```js
/** @typedef {{ raw: string, year?: number, month?: number, day?: number,
 *   qualifier: ''|'ABT'|'CAL'|'EST'|'BEF'|'AFT'|'BET'|'FROM'|'TO'|'INT',
 *   year2?: number, dual?: string, sortKey: number|null, display: string }} GDate
 *   display examples: "24 May 1819", "c. 1843", "before 1790", "1731/32", "1790–1795"
 * @typedef {{ date: GDate|null, place: string, country: string|null }} GEvent
 * @typedef {{ id: string, given: string, surname: string, name: string, suffix: string,
 *   sex: 'M'|'F'|'U', birth: GEvent|null, death: GEvent|null, living: boolean,
 *   famc: {fam: string, pedi: 'birth'|'adopted'|'foster'|'step'|'unknown'}[], fams: string[] }} Person
 * @typedef {{ id: string, partners: string[], children: string[], marriage: GEvent|null }} Family
 *   partners: HUSB then WIFE when present (same-sex and single-parent families supported)
 * @typedef {{ people: Record<string, Person>, families: Record<string, Family>,
 *   meta: { source: string, version: string, charset: string, count: number, homeId: string|null, warnings: string[] } }} Tree
 */
```

A Tree is plain JSON (it crosses the Web Worker boundary with `postMessage`).

### Modules and functions

| Module | Exports |
|---|---|
| `decode.js` | `decodeBytes(u8: Uint8Array) -> { text, charset }` — BOM sniff, UTF-16LE/BE, UTF-8, `1 CHAR` header (ANSEL, ANSI/CP1252, IBMPC/CP850, MACINTOSH), result NFC-normalised |
| `ansel.js` | `decodeAnsel(u8) -> string` (combining diacritics precede base letter in ANSEL; output composed NFC) |
| `gedcom.js` | `parseGedcom(input: string|ArrayBuffer|Uint8Array) -> Tree` (5.5, 5.5.1, 7.0; CONC/CONT; `_HOME`/`HEAD` hints; tolerant of vendor tags and junk lines; warnings, never throws on bad data) |
| `zip.js` | `extractGedcom(u8) -> Uint8Array` for `.zip`/`.gdz` (fflate) |
| `dates.js` | `parseDate(raw) -> GDate`, `formatYearRange(birth, death) -> "1819–1901"` |
| `places.js` | `resolveCountry(place) -> { country: string|null, region: string|null, ambiguous: boolean }`, `ALIASES` (≈600 entries: English + native country names, historical states, US states + abbreviations, Canadian provinces, UK nations, Irish counties) |
| `living.js` | `isLiving(person, nowYear) -> boolean` (no death event and born < 100 years ago, or no dates but has living-looking descendants/partners), `displayFor(person, mode) -> {name, dates, place}` with mode `'hide-dates'|'living-only'|'show-all'` |
| `names.js` | `nameLadder(person) -> string[]` from full to shortest: "Johann Georg Friedrich Weber" → "Johann Georg F. Weber" → "Johann G. Weber" → "J. G. Weber" → "Weber" → "J. G. W." (never hyphenate) |
| `tree.js` | `ancestors(tree, rootId, gens, {adoptive?}) -> Map<ahnen:number, personId>`, `collapse(ahnenMap) -> Map<personId, ahnen[]>` (pedigree collapse), `parentsOf(tree, id, {adoptive?}) -> {father, mother}` (for same-sex parents: first partner = left/"paternal side", second = right), `searchPeople(tree, q, limit)`, `suggestRoot(tree)`, `stats(tree)`, `relationship(tree, aId, bId)` (for the cousin calculator), `applyOverrides(tree, overrides)` |
| `builder.js` | Quick Builder: `treeFromSlots(slots) -> Tree` (≤15 slots: self, parents, grandparents, great-grandparents), `encodeAsk(slots) / decodeAsk(fragment)` (lz-string, URL-fragment safe), `mergeSlots(a, b) -> {merged, conflicts}` |
| `worker.js` | Web Worker entry: `onmessage({type:'parse', buffer, name})` → `postMessage({type:'tree', tree})` or `{type:'error', message}` |

Ahnentafel numbering: 1 = root, 2n = father (first parent), 2n+1 = mother (second parent). Generation g holds numbers 2^(g-1) … 2^g − 1.

## Charts (`web/src/app/charts/`)

### Scene IR (frozen)

```js
/** Units: points. Origin top-left. Angles in degrees, clockwise. Colors: '#rrggbb'.
 * @typedef {{ t: 'path', d: string, fill?: string, stroke?: string, sw?: number, opacity?: number, cap?: 'butt'|'round', join?: 'miter'|'round' }} PathItem
 *   d uses SVG path syntax limited to M L H V C Q A Z (absolute or relative). Both Path2D and PDFKit doc.path() accept it.
 * @typedef {{ t: 'text', x: number, y: number, rot?: number, str: string, font: string, size: number, color: string,
 *   tracking?: number, anchor?: 'start'|'middle'|'end', baseline?: 'alphabetic'|'middle', opacity?: number }} TextItem
 *   (x,y) is the anchor point on the baseline (or vertical middle); rotation is about (x,y). tracking = extra pt between glyphs.
 * @typedef {{ t: 'glyphs', font: string, size: number, color: string, g: { ch: string, x: number, y: number, rot: number }[], opacity?: number }} GlyphsItem
 *   Each glyph drawn with its baseline-left origin at (x,y), rotated rot degrees about that origin. Used for text on arcs.
 * @typedef {{ t: 'image', x: number, y: number, w: number, h: number, src: string, opacity?: number }} ImageItem
 *   Raster textures only (paper grain). src is a URL under /assets/.
 * @typedef {{ t: 'group', clip?: string, items: Item[], opacity?: number }} GroupItem
 * @typedef {PathItem|TextItem|GlyphsItem|ImageItem|GroupItem} Item
 * @typedef {{ personId: string, ahnen?: number, side?: 'a'|'b', shape: 'sector', cx: number, cy: number, r0: number, r1: number, a0: number, a1: number }
 *         | { personId: string, ahnen?: number, side?: 'a'|'b', shape: 'rect', x: number, y: number, w: number, h: number }} Hit
 *   Sector angles in degrees, 0 = up (12 o'clock), clockwise, a0 < a1.
 * @typedef {{ wPt: number, hPt: number, bg: string, items: Item[], hits: Hit[],
 *   meta: { chart: string, style: string, colorMode: string, generations: number, fonts: string[],
 *           counts: { slots: number, placed: number, abbreviated: number, missing: number },
 *           warnings: string[], legend?: { label: string, color: string, count: number }[],
 *           title: string, subtitle: string } }} Scene
 */
```

### Layout entry point

```js
// charts/layout.js
layout(opts) -> Scene
opts = {
  tree, chart: 'fan'|'bowtie'|'pedigree',
  rootId,                     // fan, pedigree
  coupleIds: [aId, bId],      // bowtie
  sweep: 180|270|360,         // fan only
  generations,                // capped by SIZE_LIMITS[size][chart]
  size: 'letter'|'a4'|'11x14'|'16x20'|'18x24'|'a2'|'20x30'|'24x36'|'a1',
  orientation: 'portrait'|'landscape'|'auto',
  style: 'ivory'|'midnight'|'botanical'|'letterpress'|'nordic'|'cartographer',
  colorMode: 'tones'|'lines'|'atlas',
  privacy: 'hide-dates'|'living-only'|'show-all',
  title, subtitle, dedication, // strings; '' means auto
  showPlaces: boolean, trimEmpty: boolean, bleed: boolean,
  colophon: boolean,           // "Made with Gildroot · gildroot.com" line on free exports
  marriage: { date, place },   // bowtie centre medallion
  placeOverrides: { [placeString]: country }, // Atlas manual assignments
  overrides: { [personId]: { name?, birth?, death?, place?, hidden?: boolean } },
  measure, metrics, hasGlyphs  // injected from fonts.js (lets Node tests run)
}
```

Modules: `layout.js` (dispatch, sizes, margins, title block, colophon), `layout-fan.js`, `layout-bowtie.js` (two 180° half-fans facing out from a centre medallion), `layout-pedigree.js`, `text.js` (fitting, arc glyph placement, abbreviation ladder application, min 6pt / floor 5.5pt), `styles.js` (6 style token sets × 3 colour modes), `ornaments.js` (single-colour SVG path data), `atlas.js` (country → colour, legend, coverage), `sizes.js` (paper sizes in pt, `SIZE_LIMITS`, margins ≥ 6% of short edge).

### Renderers and export

| Module | Exports |
|---|---|
| `render-canvas.js` | `drawScene(ctx2d, scene, { scale, dpr, highlightPersonIds? })`; `hitTest(scene, xPt, yPt) -> Hit|null` |
| `render-pdf.js` | `sceneToPdf(scene, { bleedPt?, cropMarks? }) -> Promise<Uint8Array>` via PDFKit; fonts embedded as subsets |
| `tiles.js` | `sceneToTiles(scene, { sheet: 'letter'|'a4', overlapIn: 0.25 }) -> Promise<Uint8Array>` multi-page PDF, crop marks, tile labels, page-1 assembly map |
| `raster.js` | `sceneToJpeg(scene, { dpi, maxMegapixels })` (iOS cap 16.7 MP), `shareImage(scene, { mark: true }) -> Blob` 1080×1350 PNG |
| `export.js` | UI-facing wrappers that trigger downloads with good filenames ("gildroot-ancestors-of-margaret-kowalski-24x36.pdf") |

## Commerce (`web/src/app/commerce/`)

`license.js`: `activate(key)`, `validate()`, `status() -> { tier: 'free'|'heirloom'|'historian'|'pack'|'pro', key?, rootHash? , validatedAt? }`, `checkoutUrl(product, { src })`. Lemon Squeezy License API (`https://api.lemonsqueezy.com/v1/licenses/activate|validate`, CORS verified 2026-09-25) with `meta.store_id` / `meta.product_id` checks from `site.json`. Offline grace 30 days. If the API is unreachable, a well-formed key unlocks as "pending verification" (never block a paying customer). Stored in localStorage under `gildroot.license`.

## Studio (`web/src/make/`)

Preact + htm. State shape is owned by the studio workstream; it calls only the public functions above. Parsing runs in `engine/worker.js`. Layout runs on the main thread (fast) and re-renders the canvas on option changes (budget: < 150 ms for an 8-generation fan).

## Testing

- `node --test web/test/engine/` — parser, decoding, dates, places, living, names, tree, builder.
- `node web/test/charts/run.mjs` — Playwright: renders every chart × style × colour mode on the sample corpus, exports PDFs, checks with PyMuPDF (`tools/qa/pdfcheck.py`): MediaBox, fonts embedded, no Type 3, every displayed name extractable, no text below 5.5 pt.
- `.harness/shoot.mjs <url> <prefix> [--full]` — screenshots at 1440 and 390 wide for design review.

## Conventions

- ES2022 modules, 2-space indent, semicolons, single quotes, JSDoc on exported functions.
- No DOM access in `engine/`. No network access anywhere except `commerce/license.js` and analytics.
- Every user-visible string follows the voice rules in `company/BRIEF.md` §2.
- Accessibility: WCAG AA contrast, keyboard operable, visible focus, 44 px touch targets, `prefers-reduced-motion` respected.
