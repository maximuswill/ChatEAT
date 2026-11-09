// "Plan my week": turns a plain-language week into a 7-day calendar.
// At most one small AI call reads the week (which days matter and why); every recipe comes from
// the library, so a plan costs a fraction of a cent. Without the AI, a simple keyword reader is used.
import { hardRules } from "./allergens.js";
import { searchRecipes, pickVaried } from "./library/search.js";
import { AiUnavailableError, aiStatus, libraryRecipes, parseWeekWithAi, presentRecipe, RecipeError } from "./recipe-ai.js";
import { DAY_NAMES, planMeals, slotKey, weekDays } from "./plan-shared.js";

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
const POOL_SIZE = { Breakfast: 5, Lunch: 6, Dinner: 8, Snacks: 5, "Pre-workout": 4, "Post-workout": 4, "Late-night": 4 };
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

export function parseWeekLocally(text, dayNames, meals) {
  const pins = [];
  const busy = [];
  const clauses = String(text).split(/[,.;\n]|\band\b|\bbut\b|\balso\b/i).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const days = daysIn(clause, dayNames);
    if (!days.length) continue;
    const c = clause.toLowerCase();
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
  return { pins, busy_days: busy };
}

// ---------- Building the plan ----------

const slug = (title) => `p-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
export const recipeId = (recipe) => recipe.id ?? slug(recipe.title);

async function readWeek(text, dayNames, meals, allowAi) {
  if (!text) return { parsed: { pins: [], busy_days: [] }, usedAi: false, notice: "" };
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

// Returns the full plan object that's saved and sent to the page.
export async function buildPlan({ text, start, profile, allowAi }) {
  const days = weekDays(start);
  const dayNames = days.map((d) => d.name);
  const meals = planMeals(profile.meals);
  const rules = hardRules(profile);
  const library = await libraryRecipes();
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
    if (!recipes[id]) recipes[id] = { ...presentRecipe(recipe, profile, request, rules), id };
    used.add(recipe.title);
    return id;
  };
  const best = (request, count) => pickVaried(searchRecipes(library, request, profile, { rules, avoidTitles: [...used] }).results, count);

  // Pinned meals: one library recipe each.
  const slots = {};
  for (const pin of parsed.pins ?? []) {
    const dayIndex = dayNames.indexOf(pin.day);
    if (dayIndex < 0 || !meals.includes(pin.meal)) continue;
    const key = slotKey(dayIndex, pin.meal);
    if (slots[key]) continue;
    const request = `${pin.search ?? ""} ${MEAL_QUERY[pin.meal]}${busy[pin.day] ? " make ahead" : ""}`.trim();
    const [match] = best(request, 1);
    slots[key] = { recipeId: match ? add(match.recipe, request) : null, pinned: true, note: String(pin.note ?? "").slice(0, 60) };
  }

  // The week's pool of options for every open slot, one list per meal type (plus make-ahead picks for busy days).
  const minutes = Number(profile.weeknightTime) > 0 ? ` ${profile.weeknightTime} minutes` : "";
  const pool = {};
  for (const meal of meals) {
    const request = MEAL_QUERY[meal] + (meal === "Lunch" || meal === "Dinner" ? minutes : "");
    pool[meal] = best(request, POOL_SIZE[meal] ?? 4).map((r) => add(r.recipe, request));
  }
  if (Object.keys(busy).length || profile.mealPrep === "yes") {
    pool.prep = best(PREP_QUERY, 5).map((r) => add(r.recipe, PREP_QUERY));
  }

  return {
    version: 1,
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
