import Link from "next/link";
import AppBar from "../AppBar";
import { openBillingPortal } from "../actions";
import { requireMember } from "../../lib/auth";
import { getProfile } from "../../lib/profile";
import { summarize } from "../../lib/onboarding-data";

export const metadata = { title: "Your kitchen · ChatEAT" };

// Placeholder home for logged-in users. The AI features will live here.
export default async function DashboardPage({ searchParams }) {
  const user = await requireMember();
  const params = await searchParams;
  const profile = await getProfile(user.id);
  const facts = summarize(profile.data).filter((r) => ["skill", "time", "meals", "safety", "goals"].includes(r.key));

  return (
    <>
      <AppBar email={user.email} current="/dashboard" />

      <main className="app-main">
        <div className="container">
          <h1>Your kitchen</h1>
          <div className="plan-row">
            <span className={`plan-pill ${user.has_paid_access ? "paid" : "free"}`}>
              {user.comp_access ? "Full access (complimentary)" : user.has_paid_access ? "ChatEAT Monthly" : "No active plan"}
            </span>
            {!user.comp_access && user.stripe_customer_id && (
              <form action={openBillingPortal}>
                <button type="submit" className="plan-manage">Manage subscription</button>
              </form>
            )}
          </div>
          {params?.billing === "unavailable" && (
            <p className="notice">Subscription management isn&apos;t available right now. Please try again later.</p>
          )}
          <div className="app-grid">
            <section className="app-card profile-card">
              <h2>{profile.completed ? "Your kitchen profile" : "Build your kitchen profile"}</h2>
              {profile.completed ? (
                <dl className="profile-facts">
                  {facts.map((r) => <div key={r.key} className={r.tone ?? ""}><dt>{r.label}:</dt><dd>{r.value}</dd></div>)}
                </dl>
              ) : (
                <p>{profile.exists ? "You're partway through. Pick up where you left off." : "About 5 minutes of quick questions so every suggestion fits your life."}</p>
              )}
              <Link className="button primary small" href="/onboarding">{profile.completed ? "Edit profile" : profile.exists ? "Continue" : "Start"}</Link>
            </section>
            <section className="app-card">
              <h2>Plan my week</h2>
              <p>Tell ChatEAT about your week and get a calendar of meals, lunches and snacks.</p>
              <Link className="button primary small" href="/plan">Plan my week</Link>
            </section>
            <section className="app-card">
              <h2>What should I make?</h2>
              <p>Describe what you&apos;re craving, what you have and how much time you&apos;ve got.</p>
              <Link className="button primary small" href="/cook">Get recipe ideas</Link>
            </section>
            <section className="app-card">
              <h2>My pantry</h2>
              <p>Optional. Tell ChatEAT roughly what you have, and recipes will lean on it. Takes about 2 minutes.</p>
              <Link className="button outline small" href="/pantry">Open my pantry</Link>
            </section>
            <section className="app-card">
              <h2>My cookbook</h2>
              <p>Recipes you&apos;ve saved, all in one place.</p>
              <Link className="button outline small" href="/cookbook">Open cookbook</Link>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
