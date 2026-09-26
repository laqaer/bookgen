import assert from "node:assert/strict";
import test from "node:test";
import { interpretProbe, shouldProbePaid } from "./interpret.js";

test("validation-only probe is up but not ready for buyers", () => {
  const result = interpretProbe({
    homepageStatus: 200,
    checkoutStatus: 400,
    checkoutBody: '{"error":"Missing topic, outline, or delivery email"}',
  });
  assert.equal(result.uptimeOk, true);
  assert.equal(result.ok, false);
  assert.equal(result.paidCheckout, "not_probed");
});

test("known production failure is paid-checkout broken", () => {
  const result = interpretProbe({
    homepageStatus: 200,
    checkoutStatus: 400,
    checkoutBody: '{"error":"Missing topic, outline, or delivery email"}',
    paidCheckoutStatus: 500,
    paidCheckoutBody: '{"error":"Not a valid URL"}',
  });
  assert.equal(result.paidCheckout, "broken");
  assert.equal(result.ok, false);
  assert.equal(result.uptimeOk, true);
  assert.match(result.detail, /Not a valid URL/);
});

test("stripe redirect means checkout is open", () => {
  const result = interpretProbe({
    homepageStatus: 200,
    checkoutStatus: 400,
    checkoutBody: "Missing topic",
    paidCheckoutStatus: 200,
    paidCheckoutBody: '{"url":"https://checkout.stripe.com/c/pay/cs_test_x"}',
  });
  assert.equal(result.paidCheckout, "open");
  assert.equal(result.ok, true);
});

test("paid probe runs until checkout opens, then stops", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.equal(shouldProbePaid({ now }), true);
  assert.equal(
    shouldProbePaid({
      lastState: "broken",
      lastAt: "2026-09-26T11:30:00Z",
      now,
    }),
    false,
  );
  assert.equal(
    shouldProbePaid({
      lastState: "broken",
      lastAt: "2026-09-26T10:00:00Z",
      now,
    }),
    true,
  );
  assert.equal(
    shouldProbePaid({
      lastState: "open",
      lastAt: "2026-09-26T01:00:00Z",
      now,
    }),
    false,
  );
});

test("homepage outage fails uptime", () => {
  const result = interpretProbe({
    homepageStatus: 503,
    checkoutStatus: 400,
    checkoutBody: "Missing topic",
  });
  assert.equal(result.uptimeOk, false);
  assert.equal(result.homepageOk, false);
});
