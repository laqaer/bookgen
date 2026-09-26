/**
 * BookGen production watchdog.
 * Checks the live site without creating a Stripe Checkout session.
 * The paid-checkout failure is recorded from the manual probe below
 * until a human or a later deploy re-probes it on purpose.
 */
import { interpretProbe } from "./interpret.js";

const HOMEPAGE = "https://www.bookgen.dev/";
const CHECKOUT = "https://www.bookgen.dev/api/checkout";

// Observed 2026-09-26T04:46:36Z from an unpaid probe. Not re-run on a
// schedule, because a successful probe would open a real Checkout session.
const LAST_PAID_PROBE = {
  at: "2026-09-26T04:46:36Z",
  status: 500,
  body: '{"error":"Not a valid URL"}',
  note: "Repeated with and without a cover URL. No card was charged.",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "bookgen-watchdog" });
    }
    if (url.pathname === "/status" || url.pathname === "/") {
      const latest = await readLatest(env);
      const body = statusPayload(latest, env);
      if ((request.headers.get("accept") || "").includes("text/html") || url.pathname === "/") {
        return new Response(renderHtml(body), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }
      return Response.json(body, { headers: { "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
};

export async function runCheck(env) {
  if (env.PAUSED === "1") {
    await record(env, {
      homepageStatus: 0,
      checkoutStatus: 0,
      checkoutBody: "paused",
      interpretation: {
        ok: false,
        uptimeOk: false,
        homepageOk: false,
        validationOk: false,
        paidCheckout: "not_probed",
        detail: "watchdog paused",
      },
    });
    return;
  }

  const homepage = await probe(HOMEPAGE, { method: "GET" });
  const checkout = await probe(CHECKOUT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const interpretation = interpretProbe({
    homepageStatus: homepage.status,
    checkoutStatus: checkout.status,
    checkoutBody: checkout.body,
  });
  await record(env, {
    homepageStatus: homepage.status,
    checkoutStatus: checkout.status,
    checkoutBody: checkout.body.slice(0, 200),
    interpretation,
  });
}

async function probe(url, init) {
  try {
    const response = await fetch(url, { ...init, redirect: "follow" });
    const body = await response.text();
    return { status: response.status, body: body.slice(0, 500) };
  } catch (error) {
    return { status: 0, body: String(error?.message || error).slice(0, 200) };
  }
}

async function record(env, row) {
  if (!env.DB) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      homepage_status INTEGER,
      checkout_status INTEGER,
      checkout_body TEXT,
      uptime_ok INTEGER NOT NULL,
      buyer_ready INTEGER NOT NULL,
      detail TEXT
    )`
  ).run();
  await env.DB.prepare(
    `INSERT INTO checks (created_at, homepage_status, checkout_status, checkout_body, uptime_ok, buyer_ready, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      new Date().toISOString(),
      row.homepageStatus,
      row.checkoutStatus,
      row.checkoutBody,
      row.interpretation.uptimeOk ? 1 : 0,
      row.interpretation.ok ? 1 : 0,
      row.interpretation.detail
    )
    .run();
}

async function readLatest(env) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(
      `SELECT created_at, homepage_status, checkout_status, uptime_ok, buyer_ready, detail
       FROM checks ORDER BY id DESC LIMIT 1`
    ).first();
  } catch {
    return null;
  }
}

function statusPayload(latest, env) {
  const paid = interpretProbe({
    homepageStatus: 200,
    checkoutStatus: 400,
    checkoutBody: "Missing topic",
    paidCheckoutStatus: LAST_PAID_PROBE.status,
    paidCheckoutBody: LAST_PAID_PROBE.body,
  });
  return {
    service: "bookgen-watchdog",
    paused: env.PAUSED === "1",
    offer: {
      url: "https://www.bookgen.dev/",
      price_cents: 499,
      currency: "usd",
      buyer_ready: false,
    },
    last_check: latest
      ? {
          at: latest.created_at,
          homepage_status: latest.homepage_status,
          checkout_validation_status: latest.checkout_status,
          uptime_ok: Boolean(latest.uptime_ok),
          detail: latest.detail,
        }
      : null,
    paid_checkout: {
      state: paid.paidCheckout,
      observed_at: LAST_PAID_PROBE.at,
      http_status: LAST_PAID_PROBE.status,
      error: "Not a valid URL",
      note: LAST_PAID_PROBE.note,
    },
    stop: "Set the PAUSED secret to 1 on the bookgen-watchdog Worker, or disable its cron in the Cloudflare dashboard.",
  };
}

function renderHtml(body) {
  const last = body.last_check;
  const lastLine = last
    ? `${escapeHtml(last.at)} — homepage ${last.homepage_status}, checkout validation ${last.checkout_validation_status}. ${escapeHtml(last.detail)}`
    : "No unattended check has been recorded yet.";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BookGen operating status</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;background:#0b0c0f;color:#f4f1ea}
  main{max-width:680px;margin:0 auto;padding:48px 20px}
  h1{font-size:1.6rem;margin:0 0 8px}
  p,li{line-height:1.5}
  .bad{color:#ffb4a8}
  .card{border:1px solid #2a2e38;border-radius:12px;padding:16px 18px;margin:16px 0}
  a{color:#ffb067}
  code{font-family:ui-monospace,monospace}
</style>
</head>
<body>
<main>
  <h1>BookGen status</h1>
  <p>The live offer is a $4.99 ebook package at <a href="https://www.bookgen.dev/">bookgen.dev</a>. Paid checkout is not open.</p>
  <div class="card">
    <strong class="bad">Paid checkout: broken</strong>
    <p>Last unpaid probe ${escapeHtml(body.paid_checkout.observed_at)} returned HTTP ${body.paid_checkout.http_status} <code>${escapeHtml(body.paid_checkout.error)}</code>. No card was charged. ${escapeHtml(body.paid_checkout.note)}</p>
  </div>
  <div class="card">
    <strong>Latest uptime check</strong>
    <p>${lastLine}</p>
  </div>
  <p>Stop the checker: ${escapeHtml(body.stop)}</p>
</main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
