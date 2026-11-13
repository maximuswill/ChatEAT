"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { makePlan, moreIdeas, myRecipes, putMyRecipe, recipeForSlot, saveSlots } from "./actions";
import RecipeCard from "../RecipeCard";
import RecipeMarks from "../RecipeMarks";
import { groceryList, isPrepKey, localISO, MAX_PREP, PREP_MEAL, prepKey, prepKeys, slotKey, slotSource, weekDays } from "../../lib/plan-shared";

// What each slot color means (see slotSource in lib/plan-shared.js).
const SOURCE_LABEL = { user: "Your pick", request: "From your week", quick: "Quick fill", prep: "From your meal prep" };

const EXAMPLE = "Game Thursday, no time Monday or Tuesday, friends over Friday, want to grill Saturday.";

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// The recipe a slot shows: its own, or for a red slot, the meal prep item it points at.
function slotRecipe(plan, slots, slot) {
  if (slot?.prepFrom) return plan.recipes[slots[slot.prepFrom]?.recipeId] ?? null;
  return slot?.recipeId ? plan.recipes[slot.recipeId] ?? null : null;
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

  // Anything the person picks themselves turns the slot green.
  function choose(key, recipeId) {
    if (isPrepKey(key)) { update({ ...slots, [key]: { recipeId, source: "user" } }); return; }
    const { prepFrom, ...old } = slots[key] ?? {};
    update({ ...slots, [key]: { ...old, recipeId, leftovers: false, source: "user" } });
  }
  function leftovers(key) {
    const { prepFrom, ...old } = slots[key] ?? {};
    update({ ...slots, [key]: { ...old, recipeId: null, leftovers: true, source: "user" } });
  }
  // Eat one of the meal prep items in this slot (red).
  function usePrep(key, fromKey) {
    const old = slots[key] ?? {};
    update({ ...slots, [key]: { pinned: old.pinned, note: old.note, recipeId: null, leftovers: false, prepFrom: fromKey, source: "prep" } });
  }
  // "Make a recipe for this meal" already saved the slot on the server; show it here.
  function made(res) {
    setPlan((p) => ({
      ...p,
      recipes: { ...p.recipes, ...Object.fromEntries(res.recipes.map((r) => [r.id, r])) },
      pool: { ...p.pool, [res.listKey]: [...new Set([...res.recipes.slice(1).map((r) => r.id), ...(p.pool[res.listKey] ?? [])])] },
    }));
    setSlots((s) => ({ ...s, [res.slotKey]: res.slot }));
    setSaveState("Saved");
  }
  // Clearing a pinned meal keeps its reason ("Grill night") so the slot still says why; clearing again removes it.
  // Removing a meal prep item also takes it off any day that was eating it.
  function clear(key) {
    const next = { ...slots };
    if (isPrepKey(key)) {
      delete next[key];
      for (const [k, s] of Object.entries(next)) {
        if (s.prepFrom !== key) continue;
        if (s.note) next[k] = { pinned: s.pinned, note: s.note, recipeId: null, leftovers: false };
        else delete next[k];
      }
      setSelected(null);
    } else {
      const old = slots[key];
      if (old?.note && (old.recipeId || old.leftovers || old.prepFrom)) next[key] = { pinned: old.pinned, note: old.note, recipeId: null, leftovers: false };
      else delete next[key];
    }
    update(next);
  }

  function select(key) {
    setSelected(selected === key ? null : key);
    setTimeout(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  function addPrep() {
    const used = new Set(prepKeys(slots));
    let i = 0;
    while (used.has(prepKey(i)) && i < MAX_PREP) i++;
    if (i < MAX_PREP) select(prepKey(i));
  }

  const chosen = useMemo(() => {
    if (!plan) return [];
    const ids = [...new Set(Object.values(slots).map((s) => s.recipeId).filter(Boolean))];
    return ids.map((id) => plan.recipes[id]).filter(Boolean);
  }, [plan, slots]);
  const groceries = useMemo(() => groceryList(chosen, pantry), [chosen, pantry]);

  const ended = plan && today && plan.days[6].date < today;
  const prepItems = prepKeys(slots).filter((k) => plan?.recipes[slots[k]?.recipeId]);
  const addingPrep = selected && isPrepKey(selected) && !slots[selected];

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
        <p className="hint">Mention &ldquo;meal prep&rdquo; or days with no time and ChatEAT fills your meal prep too.{plan ? " Planning again replaces this week's calendar." : ""}</p>
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
          <p className="plan-legend">
            <span className="plan-key src-user" /> Your pick
            <span className="plan-key src-request" /> From your week
            <span className="plan-key src-quick" /> Quick fill
            <span className="plan-key src-prep" /> Meal prep
            <span className="plan-legend-tip">· <RecipeMarks marks={["mine"]} /> your Make it mine · <RecipeMarks marks={["saved"]} /> in your cookbook · Click any meal to change it.</span>
          </p>

          <div className="plan-layout">
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
                    const recipe = slotRecipe(plan, slots, slot);
                    const prepHint = day.busy && (meal === "Lunch" || meal === "Dinner");
                    return (
                      <SlotButton key={key} meal={`${meal}${prepHint && !recipe && !slot?.leftovers ? " · prep ahead" : ""}`}
                        slot={slot} recipe={recipe} pressed={selected === key} onClick={() => select(key)} />
                    );
                  })}
                </div>
              ))}
            </div>

            <aside className="plan-prep" aria-label="Meal prep">
              <h3>Meal prep</h3>
              <p className="plan-prep-hint">Cook these ahead. Red meals on the calendar eat from them.</p>
              {prepKeys(slots).map((key) => {
                const recipe = plan.recipes[slots[key]?.recipeId];
                if (!recipe) return null;
                const eaten = Object.values(slots).filter((s) => s.prepFrom === key).length;
                return (
                  <SlotButton key={key} meal={eaten ? `Feeds ${eaten} ${eaten === 1 ? "meal" : "meals"}` : "Meal prep"}
                    slot={slots[key]} recipe={recipe} pressed={selected === key} onClick={() => select(key)} />
                );
              })}
              {addingPrep && <div className="plan-slot open adding" aria-hidden="true"><span className="plan-slot-add">Choose below…</span></div>}
              {prepKeys(slots).length < MAX_PREP && !addingPrep && (
                <button type="button" className="plan-prep-add" onClick={addPrep}>+ Add meal prep</button>
              )}
            </aside>
          </div>

          <div ref={pickerRef}>
            {selected && (
              <SlotPicker
                key={selected}
                plan={plan}
                slotId={selected}
                slot={slots[selected]}
                slots={slots}
                prepItems={prepItems}
                onChoose={(id) => choose(selected, id)}
                onLeftovers={() => leftovers(selected)}
                onUsePrep={(fromKey) => usePrep(selected, fromKey)}
                onClear={() => clear(selected)}
                onClose={() => setSelected(null)}
                onMade={made}
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
                <p className="hint">For {chosen.length} {chosen.length === 1 ? "recipe" : "recipes"} this week, meal prep included{pantry.length ? ", minus what's in your pantry" : ""}. Check amounts in each recipe.</p>
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

// One meal on the calendar (or one meal prep item), colored by where it came from.
function SlotButton({ meal, slot, recipe, pressed, onClick }) {
  const filled = Boolean(recipe || slot?.leftovers);
  const source = slotSource(slot);
  return (
    <button type="button" aria-pressed={pressed}
      className={`plan-slot ${filled ? `filled src-${source}` : "open"}`}
      title={filled ? SOURCE_LABEL[source] : undefined}
      onClick={onClick}>
      <span className="plan-slot-meal">{meal}{filled && <span className="sr-only"> ({SOURCE_LABEL[source]})</span>}</span>
      {recipe && <span className="plan-slot-title">{recipe.title} <RecipeMarks marks={recipe.marks} /></span>}
      {slot?.leftovers && <span className="plan-slot-title">Leftovers</span>}
      {slot?.prepFrom && recipe && <span className="plan-slot-note">From your meal prep</span>}
      {slot?.note && <span className="plan-slot-note">{slot.note}</span>}
      {!filled && <span className="plan-slot-add">+ Choose</span>}
    </button>
  );
}

// The panel under the calendar for one slot or meal prep item: its recipe (if any) and this week's options.
function SlotPicker({ plan, slotId, slot, slots, prepItems, onChoose, onLeftovers, onUsePrep, onClear, onClose, onMore, onMade }) {
  const isPrep = isPrepKey(slotId);
  const [dayIndex, mealName] = slotId.split("|");
  const day = isPrep ? null : plan.days[Number(dayIndex)];
  const meal = isPrep ? PREP_MEAL : mealName;
  const listKey = isPrep ? "prep" : meal;
  const recipe = slotRecipe(plan, slots, slot);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Meal prep options leave out what's already being prepped.
  const prepping = new Set(isPrep ? prepItems.map((k) => slots[k]?.recipeId) : []);
  const ids = [...new Set(plan.pool[listKey] ?? [])].filter((id) => id !== slot?.recipeId && !prepping.has(id) && plan.recipes[id]);
  // Where each recipe already sits this week, so repeats are easy to spot (and fine for meal prep).
  const placed = {};
  for (const [key, s] of Object.entries(slots)) {
    if (!s.recipeId) continue;
    (placed[s.recipeId] ??= []).push(isPrepKey(key) ? "meal prep" : plan.days[Number(key.split("|")[0])].name.slice(0, 3));
  }
  const canEatPrep = !isPrep && prepItems.length > 0;
  const useLabel = isPrep ? "meal prep" : `${day.name} ${meal.toLowerCase()}`;

  // Their own Make it mine and cookbook recipes, offered in every slot.
  const [mineList, setMineList] = useState(null);
  const [mineError, setMineError] = useState("");
  const loadMine = () => myRecipes().then((res) => setMineList(res.recipes ?? [])).catch(() => setMineList([]));
  useEffect(() => { loadMine(); }, []);
  async function putMine(ref) {
    setMineError("");
    const res = await putMyRecipe({ key: slotId, ref }).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    if (res.error) { setMineError(res.error); return res; }
    onMade(res);
    loadMine();
    return res;
  }

  async function more() {
    setLoading(true);
    setMessage("");
    const res = await moreIdeas(slotId, false).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setLoading(false);
    if (res.error) { setMessage(res.error); return; }
    onMore(res.listKey, res.recipes);
    setMessage(res.aiNotice || (res.limitReached ? "You've used this week's AI requests, so these came from the library." : `Added ${res.recipes.length} more ${res.recipes.length === 1 ? "idea" : "ideas"} to the top of the list.`));
  }

  return (
    <section className="plan-picker" aria-label={isPrep ? "Meal prep" : `${day.name} ${meal}`}>
      <div className="plan-picker-head">
        <h2>{isPrep ? (recipe ? "Meal prep" : "Add meal prep") : `${day.name} · ${meal}`}</h2>
        <button type="button" className="plan-close" onClick={onClose}>Close</button>
      </div>
      {(recipe || slot?.leftovers) && (
        <p className="plan-picker-source"><span className={`plan-key src-${slotSource(slot)}`} /> {SOURCE_LABEL[slotSource(slot)]}</p>
      )}
      {slot?.note && <p className="plan-picker-note"><span className="plan-key src-request" /> {slot.note}</p>}
      {isPrep && <p className="hint">Batch meals and make-ahead snacks to cook once. Then point any meal on the calendar at them.</p>}
      {!isPrep && day.busy && <p className="hint">{day.busy}. Eating from your meal prep or leftovers works best.</p>}

      <MakeForSlot slotId={slotId} label={isPrep ? "meal prep" : `${day.name}'s ${meal.toLowerCase()}`} hasMeal={Boolean(recipe || slot?.leftovers)} onMade={onMade} />

      {recipe && (
        <div className="plan-current">
          <RecipeCard key={recipe.id} recipe={recipe} useLabel={useLabel} onUseMine={(version) => putMine(`lib:${version.libraryId}`)} />
        </div>
      )}
      {slot?.leftovers && <p className="plan-current-text"><strong>Leftovers</strong> from earlier in the week.</p>}

      <div className="plan-picker-actions">
        {isPrep && recipe && <button type="button" className="button outline small" onClick={onClear}>Remove from meal prep</button>}
        {!isPrep && (recipe || slot?.leftovers) && <button type="button" className="button outline small" onClick={onClear}>Clear this meal</button>}
        {!isPrep && !recipe && !slot?.leftovers && slot?.note && <button type="button" className="button outline small" onClick={onClear}>Remove this note</button>}
        {!isPrep && !slot?.leftovers && <button type="button" className="button outline small" onClick={onLeftovers}>Leftovers</button>}
      </div>

      {canEatPrep && (
        <div className="plan-eat-prep">
          <h3 className="plan-options-title">Eat from your meal prep</h3>
          <div className="plan-eat-prep-list">
            {prepItems.map((key) => (
              <button key={key} type="button" className={`plan-eat-prep-item ${slot?.prepFrom === key ? "current" : ""}`}
                onClick={() => onUsePrep(key)} disabled={slot?.prepFrom === key}>
                {plan.recipes[slots[key].recipeId].title}{slot?.prepFrom === key ? " ✓" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {mineList?.length > 0 && (
        <details className="plan-mine" open={!recipe}>
          <summary className="plan-options-title">Your recipes ({mineList.length})</summary>
          <p className="hint">Your Make it mine versions <RecipeMarks marks={["mine"]} /> and cookbook recipes <RecipeMarks marks={["saved"]} />.</p>
          {mineError && <p className="form-error" role="alert">{mineError}</p>}
          <ul className="plan-options">
            {mineList.filter((m) => m.recipe.id !== slot?.recipeId).map(({ ref, recipe: r }) => (
              <li key={ref} className="plan-option">
                <div className="plan-option-row">
                  <div>
                    <strong>{r.title} <RecipeMarks marks={r.marks} /></strong>
                    <span className="plan-option-meta">{r.total_minutes ? `${r.total_minutes} min` : ""}{r.nutrition?.protein_g ? ` · ${r.nutrition.protein_g} g protein` : ""}</span>
                  </div>
                  <div className="plan-option-buttons">
                    <button type="button" className="button primary small" onClick={() => putMine(ref)}>Choose</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h3 className="plan-options-title">{isPrep ? "Choose something to prep" : recipe || slot?.leftovers ? "Swap for one of this week's options" : "Choose from this week's options"}</h3>
      {ids.length === 0 && <p className="cook-empty">No more options yet. Try More ideas.</p>}
      <ul className="plan-options">
        {ids.map((id) => {
          const r = plan.recipes[id];
          return (
            <li key={id} className="plan-option">
              <div className="plan-option-row">
                <div>
                  <strong>{r.title} <RecipeMarks marks={r.marks} /></strong>
                  <span className="plan-option-meta">
                    {r.total_minutes} min{r.active_minutes ? ` (${r.active_minutes} hands-on)` : ""} · {r.nutrition?.protein_g} g protein{r.course === "snack" ? " · snack" : ""}{r.tags?.some((t) => t === "make-ahead" || t === "meal-prep") ? " · make-ahead" : ""}
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

// "Make a recipe for this meal": describe what you want for this one slot or meal prep item.
function MakeForSlot({ slotId, label, hasMeal, onMade }) {
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isPrep = isPrepKey(slotId);

  async function make(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const res = await recipeForSlot({ key: slotId, text: wish }).catch(() => ({ error: "Couldn't reach ChatEAT. Check your connection." }));
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onMade(res);
    setWish("");
    const others = res.recipes.length - 1;
    setMessage(`${res.recipes[0].title} ${isPrep ? "is in your meal prep" : `is now ${label}`}.${others > 0 ? ` ${others} more ${others === 1 ? "idea is" : "ideas are"} at the top of the options below.` : ""}${res.notice ? ` ${res.notice}` : ""}`);
  }

  return (
    <form className="plan-make" onSubmit={make}>
      <label htmlFor="plan-make-input">{hasMeal ? "Want something else? Describe it" : isPrep ? "Describe what you want to prep" : "Make a recipe for this meal"}</label>
      <div className="plan-make-row">
        <input id="plan-make-input" type="text" maxLength={300} value={wish} onChange={(e) => setWish(e.target.value)}
          placeholder={isPrep ? "e.g., chicken and rice bowls for 4 lunches, or protein snack bites" : `e.g., something quick with chicken for ${label}`} />
        <button className="button primary small" type="submit" disabled={loading || wish.trim().length < 3}>{loading ? "Making…" : "Make it"}</button>
      </div>
      <span className="hint">Checks the recipe library first. A brand-new recipe uses one of your weekly AI requests.</span>
      {loading && <div className="cook-loading"><span className="cook-spinner" aria-hidden="true" /> Finding the right recipe…</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="plan-make-done" role="status">{message}</p>}
    </form>
  );
}
