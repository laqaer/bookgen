# Gildroot Press: the launch lineup

Decided on 2026-09-30 by the publisher role, from `books/MARKET.md` (market research) and `books/KDP_SPEC.md` (KDP production rules). Every cost and royalty below was computed with `tools/books/kdp.mjs` from KDP's price tables as read on 2026-09-30. Nothing here has been uploaded to Amazon. Uploading, buying ISBNs and setting the PDF prices all need your written approval (the Amber list in `ops/README.md`).

## The decision in one table

| # | Title | Format | Pages | Paper | List price | Printing cost | Royalty per copy (Amazon.com, 60%) | On sale |
|---|---|---|---|---|---|---|---|---|
| 1 | **The Family Record** | 8.25 × 11 in, paperback and hardcover, one interior | 216 | cream | $19.99 paperback, $29.99 hardcover | $4.67, $9.32 | $7.32, $8.67 | by 11 Nov 2026 |
| 2 | **In Your Own Hand** | 7 × 10 in, paperback and hardcover, one interior | 160 | cream | $14.99 paperback, $24.99 hardcover | $3.72, $8.37 | $5.27, $6.62 | by 11 Nov 2026 |
| 3 | **The Research Ledger** | 8.5 × 11 in, paperback | 180 | white | $19.99 | $4.06 | $7.93 | by 5 Jan 2027 |
| 4 | **Both Our Families** | 8.25 × 11 in, paperback and hardcover, one interior | 96 | cream | $16.99 paperback, $29.99 hardcover | $2.84, $7.49 | $7.35, $10.50 | by 15 Apr 2027, if the keyword check passes |

Each title also has a printable PDF edition for gildroot.com, the same pages set on US Letter and A4. The proposed price is $12 each, which needs your approval.

Every book uses Gildroot's own charts, drawn blank by the chart engine: title 1 uses the fan and the pedigree chart, title 2 the fan, title 3 the pedigree chart, and title 4 the bowtie. Together the four books show all three chart types we sell.

## Why these four

- **Title 1 is a Gildroot chart in book form.** Its buyers are the Keeper and the Gift Giver, and the next step from a filled-in book is a chart on the wall. The complaints in this category are about room and structure, which careful layout can fix.
- **Title 2 sells best.** Life-story journals are the largest category we looked at: the leading title has more than 12,000 ratings. It sells at every gift date (Christmas, Mother's Day, Father's Day, Grandparents Day), which evens out the chart business's Q4 peak. It is also the most crowded category, so it wins only on specific differences: bigger type stated in points, questions that fit every kind of life, and a real tree page.
- **Title 3 serves our primary customer all year.** The Keeper buys tools in January and at RootsTech (4–6 March 2027). Free forms from NEHGS and FamilySearch set a price of $0 for single forms, so the book has to earn its price with complete sets, handwriting-sized fields and real census columns.
- **Title 4 is the one bet.** We found no established book that records both families joined by a marriage. Buyers use wooden guest-book trees at $100–$200 and Etsy prints at $14–$18. It is also the only title that uses the bowtie, the chart we already sell to couples.

## What I changed from the market report, and why

1. **All four books are declared low-content.** KDP defines low-content as pages "generally repetitive, and designed to be filled in by the user", and names "journals, prompt journals, log books" as examples. All four books fit that definition. The market report judged titles 1–3 to be ordinary books, but a book declared the wrong way is rejected, while declaring low-content costs us almost nothing: we don't rely on Expanded Distribution, and series and pre-orders don't matter here. There is one real consequence. Low-content books cannot use KDP's free ISBN. Published without an ISBN, a book has no "Look Inside" preview, and the preview is how a buyer sees that our pages are better. **So buying ISBNs is the most important decision you have to make** (see "What I need from you").
2. **Title 1 has 216 pages, not 212.** Seventeen linked pedigree charts give every one of the 255 ancestors exactly one box. The market report planned 20 charts, which would have printed some people twice. Five pages that earn their place were added: a chart map, a facing page of instructions for the fan, and a fifth page of instructions. The hardcover is priced at $29.99, not $34.99, which keeps it near the price of a Heirloom chart ($29) and near the comparable KDP hardcover, which sells at $18.99.
3. **Title 2 sets its questions at 16 pt, not 14 pt.** Large-print guidelines generally start at 16 pt, so 14 pt would make the claim hard to defend. Every question in the book is 16 pt, and every other line of text is at least 14 pt, the copyright page included. Only the page numbers are smaller. The back cover prints these numbers.
4. **Title 3 has 180 pages, not 200.** The extra pages go to the forms people use up (40 pages of research log, 12 family group sheets, 2 copies of every census from 1850 to 1950). Adding blank pages to reach a round number would be the padding reviewers complain about.
5. **Title 4 is renamed "Both Our Families".** "Two Families Wedding Family Tree" is already the name of a product sold on familytreetemplates.net.
6. **Title 4's test moves from our website to Amazon.** gildroot.com is launching now and has almost no traffic, so a PDF that doesn't sell there would tell us nothing about demand. The test is keyword data instead: once OpenSEO has credits, we check search volume for "wedding family tree", "anniversary gift for parents book" and similar terms. If there is demand, the book goes on Amazon before wedding season. The PDF can still be offered to couples who buy the $29 bowtie chart.
7. **The one website address in each book is gildroot.com/books.** For a 70-year-old typing it, "books" is the plainest word, and the page lives in `web/src/books/`, which this workstream owns.

## Rules every book follows

These rules are what "better designed" means for this lineup, stated as numbers so they can be checked.

- **Room to write.** No writing line sits closer than 9 mm to the next in the record books (titles 1 and 4) or 10 mm in the journal (title 2). No form row in the ledger (title 3) is under 8 mm tall. Every date field is at least 35 mm wide, enough for "24 May 1819" written by hand. Every place line runs the full width of its column.
- **Gutter.** The inside margin is 0.875 in in titles 1 and 3 and 0.75 in in titles 2 and 4, well above KDP's 0.5 in minimum. The fields that people write in most never run into the spine. (KDP can't print lay-flat bindings, and this is the next best thing.)
- **Type.** Titles are set in Cormorant Garamond, text and prompts in EB Garamond, and form labels in the house sans. All are static TTF fonts; there are no variable fonts and no Type 3 fonts. Text is solid black on the page, with no gray text and no tints, so every page photocopies and scans cleanly.
- **Charts.** The chart engine draws all charts in a new blank mode, with Ahnentafel numbers printed in each slot. For print, every line is at least 0.75 pt (KDP's minimum), so the site's gold hairlines are thickened in the books. There is no transparency anywhere.
- **Families of every shape.** Forms say "Partner" and "Partner", not husband and wife. Each parent has a box for the kind of relationship: birth, adoptive, step, foster or guardian. There is room for more than one partnership. Nothing assumes marriage, children, religion or a comfortable childhood. By tradition, the Ahnentafel system gives fathers even numbers and mothers odd numbers. The books say so once and tell readers to treat the numbers as positions, not labels.
- **No invented people.** The filled examples use only Queen Victoria's ancestry from the CC0 Wikidata sample (`web/src/samples/victoria.ged`), plus, for title 4, Prince Albert's ancestry pulled from Wikidata with `tools/showcase/`. Examples only fill in fields that the data contains. The fact-checker signs off on every filled page, every record date and every census column before print.
- **A test for labels and spelling.** `web/test/books/` gets a check that every form label comes from one reviewed list, so "Date of Death" can never print as "Date of Birth", and a spelling check covers every printed string. This fixes the cheap-clone errors reviewers name ("qustion"; the wrong label printed on a date field).
- **Complete without the website.** Nothing in any book needs gildroot.com to be usable.

## The one Gildroot page (the last page of every book)

The page carries one small chart drawn by the engine and two short paragraphs. It has no prices, no offers, no discount codes and no QR code. The draft wording below goes to voice review and the fact-checker:

> The charts in this book were drawn by the program Gildroot uses to set family trees for framing. If your family tree is kept in a family tree file, gildroot.com can set it as a fan, pedigree or bowtie chart. The file is read on your own computer. Nothing is uploaded.
>
> Extra blank pages for this book, to print at home, are at gildroot.com/books. The page does not ask for an email address.

What the page at gildroot.com/books offers:

- continuation pedigree charts and person pages for generations 9 and beyond;
- a blank 5-generation fan and a blank bowtie;
- extra journal answer pages;
- the PDF editions, once you approve the price.

The page asks for no email address, as KDP's rules and our privacy line require. The Amazon descriptions never contain a URL.

---

## 1. The Family Record

**Subtitle:** A Family Tree Book for 255 Ancestors, Eight Generations Back, with Room to Write Every Date and Place

**In one line:** Every one of your 255 ancestors has a numbered place, with a full line for each date and place.

**Who it's for:** the Keeper, recording what they have found, and the Gift Giver, buying for a parent who "does the family tree". The record guide at the back covers the US first.

**Format:** 8.25 × 11 in. It is a custom trim for the paperback and a standard trim for the hardcover, so one interior serves both. Cream paper, black ink, 216 pages. The spine is 0.54 in on the paperback and 0.729 in on the hardcover.

**Contents, in order (216 pages):**

| Section | Pages |
|---|---|
| Title page, copyright page (with type sizes and line spacing stated), contents, "This record was kept by" | 4 |
| How to use this book: what the numbers mean; writing dates and places; unknowns, estimates and records that disagree; adoptive, step, foster and birth parents; noting where you found it | 5 |
| A filled example, as a true two-page spread: Queen Victoria's first four generations as a pedigree chart, and her person page, from the CC0 Wikidata sample | 2 |
| Five generations at a glance: a page of instructions facing a blank 5-generation fan with 31 places | 2 |
| Pedigree charts: a chart map; chart 1 (people 1–15); charts 2–17, one for each of the 16 great-great-grandparents (people 16–255); 4 blank charts for other lines (adoptive, step or birth) | 22 |
| Person pages: a full page each for people 1–31; half a page each for people 32–255 (112 pages). Each page names its parents' and child's numbers and the pages they are on | 143 |
| Partnerships and children: one page for the reader's own partnerships, and one for each of the 15 couples in generations 2–5, with 12 child rows and an "other parent" column | 16 |
| Other parents: a table keyed to the Ahnentafel numbers | 2 |
| Sources: numbered source list, referred to from the person pages | 8 |
| Where the records are: US censuses 1790–1950 and the lost 1890 census; when each state began recording births and deaths; then England and Wales, Scotland, Ireland, Canada and Germany | 4 |
| How are we related: relationship chart | 1 |
| Heirlooms, photos and documents | 4 |
| Notes | 2 |
| The Gildroot page | 1 |

**Charts:** a blank 5-generation fan (31 places); 21 blank 4-generation pedigree charts (17 numbered, which hold every one of the 255 ancestors exactly once, plus 4 for other lines); a filled 4-generation pedigree of Queen Victoria; a blank 8-generation fan drawn as line art on the cover; a small filled fan on the Gildroot page.

**Review complaints it answers** (sources are in `books/MARKET.md`):

- "not enough writing space to even include born and passing dates ... let alone the city" (Peter Pauper, [S7]). Every place line here runs the full width of its column, with 9 mm between lines.
- "THE BOOK IS LIMITED IN HOW MANY COPIES THEY GIVE YOU" ([G1]) and "did not include enough pedigree sheets" ([G3]). All 255 ancestors have a place, and continuation sheets are at gildroot.com/books.
- Readers who found more than 7 generations and ran out of room ([S5]). This book has 8 generations.
- A record timeline that covers only the UK ([HH1]). Here the US comes first, then five other countries.
- "challenging to organize my family tree in a way that felt cohesive and visually appealing" ([G1]). The engine draws the charts, and each chart gives page numbers for the people on it.
- "Date of Death" printed as "Date of Birth", and "really cheaply made" ([S9]). A label test and a printed proof prevent both.
- Families outside a two-parent first marriage left out ([Q1]). This book has plural partners, typed parent relationships, pages for other parents and charts for other lines.

**Cover:** a midnight ground (`#0B1024`) with the whole 8-generation fan drawn blank in leaf-gold 0.75 pt lines: 255 empty wedges that read as a fine engraved texture. The title sits in the medallion at the hub, in Cormorant Garamond, in leaf gold, with the subtitle in vellum below. The back cover, in vellum type, gives the numbers: "255 numbered places. 17 linked pedigree charts. 9 mm between lines. 216 pages, cream paper." It also shows a small unfilled person page and the Gildroot Press quarter-fan mark. The barcode box stays plain. The spine carries the title and the mark. Gold appears only on midnight, following the brand rule.

---

## 2. In Your Own Hand

**Subtitle:** A Large-Print Book of 160 Questions for a Parent or Grandparent to Answer About Their Life

**In one line:** 160 questions in 16-point type, with room to answer in your own hand. Skip any question; every chapter offers other ways in.

**Who it's for:** the Gift Giver (aged 30–55), buying for a parent or grandparent aged 70 or more, who will do the writing. It is one book for a mother, father, grandmother or grandfather. We don't publish gendered near-copies, because KDP rejects books that are "minimally differentiated".

**Format:** 7 × 10 in. Both bindings come in this trim, so one interior serves both. Cream paper, black ink, 160 pages. The spine is 0.40 in on the paperback and 0.589 in on the hardcover.

**Contents, in order (160 pages):**

| Section | Pages |
|---|---|
| Title page; copyright page (with type sizes stated); "Written by ___ for ___"; contents | 4 |
| How to use this book: skip anything, write as much or as little as you like, where to find more room | 2 |
| The people before you: instructions and a blank 4-generation fan with the storyteller at the center (15 places), including a box for the people who raised you, if they aren't the people in the fan | 2 |
| The people after you: children, their partners, grandchildren and great-grandchildren, including step, adopted and chosen family | 2 |
| Short answers: facts and favorites | 4 |
| Eight chapters of 20 questions each: where you began; the people who raised you; growing up; work and learning; love, friendship and partnership; home and the people you made it with; the world you lived through; what you want remembered. Each chapter has an opening page that gives permission to skip and other ways in, then 10 questions with a full page each and 10 with half a page each (16 pages per chapter) | 128 |
| A letter to the family | 3 |
| Photos and keepsakes | 6 |
| More room: extra lined pages | 8 |
| The Gildroot page | 1 |

Chapters start on right-hand pages (pages 15, 31, 47 and so on).

**Chart:** a blank 4-generation fan with the storyteller at the center (15 places), drawn by the engine, plus a small filled fan on the Gildroot page. The cover repeats the fan as line art.

**Review complaints it answers:**

- "My grandma has a hard time reading it because the writing is small" ([P2]); "the print is very light and very small" ([P4]). Here questions are 16 pt in solid black, all other text is at least 14 pt, and the back cover prints those numbers.
- "geared towards those with two parents, family vacations ... that's not me" ([Q1]); "None of these questions apply to the life I lived" ([T1]). The questions ask about "the people who raised you" and assume no marriage, children, religion or comfortable childhood. Every chapter opens with "Skip any question" and two or three other ways into the topic.
- Some questions felt "odd or personal" ([P3]). Sensitive questions are marked optional, gently worded and placed late in each chapter.
- Readers wanted more room, and found typos ([P1]). Half the questions get a full page with lines 10 mm apart, there are 8 extra pages, and a spelling test runs over every printed string.
- Several grandchildren each wanted a copy ([P3]). There are no tints and nothing written in the gutter, so a filled book photocopies and scans cleanly. The PDF edition prints extra blank copies.
- For an 80-year-old, typing, apps and surprise charges are hard ([T1]). This book is paper only, sold at one price, with nothing to sign up for.

**Cover:** an oxblood ground (`#6E1F1B`) with the title in large Cormorant Garamond italic in vellum. It sits on real ruled lines 10 mm apart, the same spacing as inside, with the 4-generation fan in vellum line above them. There are no photos. The back cover, in vellum type, says: "Questions in 16-point type. Instructions in 14-point type. Answer lines 10 mm apart. 160 pages, cream paper." It also gives two sample questions and the Gildroot Press mark. The barcode box stays plain.

**Needed before print:** an originality check of all 160 questions against the text of the best-selling journals, so we copy no one's list, wording or order (MARKET.md open issue 5). The free Family Stories Journal planned for `/journal/` (BRIEF §5, item 7) must use a different set of questions. It is an interview guide for the person asking; this book is written by the person answering. Sharing text between the two would break KDP's rules on reused and freely available content.

---

## 3. The Research Ledger

**Subtitle:** Genealogy Forms for Research Logs, US Census Extractions from 1790 to 1950, Records Requests and DNA Matches, Sized for Handwriting

**In one line:** Every form a working family historian uses, sized for handwriting, with the real column headings of each surviving US census from 1790 to 1950. Most of the 1890 census was lost in a fire, so the book says so instead of giving it a sheet.

**Who it's for:** the Keeper, doing research. It is bought all year as a tool rather than a gift, with peaks in January and around RootsTech.

**Format:** 8.5 × 11 in paperback. White paper, because it takes pencil well and photocopies cleanly. Black ink, 180 pages, spine 0.405 in. There is no hardcover, because a desk tool should be cheap to replace. The PDF edition matches the book page for page, so a buyer can print as many copies of a form as they need.

**Contents, in order (180 pages):**

| Section | Pages |
|---|---|
| Title page, copyright page, contents, "This ledger belongs to" and research focus | 4 |
| How to use the ledger: the research cycle on one page; the numbers that link the forms (person number, source number, log line); citing a source in four parts; an annotated example of each form. Filled examples use real public-domain records checked by the fact-checker, never an invented family | 12 |
| Research plans | 8 |
| Research logs, with a citation column and a "searched, not found" column | 40 |
| Research pedigree charts, blank, 4 generations, with a proof-status box for each person | 8 |
| Ahnentafel index, people 1–127 | 5 |
| Family group sheets, each a two-page spread with 16 child rows | 24 |
| US federal census extraction sheets: 1790–1840 (4 layouts); 1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940 and 1950 (2 copies each), each with the census's real column headings, printed sideways on the page | 24 |
| England and Wales: 1841; 1851–1901 (2 copies); 1911; 1921; the 1939 Register | 6 |
| Birth, marriage and death record abstracts | 12 |
| Probate, land and court abstracts | 6 |
| Correspondence and records-request log | 6 |
| DNA match tracker: shared cM, longest segment, testing company, cluster | 10 |
| DNA cluster worksheet | 2 |
| Shared cM ranges table, from the Shared cM Project (CC BY 4.0, attributed to Blaine Bettinger) | 1 |
| Relationship chart | 1 |
| Brick-wall planner | 4 |
| Timeline worksheet | 4 |
| Notes | 2 |
| The Gildroot page | 1 |

**Charts:** 8 blank 4-generation pedigree charts with proof-status boxes, drawn by the engine; a relationship chart built on the logic of the cousin calculator (`web/src/app/tools/`); a small filled pedigree chart on the Gildroot page; pedigree line art on the cover.

**Review complaints it answers:**

- "The spaces for writing in the charts and logs are tiny" ([G3]). Here the forms are letter size, no row is under 8 mm, and date fields are at least 35 mm wide.
- "they purposely did not include enough pedigree sheets" ([G3]). This book has 40 log pages, 12 family group sheets and 2 copies of each census, and the PDF edition prints without limit.
- "no instructions, making it no more than a blank pad of paper", and "qustion" misspelled ([S10]). Every form here has an annotated example, and a spelling and label test runs over the book.
- Running out of rows for children ([E1], [S16]). Family group sheets here have 16 child rows.
- Guidance written for another country ([HH1]). Here the census columns are real US columns from 1790 to 1950, and England and Wales is a second section.

**Cover:** a bone ground (`#F3EDE2`) in two inks, black and oxblood, in the Letterpress style. The front is ruled like a ledger page, the log's own columns in black 0.75 pt rules, with the title in bold Cormorant small capitals and one oxblood rule. The back lists every form and its page count and the Gildroot Press mark. The barcode box stays plain. It looks like a working book on purpose.

**Needed before print:** the fact-checker checks every census column heading against the original blank schedules (NARA for the US, The National Archives for England and Wales), and checks the Shared cM table's version and its attribution line.

---

## 4. Both Our Families

**Subtitle:** A Wedding and Anniversary Keepsake of the Two Families Joined by a Marriage, with a Family Tree of Four Generations on Each Side

**In one line:** Both families on one page: a bowtie chart with four generations on each side, and the stories behind them.

**Who it's for:** adult children buying for their parents' 25th or 50th anniversary (the Gift Giver, aged 30–55), and couples marrying (BRIEF Segment 3: "I want a picture of two families becoming one").

**Format:** 8.25 × 11 in, one interior for the paperback (custom trim) and the hardcover. Cream paper, black ink, 96 pages. The hardcover is billed at KDP's flat rate for 75–108 pages.

**Contents, in order (96 pages):**

| Section | Pages |
|---|---|
| Title page; copyright page; contents; "The families of ___ and ___, joined on ___ at ___" | 4 |
| How to use this book: for a wedding, for an anniversary; either family can go first; families of every shape | 2 |
| A filled example: Queen Victoria and Prince Albert's bowtie, from Wikidata (CC0), with a plain note that they shared a set of grandparents | 2 |
| Both families on one page: instructions and a blank bowtie with 4 generations on each side (30 places) | 2 |
| The first family: a 4-generation pedigree chart; person pages for the partner, their parents and grandparents; 10 pages of questions about this family; traditions, recipes and sayings; photos | 21 |
| The second family: the same | 21 |
| How we met | 6 |
| The wedding: the record (date, place, officiant, witnesses, where the certificate is kept); 12 pages for guests to sign with their name and how they are connected; the words that were said; photos | 17 |
| The years since: homes; children and grandchildren (step and adopted included); one page for each of five decades | 11 |
| Letters to the next generation | 6 |
| Notes | 3 |
| The Gildroot page | 1 |

**Charts:** a blank bowtie with 4 generations on each side (30 places); a filled Victoria and Albert bowtie, where pedigree collapse is marked and described neutrally; 2 blank 4-generation pedigree charts; bowtie line art on the cover.

**Gaps it fills:** there are no book reviews to mine, because we found no comparable book. What it answers instead:

- Couples now buy wooden guest-book trees at $100–$200 ([J1], [W1]) or Etsy prints that retype 3–4 generations by hand at $14–$18 ([W2]). This book records both families, the people and their stories, at a book price, and its guest pages double as the guest book.
- Anniversary and wedding journals are about the couple, not their families ([W3]). This book gives each family its own section.
- Every form says "Partner" and "Partner", and either family can go first.

**Cover:** a midnight ground, the companion to title 1, with the blank bowtie in leaf-gold 0.75 pt lines: two half-fans meeting at a center medallion that holds the title. The back cover states "Four generations of each family on one chart. 96 pages, cream paper." and carries the Gildroot Press mark.

**The gate:** the files will be ready by 31 January 2027. In February, pull US search volume for wedding and anniversary family-tree terms once OpenSEO has credits. If there is real demand, create the book in March and have it live by 15 April, ahead of the May–October wedding season. If there isn't, the PDF stays on gildroot.com next to the $29 bowtie chart and we don't create the Amazon title. The filled example needs one new data pull, Prince Albert's ancestors from Wikidata through `tools/showcase/`, checked by the fact-checker.

---

## Imprint, ISBNs and the KDP listing

- **Imprint:** Gildroot Press. The name shows on Amazon only if we use our own ISBNs.
- **ISBNs:** 7 in total, one per format: titles 1, 2 and 4 in paperback and hardcover, and title 3 in paperback. Bowker sells 10 for $295, which leaves 3 spare. Without them, low-content books publish with no ISBN, no imprint name and no Look Inside preview.
- **Low-content box:** ticked for all four titles. A one-line reason for each goes in each book's manifest.
- **Author field:** I recommend "Gildroot Press" as the name on the cover and in the author field. The text is written by the company's AI agents and edited by you, so a company name is the honest credit. A personal name would imply one person wrote it. The choice is yours.
- **AI disclosure:** text: yes, for all four, because the instructions, questions and form wording are drafted by agents (KDP counts this even after human edits). Images: no. The charts come from our deterministic chart engine, and the covers are type and engine line art; no image model is used anywhere. If that changes for any book, the answer becomes yes.
- **Series:** KDP doesn't allow series for low-content books. The four books read as a set through the covers (two midnight, one oxblood, one bone), the same type and the quarter-fan mark on every spine.
- **Descriptions and keywords:** written per book when its files are final. There will be no URLs, reviews, prices or dates. The keywords wait for real search data, because none could be pulled this week.

## Release calendar

KDP now allows 2 new titles per format per week, counted from Sunday 00:00 UTC. The plan stays inside that limit. Low-content detail pages can take up to 10 business days to appear.

| Date | What |
|---|---|
| Fri 2 Oct 2026 | Your decisions on ISBNs, KDP upload, author name and PDF prices (under the Amber rule, no answer in 72 hours means no) |
| Fri 9 Oct | Fact-checker signs off on the Victoria spread and the US record guide in title 1 |
| Fri 16 Oct | Interior and cover PDFs for titles 1 and 2 pass preflight |
| Week of Sun 11 Oct | You create 2 paperbacks and 2 hardcovers (titles 1 and 2), approve them in Print Previewer and order proofs (by Sat 17 Oct) |
| About Sat 24 Oct | Proofs arrive and are checked; fixes are made |
| Wed 28 Oct | Titles 1 and 2 published |
| Wed 11 Nov | Latest date for titles 1 and 2 to be live (10 business days), ahead of Black Friday and Christmas |
| 1 Dec | PDF editions of titles 1 and 2 on gildroot.com, if you approve the price |
| Fri 20 Nov | Title 3 files pass preflight; you create the paperback in the week of Sun 22 Nov and order a proof |
| Fri 11 Dec | Title 3 published; live before 5 Jan 2027 |
| 31 Jan 2027 | Title 4 files ready |
| February | Keyword check for title 4 |
| Week of Sun 7 Mar | You create title 4 (paperback and hardcover), if the check passes |
| 15 Apr | Title 4 live |

This schedule is tight for Christmas. The weakest link is proof shipping: if proofs arrive after 28 October, we publish the day they are approved, and the books go live later in November.

## What I need from you

1. **Buy ISBNs** from Bowker: 10 for $295. This is a new paid service (Amber). It is the only way to get "Gildroot Press" on the listing and a Look Inside preview for low-content books.
2. **Approve uploading** the four titles under your KDP account, on the calendar above. This is anything posted under your identity (Amber).
3. **Approve the list prices** in the table at the top, and **the $12 price for each PDF edition**.
4. **Choose the author name:** "Gildroot Press" (my recommendation) or your own name.
5. **Confirm the low-content declaration** for all four titles.
6. **Answer KDP's AI disclosure honestly** when you publish: text yes, images no.

## Open issues

- **No keyword data.** OpenSEO has no credits. Titles, subtitles and the ranking rest on reviews and the gift calendar, not search volume. When credits exist, pull the terms listed in MARKET.md open issue 1 before writing the keywords.
- **Amazon was never read directly.** Each proposed title was checked against the open web on 2026-09-30, and no book with any of the four titles turned up. Before you create each title, search Amazon itself for the exact title: titles lock 72 hours after publishing.
- **The quoted complaints are second-hand.** Before final copy, someone should read the 1–3 star Amazon reviews of Peter Pauper *Our Family Tree*, Heritage Hunter, *Mom, I Want to Hear Your Story* and *Tell Me Your Life Story, Grandma*.
- **The hardcover measurements are unconfirmed on paper.** KDP publishes no hardcover spine formula; ours was measured from its cover calculator. The first hardcover proof confirms it.
- **The chart engine needs a blank mode.** It must print Ahnentafel numbers, "continued on chart N" and "see page N" references, handwriting-sized slots and 0.75 pt minimum lines. The engine's letter-size limits (fan 6, pedigree 5, bowtie 4 generations) already cover every chart in this lineup.
- **No preflight script yet.** The 30-item checklist in KDP_SPEC.md §21 needs one before the first upload.
- **The Family History Book** (BRIEF v1.5, $49, typeset from a family tree file) is a different product: it prints finished research, and these books record research by hand. The Gildroot page in these books doesn't mention it until it exists.
