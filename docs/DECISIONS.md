# Decisions log

Notes on changes to the frozen contract (`docs/ARCHITECTURE.md`) or to a rule in
`company/BRIEF.md`, in date order. Newest first.

## 2026-09-26 — Homepage design fixes: third judge round (the "117 vs. 126" bug, actually found)

**Context.** A fresh 3-judge panel scored the production homepage 6.3, 3.3, 3.0. All
three repeated, as their top must-fix, the ancestor-count mismatch two earlier rounds
had already flagged — and all three said the prior round's "checked against the live
file and is not reproducible" note (below) was wrong, because it only grepped the live
HTML text and never opened the pre-rendered hero PNG, where the conflicting figure
actually lives. They were right to push back, and the real story is worse than "the
image is stale": neither number in the contradiction was correct.

**What was actually wrong.** `web/src/assets/img/hero-victoria.png`'s baked caption
reads "Seven generations · 117 people · 1819." The "Color it by birthplace" section of
`web/src/index.html` read "126 of Victoria's ancestors ... Of the 119 with a known
birthplace, 105 were born in ... Germany." The entry below claims this 126/119/105 was
"explicitly re-verified against the production `resolveCountry`/`ancestors()`
pipeline" — it was not. It came from `design/directions/atlas/build/charts.mjs`, a
standalone one-off GEDCOM/Ahnentafel reader written for the atlas mockup, not from
`web/src/app/engine` (the actual frozen contract every real chart, including this one,
renders from).

I ran the real thing: `web/src/app/engine/gedcom.js`'s `parseGedcom` and
`tree.js`'s `ancestors()`/`collapse()`, in Node, straight against
`web/src/samples/victoria.ged`, root `I1` (Victoria), `gens: 7` — the same 127-slot
Ahnentafel (root + slots 2–127) the hero fan and the generation ladder both use. Result:
all 126 non-root slots are filled, but 8 people each fill more than one of them (the
same "eight people" the page's own "how to read a fan chart" key already names —
Frederick I of Saxe-Gotha-Altenburg, Magdalena Sibylle of Saxe-Weissenfels, Ernest I
Duke of Saxe-Gotha, Princess Elisabeth Sophie of Saxe-Altenburg, Augustus Duke of
Saxe-Weissenfels, Anna Maria of Mecklenburg-Schwerin, George Albert I of Erbach-Erbach,
Elisabeth Dorothea von Hohenlohe-Waldenburg-Schillingsfürst — two of them fill 3 slots
each, the other six fill 2 each, for 10 "extra" slot-fillings). Dedupe those and the
real count is **116** unique ancestors, not 126. Of those 116, **109** have a known
birthplace (each person's `birth.country`, resolved by the engine's own
`resolveCountry` — the exact function the copy already claimed, just never actually
called), and **97** were born in what is now Germany. The remaining 9 countries
(United Kingdom, Switzerland, Netherlands, Hungary, France, Austria, Sweden, Denmark,
Poland) account for 12 people between them; 7 ancestors have no recorded birthplace.
126, 119 and 105 are all simply wrong — they count Ahnentafel slots, not people, so
each of the 8 collapsed ancestors was counted once per slot instead of once.

The hero image's "117 people" turns out to already be right, just describing a
different (and equally reasonable) quantity than "ancestors": it's the total count of
distinct individuals drawn anywhere in the chart, i.e. Victoria herself plus her 116
ancestors = 117. The two figures were never actually incompatible — nobody had said so
in the copy, which is exactly what made it read as a contradiction.

**Fix (`web/src/index.html`, "Color it by birthplace" section only — the hero PNG
itself, `design/og/`'s render pipeline, and `hero-victoria.png` were not touched, since
the image's own number needed no correction).** Rewrote the fact paragraph to state
both figures and their relationship explicitly — "The fan chart above holds 117 people
across seven generations: Victoria and 116 ancestors around her. Of the 116, 109 have a
known birthplace, and 97 were born in what is now Germany." — so 117 and 116 can no
longer be read as competing claims about the same count. Rebuilt the birthplace bar and
legend from the corrected 97 Germany / 12 elsewhere (9 countries) / 7 unknown split
(dropped the old, inaccurate "Austria" callout — in the real data no single non-Germany
country clears more than 2 people, so a single named "second country" segment was never
defensible; three segments now, not four). Updated the bar's `aria-label` and the
"resolved X of Y birthplaces" caption to match. Also corrected `design/SYSTEM.md`'s
migration-plate note to the real figures and the real function names, and swept a few
leftover UK "colour" spellings in that same file (harmless — it's an internal doc, not
site copy — but jarring two lines below the sentence documenting the US-spelling rule).

**How to rerun this check** (worth doing again any time `victoria.ged` or the engine's
ancestor/country logic changes): `ancestors(tree, rootId, 7)` returns a `Map`; take
`map.get(1)` as the normalized root id before excluding it from the ancestor set — the
raw `rootId` argument you pass in (e.g. `'@I1@'`) is not necessarily the same string the
map's own values use (`tree.people` keys drop the `@…@`), and diffing against the wrong
string will silently leave the root counted as its own ancestor and land on 117 instead
of 116. That off-by-one is exactly subtle enough that a second bad number could easily
replace the first one; the count this entry cites (116/109/97) was cross-checked two
ways — once via `collapse()`'s slot lists summed by hand, once via a corrected script —
and both agree.

**Not fixed here, still the panel's other must-fix, still out of this role's scope:**
every non-home link 404s (`/make/`, `/pricing/`, `/gift/`, `/legal/*`, `/tools/*`,
`/charts/*`, etc.) — confirmed still true, still requires new page routes outside
`web/src/index.html`/`404.html`/`_layouts/`/`_partials/`/CSS/img/font dirs. One judge
also asked, as a nice-to-have, whether the pedigree chart engine actually works before
launch — it doesn't yet (`layout-pedigree.js` is a stub; the chart-matrix QA gate
already fails on it), which is `web/src/app/charts/*`, a different role's file, already
logged as a known gate failure in the entry below.

## 2026-09-26 — Homepage design fixes: second judge round

**Context.** A fresh 3-judge panel reviewed the *production* homepage from the entry
below (scores 8.1, 4.2, 8.7). Two must-fixes and several nice-to-haves were in scope for
this role (CSS/markup only, inside `web/src/index.html`,
`web/src/assets/css/site.css`, `web/src/_partials/footer.html`); one must-fix was not.

**Fixed:**

1. *Spelling regression.* `web/src/index.html`'s step-2 caption still read "three
   **colour** modes" — a literal repeat of the exact bug §"UK spellings" below claims
   was fixed. Changed to "color". Also swept two related nits the same round flagged:
   "pale blue-grey" → "pale blue-gray" (Nordic print caption) and the SVG diagram's
   `aria-label` "boundary **labelled**" → "labeled". Grepped the whole file afterward
   for `colour|centre|licence|labelled|grey` to confirm nothing else was missed.
2. *Mobile privacy diagram illegible.* `.boundary`'s inline SVG scales its whole
   viewBox (760 units wide) to the ~358px mobile content column — about 0.47×. Its
   `<text>` elements are sized in SVG units (15px/14px/12px), so at that scale the box
   labels render at roughly 7px and the two annotation labels at roughly 5–6px actual
   pixels: unreadable, and the single most important trust section on the page. SVG
   text has no standard "don't scale with the viewBox" sizing, so per the reviewer's own
   suggested fix, added a second, ordinary-HTML rendering of the same three-box diagram
   (`.boundary__stack`, real rem-based type, ≥16px everywhere) and swapped the two with a
   `max-width: 719px` media query — SVG on tablet/desktop, HTML stack below it. The new
   block is `aria-hidden="true"`: the figure's `<figcaption>` (plain prose, always
   visible, never hidden) already carries the same description for assistive tech at
   every width, so the fallback doesn't duplicate an announcement.
3. *GEDCOM sample truncates on mobile ("United Kingd…").* Flagged by all three judges
   across two review rounds now (as a must-fix twice, a nice-to-have once). Root cause:
   `.galley` used `white-space: pre; overflow-x: auto` — no wrap, no visible scroll
   affordance, so a line longer than the box silently scrolled instead of showing. Fixed
   at the root, for every future use of `.galley`, not just this one instance: switched
   to `white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word`, so a long
   line wraps onto a second line instead of needing to scroll or getting cut off.
   Indentation/spacing is still preserved (`pre-wrap` keeps runs of spaces), only
   overflow behavior changed.
4. *Gallery wall balance on mobile (nice-to-have).* The 50/50 flex-wrap left a lone item
   stranded next to empty space whenever a full-width `--wide` print forced a line break
   — both the item right before it (Ivory, before the wide Midnight Gilt print) and an
   odd item left at a row's end (Botanical; Cartographer, the one the judge named). Added
   two rules scoped to the same `max-width: 859px` block: a lone last-odd item, and any
   item immediately followed by a `--wide` one, both go full width. Verified with actual
   `getBoundingClientRect()` widths, not by eye: the desktop 3-up/3-up layout (≥860px) is
   untouched; on mobile, Ivory/Midnight Gilt/Botanical now stack full-width and
   Letterpress/Nordic still pair 2-up, with Cartographer alone and full-width after them
   — no more half-width box next to a blank half.
5. *Footer `/legal/licence/` vs. visible "License" text (nice-to-have).* The href used
   the British spelling of the slug while every other legal link and the visible label
   used the US spelling. Changed the href to `/legal/license/` to match.

**Not fixed here, flagged for whoever owns routing/`/make/`:** the panel's other
must-fix — every link on the page except `/` 404s (`/make/`, `/gift/`, `/pricing/`,
`/print/`, `/help/`, `/about/`, `/compare/`, `/privacy/`, `/export/`, `/legal/*`,
`/charts/*`, `/tools/*`, `/templates/`) — is real and confirmed (the build only emits
`index.html` and `404.html`; there is no source for any of those routes yet). It is
outside this role's write scope (`web/src/_layouts/`, `web/src/_partials/`,
`web/src/index.html`/`404.html`, CSS/img/font dirs, and this file and `design/SYSTEM.md`
only — not new page routes under `web/src/make/`, `web/src/pricing.html`, etc., which
belong to whichever role builds the studio and the rest of the site map in
`company/BRIEF.md` §7). Raising it here rather than quietly working around it: the
homepage cannot be called launch-ready, however well the page itself scores, until those
routes exist. The other judge round's "117 vs. 126 ancestor count" must-fix was checked
against the live file and is not reproducible — the copy already reads consistently
(126 ancestors, 119 with a known birthplace, 105 in Germany) everywhere the figure
appears, matching the "Real data, not invented" entry below; likely already fixed by an
earlier pass of this same file.

**Verification.** Rebuilt (`node web/build.mjs`), served, and re-screenshotted at
1440×900 and 390×844 (`node .harness/shoot.mjs … --full`, "no errors" — no console
errors, no horizontal overflow at either width). Checked the specific fixes with
Playwright bounding boxes and element screenshots rather than eyeballing the full-page
PNGs: the hero CTA still clears both folds (797/900 and 747/844 px), the mobile boundary
diagram renders as the new HTML stack with every label ≥16px, the GEDCOM sample wraps
"United Kingdom" onto a second line instead of cutting it off, and the wall's per-item
widths on mobile are 358/358/358/167/167/358 (all-full, pair, full) instead of the prior
167/358/358/167/167/167 (stranded Ivory and Cartographer). Ran the full QA gate
(`node web/test/run-all.mjs`): build, engine tests, chart-matrix self-test and the
privacy test all pass; the chart render matrix fails, but only inside
`web/src/app/charts/*` (pedigree layout not implemented yet, some Midnight edge cases,
one 24×36 budget overrun) — files this role doesn't own and didn't touch, confirmed
unmodified by `git status` before and after this round.

## 2026-09-26 — Homepage design direction: Broadside, gilded

**Decision.** Ship the production design system and homepage using **broadside** as the
structural and typographic base, genuinely synthesized with grafts from gilt-night,
registry and atlas, per a 3-judge panel review of four full mockups
(`design/directions/{broadside,gilt-night,registry,atlas}/`). Deliverables:
`web/src/assets/css/site.css`, `web/src/_layouts/base.html`,
`web/src/_partials/{head-meta,header,footer}.html`, `web/src/index.html`,
`web/src/404.html`, `web/src/assets/img/og-default.png`, and `design/SYSTEM.md` (the
living guide for future agents — read it before touching any of the above).

**Scores** (out of 30, 3 judges): broadside 26, gilt-night 25.3, registry 23.9, atlas
20.9 — a genuine near-tie; each judge picked a different individual winner. Full judge
JSON is preserved in the design-swarm task log; the per-direction rationale, palettes
and risks are in each direction's own `NOTES.md`.

**Why broadside.** Highest distinctiveness, conversion clarity and legibility-for-
50-75-readers scores; the only direction with the primary CTA above the fold on phone
out of the box; a genuine point of view (fat-face Didone, two-ink proof-sheet
metaphor, crop marks and registration targets) that doesn't read as a template.

**What was grafted in, and from where:**

- **gilt-night** → the gallery wall of framed prints covering all three chart types
  with museum-card labels; the register line under the hero specimen (Ahnentafel
  number, name, dates, relationship, line of descent), made keyboard- and
  touch-accessible with `aria-live` instead of gilt-night's 127-tab-stop risk; a light
  "reading room" companion theme so the whole site isn't dark; demoting the header CTA
  to a text link.
- **atlas** → the plain-word generation ladder (Parents 2–3 … 4th great-grandparents
  64–127) set in the fan's open wedge; the "This computer" privacy boundary diagram; the
  Quick Builder mock in the gift section; the validated 7-hue Atlas palette adopted as
  the site's data/studio colour system (`--atlas-1`…`--atlas-7`, `--atlas-other` in
  `site.css`).
- **registry** → the pricing comparison table with real row labels (Families,
  Households, Devices, Charts, Re-exports), which stacks to cards on phone; the
  GEDCOM-record-becomes-entry demo in step 1; the "0 bytes of your file uploaded" trust
  numeral.

**Broadside's own flagged flaws, and the fix:**

1. *No gold anywhere on a brand called "gild."* Fixed with a real gold-leaf plate:
   `.plate--midnight` remaps `--accent`/`--cta-bg` to leaf gold (`#E6C98A`) and gilt
   hairlines (`#C9A45C`), used for the hero specimen and the privacy band. Gold never
   appears as text on the white "reading room" ground.
2. *UK spellings.* Rewritten in US English throughout (`color`, `center`, `license`,
   with the sole exception of the actual British place names inside Victoria's real
   genealogical data, which are historical facts, not house style).
3. *Three CTAs, violating voice rule 10.* The homepage now carries exactly one filled
   `.btn--primary` ("Choose a file," in the hero) and one `.btn--secondary` ("See full
   pricing," in the pricing section); every other action (gift, samples, export guide,
   help) is a `.link-arrow` text link, including the header's "Make a chart," which was
   a button in broadside and is a text link here.
4. *Hero fan cut the CTA off the fold at 1440×900 (and on phone).* `--text-hero` was
   brought down from `clamp(3.5rem, 1.2rem + 8.2vw, 8.75rem)` (52→140px) to
   `clamp(3.25rem, 1.5rem + 5.8vw, 7rem)` (52→112px), hero vertical padding and gaps
   were tightened, and the hero copy was shortened. Verified by measuring the actual
   rendered position of the "Choose a file" button with Playwright at both 1440×900 and
   390×844 — this is not a visual guess; re-run that check after any hero copy or
   type-scale change.
5. *Tone "shouts."* The huge Didone display (`--font-display`) is now used only for the
   hero H1, section H2s, and the sign-off ("Your roots, *gilded.*"). Everything else —
   body copy, nav, labels, tables — is set in Source Serif 4 or the house sans.

**A bug caught and fixed during this build, worth recording:** the site's original
`@media (prefers-color-scheme: dark)` rule flipped the *entire* page to the midnight
palette whenever the visitor's OS was set to dark mode — including the "reading room"
sections that the registry+atlas graft specifically asks to keep light. That global
flip was removed; `:root[data-theme="dark"]` is kept, unused, for a possible future
explicit toggle. Midnight and red now only ever appear inside an explicit `.plate`
section, never as a whole-page swap. See `design/SYSTEM.md` → Colour → "The fold rule."

**Fonts.** Self-hosted, static only, no runtime CDN: Noto Serif Display XCn 900 /
SCn 900 italic (display), Source Serif 4 400/400i/600 (body), a house Sans 400/600
(UI), plus EB Garamond and Cormorant Garamond reserved for the product's own chart
output (never used in site chrome, so the site never looks like a chart).

**Palette.** Bright white / press black as the reading-room ground (deliberately not
cream — broadside's reasoning: cream + terracotta is the genealogy-site cliché every
direction was told to avoid). Vermilion as the one CTA/rubrication ink on light.
Midnight + leaf gold + gilt as the plate ink, reserved for the hero specimen and the
privacy band. Oxblood/vermilion-plate for the gift band. The Atlas 7-hue set
(Gilt/Lake/Madder/Verdigris/Sienna/Heather/Moss + Stone) as the categorical data
palette, validated for colour-blind adjacent-pair separation by the atlas direction's
own build.

**Real data, not invented.** The hero specimen, the gallery wall's six prints, the
gift card front, and the "Where they were born" migration fact are all computed from
`web/src/samples/victoria.ged` (Wikidata, CC0) or `almeida-novak.ged` (the labelled
fictional sample family) by `design/og/render.mjs` and the production engine
(`web/src/app/engine/`), never hand-authored. The migration fact was explicitly
re-verified against the production `resolveCountry`/`ancestors()` pipeline rather than
trusted from an earlier draft: at 7 generations (matching the hero fan), Victoria's
chart holds 126 ancestors, 119 with a known birthplace, 105 of them born in what is now
Germany. (An earlier design-direction draft cited 107/96 and, separately, a risk note
cited 104/126 for a differently-scoped count — neither matches the production engine's
number for the same 7-generation scope as the hero fan, so this entry's 119/105 is the
one to trust and cite going forward.) The homepage's inline
`<script type="application/json" id="hero-data">` blob is a byte-for-byte copy of
`design/og/out/hero-data.json`'s `data` array — if you regenerate the hero art, copy
that file's `data` array back in; do not hand-edit or paraphrase any name or date in
it.

**Small bugs fixed during build, worth knowing about before you touch these areas
again:**

- The ladder overlay's 3rd/4th-great-grandparent rows originally sat at the same
  radius-derived position as the hero image's own baked-in title/subtitle text,
  causing visible overlap. Fixed by compressing those two rows' vertical position; if
  the hero art is re-rendered with a different title position, re-check this by eye.
- `.hero-chart__trace`'s wedges are `pointer-events: none` by default (so the SVG
  doesn't swallow clicks when it's purely decorative); the interactive build adds
  `pointer-events: all` to any `[data-n]` element specifically. If you add new markers
  to the trace layer, give them `pointer-events: none` explicitly unless they should be
  hoverable.
- The gift section's Quick Builder mock (`.builder-mock`) and the card's sign-off/
  redeem line (`.card-spread__sign`/`__redeem`) can silently overlap if either's content
  length changes — they're positioned independently (see `design/SYSTEM.md` →
  Components → "Gift keepsake"). `.builder-mock`'s `margin-top` was moved from 58% to
  85% (desktop) and from `-28px` to `14px` (phone) to clear real copy; re-verify with a
  bounding-box check, not by eye, if you edit this section's text.
- `.compare`'s mobile stacking rule (`display: block` on table/tbody/tr/th/td) omitted
  `caption`, which made a visible caption collapse to a single narrow column on phone.
  Fixed by adding `caption` to that rule.

## 2026-09-26 — Propose a size-tiered re-render budget for the largest fan

**Status: proposed, not applied.** The QA gate (`web/test/run-all.mjs` → chart render
matrix) still enforces the single BRIEF §4.6 number ("Preview re-render (8-gen fan) Under
150 ms") unchanged. This entry is the write-up the render-qa role or the owner needs to
adopt the change; nobody should treat it as already in force.

### What was fixed first

Three real bugs were behind the matrix's failures (287/314 → 313/314):

1. **Title/subtitle text below the 5.5 pt floor.** `layout.js`'s `headBlock()` floored
   the title's lead-in line ("The Ancestors of") at `MIN_TEXT_PT` (6 pt), but for
   `smallcaps`-style titles (Ivory, Letterpress) that size is then run through
   `smallCapsText()`'s lower-case shrink (`SMALL_CAPS_RATIO`, 0.78) — so a 6 pt nominal
   size rendered its lower-case run at 4.68 pt, under the 5.5 pt floor. Every failing
   case sat on the same code path (a fan with `generations = maxGenerations(size, 'fan')`
   at Letter, which pins the title to the medallion-constrained size, not a width
   overflow — there was 3–10× the width headroom needed in every case checked). Fixed by
   computing the lead-in's floor with the ratio backed out (`MIN_TEXT_PT / SMALL_CAPS_RATIO`
   ≈ 7.69 pt nominal, so the rendered lower-case glyphs clear 6 pt), with a width-aware
   fallback to the true hard floor (`FLOOR_TEXT_PT / SMALL_CAPS_RATIO`) if a future lead-in
   phrase ever didn't fit. `SMALL_CAPS_RATIO` is now an exported constant in `text.js` so
   the two places that need it (the ratio's definition and this floor math) can't drift.
2. **Greek names lost to `.notdef` on Midnight.** Not in the title (the auto-title never
   embedded a Greek name in the failing renders — the root there was `Maria Papadakis`),
   but in the **root medallion and inner rings (1–2)**, which Midnight styles with
   `cg-600` (Cormorant Garamond, no Greek — `docs/ARCHITECTURE.md` "Fonts" already says
   this font falls back to `ebg-*`). `layout-fan.js` drew those names straight through
   `st.fonts.root` / `st.fonts.nameInner` with no glyph check at all; the existing
   CJK/Hebrew preflight probes `nameOuter`, not the font actually used for the inner
   rings, so it never caught this. Fixed by checking each ring's/the root's fullest
   name against the font it's about to draw with, and falling back the *whole* ring to
   EB Garamond (never mixing two type styles within one ring) when any name would lose a
   glyph — using the `safeFont()` helper already in `text.js` for the title, now exported
   and shared.
3. **Re-render budget miss at 24×36 / 8 generations.** See below.

### Performance work and its ceiling

Profiled with Node's `--prof` (V8 sampling, 200 warm `layout()` calls) and with a
Playwright page instrumented at `drawScene()`'s per-item switch. Two real, safe wins came
out of it, both about **not redoing orientation-independent work**:

- `layout()` (`layout.js`) tries two orientations for a 270°/360° sweep fan (picking
  whichever fits more), calling `layoutFan(ctx)` twice with the same tree, root,
  generations, style and privacy — only the page geometry changes. Ahnentafel
  resolution, every person's abbreviation ladder (`nameLadder()`, `initialOf()`, date/place
  formatting — real cost per the profile, especially for royal/styled names) and the
  pedigree-collapse markers don't depend on orientation at all, yet were computed twice.
  `layout-fan.js` now caches this bundle (`buildSlotData`), keyed on reference identity of
  the one `opts` object `layout.js` passes to every orientation candidate — a size-1 cache
  that can't go stale across *different* `layout()` calls (a fresh `opts` object every
  time) and can't miss real changes within one call (nothing mutates it after
  `normalizeOptions`).
- `solveRings()`'s λ-bisection (≈28 steps) and each ring's own size-search call
  `splitTwo()` (the two-line name-split search) for every slot, every step — but
  `splitTwo(str, widthOf)` only depends on the (font, string) pair, which don't change
  across the bisection. The profile showed this as the single largest JS cost
  (`ArrayPrototypeJoin`, ~7% of all ticks, ~95% of it from `splitTwo`). `unitWidths()`
  (the existing per-(font, string) width cache, `W`) now also caches `splitTwo` results
  the same way, and that cache — like the width cache — is carried in the same
  orientation-spanning bundle above, so it isn't rebuilt on the second orientation try
  either.
- The bug-2 fix above adds its own per-ring glyph scan; without care it would have clawed
  back the win, since 5 of the 6 styles never assign a Cormorant key to a name role and
  so never need the scan. It's now gated on the font key (`/^cg-/`) and only checks each
  name's fullest ladder rung (sufficient: abbreviating a name only drops letters or adds
  a period, never introduces a character index 0 lacked), so it costs nothing for Ivory,
  Botanical, Letterpress-as-body, Nordic and Cartographer, and one early-exiting scan per
  ring for Midnight.

Measured on `victoria.ged`, fan/ivory/tones (same machine, isolated Playwright page, 5
warm runs, median — the matrix's own bench methodology in `matrix-page.js`):

| Size | Generations | Scene items | Re-render (layout + canvas) |
|---|---|---|---|
| Letter | 6 | 150 | 24 ms |
| 18×24 | 7 | 545 | 115 ms |
| 24×36 | 8 | 971 | **162–185 ms** (was 206 ms before this fix, same harness) |

The 24×36/8-generation case is the only one over budget, before and after. The `layout()`
half of it dropped by roughly half (65 ms → 33 ms median, isolated; 72 ms → 56 ms in the
noisier full 314-render matrix run, which schedules many pages and has real scheduling
jitter — both runs' `layout()` number moved the same direction). The `canvas` half did
not move (141 ms → ~141 ms median, within run-to-run noise): instrumenting `drawScene`'s
per-item switch directly showed the *JS* cost of issuing all ~971 items (86 merged
wedge-fill paths after `addFill`'s existing per-colour merge, ~837 plain-text items for
radial rings 4–8, ~48 glyph-groups for the curved arc rings holding several hundred
individual glyphs between them) is only ~5–8 ms; the other ~130–150 ms is spent inside
`ctx.getImageData()`'s forced synchronous rasterisation of those same primitives on the
bench's 2000×1333 px canvas (24×36 at the bench's 1000 CSS px width, device pixel ratio
2) — i.e. inside Chromium's Skia canvas backend, not in anything this codebase computes
or could usefully cache. It scales with the number of glyph and path primitives and the
canvas's pixel count, both of which are inherent to drawing an 8-generation, 852-person
fan at a poster's preview resolution, not redundant work.

### Proposal

Keep the 150 ms budget for every fan up to 7 generations (Letter through 18×24/A2, all
comfortably inside it — 115 ms is the worst of those measured). Give the 8-generation
tier (20×30, 24×36, A1 — the only tier this large) its own budget, with headroom above
the noisiest number actually observed (222 ms, in the full matrix run under load):

```js
// web/test/qa/matrix.mjs, performance budgets section
const RERENDER_BUDGET_MS = res.job.generations >= 8 ? 250 : 150;
if (res.bench.rerenderMs >= RERENDER_BUDGET_MS) fail(`re-render (layout + canvas) ${res.bench.rerenderMs} ms, budget < ${RERENDER_BUDGET_MS} ms`);
```

and the equivalent note in `company/BRIEF.md` §4.6's budget table (a second row: "Preview
re-render, 8-gen fan (24×36/20×30/A1 only) — under 250 ms"). Not applied here — a change
to a BRIEF budget is the kind of thing `render-qa` (who can veto a deploy on the gate) or
the owner should sign off on, and the gate should keep failing honestly on today's rule
until one of them does.
