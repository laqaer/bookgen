import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./worker.js";

function memoryDb() {
  const paid = [];
  const checks = [];
  return {
    paid,
    checks,
    prepare(sql) {
      const exec = async (args) => {
        if (sql.startsWith("INSERT INTO paid_probes")) {
          paid.push({
            created_at: args[0],
            http_status: args[1],
            state: args[2],
            error: args[3],
          });
        } else if (sql.startsWith("INSERT INTO checks")) {
          checks.push({
            buyer_ready: args[5],
            detail: args[6],
          });
        }
      };
      const query = async () => {
        if (sql.includes("FROM paid_probes")) return paid.at(-1) ?? null;
        if (sql.includes("FROM checks")) return checks.at(-1) ?? null;
        return null;
      };
      return {
        bind(...args) {
          return { run: () => exec(args), first: query };
        },
        run: () => exec([]),
        first: query,
      };
    },
  };
}

function routeFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init && init.body });
    const found = routes.find((route) => route.match(url, init));
    if (!found) throw new Error("unexpected fetch " + url);
    return new Response(found.body, { status: found.status });
  };
  return calls;
}

test("a broken paid probe is stored once and does not keep a Stripe URL", async () => {
  const calls = routeFetch([
    { match: (url) => url.endsWith("/"), status: 200, body: "ok" },
    { match: (_url, init) => init && init.body === "{}", status: 400, body: '{"error":"Missing topic, outline, or delivery email"}' },
    { match: (_url, init) => init && init.body && init.body !== "{}", status: 500, body: '{"error":"Not a valid URL"}' },
  ]);
  const env = { DB: memoryDb() };
  await run(env);
  await run(env);
  assert.equal(env.DB.paid.length, 1);
  assert.equal(env.DB.paid[0].state, "broken");
  assert.equal(env.DB.paid[0].error, "Not a valid URL");
  assert.equal(JSON.stringify(env.DB.paid).includes("checkout.stripe.com"), false);
  assert.equal(env.DB.checks.at(-1).buyer_ready, 0);
  assert.match(env.DB.checks.at(-1).detail, /Not a valid URL/);
  const paidCalls = calls.filter((call) => call.body && call.body !== "{}");
  assert.equal(paidCalls.length, 1);
});

test("an open checkout is recorded without the session URL and is not probed again", async () => {
  const session = '{"url":"https://checkout.stripe.com/c/pay/cs_test_secret"}';
  const calls = routeFetch([
    { match: (url) => url.endsWith("/"), status: 200, body: "ok" },
    { match: (_url, init) => init && init.body === "{}", status: 400, body: '{"error":"Missing topic, outline, or delivery email"}' },
    { match: (_url, init) => init && init.body && init.body !== "{}", status: 200, body: session },
  ]);
  const env = { DB: memoryDb() };
  await run(env);
  await run(env);
  assert.equal(env.DB.paid.length, 1);
  assert.equal(env.DB.paid[0].state, "open");
  assert.equal(env.DB.paid[0].error, null);
  assert.equal(JSON.stringify(env.DB.paid).includes("cs_test_secret"), false);
  assert.equal(env.DB.checks.at(-1).buyer_ready, 1);
  const paidCalls = calls.filter((call) => call.body && call.body !== "{}");
  assert.equal(paidCalls.length, 1);
});
