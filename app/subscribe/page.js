import { redirect } from "next/navigation";
import Brand from "../Brand";
import { logOut, startCheckout } from "../actions";
import { getCurrentUser } from "../../lib/auth";
import { currentPlan, formatPrice } from "../../lib/billing";
import "./subscribe.css";

export const metadata = { title: "Subscribe · ChatEAT" };

const FEATURES = [
  "Recipe ideas that fit your schedule, appetite, skills and kitchen",
  "\"Make it mine\": any dish rewritten just for you, and changed as often as you like",
  "A recipe library and a personal cookbook",
  "Your pantry, so recipes use what you already have",
  "Allergies and diets treated as hard rules, every time",
];

export default async function SubscribePage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.has_paid_access) redirect("/dashboard");
  const params = await searchParams;
  const plan = await currentPlan();

  return (
    <main className="auth-page">
      <Brand />
      <div className="auth-card sub-card">
        <h1>Start your ChatEAT plan</h1>
        <p className="auth-sub">One simple plan. Cancel anytime.</p>
        {params?.canceled && <p className="notice">No charge was made. You can subscribe whenever you&apos;re ready.</p>}
        {!plan.live && <p className="sub-test">Test mode: no real money is charged.</p>}
        <div className="sub-price">
          <span className="sub-amount">{formatPrice(plan)}</span>
          <span className="sub-interval">a {plan.interval}</span>
        </div>
        <ul className="sub-features">
          {FEATURES.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <form action={startCheckout}>
          <button className="button primary" type="submit">Subscribe for {formatPrice(plan)} a {plan.interval}</button>
        </form>
        <p className="sub-fine">Payments are handled securely by Stripe. ChatEAT never sees your card number.</p>
        <form action={logOut} className="sub-logout">
          <span>Signed in as {user.email}.</span>
          <button type="submit" className="ob-link">Log out</button>
        </form>
      </div>
    </main>
  );
}
