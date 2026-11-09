"use client";

import { useState } from "react";
import { generateRecipes, makeItMineFromRequest } from "../actions";
import PersonalRecipe from "../PersonalRecipe";
import RecipeCard from "../RecipeCard";

const IDEAS = [
  "Something filling I can make in 30 minutes",
  "A high-protein lunch I can meal prep",
  "I have chicken, rice and broccoli",
  "A cheap dinner for tonight",
  "Something new I can learn this weekend",
];

export default function CookClient({ rules, aiState }) {
  const [request, setRequest] = useState("");
  const [lastRequest, setLastRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [seen, setSeen] = useState([]);

  const [mine, setMine] = useState(null); // { recipe, basedOn, request }
  const [notice, setNotice] = useState("");
  const [making, setMaking] = useState(false);

  async function ask(text, avoid = []) {
    setLoading(true);
    setError("");
    setNotice("");
    const res = await generateRecipes({ request: text, avoidTitles: avoid }).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setMine(null);
    setResult(res);
    setLastRequest(text);
    setSeen([...avoid, ...res.recipes.map((r) => r.title)]);
  }

  async function makeMine() {
    const text = request.trim();
    if (!text) return;
    setMaking(true);
    setError("");
    setNotice("");
    const res = await makeItMineFromRequest(text).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setMaking(false);
    if (res.notice) { setNotice(res.notice); return; }
    if (res.error) { setError(res.error); return; }
    setResult(null);
    setMine({ ...res, request: text });
  }

  function submit(e) {
    e.preventDefault();
    if (request.trim()) ask(request.trim());
  }

  return (
    <>
      <form className="cook-form" onSubmit={submit}>
        <label htmlFor="request" className="cook-label">What are you in the mood for?</label>
        <textarea
          id="request"
          rows={3}
          maxLength={400}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (request.trim()) ask(request.trim()); } }}
          placeholder="e.g., I'm craving something savory and filling. I have ground beef, rice and peppers, and about 30 minutes."
        />
        <div className="cook-ideas" aria-label="Example requests">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="cook-idea" onClick={() => setRequest(idea)}>{idea}</button>
          ))}
        </div>
        <div className="cook-submit">
          <button className="button primary" type="submit" disabled={loading || making || !request.trim()}>{loading ? "Finding recipes…" : "Get recipes"}</button>
          {rules.length > 0 && <span className="cook-rules">Always avoiding: <strong>{rules.join(", ")}</strong></span>}
          <button type="button" className="button outline cook-mine" onClick={makeMine} disabled={loading || making || !request.trim()}>
            {making ? "Making it yours…" : "Make it mine"}
          </button>
        </div>
        {notice && <p className="cook-notice" role="status">{notice}</p>}
      </form>

      {making && (
        <div className="cook-loading" role="status">
          <span className="cook-spinner" aria-hidden="true" />
          Writing a version just for you…
        </div>
      )}

      {mine && !making && (
        <section className="cook-results" aria-live="polite">
          <div className="cook-results-head">
            <h2>Made for you: <span>&ldquo;{mine.request}&rdquo;</span></h2>
          </div>
          <PersonalRecipe key={mine.recipe.title + mine.request} recipe={mine.recipe} basedOn={mine.basedOn} />
        </section>
      )}

      {aiState === "off" && (
        <p className="cook-banner">
          <strong>Library only for now.</strong> Ideas come from ChatEAT&apos;s built-in recipe library. New AI recipes and &ldquo;Make it mine&rdquo; turn on once the AI key is added.
        </p>
      )}
      {aiState === "paused" && (
        <p className="cook-banner">
          <strong>Library only for the rest of the month.</strong> ChatEAT&apos;s AI is taking a break, but every library recipe still works.
        </p>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading && (
        <div className="cook-loading" role="status">
          <span className="cook-spinner" aria-hidden="true" />
          Reading your profile and picking recipes…
        </div>
      )}

      {result && !loading && (
        <section className="cook-results" aria-live="polite">
          <div className="cook-results-head">
            <h2>Ideas for: <span>&ldquo;{lastRequest}&rdquo;</span></h2>
            <button type="button" className="button outline small" onClick={() => ask(lastRequest, seen)}>Show different options</button>
          </div>
          {result.aiNotice && <p className="cook-banner">{result.aiNotice}</p>}
          {!result.closeMatch && result.recipes.length > 0 && (
            <p className="cook-banner">
              The library doesn&apos;t have a close match for that yet, so these are the nearest ideas.
              {result.limitReached ? " You've used this week's AI requests, so only library recipes are showing for now." : ""}
            </p>
          )}
          {result.removed?.length > 0 && (
            <p className="cook-removed">
              Removed {result.removed.length} {result.removed.length === 1 ? "idea" : "ideas"} that contained something you avoid ({[...new Set(result.removed.flatMap((r) => r.rules))].join(", ")}).
            </p>
          )}
          {result.recipes.length === 0 ? (
            <p className="cook-empty">No safe recipes matched that request. Try asking a different way.</p>
          ) : (
            <div className="cook-list">
              {result.recipes.map((r) => <RecipeCard key={r.title} recipe={r} />)}
            </div>
          )}
        </section>
      )}
    </>
  );
}
