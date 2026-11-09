"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveProfile } from "../actions";
import * as D from "../../lib/onboarding-data";

const SECTIONS = ["You", "Kitchen", "Skills", "Taste", "Safety", "Goals"];

const STEPS = [
  { id: "welcome", section: "You" },
  { id: "life", section: "You" },
  { id: "appetite", section: "You" },
  { id: "time", section: "You" },
  { id: "meals", section: "You" },
  { id: "kitchen", section: "Kitchen" },
  { id: "skills", section: "Skills" },
  { id: "learn", section: "Skills" },
  { id: "cuisines", section: "Taste" },
  { id: "favorites", section: "Taste" },
  { id: "style", section: "Taste" },
  { id: "safety", section: "Safety" },
  { id: "goals", section: "Goals" },
  { id: "budget", section: "Goals" },
  { id: "review", section: "Review" },
];

// ---------- Small building blocks ----------

function Chips({ options, value, onChange, custom, customPlaceholder = "Add your own", tone }) {
  const [draft, setDraft] = useState("");
  const shown = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  const add = () => {
    const v = draft.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v.slice(0, 60)]);
    setDraft("");
  };
  return (
    <div className="ob-chips-wrap">
      <div className="ob-chips">
        {shown.map((opt) => (
          <button key={opt} type="button" className={`ob-chip ${tone ?? ""}`} aria-pressed={value.includes(opt)} onClick={() => toggle(opt)}>
            <span className="ob-chip-mark" aria-hidden="true" />
            {opt}
          </button>
        ))}
      </div>
      {custom && (
        <div className="ob-add">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={customPlaceholder} maxLength={60} aria-label={customPlaceholder} />
          <button type="button" className="ob-add-btn" onClick={add} disabled={!draft.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}

function Cards({ options, value, onChange, columns }) {
  return (
    <div className="ob-cards" style={columns ? { "--cols": columns } : undefined}>
      {options.map((o) => (
        <button key={o.value} type="button" className="ob-card" aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? "" : o.value)}>
          <span className="ob-card-label">{o.label}</span>
          {o.hint && <span className="ob-card-hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="ob-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? "" : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function Scale({ value, onChange, labels, min = 0, label, icon }) {
  const max = min + labels.length - 1;
  return (
    <div className="ob-scale">
      <div className="ob-scale-top">
        <span className="ob-scale-value" aria-live="polite">{labels[value - min]}</span>
        {icon && <span className="ob-scale-icons" aria-hidden="true">{Array.from({ length: value - min + 1 }, (_, i) => <span key={i}>{icon}</span>)}</span>}
      </div>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={labels[value - min]} style={{ "--fill": `${((value - min) / (max - min)) * 100}%` }} />
      <div className="ob-scale-ends"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
    </div>
  );
}

function Stepper({ value, onChange, min = 1, max = 12, label }) {
  return (
    <div className="ob-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="One fewer">−</button>
      <span aria-live="polite"><strong>{value}</strong> {value === 1 ? "person" : "people"}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more">+</button>
    </div>
  );
}

function TriChips({ options, value, onChange }) {
  const cycle = (opt) => {
    const next = { ...value };
    if (!next[opt]) next[opt] = "love";
    else if (next[opt] === "love") next[opt] = "no";
    else delete next[opt];
    onChange(next);
  };
  return (
    <div className="ob-chips">
      {options.map((opt) => (
        <button key={opt} type="button" className={`ob-chip tri ${value[opt] ?? ""}`} onClick={() => cycle(opt)} aria-label={`${opt}: ${value[opt] === "love" ? "love it" : value[opt] === "no" ? "not for me" : "no opinion"}`}>
          <span className="ob-tri-icon" aria-hidden="true">{value[opt] === "love" ? "♥" : value[opt] === "no" ? "×" : ""}</span>
          {opt}
        </button>
      ))}
    </div>
  );
}

// Meals: tap once = love it, tap twice = all-time favorite, tap again = clear.
function FavoriteChips({ options, loved, top, onChange }) {
  const [draft, setDraft] = useState("");
  const shown = [...options, ...[...loved, ...top].filter((v) => !options.includes(v))];
  const stateOf = (opt) => (top.includes(opt) ? "top" : loved.includes(opt) ? "love" : "");
  const cycle = (opt) => {
    const s = stateOf(opt);
    const nextLoved = loved.filter((v) => v !== opt);
    const nextTop = top.filter((v) => v !== opt);
    if (s === "") onChange({ loved: [...nextLoved, opt], top: nextTop });
    else if (s === "love") onChange({ loved: nextLoved, top: [...nextTop, opt] });
    else onChange({ loved: nextLoved, top: nextTop });
  };
  const add = () => {
    const v = draft.trim().slice(0, 60);
    if (v && ![...loved, ...top].some((x) => x.toLowerCase() === v.toLowerCase())) onChange({ loved: [...loved, v], top });
    setDraft("");
  };
  return (
    <div className="ob-chips-wrap">
      <div className="ob-legend"><span className="love">♥ Tap once: love it</span><span className="top">★ Tap twice: all-time favorite</span></div>
      <div className="ob-chips">
        {shown.map((opt) => {
          const s = stateOf(opt);
          return (
            <button key={opt} type="button" className={`ob-chip tri ${s}`} onClick={() => cycle(opt)} aria-label={`${opt}: ${s === "top" ? "all-time favorite" : s === "love" ? "love it" : "not selected"}`}>
              <span className="ob-tri-icon" aria-hidden="true">{s === "top" ? "★" : s === "love" ? "♥" : ""}</span>
              {opt}
            </button>
          );
        })}
      </div>
      <div className="ob-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add a favorite meal" maxLength={60} aria-label="Add a favorite meal" />
        <button type="button" className="ob-add-btn" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  );
}

const Chili = () => (
  <svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 4c1-1 3-1 3 1-2 0-2 1-2 2 3 1 4 5 1 9-3 4-9 6-12 5 4-2 6-5 7-8s1-6 3-7c0-1 0-2 0-2Z" fill="#e8492b" /><path d="M16 7c0-1 0-2 2-2" stroke="#2f9e44" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
);

function Field({ label, children, hint }) {
  return (
    <div className="ob-field">
      <div className="ob-field-label">{label}</div>
      {hint && <div className="ob-field-hint">{hint}</div>}
      {children}
    </div>
  );
}

// ---------- Adaptive skills quiz ----------

function SkillQuiz({ skills, equipment, done, onAnswer, onUndo, onSkipRest, onRestart }) {
  const dish = done ? null : D.nextDish(skills, equipment);
  const queue = D.skillQueue(skills, equipment);
  const answeredKeys = Object.keys(skills);
  const last = answeredKeys[answeredKeys.length - 1];
  const reply = last !== undefined ? D.SKILL_LEVELS.find((l) => l.value === skills[last])?.reply : null;

  if (!dish) {
    return (
      <div className="ob-quiz-done ob-pop">
        <div className="ob-quiz-tier-label">Your starting point</div>
        <div className="ob-quiz-tier">{D.skillTier(skills)}</div>
        <ul className="ob-quiz-list">
          {answeredKeys.map((k) => (
            <li key={k}><span>{D.DISH_NAMES[k] ?? k}</span><span className={`lvl lvl-${skills[k]}`}>{skills[k] < 0 ? "Skipped" : D.SKILL_LEVELS[skills[k]].label}</span></li>
          ))}
        </ul>
        <button type="button" className="ob-link" onClick={onRestart}>Start the quiz over</button>
      </div>
    );
  }

  return (
    <div className="ob-quiz">
      <div className="ob-quiz-progress" aria-hidden="true">
        {queue.map((k) => <span key={k} className={k in skills ? "done" : k === dish ? "now" : ""} />)}
      </div>
      {reply && <p className="ob-reply" key={last} role="status">{reply}</p>}
      <div className="ob-dish ob-pop" key={dish}>
        <div className="ob-dish-kicker">{D.DISH_CATEGORY[dish]} · Dish {answeredKeys.length + 1}</div>
        <div className="ob-dish-name">{D.DISH_NAMES[dish]}</div>
        <div className="ob-dish-q">How comfortable are you making this?</div>
      </div>
      <div className="ob-levels">
        {D.SKILL_LEVELS.map((l) => (
          <button key={l.value} type="button" className={`ob-level lvl-${l.value}`} onClick={() => onAnswer(dish, l.value)}>{l.label}</button>
        ))}
      </div>
      <div className="ob-quiz-actions">
        {answeredKeys.length > 0 && <button type="button" className="ob-link" onClick={onUndo}>Undo last answer</button>}
        <button type="button" className="ob-link" onClick={() => onAnswer(dish, -1)}>Skip this dish</button>
        {answeredKeys.length >= 3 && <button type="button" className="ob-link" onClick={onSkipRest}>That's enough for now</button>}
      </div>
    </div>
  );
}

// ---------- Live profile card ----------

function ProfileCard({ data, email }) {
  const rows = D.summarize(data);
  const initial = (data.name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="ob-profile">
      <div className="ob-profile-head">
        <span className="ob-avatar" aria-hidden="true">{initial}</span>
        <div>
          <div className="ob-profile-name">{data.name || "Your kitchen profile"}</div>
          <div className="ob-profile-sub">{rows.length ? `${rows.length} things ChatEAT knows` : "Builds as you answer"}</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="ob-profile-empty">Your answers show up here as you go, so you can see exactly what ChatEAT will use.</p>
      ) : (
        <dl className="ob-profile-rows">
          {rows.map((r) => (
            <div key={r.key} className={`ob-profile-row ob-pop ${r.tone ?? ""}`}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ---------- The onboarding flow ----------

export default function Onboarding({ initialData, completed, email }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [step, setStep] = useState(completed ? STEPS.length - 1 : 0);
  const [saveState, setSaveState] = useState("idle");
  const [finished, setFinished] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  const set = (key) => (value) => setData((d) => ({ ...d, [key]: value }));
  const current = STEPS[step];
  const skillsDone = data.skillsDone || D.nextDish(data.skills, data.equipment) === null;

  // Save a draft whenever the person moves to another step, so leaving and coming back resumes.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    let cancelled = false;
    setSaveState("saving");
    saveProfile(dataRef.current)
      .then((r) => { if (!cancelled) setSaveState(r?.ok ? "saved" : "error"); })
      .catch(() => { if (!cancelled) setSaveState("error"); });
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => { cancelled = true; };
  }, [step]);

  const go = (i) => setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
  const next = () => go(step + 1);
  const back = () => go(step - 1);
  const jumpTo = (id) => go(STEPS.findIndex((s) => s.id === id));

  async function saveAndExit() {
    setSaveState("saving");
    await saveProfile(data).catch(() => null);
    router.push("/dashboard");
  }

  async function finish() {
    setFinishing(true);
    const result = await saveProfile(data, { completed: true }).catch(() => null);
    setFinishing(false);
    if (result?.ok) { setFinished(true); router.refresh(); }
    else setSaveState("error");
  }

  const sectionIndex = SECTIONS.indexOf(current.section);
  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  if (finished) {
    return (
      <div className="ob-done ob-pop">
        <div className="ob-done-check" aria-hidden="true">✓</div>
        <h1>{data.name ? `You're all set, ${data.name}.` : "You're all set."}</h1>
        <p>ChatEAT now knows your kitchen, your skills and what you like. Your starting point: <strong>{D.skillTier(data.skills)}</strong>.</p>
        <Link className="button primary" href="/dashboard">Go to my kitchen</Link>
      </div>
    );
  }

  const content = {
    welcome: (
      <>
        <Field label="What should we call you?" hint="Optional">
          <input className="ob-input" value={data.name} onChange={(e) => set("name")(e.target.value.slice(0, 40))} placeholder="First name" autoComplete="given-name" onKeyDown={(e) => { if (e.key === "Enter") next(); }} />
        </Field>
        <ul className="ob-welcome-list">
          <li><strong>6 quick sections:</strong> you, your kitchen, your skills, your taste, safety and goals.</li>
          <li><strong>Tap, don&apos;t type:</strong> most questions are one tap, and you can skip anything.</li>
          <li><strong>Watch it build:</strong> your profile fills in as you answer.</li>
        </ul>
      </>
    ),
    life: (
      <>
        <Chips options={D.LIFESTYLE} value={data.lifestyle} onChange={set("lifestyle")} custom customPlaceholder="Something else? Add it" />
        <Field label="Anything else about your week?" hint="Optional. The more specific, the better the plans.">
          <textarea className="ob-input" rows={3} value={data.lifeNotes} onChange={(e) => set("lifeNotes")(e.target.value.slice(0, 500))} placeholder="e.g., I play soccer, practice is 3 to 6 on weekdays and games are on Saturdays" />
        </Field>
      </>
    ),
    appetite: (
      <>
        <Field label="Activity level"><Cards options={D.ACTIVITY} value={data.activity} onChange={set("activity")} columns={2} /></Field>
        <Field label="How much do you eat?"><Scale value={data.appetite} onChange={set("appetite")} labels={D.APPETITE_LABELS} min={1} label="Appetite" /></Field>
      </>
    ),
    time: (
      <>
        <Field label="On a weeknight"><Segmented options={D.TIME_OPTIONS} value={data.weeknightTime} onChange={set("weeknightTime")} label="Weeknight cooking time" /></Field>
        <Field label="On the weekend"><Segmented options={D.TIME_OPTIONS} value={data.weekendTime} onChange={set("weekendTime")} label="Weekend cooking time" /></Field>
        <Field label="Would you cook a big batch once and eat it for days?"><Segmented options={D.MEAL_PREP} value={data.mealPrep} onChange={set("mealPrep")} label="Meal prep" /></Field>
      </>
    ),
    meals: (
      <>
        <Field label="Meals to plan"><Chips options={D.MEALS} value={data.meals} onChange={set("meals")} /></Field>
        <Field label="Any other meals?" hint="Optional, like a second lunch or game-day breakfast"><Chips options={[]} value={data.customMeals} onChange={set("customMeals")} custom customPlaceholder="Add a meal" /></Field>
        <Field label="How many people do you usually cook for?"><Stepper value={data.householdSize} onChange={set("householdSize")} label="Household size" /></Field>
        <Field label="How do you feel about leftovers?"><Segmented options={D.LEFTOVERS} value={data.leftovers} onChange={set("leftovers")} label="Leftovers" /></Field>
      </>
    ),
    kitchen: (
      <>
        <div className="ob-presets">
          <span>Quick start:</span>
          {D.EQUIPMENT_PRESETS.map((p) => (
            <button key={p.label} type="button" className="ob-preset" onClick={() => set("equipment")([...p.items])}>{p.label}</button>
          ))}
          {data.equipment.length > 0 && <button type="button" className="ob-link" onClick={() => set("equipment")([])}>Clear</button>}
        </div>
        <Chips options={D.EQUIPMENT} value={data.equipment} onChange={set("equipment")} custom customPlaceholder="Something else? Add it" />
      </>
    ),
    skills: (
      <SkillQuiz
        skills={data.skills}
        equipment={data.equipment}
        done={skillsDone}
        onAnswer={(dish, level) => setData((d) => ({ ...d, skills: { ...d.skills, [dish]: level } }))}
        onUndo={() => setData((d) => { const keys = Object.keys(d.skills); const s = { ...d.skills }; delete s[keys[keys.length - 1]]; return { ...d, skills: s, skillsDone: false }; })}
        onSkipRest={() => set("skillsDone")(true)}
        onRestart={() => setData((d) => ({ ...d, skills: {}, skillsDone: false }))}
      />
    ),
    learn: (
      <>
        <Chips options={D.LEARN} value={data.learn} onChange={set("learn")} custom customPlaceholder="Something else? Add it" />
        <Field label="Anything specific?" hint="Optional">
          <textarea className="ob-input" rows={2} value={data.learnNotes} onChange={(e) => set("learnNotes")(e.target.value.slice(0, 300))} placeholder="e.g., I want to make my mom's lasagna" />
        </Field>
      </>
    ),
    cuisines: (
      <>
        <div className="ob-legend"><span className="ob-legend-item love">♥ Tap once: love it</span><span className="ob-legend-item no">× Tap twice: not for me</span></div>
        <TriChips options={D.CUISINES} value={data.cuisines} onChange={set("cuisines")} />
      </>
    ),
    favorites: (
      <>
        <Field label="Meals you love" hint="Tap ideas or add your own">
          <FavoriteChips options={D.FAVORITE_SUGGESTIONS} loved={data.favorites} top={data.topFavorites} onChange={({ loved, top }) => setData((d) => ({ ...d, favorites: loved, topFavorites: top }))} />
        </Field>
        <Field label="Foods you won't eat" hint="Not allergies. Those come later."><Chips options={D.DISLIKES} value={data.dislikes} onChange={set("dislikes")} custom customPlaceholder="Add a food" tone="no" /></Field>
        <Field label="Textures you'd rather avoid"><Chips options={D.TEXTURES} value={data.textures} onChange={set("textures")} tone="no" /></Field>
      </>
    ),
    style: (
      <>
        <Field label="How much heat?"><Scale value={data.spice} onChange={set("spice")} labels={D.SPICE_LABELS} label="Spice tolerance" icon={<Chili />} /></Field>
        <Field label="Classic or creative?"><Scale value={data.style} onChange={set("style")} labels={D.STYLE_LABELS} min={1} label="Recipe style" /></Field>
        <Field label="Trying new foods"><Segmented options={D.ADVENTURE} value={data.adventure} onChange={set("adventure")} label="Adventurousness" /></Field>
        <Field label="Repeating meals in a week"><Segmented options={D.REPETITION} value={data.repetition} onChange={set("repetition")} label="Repetition" /></Field>
      </>
    ),
    safety: (
      <>
        <div className="ob-shield"><span aria-hidden="true">🛡</span> These are hard rules. ChatEAT will never suggest a recipe that breaks them.</div>
        <Field label="Allergies"><Chips options={D.ALLERGENS} value={data.allergies} onChange={set("allergies")} custom customPlaceholder="Another allergy" tone="danger" /></Field>
        <Field label="Diets you follow"><Chips options={D.DIETS} value={data.diets} onChange={set("diets")} custom customPlaceholder="Another diet" /></Field>
        <Field label="Cooking for someone with an allergy?" hint="Their allergies apply to anything you'll share with them.">
          <div className="ob-people">
            {data.othersAllergies.map((person, i) => (
              <div key={i} className="ob-person ob-pop">
                <div className="ob-person-top">
                  <input className="ob-input" value={person.name} placeholder="Their name (optional)" aria-label="Their name" onChange={(e) => set("othersAllergies")(data.othersAllergies.map((p, j) => j === i ? { ...p, name: e.target.value.slice(0, 40) } : p))} />
                  <button type="button" className="ob-link" onClick={() => set("othersAllergies")(data.othersAllergies.filter((_, j) => j !== i))}>Remove</button>
                </div>
                <Chips options={D.ALLERGENS} value={person.allergies} onChange={(v) => set("othersAllergies")(data.othersAllergies.map((p, j) => j === i ? { ...p, allergies: v } : p))} custom customPlaceholder="Another allergy" tone="danger" />
              </div>
            ))}
            {data.othersAllergies.length < 6 && (
              <button type="button" className="ob-preset" onClick={() => set("othersAllergies")([...data.othersAllergies, { name: "", allergies: [] }])}>+ Add a person</button>
            )}
          </div>
        </Field>
        <Field label="Anything else ChatEAT should know about your health?" hint="Optional">
          <textarea className="ob-input" rows={2} value={data.healthNotes} onChange={(e) => set("healthNotes")(e.target.value.slice(0, 300))} placeholder="e.g., I'm lactose intolerant but hard cheese is fine" />
        </Field>
      </>
    ),
    goals: (
      <>
        <Chips options={D.GOALS} value={data.goals} onChange={set("goals")} custom customPlaceholder="Another goal" />
        <Field label="Anything specific?" hint="Optional">
          <textarea className="ob-input" rows={2} value={data.goalNotes} onChange={(e) => set("goalNotes")(e.target.value.slice(0, 300))} placeholder="e.g., Put on 10 pounds before next season" />
        </Field>
        <Field label="How much nutrition detail do you want?"><Cards options={D.NUTRITION_DETAIL} value={data.nutritionDetail} onChange={set("nutritionDetail")} columns={2} /></Field>
      </>
    ),
    budget: (
      <>
        <Field label="Weekly grocery budget"><Cards options={D.BUDGET} value={data.budget} onChange={set("budget")} columns={3} /></Field>
        <Field label="How often do you splurge on things like steak or seafood?"><Segmented options={D.SPLURGE} value={data.splurge} onChange={set("splurge")} label="Splurge meals" /></Field>
      </>
    ),
    review: (
      <ReviewList data={data} onEdit={jumpTo} />
    ),
  };

  const copy = {
    welcome: ["Let's build your kitchen profile", "About 5 minutes. Every answer makes ChatEAT's suggestions fit your life better, and you can change anything later."],
    life: ["What's your life like right now?", "Pick everything that fits. This shapes how much time and food your plans assume."],
    appetite: ["How active are you, and how much do you eat?", "So portions and extra meals match your real appetite."],
    time: ["How much time do you have to cook?", "Count the hands-on time, not the time something sits in the oven."],
    meals: ["Which meals should ChatEAT plan?", "Add as many as you want. Athletes often need more than three."],
    kitchen: ["What's in your kitchen?", "Just the main tools. No need to count pans."],
    skills: ["Let's see what you can already cook", "We'll ask about a few dishes. If you know the basics, the questions get harder. Be honest: \"never tried\" just means something new to learn."],
    learn: ["What would you love to learn?", "ChatEAT will slip these into your plans a little at a time."],
    cuisines: ["Which cuisines do you love?", "Tap through them. Leave any you're neutral about."],
    favorites: ["Meals you love, and foods you won't eat", "This is about taste. Allergies get their own step."],
    style: ["What's your cooking style?", "Slide and tap to set your defaults. You can always ask for something different."],
    safety: ["Anything ChatEAT must never use?", "Allergies and diets for you and anyone you cook for."],
    goals: ["What do you want food to do for you?", "Pick as many as you like."],
    budget: ["What's your grocery budget?", "Plans stay in your range, and pricey meals only show up when you ask."],
    review: completed ? ["Your kitchen profile", "Edit any section, then save your changes."] : ["Here's your kitchen profile", "Look it over. Tap any section to change it, then save."],
  }[current.id];

  return (
    <div className="ob-shell">
      <div className="ob-main">
        <div className="ob-top">
          <button type="button" className="ob-exit" onClick={saveAndExit}>Save and exit</button>
          <ol className="ob-sections" aria-label="Sections">
            {SECTIONS.map((s, i) => (
              <li key={s} className={i < sectionIndex || current.id === "review" ? "done" : i === sectionIndex ? "now" : ""}>
                <button type="button" onClick={() => jumpTo(STEPS.find((x) => x.section === s).id)}>{s}</button>
              </li>
            ))}
          </ol>
          <div className="ob-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="ob-step ob-enter" key={current.id}>
          <h1 tabIndex={-1} ref={headingRef}>{copy[0]}</h1>
          <p className="ob-sub">{copy[1]}</p>
          <div className="ob-body">{content[current.id]}</div>
        </div>

        <div className="ob-nav">
          {step > 0 ? <button type="button" className="button outline" onClick={back}>Back</button> : <span />}
          <span className={`ob-save ${saveState}`} aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Progress saved" : saveState === "error" ? "Couldn't save. Check your connection." : ""}
          </span>
          {current.id === "review" ? (
            <button type="button" className="button primary" onClick={finish} disabled={finishing}>{finishing ? "Saving…" : completed ? "Save changes" : "Save my profile"}</button>
          ) : current.id === "skills" && !skillsDone ? (
            <span className="ob-nav-hint">Answer to continue</span>
          ) : (
            <button type="button" className="button primary" onClick={next}>{step === 0 ? "Let's go" : "Continue"}</button>
          )}
        </div>
      </div>

      <aside className="ob-aside" aria-label="Your profile so far">
        <ProfileCard data={data} email={email} />
      </aside>
      <details className="ob-aside-mobile">
        <summary>See your profile so far ({D.summarize(data).length})</summary>
        <ProfileCard data={data} email={email} />
      </details>
    </div>
  );
}

function ReviewList({ data, onEdit }) {
  const rows = D.summarize(data);
  const sections = [
    { step: "life", title: "You", keys: ["life", "activity", "appetite", "time", "meals", "household"] },
    { step: "kitchen", title: "Kitchen", keys: ["equipment"] },
    { step: "skills", title: "Skills", keys: ["skill", "learn"] },
    { step: "cuisines", title: "Taste", keys: ["top", "loves", "avoids", "spice"] },
    { step: "safety", title: "Safety", keys: ["safety"] },
    { step: "goals", title: "Goals", keys: ["goals", "budget"] },
  ];
  return (
    <div className="ob-review">
      {sections.map((s) => {
        const mine = rows.filter((r) => s.keys.includes(r.key));
        return (
          <section key={s.title} className="ob-review-section">
            <div className="ob-review-head">
              <h2>{s.title}</h2>
              <button type="button" className="ob-link" onClick={() => onEdit(s.step)}>Edit</button>
            </div>
            {mine.length ? (
              <dl>{mine.map((r) => <div key={r.key} className={r.tone ?? ""}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
            ) : (
              <p className="ob-review-empty">{s.title === "Safety" ? "No allergies or diets. Tap Edit if that's not right." : "Skipped. You can fill this in any time."}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
