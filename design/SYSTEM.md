# Gildroot design system

This is the one house style for the site and the studio. It lives in a single file,
`web/src/assets/css/site.css`, built from `web/src/_layouts/base.html` and
`web/src/_partials/{head-meta,header,footer}.html`. Read `company/BRIEF.md` §2 (brand),
§3 (customer) and §7 (site map) before changing any of it, and read
`docs/DECISIONS.md` for how this system was chosen.

If you are about to build a new page: start from `web/src/index.html` as the reference
implementation. Almost everything you need already exists as a class below. Do not
invent a second way to make a button, a price list or a plate.

## Why "Broadside, gilded"

Four full homepage directions were built and screenshot-judged by three LLM judges:
**broadside** (26/30), **gilt-night** (25.3/30), **registry** (23.9/30), **atlas**
(20.9/30) — a near-tie where each judge picked a different winner. This system uses
**broadside** as the structural and typographic base (it won on distinctiveness,
conversion clarity, and legibility for 50–75-year-old readers, and it kept the primary
button above the fold on phone), and grafts in the specific strengths every judge asked
for:

- **From gilt-night:** the gallery wall of framed prints; the register line under the
  hero specimen (Ahnentafel number, relationship, line of descent), keyboard- and
  touch-accessible with `aria-live`; the oxblood/red gift room; a light "reading room"
  content theme so the whole site isn't dark.
- **From atlas:** the plain-word generation ladder in the fan's open wedge; the
  "This computer" privacy boundary diagram; the Quick Builder mock in the gift section;
  the 7-hue Atlas palette adopted as the data/studio color system.
- **From registry:** the pricing comparison table with real row labels (Families,
  Households, Devices, Charts, Re-exports); the GEDCOM-record-becomes-entry demo in
  step 1; the "0 bytes of your file uploaded" trust numeral.
- **Broadside's own flaws, fixed here:** no gold anywhere on a brand called "gild" →
  fixed with a real gold-leaf plate (see Colour, below), used once, never as text on a
  light background. UK spellings → US English throughout. Three CTAs (violates voice
  rule 10) → one filled primary button per page, everything else is a quiet text link.
  The hero fan cut the CTA off the fold at 1440×900 and on phone → the hero was
  re-spaced and the display type scale brought down until the button clears both
  1440×900 and 390×844 (this is enforced; see "The fold rule" below). A tone that
  "shouts" → the huge Didone display is now used only for the hero H1, section H2s and
  the sign-off; everything else is text or serif copy.

## Tokens

Everything is a CSS custom property on `:root`, in `site.css` §2. Components read only
the **semantic** ones (`--bg`, `--fg`, `--accent`, `--cta-bg`, …); the raw palette
(`--vermilion`, `--midnight`, `--leaf`, …) exists so a `.plate` can remap the semantic
set locally. Never hardcode a hex value in a component rule.

### Colour

| Role | Light default ("reading room") | On `.plate--midnight` | On `.plate--red` |
|---|---|---|---|
| `--bg` / `--fg` | bright white / press black | midnight `#0B1024` / vellum `#F1ECE2` | vermilion plate / white |
| `--accent` (rubrication: prices, italics, numerals) | vermilion `#D8341C` | **leaf gold** `#E6C98A` | white |
| `--cta-bg` (the one filled button) | vermilion | leaf gold, ink text | white, vermilion text |
| `--line` / `--line-soft` | press black / blind `#D8D4CE` | gilt `#C9A45C` / low-opacity gilt | white / translucent white |

**The fold rule, made explicit.** Light is the fixed default for every page, whatever
the reader's OS theme is. It does **not** flip dark on `prefers-color-scheme: dark` —
that caused the whole homepage to invert in an earlier draft, which is exactly what the
graft ("a light reading-room theme for content pages, midnight reserved for
hero/gallery/gift") says not to do. Midnight and red only ever appear inside an explicit
`.plate--midnight` / `.plate--red` section. `:root[data-theme="dark"]` still exists for
a possible future opt-in toggle; nothing wires it up today.

**Gold is a plate ink, never body text on white.** The only places gold appears:
`.plate--midnight` (the hero specimen, the privacy band, a Midnight Gilt print), and as
`--accent` inside that plate. If you catch yourself writing gold text on the white
background, stop — that is broadside's flaw come back.

**Atlas: the product's color-by-birthplace system, adopted as the data palette.**
Seven hues plus Stone for "other" (site.css §"Atlas", `--atlas-1` … `--atlas-7`,
`--atlas-other`): Gilt `#9C7A22`, Lake `#2F6DAA`, Madder `#B5443A`, Verdigris `#00897B`,
Sienna `#C4691C`, Heather `#7050A8`, Moss `#5A8A33`, Stone `#85837A`. Use these, in
this order (most common birthplace gets slot 1), anywhere the site shows real
by-birthplace or by-category data — the homepage's "Where they were born" bar, and
later the studio's Atlas legend and the `/charts/atlas-birthplace-map/` page. Don't
invent a second categorical palette.

### Type

Self-hosted, static (never variable) woff2/ttf in `web/src/assets/fonts/`. Never add a
runtime font CDN call — that is a privacy red line (CLAUDE.md §Non-negotiables).

| Role | Stack | Used for |
|---|---|---|
| `--font-display` | Noto Serif Display XCn 900, w/ SCn italic | Hero H1, section H2s, the sign-off. **Nowhere else.** |
| `--font-serif` | Source Serif 4 400/400i/600 | Body copy, register, FAQ answers |
| `--font-sans` | house Sans 400/600 | Nav, buttons, labels, captions, tables |
| Chart faces (inside product output only) | EB Garamond, Cormorant Garamond | Never used in site chrome — they are the product's own type, kept separate so the site doesn't look like a chart |

Scale: `--text-sm` (16px floor) up to `--text-hero` (homepage H1 only, now
`clamp(3.25rem, 1.5rem + 5.8vw, 7rem)` — capped at 112px, not 140px, specifically so the
hero button clears the fold; see `docs/DECISIONS.md`). Body is 18–20px
(`--text-md`), measure is capped at 65ch (`--measure`).

### Space, rules, motion

4px base scale, `--space-3xs` (4px) to `--space-3xl` (96px), plus `--section` (a
responsive clamp for section padding) and `--gutter`. Rules come in exactly three
weights: `--rule-heavy` (8px, running heads, footer), `--rule-box` (3px, boxes,
tables, tariffs), `--rule-hair` (1px). Corners are square (`--radius: 0`); the only
round things are dots and registration targets. Motion durations are `--dur-fast`
(150ms), `--dur` (250ms), `--dur-slow` (800ms); everything respects
`prefers-reduced-motion` (site.css §22 zeroes every animation/transition).

## Layout primitives

- `.container` / `.container--narrow` — max-width wrapper with responsive gutters.
- `.section` / `.section--tight` — vertical rhythm; `.section + .section` collapses the
  double gap. Plates (`.privacy`, `.gift`, `.migrate`) pad themselves — don't also wrap
  them in `.section`.
- `.stack` (+ `--s`/`--l` modifiers), `.cluster` — flex primitives for vertical/
  horizontal rhythm.
- `.grid` (auto-fit cards), `.split` / `.split--even` (12-col at ≥900px).

## Components (with the exact class names to reuse)

**Header/footer** — `_partials/header.html` and `_partials/footer.html`. The header is
two bars: `.utility-bar` (price + privacy line, visible at both 1440 and 390 within the
first paint — this is how "price visible in 5 seconds" is satisfied) and
`.site-header` (`.brand` + `.nav` ≥960px, `.nav-menu` `<details>` below that). **At
most one filled button in the header, if any** — today there are none; every nav item
is a plain `.nav__link` text link, including "Make a chart" (demoted from a button per
the gilt-night graft).

**Buttons** — `.btn--primary` (filled, the *one* per page), `.btn--secondary` (outline),
`.btn--quiet` / `.link-arrow` (text, for every secondary action). **Voice rule 10: one
filled primary per page, never more than two prominent actions.** The homepage has
exactly one `.btn--primary` (the hero "Choose a file") and one `.btn--secondary` ("See
full pricing"); everything else is a `.link-arrow`.

```html
<a href="/make/" class="btn btn--primary btn--block-phone">Choose a file</a>
<a href="/pricing/" class="btn btn--secondary">See full pricing and the refund policy</a>
<a href="/gift/" class="link-arrow">See deadlines for printing before a holiday</a>
```

**Forms** — `.field`, `.label`, `.input`/`.select`/`.textarea`, `.check`, `.subscribe`.
56px minimum touch target everywhere.

**Notices** — `.notice--info/ok/warn/error`, always a rule + a plain sentence, never
color alone.

**Drop zone** — `.dropzone` (`__head`, `__icon`, `__title`, `__text`, `__status`). It is
a real drag target (see the inline script at the bottom of `index.html`): it
`preventDefault`s drag-over so a dropped file never just opens in the tab, and forwards
to `/make/`. It does not parse anything itself — say only what actually happens
(BRIEF voice rule 2).

**Plates** — `.plate--midnight`, `.plate--red`. Remap the semantic tokens locally; at
most one midnight and one red plate per page (broadside's own rule). Combine with the
section's own class, e.g. `<section class="plate plate--midnight privacy">`.

**Tariff / price card / comparison table** — `.tariff` (dotted-leader price list,
broadside's graft), `.price-card` (a single plan), `.compare` (registry's graft: real
row labels — Families, Households, Devices, Charts, Re-exports — columns are the
plans; stacks to cards on phone via `td[data-label]`, and `caption` must be included in
the mobile `display:block` rule or it collapses to a single narrow column — see
`docs/DECISIONS.md`).

**FAQ** — `.faq` / `<details><summary>`. Real questions only (BRIEF: no lorem ipsum, no
invented statistics). The homepage's four are the ones every judge asked for: export
steps, "is anything uploaded", sparse trees, and script/glyph limits stated *before*
payment (voice rule 9).

**Steps / menu paths / GEDCOM demo** — `.steps` (numbered sequences only, for real
processes), `.menu-path` (breadcrumb-style click paths, e.g. Ancestry → Trees → Tree
Settings → Export tree), `.galley` + `.becomes` + `.entry` (a real GEDCOM excerpt
turning into a register entry — always real data, run through the actual engine or
Ahnentafel maths, never hand-typed). `.galley` wraps long lines (`white-space: pre-wrap`)
rather than scrolling them — an earlier `pre`/`overflow-x: auto` version silently
truncated a long `PLAC` line on phone with no scroll affordance; don't reintroduce
horizontal scroll on a code sample meant to prove "we read your data faithfully."

**Figures, frames, museum labels** — `.frame--oak/walnut/black/ash/thin` (CSS-drawn
frame finishes, no stock photography), `.museum-label` (`__title`, `__meta` in the
exact style `Fan · 6 generations · 18×24`), `.wall` (the gallery, two ledges of three).
Every print on the homepage wall is rendered from `web/src/samples/victoria.ged` by
`design/og/render.mjs` — never a placeholder or a hand-drawn mockup.

**Badges, facts, panels, code** — `.badge--red/solid/muted`, `.dot` (a numbered pin),
`.facts` (dt/dd key-value rows), `.panel` (tool side-panels, free tools), `code`/`pre`/
`kbd` for anything monospace.

**The hero specimen pattern** (`.hero-chart`, `.hero-chart__trace`, `.ladder`,
`.ladder--list`, `.register`, `.fan-key`) — a static raster chart image with an inline
SVG hit-test overlay computed from the same Ahnentafel geometry the product uses
(`radii`, `span: 270`, `P(r, a) = [r·sin a, −r·cos a]`, clockwise from 12 o'clock). The
overlay is built and wired up by the inline script at the end of `index.html`, from a
`<script type="application/json" id="hero-data">` blob that must be the **exact** output
of `design/og/render.mjs hero` (`design/og/out/hero-data.json`'s `data` array) — never
hand-typed or paraphrased; see the "no invented ancestors" note in `docs/DECISIONS.md`.
Pedigree-collapse dots are computed from `data[n][3]` at render time, not hardcoded.
Keyboard: focus the chart, then ↑/↓ move toward the root/outward, ←/→ move to a sibling
in the same generation; the register is `aria-live="polite"`. Reuse this pattern
wherever the studio needs a "point at a name, see who it is" panel.

**Migration plate** (`.migrate`, `.migrate__bar`, `.migrate__legend`) — a real,
build-time-computed fact ("Of her 116 ancestors, 109 have a known birthplace and 97
were born in what is now Germany" — computed straight from `victoria.ged` with the
*production* engine (`web/src/app/engine/tree.js`'s `ancestors()`/`collapse()` plus each
person's `birth.country`, resolved by `resolveCountry`), not a hand-typed figure and not
the separate `design/og/` render-workshop's own count; see `docs/DECISIONS.md`'s
"117 vs. 126 vs. 116" entry for how the earlier 126/119/105 figure got this wrong),
plus a simple stacked bar in Atlas colors. Never invent or round a fact like this by
hand — recompute it.

**Privacy boundary + trust numeral** (`.boundary`, `.zero`) — an inline SVG "This
computer" diagram (file → chart → export, all inside a dashed boundary; a one-way
arrow in from `gildroot.com` labeled "the page, once", a blocked arrow back out
labeled "your tree — never") paired with the "0 bytes of your file uploaded" numeral.
**The SVG's `<text>` is sized in SVG units, so it scales down with the viewBox and falls
under the 16px floor on phone** (measured: ~7px actual at 390px width). Below
`max-width: 719px` the SVG is hidden and a second markup block, `.boundary__stack`,
takes over — the same three boxes and two arrows in ordinary HTML at real rem sizes.
`.boundary__stack` is `aria-hidden="true"`; the figure's `<figcaption>` (always visible,
never hidden) is the one accessible description at every width, so keep it in sync with
`.boundary__stack`'s content if either changes, rather than duplicating an SVG
`aria-label` a second time.

**Gift keepsake** (`.keepsake`, `.card-spread`, `.builder-mock`) — a printable gift
card mock next to a Quick Builder mock, deliberately collaged (rotated, offset
shadows). **If you change the message copy or the builder's sample data, re-check that
`.card-spread__sign` / `.card-spread__redeem` still clear `.builder-mock`** — they are
positioned independently (one by flex flow, the other by a `margin-top` percentage of
its own width) and will silently overlap again if either grows. Verify with a
bounding-box check, not by eye:

```js
// both must be true
redeem.y + redeem.height < builderMock.y      // desktop (≥600px)
```

**Sign-off** — `.sign-off`, the huge Didone one more time: "Your roots, *gilded.*" —
the only other place the display face appears besides the hero H1 and section H2s.

## Voice (BRIEF §2, condensed)

Plain, warm, exact. Numbers, not adjectives. No exclamation marks, no emoji, no
"AI-powered"/"unlock your legacy". Sentence case, US English (colour → **color**,
centre → **center** — this was flagged by two of three judges). State a limit before
payment, not after. Say exactly what happens to data ("read on this computer; nothing
is uploaded"), every time privacy comes up. Never claim uniqueness you can't prove.

## Do / Don't

| Do | Don't |
|---|---|
| One filled `.btn--primary` per page | A second filled button "for balance" |
| Gold only inside `.plate--midnight` | Gold text on the white ground |
| Real data — computed, cited, or clearly labelled fictional | A stat, name or date you made up |
| `prefers-reduced-motion` respected everywhere | An animation with no reduced-motion fallback |
| Square corners, hairline rules | Rounded cards, drop shadows on flat sections |
| One accent color doing the CTA work | Rainbow accents, one per section |
| Menu paths and version-stamped claims | An unverified "Ancestry's menu is at X" |

## Accessibility

`:focus-visible` gets a 3px outline everywhere (gold on `.plate--midnight`). Buttons
are ≥56px tall (44px minimum for `.btn--quiet`). The hero chart is a
`role="group"`/`tabindex="0"` container with arrow-key traversal and an
`aria-live="polite"` register, not 126 individual tab stops (that was broadside's own
noted risk; this system fixes it with one focusable container instead). Tables that
become stacked cards on phone carry `data-label` on every cell.
