"use client";

import { useState } from "react";
import { addFreshItems, removeFreshItem, savePantryStaples } from "../actions";
import { COMMON_PICKS, FRESH_SUGGESTIONS, STAPLE_CATEGORIES } from "../../lib/pantry-data";

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "added today";
  if (days === 1) return "added yesterday";
  return `added ${days} days ago`;
}

// The 2-minute tap quiz: one category per screen, tap to select, no typing.
function StapleQuiz({ initial, onDone, onCancel }) {
  const [picked, setPicked] = useState(new Set(initial));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cat = STAPLE_CATEGORIES[step];
  const last = step === STAPLE_CATEGORIES.length - 1;

  const toggle = (item) => {
    const next = new Set(picked);
    next.has(item) ? next.delete(item) : next.add(item);
    setPicked(next);
  };
  const setMany = (items, on) => {
    const next = new Set(picked);
    items.forEach((i) => (on ? next.add(i) : next.delete(i)));
    setPicked(next);
  };

  async function finish() {
    setSaving(true);
    setError("");
    const res = await savePantryStaples([...picked]).catch(() => null);
    setSaving(false);
    if (res?.ok) onDone([...picked]);
    else setError(res?.error ?? "Couldn't save. Try again.");
  }

  return (
    <div className="pantry-quiz">
      <div className="pantry-quiz-top">
        <span className="pantry-step">Step {step + 1} of {STAPLE_CATEGORIES.length}</span>
        <button type="button" className="ob-link" onClick={onCancel}>Cancel</button>
      </div>
      <div className="ob-bar" aria-hidden="true"><span style={{ width: `${((step + 1) / STAPLE_CATEGORIES.length) * 100}%` }} /></div>
      <h2>{cat.title}</h2>
      <p className="pantry-sub">{cat.sub ?? "Tap everything you usually have."}</p>
      <div className="pantry-quick">
        <button type="button" className="ob-preset" onClick={() => setMany(COMMON_PICKS[cat.id] ?? [], true)}>Add the usual ones</button>
        <button type="button" className="ob-preset" onClick={() => setMany(cat.items, true)}>All of these</button>
        <button type="button" className="ob-link" onClick={() => setMany(cat.items, false)}>Clear</button>
      </div>
      <div className="ob-chips">
        {cat.items.map((item) => (
          <button key={item} type="button" className="ob-chip" aria-pressed={picked.has(item)} onClick={() => toggle(item)}>
            <span className="ob-chip-mark" aria-hidden="true" />
            {item}
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pantry-quiz-nav">
        {step > 0 ? <button type="button" className="button outline" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <span className="pantry-count">{picked.size} items</span>
        {last
          ? <button type="button" className="button primary" onClick={finish} disabled={saving}>{saving ? "Saving…" : "Save my pantry"}</button>
          : <button type="button" className="button primary" onClick={() => setStep(step + 1)}>Next</button>}
      </div>
    </div>
  );
}

export default function PantryClient({ initial }) {
  const [staples, setStaples] = useState(initial.staples);
  const [hasTakenQuiz, setHasTakenQuiz] = useState(initial.hasTakenQuiz);
  const [fresh, setFresh] = useState(initial.fresh);
  const [quiz, setQuiz] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(names) {
    setBusy(true);
    setError("");
    const res = await addFreshItems(names).catch(() => null);
    setBusy(false);
    if (res?.ok) { setFresh([...res.added, ...fresh]); setDraft(""); }
    else setError(res?.error ?? "Couldn't add that. Try again.");
  }

  async function remove(id) {
    setFresh(fresh.filter((f) => f.id !== id));
    await removeFreshItem(id).catch(() => null);
  }

  function submit(e) {
    e.preventDefault();
    // Allow "chicken, bacon and spinach" in one go.
    const names = draft.split(/,|\band\b|\n/i).map((s) => s.trim()).filter(Boolean);
    if (names.length) add(names);
  }

  if (quiz) {
    return (
      <StapleQuiz
        initial={staples}
        onCancel={() => setQuiz(false)}
        onDone={(items) => { setStaples(items); setHasTakenQuiz(true); setQuiz(false); }}
      />
    );
  }

  const freshNames = new Set(fresh.map((f) => f.name));

  return (
    <div className="pantry">
      <section className="pantry-card">
        <div className="pantry-card-head">
          <div>
            <h2>Staples</h2>
            <p className="pantry-sub">Long-lasting basics and things you restock yourself. These stay until you change them.</p>
          </div>
          <button type="button" className="button primary small" onClick={() => setQuiz(true)}>
            {hasTakenQuiz ? "Update staples" : "Take the 2-minute quiz"}
          </button>
        </div>
        {!hasTakenQuiz ? (
          <p className="pantry-empty">Tap through 8 quick screens and ChatEAT will know what you usually have. No typing.</p>
        ) : staples.length === 0 ? (
          <p className="pantry-empty">No staples saved.</p>
        ) : (
          <div className="pantry-groups">
            {STAPLE_CATEGORIES.map((cat) => {
              const mine = cat.items.filter((i) => staples.includes(i));
              if (!mine.length) return null;
              return (
                <div key={cat.id} className="pantry-group">
                  <h3>{cat.title}</h3>
                  <p>{mine.join(", ")}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="pantry-card">
        <h2>Fresh items</h2>
        <p className="pantry-sub">Meat, fish and produce that won&apos;t last long. Each one clears itself out after its usual fridge life, so this list stays roughly current.</p>
        <form className="pantry-add" onSubmit={submit}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g., chicken, bacon, spinach" maxLength={200} aria-label="Add fresh items" />
          <button className="button primary small" type="submit" disabled={busy || !draft.trim()}>{busy ? "Adding…" : "Add"}</button>
        </form>
        <div className="pantry-suggest">
          {FRESH_SUGGESTIONS.filter((s) => !freshNames.has(s)).map((s) => (
            <button key={s} type="button" className="cook-idea" onClick={() => add([s])} disabled={busy}>+ {s}</button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {fresh.length === 0 ? (
          <p className="pantry-empty">Nothing fresh right now.</p>
        ) : (
          <ul className="pantry-fresh">
            {fresh.map((f) => (
              <li key={f.id}>
                <span className="pantry-fresh-name">{f.name}</span>
                <span className="pantry-fresh-when">{ago(f.addedAt)}</span>
                <button type="button" className="pantry-remove" onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
