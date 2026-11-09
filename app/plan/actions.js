"use server";

import { sql } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";
import { getProfile } from "../../lib/profile";
import { pantryNames } from "../../lib/pantry";
import { aiUsesThisWeek, WEEKLY_AI_LIMIT } from "../../lib/ai-budget";
import { buildPlan, MEAL_QUERY, PREP_QUERY, recipeId } from "../../lib/planner";
import { generateRecipeIdeas, RecipeError } from "../../lib/recipe-ai";

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

// "Plan my week": read the week (one AI request at most), fill it from the library and save it.
export async function makePlan({ text, start }) {
  const { user, error } = await member();
  if (error) return { error };
  const week = String(text ?? "").trim().slice(0, 600);
  if (!ISO_DATE.test(String(start))) return { error: "Pick a start day first." };
  try {
    const profile = await profileWithPantry(user.id);
    const allowAi = (await aiUsesThisWeek(user.id)) < WEEKLY_AI_LIMIT;
    const plan = await buildPlan({ text: week, start, profile, allowAi });
    if (plan.usedAi) await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${`plan: ${week}`.slice(0, 380)}, 'ai')`;
    await storePlan(user.id, plan);
    return { plan };
  } catch (e) {
    console.error("Plan my week failed", e);
    return { error: "Something went wrong planning your week. Please try again." };
  }
}

// Saves the person's picks: { "dayIndex|Meal": { recipeId, leftovers, pinned, note } }. Only recipes from this plan are allowed.
export async function saveSlots(slots) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  if (!plan) return { error: "Plan your week first." };
  const clean = {};
  for (const [key, slot] of Object.entries(slots ?? {}).slice(0, 80)) {
    const [day, meal] = String(key).split("|");
    if (!(Number(day) >= 0 && Number(day) < 7) || !plan.meals.includes(meal) || !slot) continue;
    const id = slot.recipeId && plan.recipes[slot.recipeId] ? slot.recipeId : null;
    const note = String(slot.note ?? "").slice(0, 60);
    if (!id && !slot.leftovers && !note) continue;
    clean[`${Number(day)}|${meal}`] = { recipeId: id, leftovers: Boolean(slot.leftovers) && !id, pinned: Boolean(slot.pinned), note };
  }
  plan.slots = clean;
  await storePlan(user.id, plan);
  return { ok: true };
}

// "More ideas" in the slot picker: library first, the AI only when the library runs out (counts as one AI request).
export async function moreIdeas(meal, prepAhead = false) {
  const { user, error } = await member();
  if (error) return { error };
  const plan = await loadPlan(user.id);
  if (!plan || !plan.meals.includes(meal)) return { error: "Plan your week first." };
  try {
    const profile = await profileWithPantry(user.id);
    const allowAi = (await aiUsesThisWeek(user.id)) < WEEKLY_AI_LIMIT;
    const request = prepAhead ? `${PREP_QUERY} ${MEAL_QUERY[meal]}` : MEAL_QUERY[meal];
    const titles = Object.values(plan.recipes).map((r) => r.title).slice(0, 60);
    const result = await generateRecipeIdeas(request, profile, titles, { allowAi });
    if (result.usedAi) await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${`plan ideas: ${meal}`}, 'ai')`;
    const listKey = prepAhead ? "prep" : meal;
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
