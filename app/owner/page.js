import { notFound, redirect } from "next/navigation";
import AppBar from "../AppBar";
import { getCurrentUser } from "../../lib/auth";
import { sql } from "../../lib/db";
import { AI_CREDIT_USD, isOwner } from "../../lib/owner";
import { MONTHLY_BUDGET_USD } from "../../lib/ai-budget";
import { CURATED } from "../../lib/library/index.js";
import { TIERS } from "../../lib/access-codes";
import "../account/account.css";
import "./owner.css";

export const metadata = { title: "Owner · ChatEAT" };

const money = (n) => `$${Number(n).toFixed(2)}`;
const day = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

function access(user) {
  if (isOwner(user)) return ["Owner", "owner"];
  if (user.comp_access && TIERS[user.access_tier]) return [`${TIERS[user.access_tier].label} · ${TIERS[user.access_tier].weeklyAiLimit}/wk`, "family"];
  if (user.comp_access) return ["Complimentary", "comp"];
  if (["active", "trialing"].includes(user.subscription_status)) return [user.subscription_status === "trialing" ? "Free trial" : "Subscribed", "paid"];
  if (user.subscription_status) return [`Not paying (${user.subscription_status.replace("_", " ")})`, "none"];
  return ["No plan", "none"];
}

// Only the owner can open this page; everyone else gets "not found".
export default async function OwnerPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isOwner(user)) notFound();

  const params = await searchParams;
  const q = String(params?.q ?? "").trim().toLowerCase().slice(0, 80);
  const show = ["library", "ai"].includes(params?.show) ? params.show : "all";

  const [[spend], byModel, users, aiRows] = await Promise.all([
    sql`
      select coalesce(sum(cost_usd), 0)::float as all_time,
             coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0)::float as month,
             count(*)::int as calls,
             (count(*) filter (where created_at >= date_trunc('month', now())))::int as month_calls
      from ai_usage`,
    sql`select model, count(*)::int as calls, sum(cost_usd)::float as spent from ai_usage group by model order by spent desc`,
    sql`
      select u.id, u.email, u.comp_access, u.access_tier, u.subscription_status, u.stripe_customer_id, u.created_at,
             (select count(*)::int from recipe_requests r where r.user_id = u.id and r.mode = 'ai' and r.created_at > now() - interval '30 days') as ai_30d,
             (select max(s.created_at) from sessions s where s.user_id = u.id) as last_login
      from users u order by u.created_at desc, u.id desc`,
    sql`select recipe, created_at from library_recipes order by created_at desc`,
  ]);

  const recipes = [
    ...aiRows.map((row) => ({ ...row.recipe, origin: "ai", added: row.created_at })),
    ...CURATED,
  ];
  const shown = recipes.filter((r) => {
    if (show !== "all" && r.origin !== show) return false;
    if (!q) return true;
    return [r.title, r.cuisine, r.course, r.protein, ...(r.tags ?? [])].join(" ").toLowerCase().includes(q);
  });

  const paying = users.filter((u) => ["active", "trialing"].includes(u.subscription_status)).length;
  const creditPct = AI_CREDIT_USD > 0 ? Math.min(100, (spend.all_time / AI_CREDIT_USD) * 100) : 100;
  const budgetPct = MONTHLY_BUDGET_USD > 0 ? Math.min(100, (spend.month / MONTHLY_BUDGET_USD) * 100) : 100;

  return (
    <>
      <AppBar email={user.email} current="/owner" />
      <main className="app-main">
        <div className="container account owner">
          <h1>Owner</h1>
          <p className="account-note">Only your account can see this page. Spending numbers are ChatEAT&apos;s own estimates; your real balance is in the Anthropic Console.</p>

          <section className="account-card">
            <h2>AI spending</h2>
            <div className="owner-stats">
              <Stat label="All time vs. your credit" value={`${money(spend.all_time)} / ${money(AI_CREDIT_USD)}`} pct={creditPct} note={`About ${money(Math.max(0, AI_CREDIT_USD - spend.all_time))} left · ${spend.calls} calls`} />
              <Stat label="This month vs. the site budget" value={`${money(spend.month)} / ${money(MONTHLY_BUDGET_USD)}`} pct={budgetPct} note={`${spend.month_calls} calls this month${budgetPct >= 100 ? " · paused for everyone but you" : ""}`} />
            </div>
            {byModel.length > 0 && (
              <table className="owner-table">
                <thead><tr><th>Model</th><th>Calls</th><th>Cost</th></tr></thead>
                <tbody>
                  {byModel.map((m) => <tr key={m.model}><td>{m.model}</td><td>{m.calls}</td><td>${m.spent.toFixed(4)}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>

          <section className="account-card">
            <h2>Customers</h2>
            <p className="account-note">{users.length} accounts · {paying} paying</p>
            <div className="owner-scroll">
              <table className="owner-table">
                <thead><tr><th>Email</th><th>Access</th><th>Joined</th><th>Last login</th><th>AI uses (30 days)</th></tr></thead>
                <tbody>
                  {users.map((u) => {
                    const [label, kind] = access(u);
                    return (
                      <tr key={u.id}>
                        <td className="owner-email">{u.email}</td>
                        <td><span className={`owner-tag ${kind}`}>{label}</span></td>
                        <td>{day(u.created_at)}</td>
                        <td>{u.last_login ? day(u.last_login) : "—"}</td>
                        <td>{u.ai_30d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="account-card">
            <h2>Recipe library</h2>
            <p className="account-note">{CURATED.length} built-in · {aiRows.length} saved from AI answers</p>
            <form className="owner-search" method="get" action="/owner#library">
              <input type="search" name="q" defaultValue={q} placeholder="Search title, cuisine, tag…" aria-label="Search recipes" />
              <select name="show" defaultValue={show} aria-label="Which recipes">
                <option value="all">All recipes</option>
                <option value="library">Built-in only</option>
                <option value="ai">AI-saved only</option>
              </select>
              <button className="button primary small" type="submit">Search</button>
            </form>
            <p id="library" className="account-note">Showing {shown.length}</p>
            <ul className="owner-recipes">
              {shown.map((r) => (
                <li key={r.id}>
                  <details>
                    <summary>
                      <span className="owner-recipe-title">{r.title}</span>
                      <span className={`owner-tag ${r.origin === "ai" ? "ai" : "comp"}`}>{r.origin === "ai" ? "AI-saved" : "Built-in"}</span>
                      <span className="owner-recipe-meta">{[r.course, r.cuisine, r.total_minutes && `${r.total_minutes} min`, r.added && `added ${day(r.added)}`].filter(Boolean).join(" · ")}</span>
                    </summary>
                    <div className="owner-recipe-body">
                      {r.summary && <p>{r.summary}</p>}
                      <h3>Ingredients</h3>
                      <ul>{(r.ingredients ?? []).map((i, n) => <li key={n}>{i.heading ? <strong>{i.item}</strong> : `${i.amount} ${i.item}`.trim()}</li>)}</ul>
                      <h3>Steps</h3>
                      <ol>{(r.steps ?? []).map((s, n) => <li key={n}>{s}</li>)}</ol>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, pct, note }) {
  const level = pct >= 90 ? "high" : pct >= 75 ? "mid" : "low";
  return (
    <div className="owner-stat">
      <span className="owner-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className={`owner-bar ${level}`} aria-hidden="true"><span style={{ width: `${Math.max(pct, 2)}%` }} /></span>
      <span className="owner-stat-note">{note}</span>
    </div>
  );
}
