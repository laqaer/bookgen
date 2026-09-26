# BookGen operating record

Updated: 2026-09-26. Mandate start: this session. Repository revision at audit: `a457846` on `main`.

## Offer in force

Sell the existing ebook package at <https://www.bookgen.dev/>.

- Buyer: a solo service business, creator, or hobby educator who wants a short lead magnet or tiny-product ebook. That is the positioning already on the live page.
- Price: $4.99 once, shown in the site bundle as `NEXT_PUBLIC_STRIPE_UNIT_AMOUNT_CENTS` falling back to 499 cents.
- Delivery promised by the live page: PDF, EPUB, and Word, plus email, after a free outline and first-chapter preview.
- Why this offer: it is the only live paid path. The $49 and $199 plans in the old README were not implemented. The manuscript in this repo is labeled an unverified template draft and is not for sale. An unmerged branch (`origin/claude/fervent-clarke-q0uqny`) proposes a different company, Gildroot. That branch is not in production, and its checkout depends on a new domain and a new merchant. It is not the operating offer.

## Observed facts

- `https://www.bookgen.dev/` is a Next.js app on Vercel. Nameservers are `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. The app source is not in this repository, and code search across `laqaer` did not find it. Google Drive has no BookGen source file.
- `POST /api/checkout` with an empty body returns HTTP 400 `Missing topic, outline, or delivery email`.
- The same route with a valid topic, outline, and email returns HTTP 500 `{"error":"Not a valid URL"}`. That result was repeated with no cover, a null cover, and an https cover URL. No card was charged. Stripe never opened.
- `POST /api/generate` with an empty body returns HTTP 400 `Missing paid session.`
- Related live routes: `/create`, `/contact`, `/success`, `/cancel`, `/api/outline`, `/api/preview-first-chapter`, `/api/process-session`, `/api/ebook-status`, `/api/generate-cover`, `/api/track`, `/downloads/bookgen-sample-ebook.pdf`.
- This Vercel token cannot read team `laqaers-projects` (HTTP 403). `get_deployment` for `www.bookgen.dev` returned not found. The hobby user `laqaer-7370` has no project named bookgen.
- Stripe MCP authentication was attempted and timed out. No BookGen sales receipts were found in the connected Gmail account. Stripe mail there is personal spend at other merchants.
- Cloudflare account "Laqaer Products" can deploy Workers. It does not host `bookgen.dev`. `antemass.com` is a separate live site and was not changed.
- No discretionary spending limit is on file. New spend stays at $0.
- `laqaer/agent-prompts` `AUTHORITY.md` (`4c6b5bddc9bdc3cf5f6f798cb4b29b90773dc9d4`) was read. It was not used to block this mandate. `laqaer/junction` is a model-routing product, not a session store for this business. Forge was not wired in.

## Assumptions

- The 500 is Stripe or `new URL` rejecting `success_url` or `cancel_url`, likely an empty or line-broken site URL in the Vercel project. This is not confirmed from the server source.
- Fulfillment after a paid session is implemented (`/api/process-session`, `/api/ebook-status`) and was not exercised, because that would spend the project's model budget.

## Unknowns

- Whether any customer has successfully paid.
- Webhook destination, refund behavior, and which Stripe account receives payouts.
- Model vendor and cost per generated ebook.

## Budgets

- New discretionary spend: $0. Do not buy a domain, ads, Plausible, or model credits for a second product.
- Inherited bookgen.dev hosting and generation costs stay on that existing project. This session did not call `/api/outline` or `/api/preview-first-chapter`.

## Watchdog

Deployed Worker `bookgen-watchdog` on the Laqaer Products Cloudflare account. D1 database `bookgen-watchdog`.

- Manually tested: `GET /health` returned `{"ok":true}` on 2026-09-26.
- Unattended-tested: cron runs wrote checks at `2026-09-26T04:58:13.439Z`, `2026-09-26T04:59:11.943Z`, and `2026-09-26T05:00:11.931Z`. Each saw homepage HTTP 200 and checkout validation HTTP 400. None created a Stripe session. The 05:00 run may still be the previous every-minute trigger, because the hourly schedule was uploaded just before that minute.
- Steady schedule: `17 * * * *` (once an hour). It was attached at `2026-09-26T04:59:31Z`. Checks continued about once a minute through `2026-09-26T05:03:11Z`, which matches Cloudflare's note that cron changes can take up to 15 minutes to propagate. No further check was written by `2026-09-26T05:07:31Z`. The hourly fire has not been observed yet.
- Source in this revision adds an unpaid order-shaped probe, at most every 50 minutes, while checkout is not open. It uses `watchdog-noreply@bookgen.dev`, does not follow a Stripe URL, and does not store one. After a probe returns `checkout.stripe.com`, later runs skip that request. This behavior is not live until this revision is uploaded.
- Public status: <https://bookgen-watchdog.laqaer-products.workers.dev/>
- Stop: set Worker secret `PAUSED` to `1`, or disable the cron in the Cloudflare dashboard. `PAUSED` was not exercised in production.

This is not a 24/7 sales operation. It checks that the site and the checkout validator respond. It does not fulfill orders.

## Next action

When Vercel team `laqaers-projects` is readable: open the project for `bookgen.dev`, correct the absolute success and cancel URLs (`https://www.bookgen.dev/success` and `https://www.bookgen.dev/cancel`), remove any trailing carriage return from URL and price env values, redeploy, and confirm `POST /api/checkout` returns a `checkout.stripe.com` URL. Do not pay. Then confirm the webhook and a sandbox fulfillment path.

## Handoff

Profit numbers are in `ops/LEDGER.md`. The held experiment is in `ops/EXPERIMENT.md`. `ops/watchdog/worker.js` imports `ops/watchdog/interpret.js`. Upload this revision before treating that import as live.
