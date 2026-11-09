import { redirect } from "next/navigation";
import Brand from "../Brand";
import { logOut } from "../actions";
import { getCurrentUser } from "../../lib/auth";

export const metadata = { title: "Your kitchen · ChatEAT" };

// Placeholder home for logged-in users. The AI features will live here.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="app-bar">
        <nav className="nav container" aria-label="Account">
          <Brand />
          <div className="nav-account">
            <span className="who-am-i">{user.email}</span>
            <form action={logOut}>
              <button className="button secondary small" type="submit">Log out</button>
            </form>
          </div>
        </nav>
      </header>

      <main className="app-main">
        <div className="container">
          <h1>Your kitchen</h1>
          <span className={`plan-pill ${user.has_paid_access ? "paid" : "free"}`}>
            {user.has_paid_access ? "Full access" : "Free account: paid plans coming soon"}
          </span>
          <div className="app-grid">
            <section className="app-card">
              <h2>Plan my week</h2>
              <p>Tell ChatEAT about your week and get a calendar of meals, lunches and snacks.</p>
              <span className="soon">Coming soon</span>
            </section>
            <section className="app-card">
              <h2>What should I make?</h2>
              <p>Describe what you&apos;re craving, what you have and how much time you&apos;ve got.</p>
              <span className="soon">Coming soon</span>
            </section>
            <section className="app-card">
              <h2>My cookbook</h2>
              <p>Recipes you save and love will be kept here.</p>
              <span className="soon">Coming soon</span>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
