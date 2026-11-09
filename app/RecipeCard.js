"use client";

import { useState } from "react";
import { makeItMine, saveRecipe } from "./actions";
import PersonalRecipe from "./PersonalRecipe";

const ORIGIN_LABEL = {
  library: "From the ChatEAT library",
  ai: "New recipe by ChatEAT AI",
  personal: "Made for you",
};

// The recipe without browser-only extras, for saving or personalizing.
const core = (recipe) => {
  const { pairings, ...rest } = recipe;
  return rest;
};

// One recipe: a short summary card that opens into the full recipe.
export default function RecipeCard({ recipe, startOpen = false, saved: initiallySaved = false, footer, compact = false, allowMakeItMine = true }) {
  const [open, setOpen] = useState(startOpen);
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [openPairing, setOpenPairing] = useState(null);

  async function save() {
    setSaving(true);
    setError("");
    const result = await saveRecipe(core(recipe)).catch(() => null);
    setSaving(false);
    if (result?.ok) setSaved(true);
    else setError(result?.error ?? "Couldn't save. Try again.");
  }

  async function personalize() {
    setPersonalizing(true);
    setError("");
    const result = await makeItMine(core(recipe)).catch(() => null);
    setPersonalizing(false);
    if (result?.recipe) setMine(result.recipe);
    else setError(result?.error ?? "Couldn't personalize that recipe. Try again.");
  }

  const pairings = recipe.pairings ?? [];

  return (
    <article className={`recipe ${open ? "open" : ""} ${compact ? "compact" : ""}`}>
      <div className="recipe-head">
        <div className="recipe-badges">
          {recipe.origin && <span className={`recipe-origin ${recipe.origin}`}>{ORIGIN_LABEL[recipe.origin]}</span>}
          {recipe.style && <span className="recipe-style">{recipe.style}</span>}
        </div>
        <h3>{recipe.title}</h3>
        <p className="recipe-summary">{recipe.summary}</p>
        {recipe.why_it_fits && <p className="recipe-why"><strong>Why it fits you:</strong> {recipe.why_it_fits}</p>}
        <ul className="recipe-meta">
          <li><strong>{recipe.total_minutes} min</strong> total{recipe.active_minutes ? `, ${recipe.active_minutes} hands-on` : ""}</li>
          <li><strong>{recipe.difficulty}</strong></li>
          <li><strong>Serves {recipe.servings}</strong></li>
          {recipe.nutrition && <li>About <strong>{recipe.nutrition.calories} cal</strong>, <strong>{recipe.nutrition.protein_g} g protein</strong> per serving</li>}
        </ul>
      </div>

      {open && (
        <div className="recipe-body">
          <div className="recipe-cols">
            <section>
              <h4>Ingredients</h4>
              <ul className="recipe-ingredients">
                {recipe.ingredients.map((ing, i) => (
                  ing.heading
                    ? <li key={i} className="recipe-subhead">{ing.item}</li>
                    : <li key={i}><span>{ing.item}</span><span>{ing.amount}</span></li>
                ))}
              </ul>
            </section>
            <section>
              <h4>Steps</h4>
              <ol className="recipe-steps">
                {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </section>
          </div>
          {(recipe.tips?.length > 0 || recipe.new_skill) && (
            <div className="recipe-extras">
              {recipe.new_skill && <p><strong>New skill:</strong> {recipe.new_skill}</p>}
              {recipe.tips?.map((tip, i) => <p key={i}><strong>Tip:</strong> {tip}</p>)}
            </div>
          )}
          {recipe.source && (
            <p className="recipe-source">Written in our own words and checked against <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{recipe.source.name}</a>.</p>
          )}
        </div>
      )}

      {pairings.length > 0 && (
        <div className="recipe-pairings">
          <span className="recipe-pairings-label">Goes well with:</span>
          {pairings.map((p) => (
            <button key={p.id} type="button" className="recipe-pairing" aria-pressed={openPairing === p.id} onClick={() => setOpenPairing(openPairing === p.id ? null : p.id)}>
              {p.title}
            </button>
          ))}
        </div>
      )}
      {openPairing && (
        <div className="recipe-pairing-card">
          <RecipeCard recipe={pairings.find((p) => p.id === openPairing)} compact startOpen />
        </div>
      )}

      <div className="recipe-actions">
        <button type="button" className="button primary small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide recipe" : "See full recipe"}
        </button>
        {footer ?? (
          <button type="button" className="button outline small" onClick={save} disabled={saved || saving}>
            {saved ? "Saved to cookbook" : saving ? "Saving…" : "Save to cookbook"}
          </button>
        )}
        {allowMakeItMine && !compact && recipe.origin !== "personal" && !mine && (
          <button type="button" className="button outline small" onClick={personalize} disabled={personalizing}>
            {personalizing ? "Personalizing…" : "Make it mine"}
          </button>
        )}
        {error && <span className="recipe-error" role="alert">{error}</span>}
      </div>

      {mine && (
        <div className="recipe-mine">
          <PersonalRecipe recipe={mine} />
        </div>
      )}
    </article>
  );
}
