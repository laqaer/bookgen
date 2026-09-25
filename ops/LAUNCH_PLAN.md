# Launch plan (Q4 2026)

Q4 2026 is a soft launch and a learning period. The real revenue windows are Mother's Day (Sunday 9 May 2027), Father's Day (Sunday 20 June 2027), summer reunion season and Q4 2027. Search traffic compounds slowly, so the launch depends on three honest posts by the owner, creator and society seeding, and the email list.

## Dates

| Date | Owner | What |
|---|---|---|
| Fri 25 Sep – Fri 2 Oct | agents | Build v1 and pass the QA gate |
| same week | owner | `ops/OWNER_SETUP.md` steps 1–7; order the proof prints |
| **Mon 5 Oct** | agents | Soft launch: site, studio and free tools live. Checkout live (or the waitlist until the store is approved). Sitemap submitted. |
| Fri 9 Oct | owner | Lemon Squeezy fallback decision: switch to Gumroad if the store isn't approved |
| 5–12 Oct | agents | Fix what real files break. Publish the export guides and templates. First 10 creator and society emails. |
| **Tue 13 Oct** | owner | Show HN (morning, US Eastern) and r/Genealogy. Stay about 2 hours to answer. |
| **Wed 14 Oct** | owner | One large genealogy Facebook group whose rules allow sharing free tools |
| 14–31 Oct | agents | 2–3 pages a week, pins, outreach, top-5 fixes from real files |
| Tue 27 Oct | agents | First newsletter |
| Sat 31 Oct | operator | **Gate G1** (see `company/BRIEF.md` §11) |
| 5 Oct – Sun 8 Nov | agents | Founding families offer: Family Historian $49 (regular $59) |
| Mon 9 – Wed 25 Nov | agents | "Bring the tree to Thanksgiving" (Thu 26 Nov): Ask-the-family link, reunion sheets. Newsletter Tue 17 Nov. |
| Fri 27 Nov – Tue 1 Dec | agents | Family Pack $59 (regular $79). Emails 27 Nov and 1 Dec. No sitewide discount. |
| Wed 2 – Wed 16 Dec | agents | "A gift they'll frame": online-printer ship-by table (fact-checked), gift card. Newsletter Tue 8 Dec. |
| Thu 17 – Wed 23 Dec | agents | "Print it today": same-day printing guide (Walgreens, CVS, FedEx Office, Staples). Email Thu 17 Dec. |
| Thu 24 – Thu 31 Dec | agents | "Give it as a card": printable gift card. Email Wed 23 Dec. |
| 12–27 Dec | all | Release freeze: hotfixes only |
| Thu 31 Dec | operator | **Gate G2** |

## Rules for every post

- Posted by the owner, from the owner's own account, after reading the community's rules.
- Say plainly that big posters are paid ($29) and everything on screen is free.
- Say plainly that Gildroot is built and run with AI agents under the owner, and that charts are computed only from the user's own file.
- Stay to answer questions. The agents draft replies; the owner edits and posts them.
- No persona accounts, no asking friends to upvote, no cross-posting the same text to many groups.

## Draft: Show HN

**Title:** Show HN: Gildroot – print-ready family tree fan charts from a GEDCOM, entirely in the browser

**Body:**

> I built Gildroot to turn a family tree file into a chart that looks good enough to frame. You drop a GEDCOM exported from Ancestry, MyHeritage, RootsMagic or Gramps, pick a root person, and get a fan, bowtie ("two families") or pedigree chart, typeset for posters up to 24×36.
>
> Everything runs in your browser. The file is parsed in a Web Worker, laid out into a small scene format, and drawn twice from the same scene: on a canvas for the preview and with PDFKit for the vector PDF. Text is measured with the same font bytes that get embedded, so the paper matches the screen. Names on the inner rings are set one glyph at a time along the arc. We avoided svg2pdf because it silently dropped curved text and gradients in our tests. After the first load it works with wifi off.
>
> Free: every chart and style on screen, and a Letter/A4 PDF up to 5 generations. Paid ($29 once): poster sizes, all styles, tiled home printing, photo-lab JPEGs.
>
> The code and the guides were built and are run with AI agents, with me as the owner. The charts only ever contain what's in your file.
>
> I'd love feedback on the typography, and on GEDCOM files that break it. Sample chart: [link to the Queen Victoria sample]

## Draft: r/Genealogy

**Title:** I made a free, private way to turn your GEDCOM into a printable fan chart. Nothing gets uploaded.

**Body:**

> For anyone who has wanted to print their tree nicely, especially from Ancestry: you can drop your GEDCOM into gildroot.com and get a fan chart, a pedigree chart, or a "two families" bowtie for a wedding or anniversary. It runs entirely in your browser; your file isn't uploaded anywhere, and it works with your wifi turned off once the page has loaded.
>
> What's free: every chart and style on screen, editing names and dates, and a Letter/A4 PDF up to 5 generations. Posters (up to 24×36), the other styles and tiled home printing are $29 once.
>
> Two images attached: Queen Victoria's ancestors (from Wikidata) and a fictional sample family.
>
> I'd really like to know which export problems you hit with Ancestry and FamilySearch, and any file that makes it choke. Disclosure: I run it with help from AI agents; the charts only use your data.

## Draft: Facebook group

> A free way to print your family tree as a fan chart: gildroot.com. You drop in your GEDCOM (Ancestry, MyHeritage, RootsMagic…) and it draws the chart on your own computer; nothing is uploaded. Letter-size PDFs up to 5 generations are free; posters are $29. There's also a free cousin calculator: gildroot.com/tools/cousin-calculator/. Happy to answer questions.

## Creator and society seeding

The growth agent keeps the list and status in `ops/outreach/`. Offer: a free Professional key, the sample files, and early access to new styles. Societies get a 15% member code and earn 20% through a Lemon Squeezy affiliate account in the society's name. At most 10 personalised emails a week, one follow-up, no sequences.
