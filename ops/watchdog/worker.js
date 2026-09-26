import { interpretProbe, shouldProbePaid } from "./interpret.js";

const OFFER_URL = "https://www.bookgen.dev/";
const CHECKOUT_URL = "https://www.bookgen.dev/api/checkout";
const MANUAL_PAID = {
  created_at: "2026-09-26T04:46:36Z",
  http_status: 500,
  state: "broken",
  error: "Not a valid URL",
  source: "operator_probe",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "bookgen-watchdog" });
    const latest = await latestRow(env);
    const paid = (await latestPaid(env)) || MANUAL_PAID;
    const payload = statusPayload(env, latest, paid);
    const accept = request.headers.get("accept") || "";
    const wantsHtml = url.pathname === "/" || (url.pathname === "/status" && accept.includes("text/html"));
    if (url.pathname === "/status" && !wantsHtml) {
      return Response.json(payload, { headers: { "cache-control": "no-store" } });
    }
    if (wantsHtml) return new Response(renderHtml(payload), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return new Response("not found", { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
};

function statusPayload(env, latest, paid) {
  return {
    service: "bookgen-watchdog",
    paused: env.PAUSED === "1",
    offer: {
      url: OFFER_URL,
      price_cents: 499,
      currency: "usd",
      buyer_ready: paid.state === "open",
    },
    last_check: latest,
    paid_checkout: {
      state: paid.state,
      observed_at: paid.created_at,
      http_status: paid.http_status,
      error: paid.error,
      source: paid.source || "cron",
      note: "Unpaid probe. No card was charged. A Stripe URL is not stored.",
    },
    stop: "Set the PAUSED secret to 1 on this Worker, or disable its cron in the Cloudflare dashboard.",
  };
}

function renderHtml(payload) {
  const paid = payload.paid_checkout;
  const latest = payload.last_check;
  const last = latest
    ? latest.created_at + " homepage " + latest.homepage_status + ", checkout validation " + latest.checkout_status + ". " + latest.detail
    : "No unattended check has been recorded yet.";
  const ready = payload.offer.buyer_ready ? "Paid checkout is open." : "Paid checkout is not open.";
  const paidLine = "Paid checkout: " + paid.state + ". Unpaid probe at " + paid.observed_at + " returned HTTP " + paid.http_status + (paid.error ? " " + paid.error : "") + ". No card was charged.";
  return "<!doctype html><title>BookGen status</title><h1>BookGen status</h1><p>The live offer is a $4.99 ebook package at bookgen.dev. " + escapeHtml(ready) + "</p><p><b>" + escapeHtml(paidLine) + "</b></p><p>Latest uptime check: " + escapeHtml(last) + "</p><p>Stop the checker: " + escapeHtml(payload.stop) + "</p>";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const PAID_BODY = JSON.stringify({
  topic: "Watchdog probe",
  audience: "operators",
  email: "watchdog-noreply@bookgen.dev",
  bookType: "Guide",
  genre: "Nonfiction",
  tone: "Practical",
  description: "Unattended unpaid probe. Do not fulfill.",
  lengthTarget: "short",
  chapters: 4,
  outline_json: {
    title: "Watchdog Probe",
    authorName: "Watchdog",
    chapters: [{ title: "Status", bullets: ["no charge"] }],
  },
});

export async function run(env) {
  if (env.PAUSED === "1") {
    await saveCheck(env, 0, 0, "paused", 0, 0, "watchdog paused");
    return;
  }
  const home = await probe(OFFER_URL, { method: "GET" });
  const checkout = await probe(CHECKOUT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  await ensurePaidTable(env);
  let paid = await latestPaid(env);
  if (shouldProbePaid({ lastState: paid?.state ?? null, lastAt: paid?.created_at ?? null, now: Date.now() })) {
    const paidResponse = await probe(CHECKOUT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: PAID_BODY,
    });
    const judged = interpretProbe({
      homepageStatus: home.status,
      checkoutStatus: checkout.status,
      checkoutBody: checkout.body,
      paidCheckoutStatus: paidResponse.status,
      paidCheckoutBody: paidResponse.body,
    });
    paid = {
      created_at: new Date().toISOString(),
      http_status: paidResponse.status,
      state: judged.paidCheckout,
      error: judged.paidCheckout === "open" ? null : extractError(paidResponse.body),
      source: "cron",
    };
    await env.DB.prepare(
      "INSERT INTO paid_probes (created_at, http_status, state, error) VALUES (?, ?, ?, ?)",
    ).bind(paid.created_at, paid.http_status, paid.state, paid.error).run();
  }
  const replay = replayPaid(paid);
  const result = interpretProbe({
    homepageStatus: home.status,
    checkoutStatus: checkout.status,
    checkoutBody: checkout.body,
    paidCheckoutStatus: replay.status,
    paidCheckoutBody: replay.body,
  });
  await saveCheck(
    env,
    home.status,
    checkout.status,
    checkout.body.slice(0, 200),
    result.uptimeOk ? 1 : 0,
    result.paidCheckout === "open" ? 1 : 0,
    result.detail,
  );
}

function replayPaid(paid) {
  if (!paid) return { status: null, body: "" };
  if (paid.state === "open") return { status: 200, body: '{"url":"https://checkout.stripe.com/c/pay/redacted"}' };
  return { status: paid.http_status, body: JSON.stringify({ error: paid.error || "unexpected" }) };
}

function extractError(body) {
  const match = String(body || "").match(/"error"\s*:\s*"([^"]*)"/);
  const text = match ? match[1] : String(body || "");
  return text.replace(/https:\/\/checkout\.stripe\.com\S*/gi, "[stripe-url-redacted]").slice(0, 160);
}

async function probe(url, init) {
  try {
    const response = await fetch(url, Object.assign({}, init, { redirect: "follow" }));
    const body = await response.text();
    return { status: response.status, body: body.slice(0, 500) };
  } catch (error) {
    return { status: 0, body: String(error && error.message || error).slice(0, 200) };
  }
}

async function ensurePaidTable(env) {
  if (!env.DB) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS paid_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, http_status INTEGER, state TEXT NOT NULL, error TEXT)",
  ).run();
}

async function saveCheck(env, homepage, checkout, body, uptime, buyerReady, detail) {
  if (!env.DB) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS checks (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, homepage_status INTEGER, checkout_status INTEGER, checkout_body TEXT, uptime_ok INTEGER NOT NULL, buyer_ready INTEGER NOT NULL, detail TEXT)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO checks (created_at, homepage_status, checkout_status, checkout_body, uptime_ok, buyer_ready, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(new Date().toISOString(), homepage, checkout, body, uptime, buyerReady, detail).run();
}

async function latestRow(env) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(
      "SELECT created_at, homepage_status, checkout_status, uptime_ok, buyer_ready, detail FROM checks ORDER BY id DESC LIMIT 1",
    ).first();
  } catch (e) {
    return null;
  }
}

async function latestPaid(env) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(
      "SELECT created_at, http_status, state, error FROM paid_probes ORDER BY id DESC LIMIT 1",
    ).first();
  } catch (e) {
    return null;
  }
}
