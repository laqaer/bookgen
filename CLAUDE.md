# Gildroot: operating manual for agents

Gildroot sells heirloom family-tree charts. A visitor drops a family tree file (GEDCOM) or types in a few generations, and gets a fan, bowtie or pedigree chart typeset well enough to frame. Everything runs in their browser; nothing is uploaded. Prices are one-time: Heirloom $29, Family Historian $59, Family Pack $79, Professional $149.

The company is run by a team of AI agents under one human owner. Read these before doing anything substantial:

- `company/BRIEF.md`: the strategy, product spec, pricing, voice rules, go-to-market and financial model. **Source of truth.**
- `docs/ARCHITECTURE.md`: the frozen code contract (Scene IR, module APIs, banned libraries).
- `design/SYSTEM.md`: the design system (tokens, components, do/don't).
- `ops/README.md`: how the operating team works (roles, cadence, KPIs, autonomy boundaries).

## Repo map

| Path | What |
|---|---|
| `web/src/` | The website and product. Pages are HTML with front matter; `web/build.mjs` builds them to `web/dist/`. |
| `web/src/app/engine/` | GEDCOM parsing and the family model (pure JS, runs in Node) |
| `web/src/app/charts/` | Layout to Scene IR, styles, canvas/PDF/tile/raster renderers |
| `web/src/make/` | The studio (Preact + htm) |
| `web/src/tools/` | Free tools: cousin calculator, GEDCOM viewer, ancestor calculator |
| `web/test/` | Engine unit tests (`node --test web/test/engine/`) and the chart/PDF QA matrix (`node web/test/run-all.mjs`) |
| `tools/` | QA scripts (`tools/qa/pdfcheck.py`) and data pipelines (`tools/showcase/` Wikidata CC0 lineages) |
| `ops/` | Playbooks, KPIs, calendars, memos, backlog |
| `.claude/agents/` | Role definitions for the operating team |
| `archive/bookgen/` | The previous BookGen project and its manuscripts. Do not modify. |

## Commands

```bash
node web/build.mjs            # build the site into web/dist
node web/build.mjs --serve    # build + serve on http://localhost:4173 with rebuild on change
node --test web/test/engine/  # engine unit tests
node web/test/run-all.mjs     # full QA gate: engine tests, chart x style x colour-mode matrix, PDF checks, privacy test
node .harness/shoot.mjs http://localhost:4173/ /tmp/home --full   # desktop + mobile screenshots for design review
```

Playwright is installed globally. Import it with the absolute path
`/opt/node22/lib/node_modules/playwright/index.mjs`. Headless Chromium has no internet access here, so serve local files.

## Non-negotiables (red lines)

1. **Privacy.** Never upload, log or transmit tree data. No third-party scripts on `/make/` or `/tools/`, except the Lemon Squeezy license API (fetch) and Plausible. The privacy test in `web/test/run-all.mjs` enforces this.
2. **Honesty.** No fake reviews, testimonials, scarcity, countdowns or invented user counts. No claims of uniqueness we can't prove ("nobody else offers" is banned). Competitor comparisons must be factual and dated.
3. **No invented ancestors.** Never generate people, stories or dates. Famous-family pages use cited CC0 data (Wikidata), and a fact-checker verifies them before publishing.
4. **No spam.** No persona or sockpuppet accounts, no bulk unsolicited email, no scraping personal data. Community posts go out under the owner's name and only with the owner's approval.
5. **The QA gate blocks deploys.** Never skip or weaken a test to get green.
6. **Voice.** Plain, warm and exact. Numbers, not adjectives. No exclamation marks, emoji, "AI-powered" or "unlock your legacy". Write for a 70-year-old reading on an iPad.

## How changes ship

- Work on a branch and open a PR to `main`. CI (`.github/workflows/ci.yml`) runs the build, the engine tests and the chart matrix.
- Merges to `main` deploy to GitHub Pages (`.github/workflows/pages.yml`).
- Commit messages say what changed and why. Keep PRs focused.
- Anything in the **Amber** list of `ops/README.md` needs the owner's written approval first.
