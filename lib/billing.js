// Subscriptions through Stripe Checkout.
//
// CHATEAT_REQUIRE_SUBSCRIPTION: "true" (default) means every account needs an active subscription
// (or complimentary access) to use the app. Set it to "false" in .env.local / Vercel to open the app up.
import Stripe from "stripe";
import { headers } from "next/headers";

export const REQUIRE_SUBSCRIPTION = (process.env.CHATEAT_REQUIRE_SUBSCRIPTION ?? "true").toLowerCase() !== "false";

let client;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is missing.");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// The plan's price as shown to people, read from Stripe so it always matches what they'll be charged.
let priceCache = { at: 0, plan: null };
export async function currentPlan() {
  if (priceCache.plan && Date.now() - priceCache.at < 10 * 60_000) return priceCache.plan;
  const price = await stripe().prices.retrieve(process.env.STRIPE_PRICE_ID);
  const plan = {
    amount: (price.unit_amount ?? 0) / 100,
    interval: price.recurring?.interval ?? "month",
    live: price.livemode,
  };
  priceCache = { at: Date.now(), plan };
  return plan;
}

export const formatPrice = (plan) => `$${plan.amount % 1 === 0 ? plan.amount.toFixed(0) : plan.amount.toFixed(2)}`;

// The site's own address, for Stripe's return links. SITE_URL overrides it if set.
export async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
