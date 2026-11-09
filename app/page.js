import Link from "next/link";
import CONTENT from "../content";
import Brand from "./Brand";
import { getCurrentUser } from "../lib/auth";

const ICONS = [
  <><rect x="6" y="10" width="36" height="32" rx="6" /><path d="M6 20h36M16 5v9M32 5v9M15 29h6M27 29h6" /></>,
  <path d="M8 22h32v8a12 12 0 0 1-12 12h-8A12 12 0 0 1 8 30v-8ZM4 22h40M18 15c-3-3 3-5 0-9M30 15c-3-3 3-5 0-9" />,
  <path d="M7 40h34M12 40V29M24 40V19M36 40V8" />,
];

export default async function HomePage() {
  const C = CONTENT;
  const user = await getCurrentUser();

  return (
    <>
      <header className="hero">
        <nav className="nav container" aria-label="Main">
          <Brand />
          <div className="nav-right">
            <div className="nav-links">
              <a href="#what">{C.what.label}</a>
              <a href="#who">{C.who.label}</a>
              <a href="#why">{C.why.label}</a>
            </div>
            <div className="nav-account">
              {user ? (
                <Link className="button primary small" href="/dashboard">Open ChatEAT</Link>
              ) : (
                <>
                  <Link className="text-link" href="/login">{C.account.loginButton}</Link>
                  <Link className="button primary small" href="/signup">{C.account.signupButton}</Link>
                </>
              )}
            </div>
          </div>
        </nav>

        <div className="hero-body container" id="top">
          <div>
            {C.hero.badge && <span className="badge">{C.hero.badge}</span>}
            <h1>{C.hero.headline}</h1>
            <p className="hero-intro">{C.hero.intro}</p>
            <div className="buttons">
              <a className="button primary" href="#what">{C.hero.primaryButton}</a>
              <a className="button secondary" href="#why">{C.hero.secondaryButton}</a>
            </div>
          </div>
          <aside className="week">
            <span className="week-label">{C.sampleWeek.label}</span>
            <h2>{C.sampleWeek.title}</h2>
            <ol>
              {C.sampleWeek.days.map((d, i) => (
                <li key={i} className={d.pinned ? "" : "open"}>
                  <div className="day">{d.day}</div>
                  <div>
                    <div className="meal">{d.meal}</div>
                    <div className="note">{d.note}</div>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </header>

      <main>
        <section className="section" id="what">
          <div className="container">
            <span className="label">{C.what.label}</span>
            <h2 className="big">{C.what.headline}</h2>
            <p className="section-intro">{C.what.intro}</p>
            <div className="what-grid">
              {C.what.items.map((item, i) => (
                <article key={i} className="what-card">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[i % ICONS.length]}
                  </svg>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section who" id="who">
          <div className="container who-layout">
            <div>
              <span className="label">{C.who.label}</span>
              <h2 className="big">{C.who.headline}</h2>
              <p className="section-intro">{C.who.intro}</p>
            </div>
            <ul className="who-list">
              {C.who.items.map((item, i) => (
                <li key={i}>
                  <i />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section why" id="why">
          <div className="container">
            <span className="label">{C.why.label}</span>
            <h2 className="big">{C.why.headline}</h2>
            <p className="section-intro">{C.why.intro}</p>
            <div className="why-layout">
              <div className="why-grid">
                {C.why.items.map((item, i) => (
                  <div key={i}>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="price-card">
                {C.why.priceLabel && <div className="price-label">{C.why.priceLabel}</div>}
                <div className="price-line">
                  <span className="price">{C.why.price}</span>
                  <span className="price-period">{C.why.pricePeriod}</span>
                </div>
                {C.why.priceNote && <p>{C.why.priceNote}</p>}
                {!user && <Link className="button" href="/signup">{C.account.signupButton}</Link>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-row">
          {C.footer.credit && <span>{C.footer.credit}</span>}
          {C.footer.contactEmail && (
            <span>{C.footer.contactLabel} <a href={`mailto:${C.footer.contactEmail}`}>{C.footer.contactEmail}</a></span>
          )}
        </div>
      </footer>
    </>
  );
}
