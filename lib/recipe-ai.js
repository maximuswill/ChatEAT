import Anthropic from "@anthropic-ai/sdk";
import { hardRules, violations } from "./allergens.js";
import { sql } from "./db.js";
import { CURATED, CURATED_BY_ID } from "./library/index.js";
import { pickVaried, searchRecipes, STRONG, whyItFits } from "./library/search.js";
import * as D from "./onboarding-data.js";
import { recordUsage, underBudget } from "./ai-budget.js";

// Claude Haiku 5.5 keeps AI costs to a fraction of a cent per recipe. To trade cost for more
// tailored recipes, set CHATEAT_MODEL (for example claude-sonnet-5-5 or claude-opus-5-5); no code changes needed.
const MODEL = process.env.CHATEAT_MODEL || "claude-haiku-5-5";
// Haiku has no server-side fallback model, so the fallback option is only sent for the larger models.
const SUPPORTS_FALLBACK = !MODEL.startsWith("claude-haiku");

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// "on", "off" (no key) or "paused" (this month's AI budget is used up).
export async function aiStatus() {
  if (!aiEnabled()) return "off";
  return (await underBudget()) ? "on" : "paused";
}

export class RecipeError extends Error {}
// The AI can't be used right now (budget reached, key problem, or the service is down). Callers fall back to the library.
export class AiUnavailableError extends RecipeError {}
const PAUSED_MESSAGE = "ChatEAT's AI is taking a break for the rest of the month. Library recipes still work.";

// ---------- The library: built-in recipes plus AI recipes saved over time ----------

let cache = { at: 0, recipes: [] };
async function libraryPool() {
  if (Date.now() - cache.at > 60_000) {
    const rows = await sql`select recipe from library_recipes order by created_at`;
    cache = { at: Date.now(), recipes: rows.map((row) => row.recipe) };
  }
  return [...CURATED, ...cache.recipes];
}

async function saveToLibrary(recipes) {
  for (const recipe of recipes) {
    const id = `ai-${recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-${Date.now().toString(36)}`;
    const stored = { ...recipe, id, origin: "ai", why_it_fits: "", pairings: undefined };
    await sql`
      insert into library_recipes (id, title, recipe, origin) values (${id}, ${recipe.title}, ${JSON.stringify(stored)}::jsonb, 'ai')
      on conflict do nothing`;
  }
  cache.at = 0;
}

// Copy a recipe for sending to the browser: drop internal search caches, add a personal reason and pairings.
function present(recipe, profile, request, rules) {
  const clean = Object.fromEntries(Object.entries(recipe).filter(([key]) => !key.startsWith("_")));
  if (recipe.origin === "library" || !clean.why_it_fits) clean.why_it_fits = whyItFits(recipe, profile, request);
  clean.pairings = (recipe.pairs ?? [])
    .map((id) => CURATED_BY_ID[id])
    .filter((side) => side && violations(side, rules).length === 0)
    .slice(0, 2)
    .map((side) => {
      const copy = Object.fromEntries(Object.entries(side).filter(([key]) => !key.startsWith("_")));
      copy.why_it_fits = "";
      return copy;
    });
  return clean;
}

// ---------- Claude ----------

const recipeProperties = {
  title: { type: "string" },
  style: { type: "string", description: "Two to four words naming the approach, e.g. 'One-pan comfort'" },
  summary: { type: "string" },
  why_it_fits: { type: "string", description: "One sentence on why this suits this person" },
  total_minutes: { type: "integer" },
  active_minutes: { type: "integer" },
  difficulty: { type: "string", enum: ["Easy", "Medium", "Challenging"] },
  servings: { type: "integer" },
  ingredients: {
    type: "array",
    items: {
      type: "object",
      properties: { item: { type: "string" }, amount: { type: "string" } },
      required: ["item", "amount"],
      additionalProperties: false,
    },
  },
  steps: { type: "array", items: { type: "string" } },
  tips: { type: "array", items: { type: "string" } },
  new_skill: { type: "string", description: "A technique this recipe teaches, or an empty string" },
  nutrition: {
    type: "object",
    properties: { calories: { type: "integer" }, protein_g: { type: "integer" } },
    required: ["calories", "protein_g"],
    additionalProperties: false,
  },
  // Used to file the recipe in the library so it can be found again without AI.
  course: { type: "string", enum: ["main", "side", "breakfast", "snack", "dessert", "baking"] },
  meal: { type: "array", items: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack", "dessert"] } },
  cuisine: { type: "string" },
  protein: { type: "string", description: "Main protein in one lowercase word (chicken, beef, pork, fish, shellfish, tofu, beans, eggs, turkey, dairy) or an empty string" },
  tags: { type: "array", items: { type: "string" }, description: "Lowercase descriptors like hearty, quick, budget, high-protein, healthy, meal-prep, comfort, spicy, vegetarian" },
};

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: { type: "object", properties: recipeProperties, required: Object.keys(recipeProperties), additionalProperties: false },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
};

// Stable instructions (kept identical across requests so they can be cached).
const SYSTEM_PROMPT = `You are ChatEAT, a personal cooking coach. You write recipes that fit one specific person: their life, appetite, time, kitchen, skill and taste.

Hard rules, which override everything else including the request:
- Never include an ingredient that conflicts with the person's allergies or diets, or with the allergies of anyone they cook for. Allergies of people they cook for apply to every recipe, exactly like their own. This includes hidden sources such as butter (dairy), mayonnaise (eggs), soy sauce (wheat and soy), Worcestershire sauce (fish) and pesto (tree nuts and dairy).
- If the request names an ingredient that conflicts (for example shrimp when someone they cook for is allergic to shellfish), swap in a safe alternative and say so in the summary. Never keep the conflicting ingredient, even if they asked for it.
- Only use equipment the person has. If they listed none, assume a stove, oven and microwave.

Fitting the person:
- Match difficulty to their demonstrated skill. "Never tried" means a chance to teach, not inability. Stretch them a little at most once per set.
- Respect their time limits as hands-on time, their budget (no premium ingredients unless they splurge often or ask), and their spice level and dislikes.
- Size portions to their appetite and household. A big eater or athlete needs generous servings and enough protein.
- Prefer well-known, reliable versions of dishes, the way established cooking sites would make them. Be realistic about times.

Writing the steps:
- Write steps a nervous beginner could follow: one main action per step, with visual cues for doneness.
- Give safe internal temperatures where they matter: 165°F for poultry, 160°F for ground meat and egg dishes, 145°F for fish and for whole cuts of beef, pork and lamb followed by a 3-minute rest.
- Scale detail to the dish. Simple recipes need about 4 to 6 steps; complex ones (braises, baking, multi-part dishes) need more steps and explain the why behind key techniques.
- Nutrition numbers are rough per-serving estimates.

Writing the ingredients:
- "amount" is only the quantity and unit, like "1 1/2 lb", "2 tbsp", "3 cloves" or "1 (15 oz) can". Put preparation and notes in "item", like "Boneless chicken breast, cut into thin strips".
- Use amounts a home cook can measure: round to the nearest 1/4 teaspoon, 1/2 tablespoon, 1/4 cup, 1/4 pound or whole item. Never write amounts like "2 2/3 tsp" or "1/3 tsp".
- Leave out optional ingredients rather than listing them with an amount of zero.
- Name substitutes plainly, like "Sunflower seed butter", without mentioning the ingredient they replace (not "instead of peanut butter"). Explain swaps in the summary, not in the ingredient list.

Writing the summary:
- One or two sentences on what the dish is and what makes it good. Don't list things the recipe leaves out or repeat the person's profile back to them; save the personal reasons for "why_it_fits".
- Keep "why_it_fits" to one sentence.`;

function describeProfile(p) {
  const lines = [];
  const add = (label, value) => { if (value && (!Array.isArray(value) || value.length)) lines.push(`${label}: ${Array.isArray(value) ? value.join(", ") : value}`); };
  add("Name", p.name);
  add("Life right now", p.lifestyle);
  add("About their week", p.lifeNotes);
  add("Activity", D.ACTIVITY.find((a) => a.value === p.activity)?.label);
  add("Appetite", D.APPETITE_LABELS[p.appetite - 1]);
  const minutes = (v) => (v === "0" ? "none, so food must be made ahead (meal prep or leftovers)" : `${v} minutes`);
  add("Weeknight hands-on cooking time", p.weeknightTime && minutes(p.weeknightTime));
  add("Weekend hands-on cooking time", p.weekendTime && minutes(p.weekendTime));
  add("Meal prep", D.MEAL_PREP.find((a) => a.value === p.mealPrep)?.label);
  add("Cooks for", `${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}`);
  add("Leftovers", D.LEFTOVERS.find((a) => a.value === p.leftovers)?.label);
  add("Equipment", p.equipment);
  const skills = Object.entries(p.skills).filter(([, v]) => v >= 0).map(([k, v]) => `${D.DISH_NAMES[k] ?? k}: ${D.SKILL_LEVELS[v].label}`);
  add("Skill level", Object.keys(p.skills).length ? D.skillTier(p.skills) : "");
  add("Specific dishes", skills);
  add("Wants to learn", [...p.learn, p.learnNotes].filter(Boolean));
  add("Loves these cuisines", Object.entries(p.cuisines).filter(([, v]) => v === "love").map(([k]) => k));
  add("Avoids these cuisines", Object.entries(p.cuisines).filter(([, v]) => v === "no").map(([k]) => k));
  add("All-time favorite meals (suggest these or close variations often)", p.topFavorites);
  add("Meals they love", p.favorites);
  add("Won't eat (preference, not allergy)", p.dislikes);
  add("Textures they avoid", p.textures);
  add("Spice", D.SPICE_LABELS[p.spice]);
  add("Recipe style", D.STYLE_LABELS[p.style - 1]);
  add("Trying new foods", D.ADVENTURE.find((a) => a.value === p.adventure)?.label);
  add("Goals", [...p.goals, p.goalNotes].filter(Boolean));
  add("Nutrition detail", D.NUTRITION_DETAIL.find((a) => a.value === p.nutritionDetail)?.label);
  add("Weekly grocery budget", D.BUDGET.find((a) => a.value === p.budget)?.label);
  add("Splurges on pricey ingredients", D.SPLURGE.find((a) => a.value === p.splurge)?.label);
  add("HARD RULE, allergies", p.allergies);
  add("HARD RULE, diets", p.diets);
  for (const o of p.othersAllergies) add(`HARD RULE, allergies of ${o.name || "someone they cook for"}`, o.allergies);
  add("Health notes", p.healthNotes);
  add("Ingredients they already have (a rough list; lean on these when it makes sense, don't assume amounts, and still list everything the recipe needs)", p.pantry ?? []);
  return lines.length ? lines.join("\n") : "No profile yet. Assume a beginner with a basic kitchen.";
}

// One structured (JSON) Claude call with the budget check, usage recording and friendly errors.
async function requestJson({ system, userText, schema, maxTokens = 16000, effort = "medium" }) {
  if (!(await underBudget())) throw new AiUnavailableError(PAUSED_MESSAGE);
  const client = new Anthropic();
  try {
    const request = {
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort, format: { type: "json_schema", schema } },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
    };
    // A declined request is retried on another model automatically where that's supported.
    const response = SUPPORTS_FALLBACK
      ? await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(request);
    await recordUsage(response.model ?? MODEL, response.usage).catch((e) => console.error("Couldn't record AI usage", e));
    if (response.stop_reason === "refusal") throw new RecipeError("ChatEAT couldn't help with that request. Try asking a different way.");
    if (response.stop_reason === "max_tokens") throw new RecipeError("That answer ran too long. Try a simpler request.");
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new RecipeError("ChatEAT's answer came back garbled. Please try again.");
    }
  } catch (error) {
    if (error instanceof RecipeError) throw error;
    // Any problem reaching the AI (bad key, spend limit hit in the Anthropic Console, outage) means library-only for now.
    console.error("AI call failed", error?.status ?? "", error?.message ?? error);
    if (error instanceof Anthropic.AuthenticationError) throw new AiUnavailableError("ChatEAT's AI isn't available right now. Library recipes still work.");
    if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("ChatEAT's AI is busy right now. Library recipes still work; try AI again in a moment.");
    if (error instanceof Anthropic.APIConnectionError) throw new AiUnavailableError("Couldn't reach ChatEAT's AI. Library recipes still work.");
    if (error instanceof Anthropic.APIError) throw new AiUnavailableError("ChatEAT's AI isn't available right now. Library recipes still work.");
    throw error;
  }
}

async function callClaude(userText) {
  const data = await requestJson({ system: SYSTEM_PROMPT, userText, schema: RECIPE_SCHEMA });
  return (data.recipes ?? []).map((r) => ({ ...r, equip: [], pairs: [], source: null }));
}

async function newAiRecipes(request, profile, avoidTitles, count, rules) {
  const ask = (extra = "") => callClaude([
    "About this person:",
    describeProfile(profile),
    "",
    `Their request: ${request}${extra}`,
    "",
    `Return exactly ${count} ${count === 1 ? "recipe" : "recipes"} that take different approaches to the request, unless it asks for something narrower.`,
    avoidTitles.length ? `They already have these, so suggest different dishes: ${avoidTitles.join("; ")}` : "",
  ].join("\n"));

  let removed = [];
  let safe = [];
  const first = await ask();
  for (const r of first) (violations(r, rules).length ? removed.push({ title: r.title, rules: violations(r, rules) }) : safe.push(r));
  // If every suggestion broke a rule, try once more, telling Claude what went wrong.
  if (safe.length === 0 && removed.length) {
    const again = await ask(`\n(Important: earlier ideas contained ${[...new Set(removed.flatMap((r) => r.rules))].join(", ")}, which this person must avoid.)`);
    for (const r of again) (violations(r, rules).length ? removed.push({ title: r.title, rules: violations(r, rules) }) : safe.push(r));
  }
  return { recipes: safe.slice(0, count).map((r) => ({ ...r, origin: "ai" })), removed };
}

// ---------- What the app calls ----------

// Library first; the AI only fills in what the library can't answer well.
// Returns { recipes, removed, usedAi, closeMatch, aiNotice }. If the AI can't run (no key, monthly
// budget reached, or an API problem), it quietly falls back to the library and explains in aiNotice.
export async function generateRecipeIdeas(request, profile, avoidTitles = [], { allowAi = true } = {}) {
  const rules = hardRules(profile);
  const pool = await libraryPool();
  const { results } = searchRecipes(pool, request, profile, { rules, avoidTitles });
  const picks = pickVaried(results, 3);
  const strong = picks.filter((p) => p.score >= STRONG).map((p) => p.recipe);

  const libraryOnly = (aiNotice = "") => {
    const chosen = strong.length >= 3 ? strong : picks.map((p) => p.recipe);
    return {
      recipes: chosen.map((r) => present(r, profile, request, rules)),
      removed: [],
      usedAi: false,
      closeMatch: strong.length >= 3,
      aiNotice,
    };
  };

  if (strong.length >= 3) return libraryOnly();
  const status = await aiStatus();
  if (status === "paused") return libraryOnly(PAUSED_MESSAGE);
  if (status === "off" || !allowAi) return libraryOnly();

  const need = 3 - strong.length;
  let ai;
  try {
    ai = await newAiRecipes(request, profile, [...avoidTitles, ...strong.map((r) => r.title)], need, rules);
  } catch (error) {
    if (error instanceof AiUnavailableError) return libraryOnly(error.message);
    throw error;
  }
  if (ai.recipes.length) await saveToLibrary(ai.recipes).catch((e) => console.error("Couldn't save AI recipes to the library", e));
  return {
    recipes: [...strong, ...ai.recipes].map((r) => present(r, profile, request, rules)),
    removed: ai.removed,
    usedAi: true,
    closeMatch: true,
    aiNotice: "",
  };
}

// ---------- "Make it mine" and follow-up changes ----------
// Personal versions are made for one person, so they're not added to the shared library.

const PERSONALIZE_RULES = [
  "- scale servings and quantities to their appetite and household (and leftovers preference),",
  "- swap out anything they won't eat, can't have, or don't have the equipment for,",
  "- match the detail of the steps to their skill: more guidance and technique explanations for beginners, leaner steps for confident cooks,",
  "- keep it within their budget and time where possible.",
];

const recipeForPrompt = (recipe) => JSON.stringify({
  title: recipe.title, servings: recipe.servings, difficulty: recipe.difficulty,
  ingredients: recipe.ingredients, steps: recipe.steps, tips: recipe.tips,
});

async function onePersonalRecipe(prompt, profile) {
  if (!aiEnabled()) throw new RecipeError("\"Make it mine\" needs the AI, which isn't turned on yet.");
  const [mine] = await callClaude(["About this person:", describeProfile(profile), "", ...prompt].join("\n"));
  if (!mine) throw new RecipeError("Couldn't make that recipe. Please try again.");
  const broken = violations(mine, hardRules(profile));
  if (broken.length) throw new RecipeError(`That version contained ${broken.join(", ")}, which you avoid, so it was hidden. Try again.`);
  return { ...mine, origin: "personal", pairings: [] };
}

// Rewrite an existing recipe (from the library or AI) for this person. `note` is anything extra they asked for.
export async function personalizeRecipe(recipe, profile, note = "") {
  return onePersonalRecipe([
    "Adapt this recipe for them. Keep the dish recognizable, but:",
    ...PERSONALIZE_RULES,
    note ? `They also asked: "${note}". Follow that unless it breaks a hard rule.` : "",
    "Return exactly 1 recipe. Keep the original title with ' (made for you)' added. End the summary with one short sentence naming the main changes.",
    "",
    `Original recipe:\n${recipeForPrompt(recipe)}`,
  ], profile);
}

// From the request box: one recipe for the dish they named, starting from the library version when there is one.
// Returns { recipe, basedOn } where basedOn is the library recipe title used, if any.
export async function personalizeFromRequest(request, profile, findBase) {
  const base = findBase(await libraryPool());
  if (base) return { recipe: await personalizeRecipe(base, profile, request), basedOn: base.title };
  const recipe = await onePersonalRecipe([
    `They want to make this specific dish: "${request}".`,
    "Write exactly 1 recipe for that dish, the way an established cooking site would make it, adapted for them:",
    ...PERSONALIZE_RULES,
    "Add ' (made for you)' to the title. Keep the summary to one or two sentences.",
  ], profile);
  return { recipe, basedOn: null };
}

// "Change it": apply the person's requested changes to their current version.
export async function refineRecipe(recipe, change, profile) {
  return onePersonalRecipe([
    "Here is their current version of a recipe. Rewrite it with the change they asked for, and keep everything else the same.",
    `Their change: "${change}"`,
    "If the change would break a hard rule, make the closest safe version and say so in the summary.",
    "Return exactly 1 recipe. Keep the title unless the change makes it a different dish. Start the summary with one short sentence saying what changed.",
    "",
    `Current version:\n${recipeForPrompt(recipe)}`,
  ], profile);
}

// ---------- "Plan my week" ----------
// One small, cheap call that reads the person's week and returns structured pins. Recipes come from the library.

export const libraryRecipes = libraryPool;
export const presentRecipe = present;

const WEEK_PROMPT = `You turn a short description of someone's week into a meal-plan outline for a cooking app.
Return only meals that the description gives a reason for, pinned to a day:
- A game, race, meet or hard training: pin a carb-rich dinner the night before (note like "Carbs before Thursday's game") and, if that meal type is offered, a pre-workout meal on the day, plus a recovery meal after.
- Guests, friends over or a party: a crowd-pleasing dinner that day. A date: a date-night dinner.
- A cooking wish (grill, try a new dish, bake): pin it to that day.
- No time or very busy days: list them in busy_days (they get make-ahead food or leftovers), do not pin them.
Use only the given day names and meal types. Notes are at most 7 words. "search" is 2 to 6 plain words describing the dish for a recipe search, like "carb heavy pasta dinner" or "grilled chicken". Never invent events that were not described.`;

export async function parseWeekWithAi(text, dayNames, mealTypes) {
  const day = { type: "string", enum: dayNames };
  const schema = {
    type: "object",
    properties: {
      pins: {
        type: "array",
        items: {
          type: "object",
          properties: { day, meal: { type: "string", enum: mealTypes }, note: { type: "string" }, search: { type: "string" } },
          required: ["day", "meal", "note", "search"],
          additionalProperties: false,
        },
      },
      busy_days: {
        type: "array",
        items: { type: "object", properties: { day, note: { type: "string" } }, required: ["day", "note"], additionalProperties: false },
      },
    },
    required: ["pins", "busy_days"],
    additionalProperties: false,
  };
  return requestJson({
    system: WEEK_PROMPT,
    schema,
    maxTokens: 1500,
    effort: "low",
    userText: `Days, in order: ${dayNames.join(", ")}
Meal types: ${mealTypes.join(", ")}
Their week: ${text}`,
  });
}

// Used by scripts/quality-test.mjs to check the AI's recipes directly (bypasses the library).
export const testHooks = { newAiRecipes, describeProfile };
