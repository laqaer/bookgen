export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "bookgen-watchdog" });
    const latest = await latestRow(env);
    const payload = {
      service: "bookgen-watchdog",
      paused: env.PAUSED === "1",
      offer: { url: "https://www.bookgen.dev/", price_cents: 499, currency: "usd", buyer_ready: false },
      last_check: latest,
      paid_checkout: { state: "broken", observed_at: "2026-09-26T04:46:36Z", http_status: 500, error: "Not a valid URL", note: "Unpaid probe. No card was charged." },
      stop: "Set the PAUSED secret to 1 on this Worker, or disable its cron in the Cloudflare dashboard."
    };
    const accept = request.headers.get("accept") || "";
    const wantsHtml = url.pathname === "/" || (url.pathname === "/status" && accept.includes("text/html"));
    if (url.pathname === "/status" && !wantsHtml) return Response.json(payload, { headers: { "cache-control": "no-store" } });
    if (wantsHtml) {
      const last = latest ? latest.created_at + " homepage " + latest.homepage_status + ", checkout validation " + latest.checkout_status + ". " + latest.detail : "No unattended check has been recorded yet.";
      const html = "<!doctype html><title>BookGen status</title><h1>BookGen status</h1><p>The live offer is a $4.99 ebook package at bookgen.dev. Paid checkout is not open.</p><p><b>Paid checkout: broken.</b> An unpaid probe at 2026-09-26T04:46:36Z returned HTTP 500 Not a valid URL. No card was charged.</p><p>Latest uptime check: " + escapeHtml(last) + "</p><p>Stop the checker: " + escapeHtml(payload.stop) + "</p>";
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(run(env)); }
};
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
async function run(env) {
  if (env.PAUSED === "1") { await save(env, 0, 0, "paused", 0, "watchdog paused"); return; }
  const home = await probe("https://www.bookgen.dev/", { method: "GET" });
  const checkout = await probe("https://www.bookgen.dev/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const validationOk = checkout.status === 400 && /missing topic/i.test(checkout.body);
  const uptimeOk = home.status === 200 && validationOk;
  const detail = home.status !== 200 ? ("homepage HTTP " + home.status) : !validationOk ? ("checkout validation HTTP " + checkout.status) : "uptime ok; paid checkout was not probed";
  await save(env, home.status, checkout.status, checkout.body.slice(0, 200), uptimeOk ? 1 : 0, detail);
}
async function probe(url, init) {
  try { const response = await fetch(url, Object.assign({}, init, { redirect: "follow" })); const body = await response.text(); return { status: response.status, body: body.slice(0, 500) }; }
  catch (error) { return { status: 0, body: String(error && error.message || error).slice(0, 200) }; }
}
async function save(env, homepage, checkout, body, uptime, detail) {
  if (!env.DB) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS checks (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, homepage_status INTEGER, checkout_status INTEGER, checkout_body TEXT, uptime_ok INTEGER NOT NULL, buyer_ready INTEGER NOT NULL, detail TEXT)").run();
  await env.DB.prepare("INSERT INTO checks (created_at, homepage_status, checkout_status, checkout_body, uptime_ok, buyer_ready, detail) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(new Date().toISOString(), homepage, checkout, body, uptime, detail).run();
}
async function latestRow(env) {
  if (!env.DB) return null;
  try { return await env.DB.prepare("SELECT created_at, homepage_status, checkout_status, uptime_ok, detail FROM checks ORDER BY id DESC LIMIT 1").first(); }
  catch (e) { return null; }
}
