import Link from "next/link";
import Brand from "./Brand";
import { logOut } from "./actions";
import { getCurrentUser } from "../lib/auth";
import { AI_CREDIT_USD, isOwner } from "../lib/owner";
import { spentAllTime } from "../lib/ai-budget";

// Top bar for logged-in pages.
export default async function AppBar({ email, current }) {
  const links = [
    ["/dashboard", "My kitchen"],
    ["/cook", "What should I make?"],
    ["/plan", "Plan my week"],
    ["/pantry", "My pantry"],
    ["/cookbook", "Cookbook"],
  ];
  const owner = isOwner(await getCurrentUser());
  if (owner) links.push(["/owner", "Owner"]);
  return (
    <header className="app-bar">
      <nav className="nav container" aria-label="Account">
        <div className="app-bar-left">
          <Brand />
          <div className="app-bar-links">
            {links.map(([href, label]) => (
              <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
            ))}
          </div>
        </div>
        <div className="nav-account">
          {owner ? <CreditMeter /> : <span className="who-am-i">{email}</span>}
          <Link className={`button secondary small account-link ${current === "/account" ? "current" : ""}`} href="/account" aria-current={current === "/account" ? "page" : undefined}>Account</Link>
          <form action={logOut}>
            <button className="button secondary small" type="submit">Log out</button>
          </form>
        </div>
      </nav>
    </header>
  );
}

// Owner only: all-time estimated AI spend against the credit loaded in the Anthropic Console.
async function CreditMeter() {
  const spent = await spentAllTime().catch(() => null);
  if (spent === null) return null;
  const pct = AI_CREDIT_USD > 0 ? Math.min(100, (spent / AI_CREDIT_USD) * 100) : 100;
  const level = pct >= 90 ? "high" : pct >= 75 ? "mid" : "low";
  return (
    <Link href="/owner" className={`credit-meter ${level}`} title={`About $${(AI_CREDIT_USD - spent).toFixed(2)} of AI credit left (ChatEAT's estimate)`}>
      <span className="credit-meter-text">AI ${spent.toFixed(2)} / ${AI_CREDIT_USD.toFixed(2)}</span>
      <span className="credit-meter-bar" aria-hidden="true"><span style={{ width: `${Math.max(pct, 2)}%` }} /></span>
    </Link>
  );
}
