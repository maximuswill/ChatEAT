import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "../../Brand";
import { getCurrentUser } from "../../../lib/auth";
import { stripe } from "../../../lib/billing";
import { sql } from "../../../lib/db";
import { getProfile } from "../../../lib/profile";
import "../subscribe.css";

export const metadata = { title: "Welcome · ChatEAT" };

// Stripe sends people here after paying. We confirm the payment with Stripe directly
// (never trusting the link alone) and then turn on their access.
export default async function SubscribeSuccessPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { session_id: sessionId } = await searchParams;

  let ok = false;
  if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      const mine = session.client_reference_id === String(user.id);
      const sub = session.subscription;
      if (mine && session.status === "complete" && sub && typeof sub === "object") {
        await sql`
          update users set stripe_subscription_id = ${sub.id}, subscription_status = ${sub.status},
                 stripe_customer_id = coalesce(stripe_customer_id, ${String(session.customer)})
          where id = ${user.id}`;
        ok = ["active", "trialing"].includes(sub.status);
      }
    } catch (error) {
      console.error("Checkout confirmation failed", error?.message);
    }
  }

  const profile = ok ? await getProfile(user.id) : null;
  const next = profile?.completed ? "/dashboard" : "/onboarding";

  return (
    <main className="auth-page">
      <Brand />
      <div className="auth-card sub-card">
        {ok ? (
          <>
            <h1>You&apos;re in.</h1>
            <p className="auth-sub">Your ChatEAT plan is active. Let&apos;s set up your kitchen profile so every recipe fits you.</p>
            <Link className="button primary" href={next}>{profile?.completed ? "Go to my kitchen" : "Build my kitchen profile"}</Link>
          </>
        ) : (
          <>
            <h1>We couldn&apos;t confirm that payment</h1>
            <p className="auth-sub">If you were charged, refresh this page in a moment. Otherwise, you can try again.</p>
            <Link className="button primary" href="/subscribe">Back to subscribe</Link>
          </>
        )}
      </div>
    </main>
  );
}
