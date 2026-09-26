# Experiment: restore paid checkout

Status: **held**. Do not send buyers to the pay button while it returns an error.

| Field | Value |
|---|---|
| Hypothesis | After checkout returns a Stripe URL, at least one non-owner customer pays $4.99 and receives the ebook files within 14 days, using only the traffic the site already has. |
| Audience | Visitors to bookgen.dev: solo service businesses, creators, and hobby educators, as the page already addresses them. |
| Offer | Existing package. Free preview, then $4.99 for PDF, EPUB, and Word. |
| Channel | The live site. No paid ads. The GitHub README points at the free preview only. |
| Cost ceiling | $0 new discretionary spend. |
| Success metric | One paid order, not placed by the owner, with a downloadable file delivered. |
| Window | 14 days starting the first day `POST /api/checkout` returns a `checkout.stripe.com` URL. |
| Stop or pivot | If that URL is still absent when Vercel access exists and the URL env has been corrected, stop and repair fulfillment before any new campaign. If the URL works and 14 days pass with zero paid orders, change the first-screen promise or the price. Do not keep the same page and call it a test. |

Acquisition was not launched. A broken pay button is not a channel.
