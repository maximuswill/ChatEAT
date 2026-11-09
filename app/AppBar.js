import Link from "next/link";
import Brand from "./Brand";
import { logOut } from "./actions";

// Top bar for logged-in pages.
export default function AppBar({ email, current }) {
  const links = [
    ["/dashboard", "My kitchen"],
    ["/cook", "What should I make?"],
    ["/cookbook", "Cookbook"],
  ];
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
          <span className="who-am-i">{email}</span>
          <form action={logOut}>
            <button className="button secondary small" type="submit">Log out</button>
          </form>
        </div>
      </nav>
    </header>
  );
}
