import Link from "next/link";
import { redirect } from "next/navigation";
import AppBar from "../AppBar";
import PasswordForm from "./PasswordForm";
import { CancelSubscription, DeleteAccount } from "./AccountActions";
import { logOut, openBillingPortal, resumeSubscription } from "../actions";
import { getCurrentUser } from "../../lib/auth";
import { currentPlan, formatPrice, LIVE_STATUSES, REQUIRE_SUBSCRIPTION } from "../../lib/billing";
import { isOwner } from "../../lib/owner";
import "./account.css";

export const metadata = { title: "Account · ChatEAT" };

const STATUS_TEXT = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment failed. Update your card to keep access.",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Payment not finished",
  incomplete_expired: "Payment not finished",
  paused: "Paused",
};

// Open to anyone logged in, even without an active plan, so people can always manage billing.
export default async function AccountPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const plan = await currentPlan().catch(() => null);
  const endsOn = user.subscription_cancel_at
    ? new Date(user.subscription_cancel_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })
    : null;

  return (
    <>
      <AppBar email={user.email} current="/account" />
      <main className="app-main">
        <div className="container account">
          <h1>Account</h1>
          {params?.billing === "unavailable" && <p className="notice">Subscription management isn&apos;t available right now. Please try again later.</p>}
          {params?.billing === "canceled" && endsOn && <p className="notice">Your subscription is canceled. You won&apos;t be charged again, and you have access until {endsOn}.</p>}
          {params?.billing === "resumed" && !endsOn && <p className="notice">Your subscription is back on. Nothing else changes.</p>}

          <section className="account-card">
            <h2>Profile</h2>
            <dl className="account-facts">
              <div><dt>Email</dt><dd>{user.email}</dd></div>
            </dl>
            <Link className="button outline small" href="/onboarding">Edit kitchen profile</Link>
          </section>

          <section className="account-card">
            <h2>Plan</h2>
            {user.comp_access ? (
              <p>You have <strong>complimentary full access</strong>. There&apos;s nothing to pay or manage.</p>
            ) : user.stripe_subscription_id && LIVE_STATUSES.includes(user.subscription_status) ? (
              <>
                <dl className="account-facts">
                  <div><dt>Plan</dt><dd>ChatEAT Monthly{plan ? `, ${formatPrice(plan)} a ${plan.interval}` : ""}</dd></div>
                  <div><dt>Status</dt><dd>{endsOn ? `Canceled. You have access until ${endsOn}.` : (STATUS_TEXT[user.subscription_status] ?? user.subscription_status)}</dd></div>
                </dl>
                {endsOn ? (
                  <form action={resumeSubscription}>
                    <button className="button primary small" type="submit">Keep my subscription</button>
                  </form>
                ) : (
                  <CancelSubscription />
                )}
                <p className="account-note">Update your card or see receipts on Stripe&apos;s secure billing page.</p>
                <form action={openBillingPortal}>
                  <button className="button outline small" type="submit">Card and receipts</button>
                </form>
              </>
            ) : (
              <>
                <p>You don&apos;t have an active plan.</p>
                {REQUIRE_SUBSCRIPTION && <Link className="button primary small" href="/subscribe">See the plan</Link>}
              </>
            )}
          </section>

          <section className="account-card">
            <h2>Password</h2>
            <PasswordForm />
          </section>

          <section className="account-card">
            <h2>Log out</h2>
            <form action={logOut}>
              <button className="button outline small" type="submit">Log out</button>
            </form>
          </section>

          {!isOwner(user) && (
            <section className="account-card">
              <h2>Delete account</h2>
              <DeleteAccount hasSubscription={Boolean(user.stripe_subscription_id && LIVE_STATUSES.includes(user.subscription_status) && !endsOn)} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
