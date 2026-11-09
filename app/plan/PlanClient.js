"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { makePlan, moreIdeas, saveSlots } from "./actions";
import RecipeCard from "../RecipeCard";
import { groceryList, localISO, slotKey, weekDays } from "../../lib/plan-shared";

const EXAMPLE = "Game Thursday, no time Monday or Tuesday, friends over Friday, want to grill Saturday.";

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function PlanClient({ initialPlan, rules, pantry }) {
  const [plan, setPlan] = useState(initialPlan);
  const [slots, setSlots] = useState(initialPlan?.slots ?? {});
  const [text, setText] = useState(initialPlan?.text ?? "");
  const [today, setToday] = useState(null); // set after load so it's the person's own date
  const [start, setStart] = useState("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [saveState, setSaveState] = useState("");
  const pickerRef = useRef(null);

  useEffect(() => setToday(localISO()), []);

  const nextMonday = today ? addDays(today, ((8 - new Date(`${today}T12:00:00`).getDay()) % 7) || 7) : null;
  const startOptions = today ? [
    { value: "today", iso: today, label: `Today (${weekDays(today)[0].name.slice(0, 3)}, ${weekDays(today)[0].label})` },
    { value: "monday", iso: nextMonday, label: `Next Monday (${weekDays(nextMonday)[0].label})` },
  ] : [];

  async function plan_() {
    const iso = startOptions.find((o) => o.value === start)?.iso;
    if (!iso) return;
    setLoading(true);
    setError("");
    const res = await makePlan({ text, start: iso }).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setPlan(res.plan);
    setSlots(res.plan.slots);
    setSelected(null);
  }

  async function update(next) {
    setSlots(next);
    setSaveState("Saving…");
    const res = await saveSlots(next).catch(() => ({ error: "Couldn't save. Check your connection." }));
    setSaveState(res?.ok ? "Saved" : res?.error ?? "Couldn't save.");
  }

  function choose(key, recipeId) {
    const old = slots[key] ?? {};
    update({ ...slots, [key]: { ...old, recipeId, leftovers: false } });
  }
  function leftovers(key) {
    const old = slots[key] ?? {};
    update({ ...slots, [key]: { ...old, recipeId: null, leftovers: true } });
  }
  // Clearing a pinned meal keeps its reason ("Grill night") so the slot still says why; clearing again removes it.
  function clear(key) {
    const old = slots[key];
    const next = { ...slots };
    if (old?.note && (old.recipeId || old.leftovers)) next[key] = { pinned: old.pinned, note: old.note, recipeId: null, leftovers: false };
    else delete next[key];
    update(next);
  }

  function select(key) {
    setSelected(selected === key ? null : key);
    setTimeout(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const chosen = useMemo(() => {
    if (!plan) return [];
    const ids = [...new Set(Object.values(slots).map((s) => s.recipeId).filter(Boolean))];
    return ids.map((id) => plan.recipes[id]).filter(Boolean);
  }, [plan, slots]);
  const groceries = useMemo(() => groceryList(chosen, pantry), [chosen, pantry]);

  const ended = plan && today && plan.days[6].date < today;

  return (
    <>
      <form className="cook-form" onSubmit={(e) => { e.preventDefault(); plan_(); }}>
        <label htmlFor="week" className="cook-label">What does your week look like?</label>
        <textarea id="week" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g., ${EXAMPLE}`} />
        {!text && <div className="cook-ideas"><button type="button" className="cook-idea" onClick={() => setText(EXAMPLE)}>Try the example</button></div>}
        <div className="cook-submit">
          <label className="plan-start">
            Week starts
            <select value={start} onChange={(e) => setStart(e.target.value)} disabled={!today}>
              {startOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button className="button primary" type="submit" disabled={loading || !today}>
            {loading ? "Planning…" : plan ? "Plan a new week" : "Plan my week"}
          </button>
          {rules.length > 0 && <span className="cook-rules">Always avoiding: <strong>{rules.join(", ")}</strong></span>}
        </div>
        {plan && <p className="hint">Planning again replaces this week&apos;s calendar.</p>}
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <div className="cook-loading"><span className="cook-spinner" aria-hidden="true" /> Reading your week and picking meals…</div>}

      {plan && !loading && (
        <section className="plan-result" aria-label="Your week">
          {plan.notice && <p className="cook-banner">{plan.notice}</p>}
          {ended && <p className="cook-banner">This plan ended on {plan.days[6].name}, {plan.days[6].label}. Plan a new week when you&apos;re ready.</p>}
          <div className="plan-head">
            <h2>Your week <span>{plan.days[0].label} – {plan.days[6].label}</span></h2>
            <span className="plan-save" aria-live="polite">{saveState}</span>
          </div>
          <p className="plan-legend"><span className="plan-pin-dot" /> Pinned for a reason · Click any meal to choose, swap or clear it.</p>

          <div className="plan-week">
            {plan.days.map((day, d) => (
              <div key={day.date} className={`plan-day ${day.date === today ? "today" : ""}`}>
                <div className="plan-day-head">
                  <strong>{day.name}</strong> <span>{day.label}</span>
                  {day.busy && <em className="plan-busy">{day.busy}</em>}
                </div>
                {plan.meals.map((meal) => {
                  const key = slotKey(d, meal);
                  const slot = slots[key];
                  const recipe = slot?.recipeId ? plan.recipes[slot.recipeId] : null;
                  const prepHint = day.busy && (meal === "Lunch" || meal === "Dinner");
                  return (
                    <button key={key} type="button" aria-pressed={selected === key}
                      className={`plan-slot ${recipe || slot?.leftovers ? "filled" : "open"} ${slot?.pinned ? "pinned" : ""}`}
                      onClick={() => select(key)}>
                      <span className="plan-slot-meal">{meal}{prepHint && !recipe && !slot?.leftovers ? " · prep ahead" : ""}</span>
                      {recipe && <span className="plan-slot-title">{recipe.title}</span>}
                      {slot?.leftovers && <span className="plan-slot-title">Leftovers</span>}
                      {slot?.note && <span className="plan-slot-note">{slot.note}</span>}
                      {!recipe && !slot?.leftovers && <span className="plan-slot-add">+ Choose</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div ref={pickerRef}>
            {selected && (
              <SlotPicker
                key={selected}
                plan={plan}
                slotId={selected}
                slot={slots[selected]}
                slots={slots}
                onChoose={(id) => choose(selected, id)}
                onLeftovers={() => leftovers(selected)}
                onClear={() => clear(selected)}
                onClose={() => setSelected(null)}
                onMore={(listKey, recipes) => setPlan((p) => ({
                  ...p,
                  recipes: { ...p.recipes, ...Object.fromEntries(recipes.map((r) => [r.id, r])) },
                  pool: { ...p.pool, [listKey]: [...new Set([...recipes.map((r) => r.id), ...(p.pool[listKey] ?? [])])] },
                }))}
              />
            )}
          </div>

          <section className="plan-groceries">
            <h2>You may need</h2>
            {chosen.length === 0 ? (
              <p className="cook-empty">Choose some meals and their ingredients show up here.</p>
            ) : (
              <>
                <p className="hint">For {chosen.length} {chosen.length === 1 ? "meal" : "meals"} this week{pantry.length ? ", minus what's in your pantry" : ""}. Check amounts in each recipe.</p>
                <ul className="plan-grocery-list">
                  {groceries.need.map((g) => (
                    <li key={g.name}>
                      <label><input type="checkbox" /> {g.name}{g.recipes.length > 1 && <span> · {g.recipes.length} meals</span>}</label>
                    </li>
                  ))}
                </ul>
                {groceries.have.length > 0 && (
                  <details className="plan-have">
                    <summary>Probably in your pantry ({groceries.have.length})</summary>
                    <p>{groceries.have.map((g) => g.name).join(", ")}</p>
                  </details>
                )}
              </>
            )}
          </section>
        </section>
      )}
    </>
  );
}

// The panel under the calendar for one slot: its recipe (if any) and this week's options to choose from.
function SlotPicker({ plan, slotId, slot, slots, onChoose, onLeftovers, onClear, onClose, onMore }) {
  const [dayIndex, meal] = slotId.split("|");
  const day = plan.days[Number(dayIndex)];
  const recipe = slot?.recipeId ? plan.recipes[slot.recipeId] : null;
  const prepFirst = Boolean(day.busy) && (meal === "Lunch" || meal === "Dinner");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const ids = [...new Set([...(prepFirst ? plan.pool.prep ?? [] : []), ...(plan.pool[meal] ?? [])])].filter((id) => id !== slot?.recipeId && plan.recipes[id]);
  // Where each recipe already sits this week, so repeats are easy to spot (and fine for meal prep).
  const placed = {};
  for (const [key, s] of Object.entries(slots)) if (s.recipeId) (placed[s.recipeId] ??= []).push(plan.days[Number(key.split("|")[0])].name.slice(0, 3));

  async function more() {
    setLoading(true);
    setMessage("");
    const res = await moreIdeas(meal, prepFirst).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setLoading(false);
    if (res.error) { setMessage(res.error); return; }
    onMore(res.listKey, res.recipes);
    setMessage(res.aiNotice || (res.limitReached ? "You've used this week's AI requests, so these came from the library." : `Added ${res.recipes.length} more ${res.recipes.length === 1 ? "idea" : "ideas"} to the top of the list.`));
  }

  return (
    <section className="plan-picker" aria-label={`${day.name} ${meal}`}>
      <div className="plan-picker-head">
        <h2>{day.name} · {meal}</h2>
        <button type="button" className="plan-close" onClick={onClose}>Close</button>
      </div>
      {slot?.note && <p className="plan-picker-note"><span className="plan-pin-dot" /> {slot.note}</p>}
      {prepFirst && <p className="hint">{day.busy}. Make-ahead recipes and leftovers come first.</p>}

      {recipe && (
        <div className="plan-current">
          <RecipeCard recipe={recipe} />
        </div>
      )}
      {slot?.leftovers && <p className="plan-current-text"><strong>Leftovers</strong> from earlier in the week.</p>}

      <div className="plan-picker-actions">
        {(recipe || slot?.leftovers) && <button type="button" className="button outline small" onClick={onClear}>Clear this meal</button>}
        {!recipe && !slot?.leftovers && slot?.note && <button type="button" className="button outline small" onClick={onClear}>Remove this note</button>}
        {!slot?.leftovers && <button type="button" className="button outline small" onClick={onLeftovers}>Leftovers</button>}
      </div>

      <h3 className="plan-options-title">{recipe || slot?.leftovers ? "Swap for one of this week's options" : "Choose from this week's options"}</h3>
      {ids.length === 0 && <p className="cook-empty">No more options for this meal yet. Try More ideas.</p>}
      <ul className="plan-options">
        {ids.map((id) => {
          const r = plan.recipes[id];
          return (
            <li key={id} className="plan-option">
              <div className="plan-option-row">
                <div>
                  <strong>{r.title}</strong>
                  <span className="plan-option-meta">
                    {r.total_minutes} min{r.active_minutes ? ` (${r.active_minutes} hands-on)` : ""} · {r.nutrition?.protein_g} g protein{r.tags?.some((t) => t === "make-ahead" || t === "meal-prep") ? " · make-ahead" : ""}
                    {placed[id] && ` · on ${placed[id].join(", ")}`}
                  </span>
                  {r.why_it_fits && <span className="plan-option-why">{r.why_it_fits}</span>}
                </div>
                <div className="plan-option-buttons">
                  <button type="button" className="button primary small" onClick={() => onChoose(id)}>Choose</button>
                  <button type="button" className="button outline small" aria-expanded={preview === id} onClick={() => setPreview(preview === id ? null : id)}>{preview === id ? "Hide" : "Preview"}</button>
                </div>
              </div>
              {preview === id && <div className="plan-preview"><RecipeCard recipe={r} compact startOpen /></div>}
            </li>
          );
        })}
      </ul>
      <div className="plan-picker-actions">
        <button type="button" className="button outline small" onClick={more} disabled={loading}>{loading ? "Finding ideas…" : "More ideas"}</button>
        {message && <span className="hint" role="status">{message}</span>}
      </div>
    </section>
  );
}
