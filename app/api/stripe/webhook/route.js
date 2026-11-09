// Stripe calls this address when a subscription starts, renews, fails to renew or is canceled,
// so a person's access always matches their subscription.
//
// Setup (once the site is live): in Stripe, go to Developers → Webhooks, add an endpoint at
//   https://<your-site>/api/stripe/webhook
// listening for: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
// Then copy its signing secret (whsec_...) into STRIPE_WEBHOOK_SECRET in Vercel.
import { stripe } from "../../../../lib/billing";
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";

async function saveSubscription(sub) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  await sql`
    update users set subscription_status = ${sub.status}, stripe_subscription_id = ${sub.id}
    where stripe_customer_id = ${customerId}`;
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    // Proves the request really came from Stripe; anything else is rejected.
    event = stripe().webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await sql`update users set stripe_customer_id = coalesce(stripe_customer_id, ${String(session.customer)}) where id = ${Number(session.client_reference_id)}`;
          await saveSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await saveSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook failed", event.type, error?.message);
    return new Response("Webhook handler failed", { status: 500 }); // Stripe retries later
  }
  return new Response("ok", { status: 200 });
}
