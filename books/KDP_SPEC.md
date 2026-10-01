# Amazon KDP print production spec

Status: authoritative for Gildroot Press. Checked 2026-09-30 against KDP's own help pages and cover calculator.
Owner of this file: whoever changes `tools/books/kdp.mjs`. Change this spec first, then the code, then `web/test/books/kdp.test.mjs`.

This is the rulebook for every paperback and hardcover Gildroot Press sends to Amazon KDP. It covers the numbers the tooling needs (page sizes, margins, spine, cover, cost, royalty) and the rules the listing must follow (ISBN, low-content, AI disclosure, metadata, title limits, proofs). It ends with the preflight checklist our tooling enforces.

**How to read the citations.** Every number carries a source tag such as [S1]. The tags resolve in the source table in §0. All sources were read in full on 2026-09-30 by fetching the pages directly from `kdp.amazon.com`. Where KDP's help text doesn't state a number, we measured it with KDP's own cover calculator on the same day and say so ("measured"). Where only secondary sources give a number, it is marked **(secondary)** and the tooling treats it as a soft limit.

**Scope.** US marketplace (Amazon.com), US dollars, inches, black ink unless stated. Other marketplaces are out of scope for v1.

---

## 0. Sources

| Tag | KDP page | URL | Checked |
|---|---|---|---|
| S1 | Set Trim Size, Bleed, and Margins | https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6 | 2026-09-30 |
| S2 | Paperback Submission Guidelines | https://kdp.amazon.com/en_US/help/topic/G201857950 | 2026-09-30 |
| S3 | Print Options | https://kdp.amazon.com/en_US/help/topic/G201834180 | 2026-09-30 |
| S4 | Hardcover | https://kdp.amazon.com/en_US/help/topic/GAVW3FZZAKA2KY3B | 2026-09-30 |
| S5 | Create a Paperback Cover | https://kdp.amazon.com/en_US/help/topic/G201953020 | 2026-09-30 |
| S6 | Cover Calculator and Template Generator (queried for the values in §6–§7) | https://kdp.amazon.com/en_US/cover-calculator | 2026-09-30 |
| S7 | Create a Hardcover Cover | https://kdp.amazon.com/en_US/help/topic/GDTKFJPNQCBTMRV6 | 2026-09-30 |
| S8 | Paperback Printing Cost | https://kdp.amazon.com/en_US/help/topic/G201834340 | 2026-09-30 |
| S9 | Hardcover Printing Cost | https://kdp.amazon.com/en_US/help/topic/GHT976ZKSKUXBB6H | 2026-09-30 |
| S10 | Paperback Royalty | https://kdp.amazon.com/en_US/help/topic/G201834330 | 2026-09-30 |
| S11 | Hardcover Royalty | https://kdp.amazon.com/en_US/help/topic/G77F3WPD3KQLJTFS | 2026-09-30 |
| S12 | Barcodes | https://kdp.amazon.com/en_US/help/topic/G5HDYGP4BXLX4RUW | 2026-09-30 |
| S13 | Expanded Distribution | https://kdp.amazon.com/en_US/help/topic/GQTT4W3T5AYK7L45 | 2026-09-30 |
| S14 | Format Images in Your Book | https://kdp.amazon.com/en_US/help/topic/G202169030 | 2026-09-30 |
| S15 | Save Your Manuscript File (incl. Manual Review Checklist) | https://kdp.amazon.com/en_US/help/topic/G202145060 | 2026-09-30 |
| S16 | Books Titles & Editions | https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC | 2026-09-30 |
| S17 | Write a Book Description | https://kdp.amazon.com/en_US/help/topic/G201189630 | 2026-09-30 |
| S18 | Make Your Book More Discoverable with Keywords | https://kdp.amazon.com/en_US/help/topic/G201298500 | 2026-09-30 |
| S19 | KDP Categories | https://kdp.amazon.com/en_US/help/topic/G200652170 | 2026-09-30 |
| S20 | Create a Book | https://kdp.amazon.com/en_US/help/topic/G202172740 | 2026-09-30 |
| S21 | How do I order a proof or author copy? | https://kdp.amazon.com/en_US/help/topic/GVEG4YA9G2T7N6DR | 2026-09-30 |
| S22 | Fix Paperback and Hardcover Formatting Issues | https://kdp.amazon.com/en_US/help/topic/G201834260 | 2026-09-30 |
| S23 | Paperback Fonts | https://kdp.amazon.com/en_US/help/topic/G202145450 | 2026-09-30 |
| S24 | Low-Content Books | https://kdp.amazon.com/en_US/help/topic/GGE5T76TWKA85DJM | 2026-09-30 |
| S25 | Content Guidelines (incl. AI content) | https://kdp.amazon.com/en_US/help/topic/G200672390 | 2026-09-30 |
| S26 | Metadata Guidelines for Books | https://kdp.amazon.com/en_US/help/topic/G201097560 | 2026-09-30 |
| S27 | Guide to Kindle Content Quality | https://kdp.amazon.com/en_US/help/topic/G200952510 | 2026-09-30 |
| S28 | What is an ISBN and Imprint? | https://kdp.amazon.com/en_US/help/topic/G201834170 | 2026-09-30 |
| S29 | Get an ISBN | https://kdp.amazon.com/en_US/help/topic/GTJ8LBXL6Z4WV5QX | 2026-09-30 |
| S30 | Update your book details | https://kdp.amazon.com/en_US/help/topic/G200736410 | 2026-09-30 |
| S31 | Timelines | https://kdp.amazon.com/en_US/help/topic/G202173620 | 2026-09-30 |
| S32 | Groundwood Paper | https://kdp.amazon.com/en_US/help/topic/G99WKT9FARBGHBJF | 2026-09-30 |
| S33 | Hardcover Print Elements | https://kdp.amazon.com/en_US/help/topic/GKZVNAAFYWVKZWL8 | 2026-09-30 |
| S34 | Proof and Author Copies | https://kdp.amazon.com/en_US/help/topic/G7BBN68RYX5UMDZF | 2026-09-30 |
| S35 | How much do proof or author copies cost? | https://kdp.amazon.com/en_US/help/topic/G2MYNEKHT443C2H2 | 2026-09-30 |
| S36 | Printing Cost & Royalty Calculator (landing page) | https://kdp.amazon.com/en_US/help/topic/GSQF43YAMUPFTMSP | 2026-09-30 |
| S37 | 4 – Title Setup: Book Details, Content, & Pricing | https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6 | 2026-09-30 |
| S38 | Format Your Hardcover | https://kdp.amazon.com/en_US/help/topic/GKYZRXFBZH2LDXAK | 2026-09-30 |

Secondary sources (context only; never the sole basis for a hard rule):

| Tag | Source | Checked |
|---|---|---|
| X1 | "Amazon KDP Cuts Weekly Publishing Limits", SelfPub newsletter, 24 Sep 2026. https://selfpub.substack.com/p/amazon-kdp-cuts-weekly-publishing-limits | 2026-09-30 |
| X2 | KDP Community announcement "Update on KDP Title Creation Limits" (Amazon's forum; the page renders only with JavaScript, so its text was read through the quotes in X1 and X3). https://www.kdpcommunity.com/s/article/KDP-Title-Creation-Limits-Update | 2026-09-30 |
| X3 | "Amazon KDP Caps New Titles at 2 per Week", FeelFish news, 26 Sep 2026 (quotes the announcement). https://www.feelfish.com/en/resources/news/2026-09-26 | 2026-09-30 |
| X4 | "KDP Backend Keywords 2026 – 7 Fields, 50 Characters Each", Univers Studio. https://univers.studio/blog/optimize-kdp-backend-keywords/ | 2026-09-30 |

---

## 1. Formats

- **Paperback:** perfect bound, full-color cover on 80 lb (220 GSM) white stock, glossy or matte finish [S3].
- **Hardcover:** case laminate only. The cover art is printed and wrapped around 2 mm board, then glossy or matte laminated. No dust jacket, no cloth [S4][S33]. Endsheets are white or cream to match the interior paper [S33]. Books over 120 pages get a black-and-white headband [S7][S33].
- Each format needs its own ISBN [S28]. Title and author must match exactly across formats or Amazon won't link them on one detail page [S16][S20].
- Hardcover sells on Amazon.com, .co.uk, .de, .es, .fr, .it, .nl, .ie, .com.be, .pl and .se. It is not available on .co.jp or through Expanded Distribution [S4][S13].

---

## 2. Trim sizes

A trim is **large** if it is more than 6.12 in wide or more than 9 in tall. Large trims cost more to print [S1][S3][S8].

### 2.1 Paperback (kdp.amazon.com) [S1][S2][S3]

Pages allowed, by ink and paper:

| Trim (in) | Large? | B&W white | B&W cream | B&W groundwood | Standard color | Premium color |
|---|---|---|---|---|---|---|
| 5 x 8, 5.06 x 7.81, 5.25 x 8, 5.5 x 8.5, **6 x 9** | no | 24–828 | 24–776 | 24–812 | 72–600 | 24–828 |
| 6.14 x 9.21, 6.69 x 9.61, **7 x 10**, 7.44 x 9.69, 7.5 x 9.25, **8 x 10** | yes | 24–828 | 24–776 | 24–812 | 72–600 | 24–828 |
| 8.25 x 6, 8.25 x 8.25 | yes | 24–800 | 24–750 | 24–784 | 72–600 | 24–800 |
| 8.5 x 8.5, **8.5 x 11** | yes | 24–590 | 24–550 | 24–578 | 72–600 | 24–590 |
| 8.27 x 11.69 (A4) | yes | 24–780 | 24–730 | 24–764 | not offered | 24–590 |

Custom paperback trims are allowed from 4 to 8.5 in wide and 6 to 11.69 in tall [S3]. KDP publishes no page limits for custom trims. The only non-standard size in the Expanded Distribution chart, 8.25 x 11, is marked not eligible [S13]. Our tooling accepts a custom trim only with `customTrim: true` and then applies the 8.5 x 11 limits.

### 2.2 Hardcover [S1][S3][S4]

Five trims, 75–550 pages, with black ink on white or cream paper, or premium color on white. No groundwood and no standard color [S3].

| Trim (in) | Large? | Pages |
|---|---|---|
| 5.5 x 8.5 | no | 75–550 |
| **6 x 9** | no | 75–550 |
| 6.14 x 9.21 | yes | 75–550 |
| **7 x 10** | yes | 75–550 |
| **8.25 x 11** | yes | 75–550 |

**What this means for us.** 8.5 x 11 is paperback only and 8.25 x 11 is hardcover only, so a letter-size title needs two interior PDFs (or one custom 8.25 x 11 paperback, which gives up Expanded Distribution). 6 x 9 and 7 x 10 exist in both bindings, so one interior can serve both if the page count is 76–550 [S4]. If the ISBN is printed in the interior, each format's file must carry its own ISBN [S4].

---

## 3. Page counts

- KDP counts the pages in the file and rounds up to an even number [S2][S15]. One PDF page is one side of a leaf [S22]. Our tooling always emits an even page count.
- Minimum 24 pages for paperback (72 for standard color) and 75 for hardcover [S2][S4]. With rounding, the smallest hardcover is 76 pages; KDP's cover calculator also uses 76 as the minimum (measured [S6]).
- No more than 4 consecutive blank pages at the beginning or middle, and no more than 10 at the end [S15][S22]. "Excessive blank pages" are a stated rejection reason [S2][S5].

---

## 4. Paper and ink [S3][S32]

| Option | Paper weight | Paperback | Hardcover |
|---|---|---|---|
| Black ink, white paper | 50–61 lb (74–90 GSM) | yes | yes |
| Black ink, cream paper | 50–61 lb (74–90 GSM) | yes | yes |
| Black ink, groundwood paper | 45 lb (60 GSM) | yes | no |
| Standard color, white paper | 50–61 lb (74–90 GSM) | yes | no |
| Premium color, white paper | 60–71 lb (88–105 GSM) | yes | yes |

- Paper weight varies by printing location [S3].
- Ink type is locked after publishing. Black-ink paperbacks may later switch between white, cream and groundwood [S3][S30].
- Groundwood costs about 5% less per page and is not recommended for heavy ink coverage; KDP may switch such books to white or cream [S32]. **We don't use groundwood for chart books.**
- Color photos print in color only with a color ink option [S14].

---

## 5. Interior PDF

### 5.1 Page size [S1][S2]

- **No bleed:** page size = trim size.
- **Bleed:** width = trim width + 0.125 in; height = trim height + 0.25 in. Bleed is added to the top, bottom and outside edge only; the spine edge gets none [S1][S2].
- If even one page bleeds, the whole file must be set up with bleed [S1]. Bleed requires a PDF upload [S2].

| Trim | No bleed | With bleed |
|---|---|---|
| 6 x 9 | 6 x 9 | 6.125 x 9.25 |
| 7 x 10 | 7 x 10 | 7.125 x 10.25 |
| 8 x 10 | 8 x 10 | 8.125 x 10.25 |
| 8.5 x 11 | 8.5 x 11 | 8.625 x 11.25 |
| 8.25 x 11 (hardcover) | 8.25 x 11 | 8.375 x 11.25 |

KDP's table prints 5.5 x 8.5 with bleed as "5.626" wide [S1]; the formula gives 5.625, which is what we use.

### 5.2 Margins [S1][S2]

| Billed pages | Inside (gutter) minimum | Outside, top, bottom: no bleed | Outside, top, bottom: with bleed |
|---|---|---|---|
| 24–150 | 0.375 in | 0.25 in | 0.375 in |
| 151–300 | 0.5 in | 0.25 in | 0.375 in |
| 301–500 | 0.625 in | 0.25 in | 0.375 in |
| 501–700 | 0.75 in | 0.25 in | 0.375 in |
| 701–828 | 0.875 in | 0.25 in | 0.375 in |

- The same table applies to hardcover: KDP's hardcover formatting page sends you to this page for trim size and margins [S38].
- Top, bottom and outside margins don't have to be equal, as long as each meets its minimum [S1].
- **Gildroot rule (stricter):** KDP doesn't say whether the with-bleed minimum is measured from the trim line or from the bleed edge. We measure every margin from the trim line and use 0.375 in when the book has bleed. That satisfies both readings. Italic overhang counts as text outside the margin in Print Previewer [S22], so our house margins sit well above the minimums.

### 5.3 Content rules

| Rule | Value | Source |
|---|---|---|
| Minimum type size | 7 pt | [S2][S15][S23] |
| Minimum line weight | 0.75 pt (0.01 in) | [S2][S15] |
| Minimum gray fill on black-ink books | 10% (recommended) | [S2][S15] |
| Image resolution | at least 300 DPI; under 200 DPI counts as low resolution; 600 DPI recommended maximum | [S2][S14] |
| File size | 650 MB maximum | [S2][S15] |
| Page files | single pages, not spreads | [S2][S15] |
| Pagination | sequential; even numbers on left pages, odd on right (left-to-right books) | [S2][S15] |
| Orientation | every page the same way | [S2][S15] |
| Reading direction | left to right (RTL only for Hebrew, Yiddish, Japanese) | [S2][S15] |

**Line weight matters for charts.** Our chart styles use gold hairlines. In a KDP interior every stroke must be at least 0.75 pt. The book renderer raises thinner strokes to 0.75 pt.

### 5.4 PDF construction [S2][S15][S22][S23]

- Embed every font. KDP recommends full embedding over subsets [S15], but its fonts page accepts "Embedded" or "Embedded Subset" [S23]. Chromium's `page.pdf()` embeds subsets; that is acceptable.
- No fake bold or italic: a style must exist as a real font in the file ("faux font" errors) [S23]. Use the static TTF files in `web/src/assets/fonts/` (EB Garamond 400/400i/600, Cormorant Garamond 500/500i/600, Sans 400/600). **Gildroot rule:** no variable fonts and no Type 3 fonts.
- Flatten transparencies and layers [S2][S15][S22]. **Gildroot rule:** no `opacity`, no alpha colors, no images with alpha channels, no blend modes in book templates, so Chromium never writes soft masks.
- No crop marks, trim marks, bookmarks, comments, invisible objects, annotations, placeholder text or metadata [S2][S15]. Chromium turns `<a href>` into link annotations, so book templates contain no links, and preflight strips the document Info dictionary and XMP.
- No PDF creation logos or watermarks [S2][S15].
- No encryption or file security [S2][S15].
- PDF/X-1a is preferred but not required; non-PDF/X files may have non-printing objects removed [S15].
- File names: no emoji or unsupported special characters [S2]. **Gildroot rule:** `[a-z0-9-]+\.pdf`.
- Do not include the words "spiral", "hard bound", "leather bound" or "calendar", or any wording that implies the book is part of a bundled or boxed set [S15][S27].

---

## 6. Spine width

### 6.1 Paperback [S2][S5], confirmed with the calculator [S6]

Spine width = billed page count x per-page factor.

| Paper | Inches per page |
|---|---|
| White (black ink) | 0.002252 |
| Cream (black ink) | 0.0025 |
| Groundwood (black ink) | 0.00235 |
| Standard color (white paper) | 0.002252 |
| Premium color (white paper) | 0.002347 |

The Paperback Submission Guidelines list a single "Color paper" factor of 0.002347 [S2]; the paperback cover page gives separate factors for standard (0.002252) and premium (0.002347) color [S5]. The calculator agrees with the cover page: 120 pages at 8.5 x 11 gives a 0.27 in spine for standard color and 0.282 in for premium color (measured [S6]).

### 6.2 Hardcover (measured [S6])

KDP's help pages don't publish a hardcover spine formula; they point to the calculator [S7]. We queried the calculator for 6 x 9 at 76–550 pages on white and cream paper, at 200 pages on every hardcover trim and on premium color, and at 120 pages on 7 x 10 and 8.25 x 11. Every result fits:

> Hardcover spine = billed page count x paper factor (same factors as paperback) + 4.8 mm (0.18898 in)

| Pages (6 x 9, white) | 76 | 120 | 200 | 300 | 400 | 550 |
|---|---|---|---|---|---|---|
| Calculator spine (in) | 0.360 | 0.459 | 0.639 | 0.865 | 1.090 | 1.428 |
| Formula (in) | 0.360 | 0.459 | 0.639 | 0.865 | 1.090 | 1.428 |

Every calculator reading we took is a fixture in `web/test/books/kdp.test.mjs`.

### 6.3 Spine text

- Paperback: at least 79 pages are needed for spine text [S5][S15]; another page says "more than 79 pages" [S2][S5]; Cover Creator needs 80 [S5]. Because page counts are even, all three mean **80 billed pages or more**. Spine text on a shorter book is a rejection reason [S5].
- Hardcover: KDP states no minimum. The thinnest hardcover spine (76 pages, white) is 0.360 in with a 0.235 in safe area (measured [S6]).
- Keep at least 0.0625 in between spine text and each fold; allow 0.0625 in of fold variance on either side [S2][S5].
- KDP says the spine may shift up to "0.0125 in (3.2 mm)" [S5]. 3.2 mm is 0.125 in, so the inch figure is a typo. **Gildroot rule:** no hard color edge or rule on the spine folds; let the back, spine and front share one background across the folds.

---

## 7. Cover PDF

One PDF, one page, containing back cover, spine and front cover as one image [S5][S7]. 650 MB maximum; 40 MB or less recommended [S5][S7].

### 7.1 Paperback [S2][S5], confirmed with the calculator [S6]

```
cover width  = 0.125 + trim width + spine + trim width + 0.125
cover height = 0.125 + trim height + 0.125
```

- Bleed of 0.125 in on all sides; bottom bleed can't exceed 0.125 in [S2].
- The cover must be one continuous image, centered left to right on the spine [S2].
- Text at least 0.125 in inside the trim lines, and no front or back text in the spine area [S5]. Anything not meant to be trimmed stays at least 0.25 in from the outside edge of the file [S2].
- Borders are not recommended; a border must sit at least 0.25 in inside the trim line [S5].
- Cover text at least 7 pt, legible against its background [S5].
- Images 300 DPI, at 100% size, flattened [S5]. CMYK is recommended for images; color profiles are removed; no spot colors; don't mix color spaces [S5].
- Title, subtitle, author, edition and ISBN on the cover must exactly match the book details [S5][S26].

### 7.2 Hardcover (case laminate) [S7], dimensions measured with the calculator [S6]

The help page gives the parts but not the arithmetic. The calculator's output for every trim fits:

```
board width   = trim width  + 5 mm      (6 x 9 -> 6.197 in)
board height  = trim height + 6 mm      (6 x 9 -> 9.236 in)
wrap          = 15 mm = 0.591 in on every outside edge
hinge         = 10 mm = 0.394 in on each board, next to the spine
cover width   = wrap + board width + spine + board width + wrap
cover height  = wrap + board height + wrap
```

- Keep text 0.125 in inside the board edges (the calculator's "Margin"), and keep text and the barcode out of the hinge [S6][S7].
- Spine text: 0.0625 in from each fold; the spine safe area runs 0.125 in inside the board's top and bottom (measured [S6]).
- **KDP's help page disagrees with its calculator.** It says the wrap is "0.51 in (15 mm)" and that text sits "0.635 in (16 mm) from the edge of the book" [S7]. 0.51 in is 13 mm, not 15 mm. The calculator gives 15 mm = 0.591 in. We follow the calculator, which also keeps text further from the edge than the help page asks.

### 7.3 Worked cover sizes (black ink, white paper)

| Binding | Trim | Pages | Interior page (bleed) | Spine | Full cover (w x h) |
|---|---|---|---|---|---|
| Paperback | 6 x 9 | 120 | 6.125 x 9.25 | 0.270 | 12.520 x 9.250 |
| Paperback | 6 x 9 | 200 | 6.125 x 9.25 | 0.450 | 12.700 x 9.250 |
| Paperback | 7 x 10 | 200 | 7.125 x 10.25 | 0.450 | 14.700 x 10.250 |
| Paperback | 8 x 10 | 200 | 8.125 x 10.25 | 0.450 | 16.700 x 10.250 |
| Paperback | 8.5 x 11 | 120 | 8.625 x 11.25 | 0.270 | 17.520 x 11.250 |
| Paperback | 8.5 x 11 | 200 | 8.625 x 11.25 | 0.450 | 17.700 x 11.250 |
| Hardcover | 6 x 9 | 120 | 6.125 x 9.25 | 0.459 | 14.034 x 10.417 |
| Hardcover | 6 x 9 | 200 | 6.125 x 9.25 | 0.639 | 14.214 x 10.417 |
| Hardcover | 7 x 10 | 200 | 7.125 x 10.25 | 0.639 | 16.214 x 11.417 |
| Hardcover | 8.25 x 11 | 120 | 8.375 x 11.25 | 0.459 | 18.534 x 12.417 |
| Hardcover | 8.25 x 11 | 200 | 8.375 x 11.25 | 0.639 | 18.714 x 12.417 |

Every row matches KDP's cover calculator to the 0.001 in it displays [S6].

---

## 8. Barcode [S5][S7][S12]

- **Default: let KDP place it.** Leave the area blank; KDP adds a barcode at no cost, and KDP says its barcodes are "guaranteed to meet all manufacturing requirements" [S12]. It prints in a 2 x 1.2 in white box in the lower right of the back cover; anything under it is covered, and covers with images or text in that spot can be rejected [S7][S12][S24].
- **Paperback placement:** the calculator's barcode margin is 0.25 in from the spine fold and 0.25 in from the bottom trim (measured [S6]), which matches the 0.25 in clearance rule for your own barcode [S12].
- **Hardcover placement:** the calculator's barcode margin is 0.25 in from the hinge and 0.375 in from the bottom of the board (measured [S6]). The help page says "at least 0.76 in (19 mm) from the bottom of the cover and at least 0.25 in (6 mm) from the spine hinge" [S7], without saying whether "cover" means the board or the whole file. Our own barcode box sits 0.76 in above the board bottom, which meets every reading, and the keep-out box spans everything from 0.375 in to 0.76 in + 1.2 in above the board bottom, so KDP's barcode lands on plain background wherever it goes.
- **Our own barcode, if ever needed:** vector preferred, raster at 300 PPI; 100% black (not RGB, CMYK or registration black); suggested 2 x 1.2 in, minimum 1.4 x 0.8 in; at least 0.25 in from spine and trim; solid white background; upright and square; not flattened into the cover image. The ISBN must match exactly; a price code, if present, must match the list price [S12].
- A QR code may appear elsewhere on the cover, never in the barcode space [S12]. Two-stage barcodes are not supported [S12].
- Transparency codes are retired for books created after November 2025 [S12].
- **Gildroot rule:** preflight keeps `cover.barcodeKeepOut` free of text and images, on a plain light background. On paperback it is the barcode box plus 0.125 in all round; on hardcover it also covers the band between the two readings above.

---

## 9. Printing cost and royalty (Amazon.com)

### 9.1 Printing cost [S8][S9]

`printing cost = fixed cost + (page count x per-page cost)`. Bleed and cover finish don't change the cost; trim class, page count, ink and paper do [S8][S9].

| Book | Pages | Regular trim | Large trim |
|---|---|---|---|
| Paperback, black ink, white or cream | 24–110 | $2.30 flat | $2.84 flat |
| | 112–828 | $1.00 + $0.012/page | $1.00 + $0.017/page |
| Paperback, groundwood | 24–112 | $2.23 flat | $2.75 flat |
| | 114–828 | $1.00 + $0.0114/page | $1.00 + $0.0162/page |
| Paperback, premium color | 24–40 | $3.60 flat | $4.20 flat |
| | 42–828 | $1.00 + $0.065/page | $1.00 + $0.08/page |
| Paperback, standard color | 72–600 | $1.00 + $0.0255/page | $1.00 + $0.0402/page |
| Hardcover, black ink | 75–108 | $6.80 flat | $7.49 flat |
| | 110–550 | $5.65 + $0.012/page | $5.65 + $0.017/page |
| Hardcover, premium color | 75–550 | $5.65 + $0.065/page | $5.65 + $0.080/page |

KDP's page ranges overlap at 110 pages ("24–110" and "110–828" for paperback) [S8]; the note "24–110 pages only incur the fixed cost" decides it: 110 pages is flat. KDP's own example rounds 1.00 + 333 x 0.012 = 4.996 to $5.00 [S10], so we round to the nearest cent. The Paperback Royalty page says trim size doesn't affect printing cost [S10]; the Printing Cost page's large-trim column says it does [S8]. We follow the cost table.

### 9.2 Royalty [S10][S11]

`royalty = (royalty rate x list price) - printing cost`

- 50% for list prices at or below $9.98; 60% at or above $9.99. Same rule for paperback and hardcover on Amazon.com [S10][S11].
- Expanded Distribution (paperback only): 40% of list price minus printing cost [S10][S13].
- Minimum list price = printing cost / royalty rate, using the rate that applies at that price [S8][S9]. Our code rounds up to the cent so the royalty is never negative. Enrolling in Expanded Distribution changes the minimum [S36]; our code uses printing cost / 0.40 for it.
- Maximum list price: $250 [S8][S9].
- KDP's examples: 333-page regular paperback at $15: (0.60 x $15) - $5.00 = $4.00; the same book through Expanded Distribution: (0.40 x $15) - $5.00 = $1.00 [S10]. 300-page regular hardcover: $5.65 + 300 x $0.012 = $9.25 [S9].

### 9.3 Worked examples: 120 and 200 pages, black ink, white paper

| Binding | Trim | Pages | Printing cost | Minimum list price | Royalty at $19.99 | at $24.99 | at $34.99 |
|---|---|---|---|---|---|---|---|
| Paperback | 6 x 9 (regular) | 120 | 1.00 + 120 x 0.012 = **$2.44** | $4.88 | $9.55 | $12.55 | $18.55 |
| Paperback | 6 x 9 (regular) | 200 | 1.00 + 200 x 0.012 = **$3.40** | $6.80 | $8.59 | $11.59 | $17.59 |
| Paperback | 8.5 x 11 (large) | 120 | 1.00 + 120 x 0.017 = **$3.04** | $6.08 | $8.95 | $11.95 | $17.95 |
| Paperback | 8.5 x 11 (large) | 200 | 1.00 + 200 x 0.017 = **$4.40** | $8.80 | $7.59 | $10.59 | $16.59 |
| Hardcover | 6 x 9 (regular) | 120 | 5.65 + 120 x 0.012 = **$7.09** | $11.82 | $4.90 | $7.90 | $13.90 |
| Hardcover | 6 x 9 (regular) | 200 | 5.65 + 200 x 0.012 = **$8.05** | $13.42 | $3.94 | $6.94 | $12.94 |
| Hardcover | 8.25 x 11 (large) | 120 | 5.65 + 120 x 0.017 = **$7.69** | $12.82 | $4.30 | $7.30 | $13.30 |
| Hardcover | 8.25 x 11 (large) | 200 | 5.65 + 200 x 0.017 = **$9.05** | $15.09 | $2.94 | $5.94 | $11.94 |

7 x 10 and 8 x 10 are large trims and cost the same as 8.5 x 11 at the same page count. Example: an 8.5 x 11 paperback of 120 pages at $24.99 earns 0.60 x 24.99 - 3.04 = $11.95 per copy sold on Amazon.com.

---

## 10. ISBN and imprint [S26][S28][S29]

- Paperback and hardcover need an ISBN, except low-content books (§11) [S26][S28]. Each format needs its own [S28].
- **Free KDP ISBN:** the imprint shows as "Independently published", and the ISBN works only on KDP [S28][S29].
- **Own ISBN** (for example from Bowker): the imprint we register, such as "Gildroot Press", appears on the detail page. Title, author and imprint must match the ISBN agency record exactly, case and trailing spaces included; imprint field maximum 100 characters [S28][S29].
- The ISBN choice and the imprint are locked once published [S30].
- An ISBN printed in the manuscript must match the one entered in title setup [S26].
- **Decision needed from the owner (Amber: new paid service):** buy ISBNs so the imprint reads "Gildroot Press", or use free KDP ISBNs and accept "Independently published".

---

## 11. Low-content books [S24]

- **Definition:** "minimal or no content on the interior pages ... generally repetitive, and designed to be filled in by the user." Examples KDP lists: notebooks, planners, journals, prompt journals, log books, coupon books, score cards, crafting templates, blank sheet music. Not generally low-content: nonfiction, puzzle books, coloring books, photography, manuals, textbooks, children's books. KDP notes there can be exceptions.
- **Rules:** tick the Low-content box under Categories; not ticking it (or ticking another box) for a low-content book gets it rejected. ISBN is optional; the free KDP ISBN is not available. Choose "Publish without an ISBN" (KDP places a barcode) or "Use my own ISBN". The ISBN choice can't be changed later; changing it means unpublishing and republishing.
- **Limits:** no Expanded Distribution (whatever the ISBN option); no series; no Read Sample (Look Inside) or back-cover thumbnail when published without an ISBN; no Release Date scheduling. Detail pages and updates can take up to 10 business days [S31].
- The low-content checkbox is locked after publishing [S30].
- Expanded Distribution distributors also refuse "paperbacks containing frequent lined or blank pages, such as journals, notebooks, planners" [S13].
- **What this means for us.** A family-record book that is mostly blank pedigree charts and family group sheets to fill in fits KDP's definition (repetitive, filled in by the user). A book that teaches, explains or presents cited family data is not. Every title's manifest records `lowContent: true|false` with a one-line reason; if a book is borderline, the owner decides before upload.

---

## 12. AI-generated content disclosure [S25]

- KDP requires publishers to tell it about **AI-generated** text, images or translations when publishing a new book, and when editing and republishing an existing one. AI-generated images include cover and interior art.
- **AI-generated** means the content was created by an AI-based tool, "even if you applied substantial edits afterwards."
- **AI-assisted** content (you created it and used AI to edit, refine, error-check or improve it, or to brainstorm) does not need to be disclosed.
- The publisher is responsible for making sure all AI-generated or AI-assisted content follows the content guidelines, including intellectual property rights.

**What this means for us.** Gildroot is run by AI agents. Any sentence an agent drafts is AI-generated text under KDP's definition, even after the owner edits it. So:

1. Every manifest has `aiDisclosure: { text, images, translations }`, each true or false with a note.
2. Prose drafted by an agent sets `text: true`.
3. Our reading: charts drawn by our deterministic renderer (`web/src/app/charts/`) from GEDCOM or Wikidata data are not created by an AI-based tool, so they don't set `images: true` by themselves. Any picture made with an image model sets `images: true`.
4. When in doubt, disclose.

---

## 13. Metadata

### 13.1 Title and subtitle [S16][S26]

- The title field holds only the title as it appears on the cover. For print, the title must be on the front cover or spine and match the metadata [S26].
- Title and subtitle together: 200 characters or fewer [S16]. KDP notes readers skim past titles over 60 characters [S18].
- Not allowed in title or subtitle: repeated generic keywords ("notebook", "journal", "gifts", "books"), unauthorized references to other titles, authors or trademarks, implied contributors who weren't involved, sales rank ("bestselling"), promotions ("free"), punctuation only, placeholders ("unknown", "n/a", "blank", "none", "null"), HTML [S16][S26]. No URLs, genre descriptions or promotions in title, subtitle, series or edition [S27].
- A collection must say so ("Collection", "Compilation") [S26].
- Title, subtitle and primary author can be edited for 72 hours after first publication; after that they are locked and need a new edition [S30][S31].

### 13.2 Description [S17][S26]

- Maximum 4000 characters, counting HTML tags [S17].
- Not allowed: phone numbers, mail or email addresses, **website URLs**; reviews, quotes or testimonials; requests for reviews; ads or promotional material; time-sensitive information; availability, price or other ordering information; spoilers; keyword lists; emoji [S17][S26].

### 13.3 Keywords [S18][S26]

- Up to 7 keywords or short phrases; 2–3-word phrases recommended [S18][S26].
- Each slot holds 50 characters in the KDP form **(secondary [X4])**. KDP's help page only says "keep an eye on the character limit in the text field" [S18]. Tooling treats 50 as the limit.
- Avoid: words already in the title, contributors or categories; quality claims ("best"); time-sensitive words ("new", "on sale"); words common to the whole category ("book"); misspellings; spacing, plural or punctuation variants; other authors' names or books; brands we don't own; quotation marks; Amazon program names ("Kindle Unlimited", "KDP Select"); HTML [S18][S26]. KDP has "a zero tolerance policy for metadata that is meant to advertise, promote, or mislead" [S18].

### 13.4 Categories [S19][S26]

- Choose up to **3** categories, based on primary audience and primary marketplace [S19][S26]. We always use all 3. Changes take up to 72 hours [S19]. KDP may change categories that don't fit the book [S19][S25].

### 13.5 Other details

- Primary audience: answer the sexually-explicit question (No for us); reading age is optional [S26].
- Locked after publishing: language, title, subtitle, edition, primary author, publication date, low-content checkbox, ISBN choice, imprint, trim size, royalty rate. Editable: contributors, description, keywords, categories, reading age, territories, price, Expanded Distribution [S30].

---

## 14. Content rules that shape the gildroot.com page [S27]

KDP does not allow, among other things [S27]:

- content "whose primary purpose is to solicit or advertise";
- content that "redirects readers to an external source to obtain the full content";
- bonus content that appears before the book's primary content;
- content "excessively reused, recycled, or repeated within or across books";
- content "rebranded or re-released with significant changes to the metadata".

KDP has "a zero-tolerance policy for any book content meant to advertise, promote, mislead" [S27]. Covers that closely resemble another book's layout, colors, fonts or images are not allowed [S26].

**Gildroot rules that follow from this:**

1. Every book is complete on paper. Nothing in it needs gildroot.com to be usable.
2. At most one page mentions gildroot.com, placed after the main content (back matter). It says plainly what the site does. No discount codes, no prices, no urgency.
3. The Amazon description never contains a URL [S17].
4. The back cover may carry the Gildroot Press wordmark. No offers on the cover.
5. No two titles share most of their interior. A new trim size of the same book is a format of that book, not a new title.

---

## 15. Title creation limit

- **Now:** "we limit the number of titles you can create at the same time to 2 per book format each week" [S2][S20]. Formats are counted separately (paperback, hardcover, eBook) **(secondary [X1][X3])**.
- KDP's forum announcement, as quoted: "Starting Monday, September 21, 2026, you can create up to 2 titles per format per week" and "Your weekly limit resets every Sunday at 12:00 AM UTC." Unused allowance doesn't carry over, and edits, cover changes and price changes to existing books are not limited **(secondary [X2][X3])**. The limit before 21 September 2026 was 10 per format per week **(secondary [X1][X3])**; the first limit, in September 2023, was 3 titles per day **(secondary [X3])**.
- KDP's help pages on 2026-09-30 state no per-day limit and no separate limit for new accounts; the weekly limit applies to every account [S2][S20].
- **Plan:** at most 2 new paperbacks and 2 new hardcovers per week, counted Sunday to Saturday (UTC).

---

## 16. Review and timelines [S15][S22][S31]

- Print Previewer checks margins, cover size and fonts automatically; after submission a person reviews the interior and cover [S22]. Reviewing the book in Previewer is a required step of title setup [S37], and proofs can't be ordered until the book is approved there [S21].
- Paperback and hardcover detail page: up to 72 hours on Amazon.com, up to 5 days elsewhere; low-content books up to 10 business days [S31].
- Manuscript or cover updates: up to 72 hours; price updates: 72 hours to 5 business days [S31].
- Read Sample (Look Inside): 9–10 business days [S31].

---

## 17. Proofs and author copies [S21][S34][S35]

- Proofs can be ordered while the book is a draft, after it is approved in Print Previewer. Up to 5 proof copies per order [S21].
- Proofs carry a "Not for Resale" watermark and a barcode without the ISBN [S34].
- KDP emails a checkout link within 4 hours; the proof leaves the cart if not bought within 24 hours of that email [S21].
- Author copies: only for Live books, up to 999 per order; they can be resold or given away [S21][S34].
- Price: printing cost per copy for the chosen marketplace, plus shipping; no free or Prime shipping; no royalties; not shown in KDP reports [S21][S34][S35].
- Hardcover proofs and author copies for Canada are ordered from Amazon.com [S21].
- **Gildroot rule:** order and inspect a printed proof of every new trim, paper and binding combination before the book goes live.

---

## 18. Expanded Distribution (paperback only) [S13]

- 40% royalty minus printing cost [S10][S13]. Can take up to eight weeks to reach booksellers [S13].
- Eligible with black ink and white paper: 5 x 8, 5.06 x 7.81, 5.25 x 8, 5.5 x 8.5, 6 x 9, 6.14 x 9.21, 6.69 x 9.61, 7 x 10, 7.44 x 9.69, 7.5 x 9.25, 8 x 10 and 8.5 x 11. Not eligible: 8.25 x 6, 8.25 x 8.25, 8.25 x 11 and (on white) 8.5 x 8.5. A4 (8.27 x 11.69) is not listed. 8.5 x 11 is eligible on white paper and on standard or premium color, but not on cream or groundwood [S13].
- Distributors may refuse books with frequent lined or blank pages, public-domain content, coloring books and heavy-ink interiors [S13]. The same page carries an unlabeled table of topics that includes "Workbooks", "Biographies", "Activity books" and "How-to books" [S13]. We don't count on Expanded Distribution for any title.

---

## 19. Places where KDP's own pages disagree

| Topic | What the pages say | What we do |
|---|---|---|
| Hardcover wrap | "0.51 in (15 mm)" [S7]; calculator 0.591 in (15 mm) [S6] | 15 mm (calculator) |
| Hardcover text inset | "0.635 in (16 mm) from the edge" [S7]; calculator: wrap + 0.125 in board margin = 0.716 in [S6] | calculator (stricter) |
| Hardcover barcode | 0.76 in "from the bottom of the cover" [S7]; calculator: 0.375 in above board bottom [S6] | barcode 0.76 in above board bottom; keep-out covers both |
| Spine text minimum | "at least 79" [S5][S15], "more than 79" [S2][S5], Cover Creator 80 [S5] | 80 billed pages |
| Standard color spine | one "Color paper" factor 0.002347 [S2]; 0.002252 [S5]; calculator 0.002252 [S6] | 0.002252 |
| Large trim cost | "Trim size ... don't affect printing cost" [S10]; large-trim cost column [S8] | cost table [S8] |
| Hardcover minimum pages | 75 [S3][S4]; calculator minimum 76 [S6] | 76 billed pages (same thing after rounding) |
| Spine shift | "0.0125 in (3.2 mm)" [S5] | 0.125 in (3.2 mm) |
| 5.5 x 8.5 bleed width | "5.626 in" [S1] | 5.625 in (formula) |
| Margin with bleed | 0.375 in, reference edge not stated [S1] | measured from trim (stricter) |

If KDP rejects a file over one of these, update this table and the code the same day.

---

## 20. `tools/books/kdp.mjs`

`kdpGeometry({ trim, pages, paper = 'white', bleed = true, binding = 'paperback', customTrim = false })` returns:

| Field | Meaning |
|---|---|
| `interiorPageIn {w,h}` | PDF page size for the interior (§5.1) |
| `marginsIn {inside, outside, top, bottom}` | minimum margins from the trim line (§5.2) |
| `trimBoxIn(pageNumber)` | where the trim sits on a 1-based PDF page: odd pages are right-hand pages, so they bleed on the right (§5.1, §5.3) |
| `spineIn` | spine width (§6) |
| `coverIn {w,h}` | full cover PDF size (§7) |
| `cover` | panels, safe areas, hinges, board, barcode box and keep-out, in inches from the cover's top-left corner |
| `spineTextAllowed` | §6.3 |
| `printCostUsd`, `minListPriceUsd`, `maxListPriceUsd` | §9, Amazon.com |
| `royaltyAt(price, {channel})` | §9.2; throws below the minimum or above $250, and for Expanded Distribution on hardcover |
| `billedPages`, `pageRange`, `largeTrim`, `warnings` | §2–§3 |

`paper` is one of `white`, `cream`, `groundwood`, `standard-color`, `premium-color`; the ink follows from it. Invalid combinations (an 8.5 x 11 hardcover, a 600-page 8.5 x 11 paperback, groundwood hardcover) throw `KdpSpecError`. `KDP_RULES` exports the numeric limits the preflight uses. Tests: `node --test web/test/books/`.

---

## 21. Preflight checklist (enforced by tooling)

A book ships to KDP only when every item passes. Items marked (warn) report but don't block.

**Interior PDF**

1. Every page is exactly `interiorPageIn` (±0.001 in); single pages; one orientation. [S1][S2]
2. Page count is even and inside `pageRange` for the trim, paper and binding. [S2][S3]
3. No text or non-bleed art inside the margins in `marginsIn`, measured from the trim line on mirrored pages. Art that crosses the trim reaches the bleed edge. [S1][S22]
4. All fonts embedded; no Type 3, no variable fonts; no faux bold or italic. [S2][S23]
5. No text under 7 pt. [S2]
6. No stroke under 0.75 pt. [S2]
7. No gray fill lighter than 10% on black-ink books (warn). No color on black-ink books (warn). [S2]
8. Every raster image at least 300 PPI at its placed size; over 600 PPI (warn). [S2][S14]
9. No annotations or links, bookmarks, comments, form fields, JavaScript, encryption, Info or XMP metadata, crop marks or creation watermarks. [S2][S15]
10. No transparency: no soft masks, no constant alpha below 1, no blend modes. [S2][S22]
11. No run of more than 4 blank pages at the start or middle, or more than 10 at the end. [S15]
12. Folios, where printed, are even on left pages and odd on right pages. [S2]
13. Title, subtitle, author, edition and ISBN on the title and copyright pages match the manifest exactly. No binding or bundle words. [S15][S26]
14. At most one page mentions gildroot.com, and it comes after the main content. [S27]
15. File at most 650 MB; file name matches `[a-z0-9-]+\.pdf`. [S2]

**Cover PDF**

16. One page, exactly `coverIn` (±0.001 in). [S5][S6]
17. Background art reaches every edge of the file. [S5][S22]
18. All text inside `cover.safe`; no spine text unless `spineTextAllowed`. [S5][S7]
19. Nothing but plain background inside `cover.barcodeKeepOut` (when KDP places the barcode). [S7][S12]
20. Fonts embedded, no Type 3; no text under 7 pt; images at least 300 PPI; no transparency; no spot colors. [S5][S7]
21. Cover title, subtitle and author match the manifest exactly. [S5][S26]
22. File at most 40 MB (warn); at most 650 MB. [S5]

**Listing manifest**

23. Title plus subtitle at most 200 characters, with none of the banned terms in §13.1. [S16][S26]
24. Description at most 4000 characters including HTML; no URLs, email addresses, phone numbers, reviews, quotes, prices, dates or emoji. [S17]
25. At most 7 keywords of at most 50 characters each, with none of the banned terms in §13.3. [S18][X4]
26. 1 to 3 categories chosen (house target: 3). `lowContent` set with a reason, and an ISBN option that matches it. [S19][S24]
27. `aiDisclosure` present for text, images and translations. [S25]
28. List price between `minListPriceUsd` and $250; royalty recorded. [S8][S9][S10]
29. Release plan keeps new titles to 2 per format per week. [S2][S20]
30. A printed proof of this trim, paper and binding has been approved. (Gildroot rule) [S21]
