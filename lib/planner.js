// "Plan my week": turns a plain-language week into a 7-day calendar.
// At most one small AI call reads the week (which days matter and why); every recipe comes from
// the library, so a plan costs a fraction of a cent. Without the AI, a simple keyword reader is used.
import { hardRules } from "./allergens.js";
import { searchRecipes, pickVaried } from "./library/search.js";
import { AiUnavailableError, aiStatus, libraryRecipes, parseWeekWithAi, presentRecipe, RecipeError } from "./recipe-ai.js";
import { CORE_MEALS, DAY_NAMES, planMeals, prepKey, slotKey, weekDays } from "./plan-shared.js";

// How each meal type is searched in the library.
export const MEAL_QUERY = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snacks: "snack",
  "Pre-workout": "pre workout snack carbs",
  "Post-workout": "post workout high protein",
  "Late-night": "late night snack",
};
// Big enough that quick fill can cover seven days with few repeats.
const POOL_SIZE = { Breakfast: 7, Lunch: 7, Dinner: 8, Snacks: 5, "Pre-workout": 4, "Post-workout": 4, "Late-night": 4 };
export const PREP_QUERY = "meal prep make ahead";


const WEEKEND = new Set(["Saturday", "Sunday"]);

// ---------- Reading the week without AI ----------

const DAY_WORDS = Object.fromEntries(DAY_NAMES.flatMap((name) => {
  const lower = name.toLowerCase();
  return [[lower, name], [lower.slice(0, 3), name], [`${lower}s`, name]];
}).concat([["tues", "Tuesday"], ["weds", "Wednesday"], ["thur", "Thursday"], ["thurs", "Thursday"]]));

function daysIn(clause, dayNames) {
  const words = clause.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/);
  const found = new Set();
  for (const w of words) if (DAY_WORDS[w]) found.add(DAY_WORDS[w]);
  if (words.includes("tonight") || words.includes("today")) found.add(dayNames[0]);
  if (words.includes("tomorrow")) found.add(dayNames[1]);
  if (words.includes("weekend")) { found.add("Saturday"); found.add("Sunday"); }
  return [...found].filter((d) => dayNames.includes(d));
}

// "Meal prep Sunday", "want to batch cook", "make two snacks ahead of time": food to make ahead this week.
const WANTS_PREP = /\bmeal[- ]?prep|\bprep (day|on|ahead|for)\b|\bbatch[- ]?cook|\bmake-ahead\b|\b(make|cook|prep|bake)\b[^.,;]*\bahead\b/i;
const MEAL_PREP_WORDS = /\bmeal[- ]?prep|\bbatch[- ]?cook/i;
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3 };
const SNACK_NOUNS = /^(snacks?|bites|bars|muffins|granola|desserts?|cookies|treats)$/;
const MEAL_NOUNS = /^(meals?|lunches|dinners|bowls|batches)$/;

// The number just before a noun ("two homemade snacks" -> 2), or null if none is given.
function countBefore(words, nouns) {
  for (let i = 0; i < words.length; i++) {
    if (!nouns.test(words[i])) continue;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const n = /^\d+$/.test(words[j]) ? Number(words[j]) : NUMBER_WORDS[words[j]];
      if (n) return n;
    }
  }
  return null;
}

// How many batch meals and snacks they asked to make ahead: "make two snacks ahead" -> { batch_meals: 0, snacks: 2 }.
// Just "meal prep" with nothing specific -> 2 batch meals. Nothing about making food ahead -> both 0.
export function prepWishLocally(text) {
  const t = String(text ?? "").toLowerCase();
  if (!WANTS_PREP.test(t)) return { batch_meals: 0, snacks: 0 };
  const words = t.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const mentionsSnacks = words.some((w) => SNACK_NOUNS.test(w));
  const snacks = countBefore(words, SNACK_NOUNS) ?? (mentionsSnacks ? 1 : 0);
  const meals = countBefore(words, MEAL_NOUNS) ?? (MEAL_PREP_WORDS.test(t) || !snacks ? 2 : 0);
  return { batch_meals: Math.min(meals, 4), snacks: Math.min(snacks, 4) };
}

export function parseWeekLocally(text, dayNames, meals) {
  const pins = [];
  const busy = [];
  const clauses = String(text).split(/[,.;\n]|\band\b|\bbut\b|\balso\b/i).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const days = daysIn(clause, dayNames);
    if (!days.length) continue;
    const c = clause.toLowerCase();
    if (WANTS_PREP.test(c)) continue; // "meal prep Sunday" is about the prep section, not a dinner
    for (const day of days) {
      const i = dayNames.indexOf(day);
      if (/no time|busy|slammed|swamped|working late|late (practice|class)|no cooking|won'?t (be home|have time)/.test(c)) {
        busy.push({ day, note: "No time: prep ahead" });
      } else if (/\b(game|match|race|meet|tournament|competition|scrimmage)\b/.test(c)) {
        if (i > 0) pins.push({ day: dayNames[i - 1], meal: "Dinner", note: `Carbs before ${day}'s game`, search: "carb heavy pasta" });
        if (meals.includes("Pre-workout")) pins.push({ day, meal: "Pre-workout", note: "Fuel before the game", search: "pre workout carbs" });
        if (meals.includes("Post-workout")) pins.push({ day, meal: "Post-workout", note: "Recover after the game", search: "high protein recovery" });
      } else if (/friends|guests|party|people over|company|hosting|roommates/.test(c)) {
        pins.push({ day, meal: "Dinner", note: "Friends over", search: "crowd pleaser party" });
      } else if (/grill|bbq|barbecue|cookout/.test(c)) {
        pins.push({ day, meal: "Dinner", note: "Grill night", search: "grilled" });
      } else if (/\bdate\b/.test(c)) {
        pins.push({ day, meal: "Dinner", note: "Date night", search: "date night" });
      } else {
        const note = clause.replace(/\s+/g, " ").slice(0, 40);
        pins.push({ day, meal: "Dinner", note: note.charAt(0).toUpperCase() + note.slice(1), search: clause });
      }
    }
  }
  return { pins, busy_days: busy, meal_prep: prepWishLocally(text) };
}

// ---------- Building the plan ----------

const slug = (title) => `p-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
export const recipeId = (recipe) => recipe.id ?? slug(recipe.title);

async function readWeek(text, dayNames, meals, allowAi) {
  if (!text) return { parsed: { pins: [], busy_days: [], meal_prep: { batch_meals: 0, snacks: 0 } }, usedAi: false, notice: "" };
  const status = allowAi ? await aiStatus() : "off";
  if (status === "on") {
    try {
      return { parsed: await parseWeekWithAi(text, dayNames, meals), usedAi: true, notice: "" };
    } catch (error) {
      if (!(error instanceof RecipeError)) throw error;
      const notice = error instanceof AiUnavailableError ? error.message : "";
      return { parsed: parseWeekLocally(text, dayNames, meals), usedAi: false, notice };
    }
  }
  const notice = status === "paused" ? "ChatEAT's AI is taking a break for the month, so your week was read with simple keywords." : !allowAi ? "You've used this week's AI requests, so your week was read with simple keywords." : "";
  return { parsed: parseWeekLocally(text, dayNames, meals), usedAi: false, notice };
}

// Quick fill: every empty breakfast, lunch and dinner gets one of this week's options, so the
// calendar starts full. They're marked "quick" (orange) and are meant to be swapped freely.
// Quick fill only ever uses library recipes already in the pool; it never calls the AI.
// Each meal rotates through its list so the same recipe isn't on back-to-back days.
function quickFill(slots, pool, dayNames, meals, busy) {
  const turn = {};
  for (const meal of CORE_MEALS) {
    if (!meals.includes(meal)) continue;
    for (let d = 0; d < dayNames.length; d++) {
      const key = slotKey(d, meal);
      if (slots[key]) continue;
      const listKey = meal;
      const list = pool[listKey] ?? [];
      if (!list.length) continue;
      const yesterday = slots[slotKey(d - 1, meal)]?.recipeId;
      turn[listKey] ??= 0;
      let id = list[turn[listKey]++ % list.length];
      if (id === yesterday && list.length > 1) id = list[turn[listKey]++ % list.length];
      slots[key] = { recipeId: id, source: "quick" };
    }
  }
}

// Meal prep section: filled only with what the week asks for. `wish` is how many batch meals and snacks
// they said they'd make ahead; no-time days also need enough batch meals to cover their lunch and dinner.
// Busy days' lunch and dinner then point at the prepped meals (red).
// Prep items are quick fill too: library recipes only, never AI.
export const SNACK_PREP_QUERY = "make ahead snack";
// Snacks and treats for the meal prep section (the library files these under three courses).
const isSnack = (recipe) => ["snack", "dessert", "baking"].includes(recipe?.course);
function fillMealPrep(slots, pool, recipes, dayNames, meals, busy, wish = {}) {
  const busyDays = dayNames.map((name, d) => ({ name, d })).filter(({ name }) => busy[name]);
  const busyMeals = busyDays.length * ["Lunch", "Dinner"].filter((m) => meals.includes(m)).length;
  // About three portions per batch recipe: enough for the busy days (at least two, at most four).
  const forBusyDays = busyMeals ? Math.max(2, Math.min(4, Math.ceil(busyMeals / 3))) : 0;
  const mainsWanted = Math.max(forBusyDays, Math.min(4, Number(wish.batch_meals) || 0));
  const snacksWanted = Math.min(4, Number(wish.snacks) || 0);
  if (!mainsWanted && !snacksWanted) return;
  const mains = (pool.prep ?? []).filter((id) => !isSnack(recipes[id]));
  const snacks = (pool.prep ?? []).filter((id) => isSnack(recipes[id]));
  const picked = [...mains.slice(0, mainsWanted), ...snacks.slice(0, snacksWanted)];
  picked.forEach((id, i) => { slots[prepKey(i)] = { recipeId: id, source: "quick" }; });

  const prepMains = picked.map((id, i) => ({ id, key: prepKey(i) })).filter(({ id }) => !isSnack(recipes[id]));
  if (!prepMains.length) return;
  let turn = 0;
  for (const { d } of busyDays) {
    for (const meal of ["Lunch", "Dinner"]) {
      const key = slotKey(d, meal);
      if (!meals.includes(meal) || slots[key]) continue;
      slots[key] = { prepFrom: prepMains[turn++ % prepMains.length].key, source: "prep" };
    }
  }
}

// Returns the full plan object that's saved and sent to the page.
// `viewer` (lib/viewer.js) lets the person's own "Make it mine" and cookbook recipes come up more often.
export async function buildPlan({ text, start, profile, allowAi, viewer = null }) {
  const days = weekDays(start);
  const dayNames = days.map((d) => d.name);
  const meals = planMeals(profile.meals);
  const rules = hardRules(profile);
  const library = await libraryRecipes(viewer);
  const { parsed, usedAi, notice } = await readWeek(text, dayNames, meals, allowAi);

  // Days with no time to cook: from the description, plus the profile's "No time (prep ahead)" answers.
  const busy = {};
  for (const b of parsed.busy_days ?? []) if (dayNames.includes(b.day)) busy[b.day] = (b.note || "No time: prep ahead").slice(0, 60);
  for (const name of dayNames) {
    const timeAnswer = WEEKEND.has(name) ? profile.weekendTime : profile.weeknightTime;
    if (timeAnswer === "0" && !busy[name]) busy[name] = "No time: prep ahead";
  }

  const recipes = {};
  const used = new Set();
  const add = (recipe, request) => {
    const id = recipeId(recipe);
    if (!recipes[id]) recipes[id] = { ...presentRecipe(recipe, profile, request, rules, viewer), id };
    used.add(recipe.title);
    return id;
  };
  const best = (request, count) => pickVaried(searchRecipes(library, request, profile, { rules, avoidTitles: [...used], viewer }).results, count);

  // Pinned meals: one library recipe each.
  const slots = {};
  for (const pin of parsed.pins ?? []) {
    const dayIndex = dayNames.indexOf(pin.day);
    if (dayIndex < 0 || !meals.includes(pin.meal)) continue;
    const key = slotKey(dayIndex, pin.meal);
    if (slots[key]) continue;
    const request = `${pin.search ?? ""} ${MEAL_QUERY[pin.meal]}${busy[pin.day] ? " make ahead" : ""}`.trim();
    const [match] = best(request, 1);
    slots[key] = { recipeId: match ? add(match.recipe, request) : null, pinned: true, note: String(pin.note ?? "").slice(0, 60), source: "request" };
  }

  // The week's pool of options for every open slot, one list per meal type (plus make-ahead picks for busy days).
  const minutes = Number(profile.weeknightTime) > 0 ? ` ${profile.weeknightTime} minutes` : "";
  const pool = {};
  for (const meal of meals) {
    const request = MEAL_QUERY[meal] + (meal === "Lunch" || meal === "Dinner" ? minutes : "");
    pool[meal] = best(request, POOL_SIZE[meal] ?? 4).map((r) => add(r.recipe, request));
  }
  // Options for the meal prep section (batch meals and make-ahead snacks), always offered.
  pool.prep = [
    ...best(PREP_QUERY, 6).map((r) => add(r.recipe, PREP_QUERY)),
    ...best(SNACK_PREP_QUERY, 5).map((r) => add(r.recipe, SNACK_PREP_QUERY)),
  ];

  fillMealPrep(slots, pool, recipes, dayNames, meals, busy, parsed.meal_prep ?? {});
  quickFill(slots, pool, dayNames, meals, busy);

  return {
    version: 3,
    start,
    text,
    days: days.map((d) => ({ ...d, busy: busy[d.name] ?? "" })),
    meals,
    slots,
    pool,
    recipes,
    usedAi,
    notice,
    createdAt: new Date().toISOString(),
  };
}
