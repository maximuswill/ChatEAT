"use client";

import { useState } from "react";
import { changeMyRecipe } from "./actions";
import RecipeCard from "./RecipeCard";

// A personal ("made for you") recipe, plus a box to ask the AI for changes as many times as you like.
export default function PersonalRecipe({ recipe, basedOn }) {
  const [versions, setVersions] = useState([recipe]);
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = versions[versions.length - 1];

  async function submit(e) {
    e.preventDefault();
    if (!change.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await changeMyRecipe(current, change.trim()).catch(() => null);
    setBusy(false);
    if (result?.recipe) {
      setVersions([...versions, result.recipe]);
      setChange("");
    } else {
      setError(result?.error ?? "Couldn't change the recipe. Try again.");
    }
  }

  return (
    <div className="personal">
      {basedOn && versions.length === 1 && <p className="personal-note">Started from the library&apos;s {basedOn} and tailored to your profile.</p>}
      {versions.length > 1 && <p className="personal-note">Version {versions.length}: updated with your changes.</p>}
      <RecipeCard key={versions.length} recipe={current} startOpen allowMakeItMine={false} />
      <form className="personal-change" onSubmit={submit}>
        <label htmlFor={`change-${current.title}`} className="personal-change-label">Want anything different?</label>
        <textarea
          id={`change-${current.title}`}
          rows={2}
          maxLength={300}
          value={change}
          onChange={(e) => setChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
          placeholder="e.g., Make it spicier, use chicken thighs instead, double it for meal prep, no oven"
        />
        <div className="personal-change-actions">
          <button className="button primary small" type="submit" disabled={busy || !change.trim()}>{busy ? "Updating…" : "Update recipe"}</button>
          {versions.length > 1 && (
            <button type="button" className="button outline small" onClick={() => setVersions(versions.slice(0, -1))} disabled={busy}>Back to previous version</button>
          )}
          {error && <span className="recipe-error" role="alert">{error}</span>}
        </div>
      </form>
    </div>
  );
}
