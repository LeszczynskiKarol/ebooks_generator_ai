// Registers the production Stripe webhook endpoint and stores its signing
// secret in .env (replaces any existing STRIPE_WEBHOOK_SECRET line).
require("dotenv").config();
const fs = require("fs");
const Stripe = require("stripe");

const URL = "https://api.inkmagnet.com/api/webhooks/stripe";

(async () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const dup = existing.data.find((e) => e.url === URL);
  if (dup) {
    // secret is only returned at creation — recreate to capture it
    await stripe.webhookEndpoints.del(dup.id);
    console.log("removed stale endpoint", dup.id);
  }
  const ep = await stripe.webhookEndpoints.create({
    url: URL,
    enabled_events: ["checkout.session.completed"],
  });
  let txt = fs.readFileSync(".env", "utf8");
  if (/^STRIPE_WEBHOOK_SECRET=/m.test(txt)) {
    txt = txt.replace(/^STRIPE_WEBHOOK_SECRET=.*$/gm, `STRIPE_WEBHOOK_SECRET=${ep.secret}`);
  } else {
    txt += `\nSTRIPE_WEBHOOK_SECRET=${ep.secret}\n`;
  }
  fs.writeFileSync(".env", txt);
  console.log("webhook registered:", ep.id, "secret saved to .env");
})();
