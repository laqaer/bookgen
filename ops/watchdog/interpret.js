/**
 * Pure interpretation of BookGen production probes.
 * The paid checkout probe is optional so the scheduler can avoid
 * creating Stripe sessions.
 */

export const PAID_PROBE_INTERVAL_MS = 50 * 60 * 1000;

export function shouldProbePaid({
  lastState = null,
  lastAt = null,
  now,
  minIntervalMs = PAID_PROBE_INTERVAL_MS,
}) {
  if (lastState === "open") return false;
  if (!lastAt) return true;
  const then = Date.parse(lastAt);
  if (!Number.isFinite(then)) return true;
  return now - then >= minIntervalMs;
}

export function interpretProbe({
  homepageStatus,
  checkoutStatus,
  checkoutBody = "",
  paidCheckoutStatus = null,
  paidCheckoutBody = "",
}) {
  const validationBody = String(checkoutBody || "");
  const paidBody = String(paidCheckoutBody || "");
  const homepageOk = homepageStatus === 200;
  const validationOk =
    checkoutStatus === 400 && /missing topic/i.test(validationBody);

  let paidCheckout = "not_probed";
  if (paidCheckoutStatus != null) {
    if (paidCheckoutStatus === 200 && /checkout\.stripe\.com/i.test(paidBody)) {
      paidCheckout = "open";
    } else if (
      paidCheckoutStatus === 500 &&
      /not a valid url/i.test(paidBody)
    ) {
      paidCheckout = "broken";
    } else {
      paidCheckout = "unexpected";
    }
  }

  const ok = homepageOk && validationOk && paidCheckout !== "broken" && paidCheckout !== "unexpected";
  // A validation-only probe is healthy for uptime, but paid checkout can still be broken.
  // `ok` means "safe to send a buyer", so an unprobed paid path is not ok.
  const uptimeOk = homepageOk && validationOk;

  let detail = "homepage and checkout validation responded";
  if (!homepageOk) detail = `homepage HTTP ${homepageStatus}`;
  else if (!validationOk) detail = `checkout validation HTTP ${checkoutStatus}`;
  else if (paidCheckout === "broken") detail = "paid checkout returns Not a valid URL";
  else if (paidCheckout === "unexpected") detail = `paid checkout HTTP ${paidCheckoutStatus}`;
  else if (paidCheckout === "not_probed") detail = "uptime ok; paid checkout was not probed";
  else if (paidCheckout === "open") detail = "paid checkout returned a Stripe URL";

  return {
    ok: ok && paidCheckout === "open",
    uptimeOk,
    homepageOk,
    validationOk,
    paidCheckout,
    detail,
  };
}
