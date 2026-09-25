# Owner setup checklist

These are the only steps that need a human. Everything else is built and run by the agent team. Total time is about 4–6 hours, plus Lemon Squeezy's approval wait. Do them in order; each step says what to hand back to the agents.

Until step 3 is finished, the site works fully (charts, previews, free exports) and the buy buttons show a short "checkout opens soon" note with the email sign-up instead of a broken link.

## 1. Domain (10 minutes)

1. Buy **gildroot.com** at any registrar (Cloudflare Registrar sells at cost). `gildroot.co` as a redirect is optional.
2. Hand back: nothing yet. DNS is set in step 2.

## 2. Publish the site on GitHub Pages (20 minutes)

1. Merge the Gildroot branch into `main`, or ask the agents to open the pull request.
2. Optional: rename the repository from `bookgen` to `gildroot` (Settings → General → Repository name). GitHub redirects the old URL.
3. Settings → Pages → Build and deployment → Source: **GitHub Actions**. The workflow `.github/workflows/pages.yml` deploys every push to `main`.
4. Settings → Pages → Custom domain: `gildroot.com`. Tick **Enforce HTTPS** once the certificate is issued.
5. At your DNS provider:
   - `A` records for the apex `gildroot.com`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www`: `laqaer.github.io`
6. In `web/src/_data/site.json`, set `"domain": "gildroot.com"` (the agents can do this once you confirm DNS is live).
7. Settings → Branches: protect `main` and require the **ci** check before merging.

## 3. Lemon Squeezy store (60–90 minutes, plus approval)

Lemon Squeezy is the merchant of record: it handles checkout, sales tax/VAT, receipts, refunds and license keys.

1. Create an account and a store called **gildroot**. Complete identity verification and payout details, then submit the store for activation.
2. Create one product, **Gildroot chart license**, with these variants. For every variant turn on **Generate license keys**, set the activation limit shown, and set no expiry:

   | Variant | Price | Activation limit |
   |---|---|---|
   | Heirloom | $29 | 3 |
   | Family Historian | $59 | 5 |
   | Family Pack | $79 | 9 |
   | Professional | $149 | 10 |
   | Upgrade Heirloom → Family Historian | $30 | 5 |
   | Gift: Heirloom | $29 | 3 |
   | Gift: Family Historian | $59 | 5 |

3. For each variant, set the receipt's thank-you note: *"Your license key is above. Open https://gildroot.com/unlock/ and paste it to unlock poster exports. Keep this email: the key works again on any computer."*
4. Turn on the **affiliate programme**: 30% commission on first orders, 30-day cookie, auto-approve.
5. Confirm that refunding an order disables its license key. (Settings → License keys; the support agent also checks this on each refund.)
6. Create an API key (Settings → API) for the operator's weekly numbers.
7. Hand back to the agents (paste into a session, or add as repository secrets):
   - the store ID and the product ID (numbers)
   - each variant's checkout URL (Products → the variant → Share → checkout link)
   - `LS_API_KEY` as a GitHub Actions secret and in the agent environment

   The agents put these in `web/src/_data/site.json` and set `"checkout.enabled": true`.
8. If the store isn't approved by **Friday 9 October**, create a Gumroad account as the fallback and hand back its product links instead.

## 4. Analytics (10 minutes)

1. Create a Plausible site for `gildroot.com` (about $9 a month). It doesn't use cookies and doesn't collect personal data.
2. Add these custom-event goals: `file_loaded`, `chart_rendered`, `checkout_click`, `unlock_success`, `export_paid`, `export_free`, `ask_link_created`, `template_download`.
3. Create an API key. Hand back: the key as `PLAUSIBLE_API_KEY`.

The agents set `analytics.plausibleDomain` in `site.json`. Events never contain names, places or dates, only coarse buckets such as "7 generations".

## 5. Newsletter (15 minutes)

1. Create a Buttondown account (free up to 100 subscribers). Add the sending-domain DNS records it shows you.
2. Hand back: the Buttondown username (for the sign-up form) and an API key.

## 6. Email addresses (20 minutes)

1. Set up `hello@gildroot.com` and `support@gildroot.com`. Cloudflare Email Routing is free and can forward both to a new Gmail inbox.
2. Connect that Gmail inbox to Claude as a connector so the support agent can read and draft replies.

## 7. Search engines (15 minutes)

1. Verify `gildroot.com` in Google Search Console and Bing Webmaster Tools (DNS TXT record), then submit `https://gildroot.com/sitemap.xml`.
2. Connect Search Console to OpenSEO so the content agent can see queries and positions.

## 8. Pinterest (20 minutes, optional)

Create a Pinterest business account, claim the domain, and apply for API access. If API access isn't granted, the growth agent prepares pins for you to upload in a batch.

## 9. Proof prints (about $50 and 1 hour)

Order two real prints of the sample chart so the site shows honest photos:

1. A 24×36 photo poster from Walgreens (same-day in many stores) in **Midnight Gilt**.
2. A 24×36 print from FedEx Office or Staples in **Ivory**.

Photograph both on a wall in daylight and add the photos to `web/src/assets/img/photos/` (or send them to a session). The agents replace the illustrated wall mockups with them.

## 10. Launch posts (about 3 hours across two days)

The drafts are in `ops/LAUNCH_PLAN.md`. Post them yourself, from your own accounts, after reading each community's rules:

- **Tuesday 13 October:** Show HN (morning, US Eastern) and r/Genealogy. Stay about two hours to answer questions; the agents draft replies for you.
- **Wednesday 14 October:** one large genealogy Facebook group whose rules allow sharing free tools.

## 11. Approve the operating policy (10 minutes)

Read the Green / Amber / Red lists in `ops/README.md` and reply "approved" (or edit them). The agents work within those boundaries.

## 12. Optional

- A USPTO knockout search for "Gildroot" (classes 9, 42 and 40) before filing a trademark.
- Submit the site to Cyndi's List.
- Apply to the FamilySearch developer programme for direct import in v2.
