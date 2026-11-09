// Creates the ChatEAT subscription product and price in Stripe (safe to run again),
// then saves the price ID to .env.local as STRIPE_PRICE_ID.
//
// Run with:            npm run stripe:setup
// Change the price:    npm run stripe:setup -- 7.99
//   (Stripe prices can't be edited, so this makes a new price, makes it the default and
//    archives the old one. Existing subscribers stay on the price they signed up at.)
import Stripe from "stripe";
import { readFileSync, writeFileSync } from "node:fs";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is missing. Add it to .env.local first.");
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const dollars = Number(process.argv[2] ?? 5);
if (!(dollars > 0)) {
  console.error("Give a price in dollars, like 5 or 7.99");
  process.exit(1);
}
const cents = Math.round(dollars * 100);
const LOOKUP_KEY = "chateat_monthly";

// Find or create the product.
const products = await stripe.products.search({ query: "metadata['app']:'chateat' AND active:'true'" });
const product = products.data[0] ?? await stripe.products.create({
  name: "ChatEAT Monthly",
  description: "Your AI cooking coach: weekly plans, personalized recipes and your own recipe library.",
  metadata: { app: "chateat" },
});

// Reuse the current price if it already matches; otherwise make a new one.
const current = (await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 })).data[0];
let price = current;
if (!current || current.unit_amount !== cents || current.recurring?.interval !== "month") {
  price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: cents,
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
    transfer_lookup_key: true,
  });
  await stripe.products.update(product.id, { default_price: price.id });
  if (current) await stripe.prices.update(current.id, { active: false });
}

// Save the price ID to .env.local.
const envPath = new URL("../.env.local", import.meta.url);
let env = readFileSync(envPath, "utf8");
const line = `STRIPE_PRICE_ID="${price.id}"`;
env = /^STRIPE_PRICE_ID=.*$/m.test(env) ? env.replace(/^STRIPE_PRICE_ID=.*$/m, line) : `${env.trimEnd()}\n${line}\n`;
writeFileSync(envPath, env);

console.log(`Product: ${product.name} (${product.id})`);
console.log(`Price: $${(price.unit_amount / 100).toFixed(2)} per ${price.recurring.interval} (${price.id})${price === current ? ", already set up" : ", created"}`);
console.log(`Mode: ${price.livemode ? "LIVE" : "test"}. Saved STRIPE_PRICE_ID to .env.local. Restart the dev server to pick it up.`);
