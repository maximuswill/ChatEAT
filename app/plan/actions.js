"use server";

// Every AI use in the planner counts toward the person's weekly AI requests (a recipe_requests row
// with mode 'ai'): reading the week, "More ideas" and "Make a recipe for this meal". Quick fill and
// the meal prep fill never use the AI.
import { sql } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";
import { getProfile } from "../../lib/profile";
import { pantryNames } from "../../lib/pantry";
import { aiAllowed } from "../../lib/ai-budget";
import { buildPlan, MEAL_QUERY, PREP_QUERY, recipeId } from "../../lib/planner";
import { isPrepKey, PREP_MEAL, slotSource } from "../../lib/plan-shared";
import { generateRecipeIdeas, presentRecipe, RecipeError } from "../../lib/recipe-ai";
import { normTitle } from "../../lib/library/search.js";
import { viewerFor } from "../../lib/viewer";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function member() {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again." };
  if (!user.has_paid_access) return { error: "Plan my week is part of the paid plan." };
  return { user };
}

async function loadPlan(userId) {
  const [row] = await sql`select plan from meal_plans where user_id = ${userId}`;
  return row?.plan ?? null;
}

async function storePlan(userId, plan) {
  await sql`
    insert into meal_plans (user_id, week_start, plan, updated_at) values (${userId}, ${plan.start}, ${JSON.stringify(plan)}::jsonb, now())
    on conflict (user_id) do update set week_start = excluded.week_start, plan = excluded.plan, updated_at = now()`;
}

async function profileWithPantry(userId) {
  const { data } = await getProfile(userId);
  data.pantry = await pantryNames(userId);
  return data;
}

// A calendar slot ("3|Dinner") or meal prep item ("prep|0"): which list of options and search it uses.
function slotInfo(plan, key) {
  if (isPrepKey(key)) return { key: String(key), meal: PREP_MEAL, listKey: "prep", query: PREP_QUERY };
  const [day, meal] = String(key).split("|");
  if (!(Number(day) >= 0 && Number(day) < 7) || !plan.meals.includes(meal)) return null;
  return { key: `${Number(day)}|${meal}`, meal, listKey: meal, query: MEAL_QUERY[meal] };
}

// "Plan my week": read the week (one AI request at most), fill it from the library and save it.
export async function makePlan({ text, start }) {
  const { user, error } = await member();
  if (error) return { error };
  const week = String(text ?? "").trim().slice(0, 600);
  if (!ISO_DATE.test(String(start))) return { error: "Pick a start day first." };
  try {
    const profile = await profileWithPantry(user.id);
    const allowAi = await aiAllowed(user);
    const plan = await buildPlan({ text: week, start, profile, allowAi, viewer: await viewerFor(user) });
    if (plan.usedAi) await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${`plan: ${week}`.slice(0, 380)}, 'ai')`;
    await storePlan(user.id, plan);
    return { plan };
  } catch (e) {
    console.error("Plan my week failed", e);
    return { error: "Something went wrong planning your week. Please try again." };
  }
}

// Saves the person's picks: { "dayIndex|Meal": { recipeId, leftovers, pinned, note, source, prepFrom },
// "prep|0": { recipeId, source } }. Only recipes from this plan, and prep items that exist, are allowed.
export async function saveSlots(slots) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  if (!plan) return { error: "Plan your week first." };
  const entries = Object.entries(slots ?? {}).slice(0, 100);
  const clean = {};
  for (const [key, slot] of entries) {
    if (!isPrepKey(key) || !slot?.recipeId || !plan.recipes[slot.recipeId]) continue;
    clean[key] = { recipeId: slot.recipeId, source: slotSource(slot) === "quick" ? "quick" : "user" };
  }
  for (const [key, slot] of entries) {
    const info = !isPrepKey(key) && slotInfo(plan, key);
    if (!info || !slot) continue;
    const prepFrom = slot.prepFrom && clean[slot.prepFrom] ? slot.prepFrom : null;
    const id = !prepFrom && slot.recipeId && plan.recipes[slot.recipeId] ? slot.recipeId : null;
    const note = String(slot.note ?? "").slice(0, 60);
    if (!id && !prepFrom && !slot.leftovers && !note) continue;
    clean[info.key] = {
      recipeId: id, leftovers: Boolean(slot.leftovers) && !id && !prepFrom, pinned: Boolean(slot.pinned), note,
      ...(prepFrom ? { prepFrom } : {}),
      source: prepFrom ? "prep" : slotSource({ ...slot, prepFrom: null }),
    };
  }
  plan.slots = clean;
  await storePlan(user.id, plan);
  return { ok: true };
}

// "More ideas" in the slot picker: library first, the AI only when the library runs out (one AI request).
// Only runs when the person asks, so quick fill itself never uses the AI.
export async function moreIdeas(key, prepAhead = false) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  const info = plan && slotInfo(plan, key);
  if (!info) return { error: "Plan your week first." };
  try {
    const profile = await profileWithPantry(user.id);
    const allowAi = await aiAllowed(user);
    const prep = prepAhead && info.listKey !== "prep";
    const request = prep ? `${PREP_QUERY} ${info.query}` : info.query;
    const titles = Object.values(plan.recipes).map((r) => r.title).slice(0, 60);
    const result = await generateRecipeIdeas(request, profile, titles, { allowAi, viewer: await viewerFor(user) });
    if (result.usedAi) await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${`plan ideas: ${info.meal}`}, 'ai')`;
    const listKey = prep ? "prep" : info.listKey;
    const ids = [];
    for (const recipe of result.recipes) {
      const id = recipeId(recipe);
      plan.recipes[id] = { ...recipe, id };
      ids.push(id);
    }
    plan.pool[listKey] = [...new Set([...ids, ...(plan.pool[listKey] ?? [])])];
    await storePlan(user.id, plan);
    return { recipes: ids.map((id) => plan.recipes[id]), listKey, aiNotice: result.aiNotice, limitReached: !allowAi };
  } catch (e) {
    if (e instanceof RecipeError) return { error: e.message };
    console.error("More plan ideas failed", e);
    return { error: "Couldn't get more ideas. Please try again." };
  }
}

// "Make a recipe for this meal": the person describes what they want for one slot (Tuesday dinner)
// or a meal prep item. The library is searched first; the AI writes new recipes only when nothing fits
// (one AI request). The best match goes in the slot (green, since they asked for it) and the
// runners-up become swap options.
export async function recipeForSlot({ key, text }) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  if (!plan) return { error: "Plan your week first." };
  const info = slotInfo(plan, key);
  if (!info) return { error: "Pick a meal on the calendar first." };
  const wish = String(text ?? "").trim().slice(0, 300);
  if (wish.length < 3) return { error: "Tell ChatEAT a little about what you want for this meal." };

  try {
    const profile = await profileWithPantry(user.id);
    const allowAi = await aiAllowed(user);
    const query = info.listKey === "prep" ? "make ahead" : info.query;
    const result = await generateRecipeIdeas(`${wish} ${query}`, profile, [], { allowAi, viewer: await viewerFor(user) });
    if (!result.recipes.length) return { error: "ChatEAT couldn't find a recipe for that. Try describing it differently." };
    if (result.usedAi) await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${`plan slot: ${wish}`.slice(0, 380)}, 'ai')`;

    const ids = result.recipes.map((recipe) => {
      const id = recipeId(recipe);
      plan.recipes[id] = { ...recipe, id };
      return id;
    });
    const old = plan.slots[info.key] ?? {};
    plan.slots[info.key] = info.listKey === "prep"
      ? { recipeId: ids[0], source: "user" }
      : { recipeId: ids[0], leftovers: false, pinned: Boolean(old.pinned), note: old.note ?? "", source: "user" };
    plan.pool[info.listKey] = [...new Set([...ids.slice(1), ...(plan.pool[info.listKey] ?? [])])];
    await storePlan(user.id, plan);
    return {
      slotKey: info.key,
      listKey: info.listKey,
      slot: plan.slots[info.key],
      recipes: ids.map((id) => plan.recipes[id]),
      usedAi: result.usedAi,
      notice: result.aiNotice || (!allowAi ? "You've used this week's AI requests, so this came from the library." : ""),
    };
  } catch (e) {
    if (e instanceof RecipeError) return { error: e.message };
    console.error("Recipe for slot failed", e);
    return { error: "Something went wrong making that recipe. Please try again." };
  }
}

// ---------- Your own recipes in the planner ----------

// A person's own recipe, ready for their plan. Its plan id comes from where it's stored ("lib-..." or "cb-12").
function presentMine(ref, recipe, profile, viewer) {
  return { ...presentRecipe({ steps: [], ingredients: [], tags: [], pairs: [], ...recipe }, profile, "", [], viewer), id: ref.replace(":", "-") };
}

// Loads exactly the recipe a ref points at, only if it belongs to this person.
async function resolveMyRecipe(user, ref) {
  const [kind, id] = String(ref).split(":");
  let rows = [];
  if (kind === "lib") rows = await sql`select recipe from library_recipes where id = ${String(id)} and created_by = ${user.id}`;
  else if (kind === "cb" && /^\d+$/.test(String(id))) rows = await sql`select recipe from saved_recipes where id = ${Number(id)} and user_id = ${user.id}`;
  if (!rows[0]) return null;
  return presentMine(`${kind}:${id}`, rows[0].recipe, await profileWithPantry(user.id), await viewerFor(user));
}

// One person's recipes to offer in any slot: their "Make it mine" versions (newest version of each dish)
// and their cookbook. `ref` says where each came from, so putMyRecipe can load and check it on the server.
async function loadMyRecipes(user) {
  const viewer = await viewerFor(user);
  const [mineRows, savedRows] = await Promise.all([
    sql`select id, recipe from library_recipes where created_by = ${user.id} and origin = 'mine' order by created_at desc limit 40`,
    sql`select id, recipe from saved_recipes where user_id = ${user.id} order by created_at desc limit 40`,
  ]);
  const profile = await profileWithPantry(user.id);
  const seen = new Set();
  const out = [];
  const push = (ref, recipe) => {
    const key = normTitle(recipe?.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ ref, recipe: presentMine(ref, recipe, profile, viewer) });
  };
  for (const row of mineRows) push(`lib:${row.id}`, row.recipe);
  for (const row of savedRows) push(`cb:${row.id}`, row.recipe);
  return out.slice(0, 30);
}

export async function myRecipes() {
  const { user, error } = await member();
  if (error) return { error };
  return { recipes: await loadMyRecipes(user) };
}

// Puts one of their own recipes into a slot or meal prep item (green, since they picked it).
export async function putMyRecipe({ key, ref }) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  if (!plan) return { error: "Plan your week first." };
  const info = slotInfo(plan, key);
  if (!info) return { error: "Pick a meal on the calendar first." };
  const recipe = await resolveMyRecipe(user, ref);
  if (!recipe) return { error: "That recipe isn't one of yours anymore." };

  const id = recipe.id;
  plan.recipes[id] = recipe;
  const old = plan.slots[info.key] ?? {};
  plan.slots[info.key] = info.listKey === "prep"
    ? { recipeId: id, source: "user" }
    : { recipeId: id, leftovers: false, pinned: Boolean(old.pinned), note: old.note ?? "", source: "user" };
  await storePlan(user.id, plan);
  return { slotKey: info.key, listKey: info.listKey, slot: plan.slots[info.key], recipes: [recipe] };
}
