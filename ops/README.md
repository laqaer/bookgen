# Gildroot operating team

Gildroot is run by eight AI agent roles under one human owner. Each role is defined in `.claude/agents/<role>.md`, so any Claude Code session can hand work to it. Scheduled Routines wake the team on a weekly cadence (see "Cadence"). The owner reads one memo a week and approves anything in the Amber list.

## Goal

Get users and get revenue while keeping the product private, honest and beautiful. The KPIs and the 90-day targets are below. The kill and pivot gates are in `company/BRIEF.md` §11.

## Roles

| Role (agent file) | Owns | Weekly output |
|---|---|---|
| `operator` | Priorities, gates, the weekly memo, the backlog | Monday memo in `ops/memos/YYYY-MM-DD.md`: KPIs, 3 priorities, decisions needed from the owner |
| `studio-engineer` | Product features, bugs, performance, the studio and tools | Tuesday and Thursday release trains (PRs that pass the QA gate) |
| `render-qa` | The QA gate, the fixture corpus, visual diffs, the privacy test. **Can veto any deploy.** | A gate report on every release PR; new fixtures from support tickets |
| `style-designer` | Chart styles, seasonal palettes, the design system, the style judge panel | One new chart style every 2 weeks (it ships only if judges score it 8/10 or higher) |
| `content-seo` | Guides, tool pages, comparison pages, internal links, Search Console follow-up | 2–3 new or refreshed pages a week |
| `growth` | Newsletter, Pinterest, affiliates, creator and society outreach, price periods | Wednesday outreach batch (at most 10 personalised emails, drafted for the owner to send until mail is connected), pins, experiment readout |
| `support` | Inbox, FAQ, refunds, license-key issues | First reply within 24 h on weekdays; recurring problems turned into fixtures and FAQ entries |
| `fact-checker` | Every external claim before it ships: export steps, printer sizes and deadlines, competitor prices, historical people | Sign-off comment on every content PR |

## Cadence

| When | Who | What |
|---|---|---|
| Monday | operator | Pull KPIs (Lemon Squeezy, Plausible, Search Console), write the memo, update `ops/BACKLOG.md` |
| Tuesday | studio-engineer, render-qa | Release train 1: top backlog items, QA gate, PR |
| Wednesday | content-seo, fact-checker, growth | Publish day: 2–3 pages, outreach batch, pins |
| Thursday | studio-engineer, render-qa, style-designer | Release train 2; a style release every other week |
| Friday | support, operator | Support review into fixtures and FAQ; experiment readout; backlog grooming |
| Daily | support | Inbox triage once mail is connected |

## KPIs (tracked in `ops/KPIS.md`)

| KPI | 90-day target |
|---|---|
| Activation: charts rendered ÷ visitors to home, studio and tool pages | ≥ 20% |
| Chart rendered → paid | ≥ 3% |
| Visitor → paid | ≥ 0.6% |
| Average order value | ≥ $40 |
| Refund rate | ≤ 5% |
| Export error rate | < 1% |
| Support first reply | < 24 h; ≥ 90% resolved without the owner |
| Email subscribers | 500 by 31 Dec 2026 |
| Active affiliates or societies | 5 by 31 Dec 2026 |
| Organic clicks | 1,000 a month by 31 Mar 2027 |
| Home page LCP | ≤ 2.5 s |

## Autonomy boundaries

**Green: do it, then log it in the memo.**
Ship code that passes the QA gate. Publish content the fact-checker has signed off. Ship styles that score 8/10 or higher. Answer support. Refund on request within 30 days. Replace license keys. Pin up to 10 times a day. Send newsletters to opted-in subscribers (at most 1 a week, 2 a week in Q4). Run copy tests. Run price periods for Heirloom within $24–34. Create discount codes up to 20%. Send creator and society outreach within the approved policy (10 a week, personalised, one follow-up).

**Amber: propose it in the memo or a PR; the owner approves in writing. No answer within 72 h means no.**
List-price changes outside the band. Any new paid service. New chart types outside the roadmap. Any change to the privacy model or to what analytics collect. Affiliate rate changes. Partnerships involving money or logos. Anything posted under the owner's identity. Press replies. Legal page changes. Paid ads.

**Red: never.**
Collect or upload tree data, or add third-party scripts to the studio or tools. Fake reviews, testimonials, scarcity or countdowns. Persona or sockpuppet accounts; buying followers or links. Bulk unsolicited email; scraping personal data. Generating or inventing ancestors, stories or "AI family history". Publishing unverified claims about real people. Misleading use of competitor trademarks. Dark patterns (pre-checked boxes, hidden charges, confirmshaming).

## Files

- `ops/OWNER_SETUP.md`: the owner's one-time setup checklist (domain, Pages, Lemon Squeezy, analytics, email)
- `ops/LAUNCH_PLAN.md`: the dated launch and Q4 plan, with drafts of the owner's launch posts
- `ops/BACKLOG.md`: the prioritized backlog (operator owns ordering)
- `ops/KPIS.md`: the weekly KPI table
- `ops/memos/`: weekly memos
- `ops/outreach/`: creator and society lists with outreach status (no personal data beyond public business contact details)
