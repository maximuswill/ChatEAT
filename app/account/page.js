import Link from "next/link";
import { redirect } from "next/navigation";
import AppBar from "../AppBar";
import PasswordForm from "./PasswordForm";
import { logOut, openBillingPortal } from "../actions";
import { getCurrentUser } from "../../lib/auth";
import { currentPlan, formatPrice, REQUIRE_SUBSCRIPTION } from "../../lib/billing";
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

  return (
    <>
      <AppBar email={user.email} current="/account" />
      <main className="app-main">
        <div className="container account">
          <h1>Account</h1>
          {params?.billing === "unavailable" && <p className="notice">Subscription management isn&apos;t available right now. Please try again later.</p>}

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
            ) : user.stripe_subscription_id ? (
              <>
                <dl className="account-facts">
                  <div><dt>Plan</dt><dd>ChatEAT Monthly{plan ? `, ${formatPrice(plan)} a ${plan.interval}` : ""}</dd></div>
                  <div><dt>Status</dt><dd>{STATUS_TEXT[user.subscription_status] ?? user.subscription_status ?? "Unknown"}</dd></div>
                </dl>
                <p className="account-note">Update your card, see receipts or cancel on Stripe&apos;s secure billing page. If you cancel, you keep access until the end of the period you&apos;ve paid for.</p>
                <form action={openBillingPortal}>
                  <button className="button primary small" type="submit">Manage or cancel subscription</button>
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
        </div>
      </main>
    </>
  );
}
