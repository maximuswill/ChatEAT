"use server";

import { redirect } from "next/navigation";
import { sql } from "../lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "../lib/auth";
import { withDefaults } from "../lib/onboarding-data";
import { getProfile } from "../lib/profile";
import { generateRecipeIdeas, personalizeFromRequest, personalizeRecipe, refineRecipe, RecipeError } from "../lib/recipe-ai";
import { describesSpecificMeal, findLibraryDish } from "../lib/library/search.js";
import { hardRules } from "../lib/allergens";
import { keepDays, lookupFresh, STAPLE_CATEGORIES } from "../lib/pantry-data.js";
import { pantryNames } from "../lib/pantry.js";
import { REQUIRE_SUBSCRIPTION, siteUrl, stripe } from "../lib/billing";
import { aiUsesThisWeek, WEEKLY_AI_LIMIT } from "../lib/ai-budget";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function readForm(formData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUp(_previous, formData) {
  const { email, password } = readForm(formData);

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "Enter a valid email address.", email };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password with at least ${MIN_PASSWORD} characters.`, email };
  }
  if (password.length > 200) {
    return { error: "That password is too long.", email };
  }

  const passwordHash = await hashPassword(password);
  const created = await sql`
    insert into users (email, password_hash)
    values (${email}, ${passwordHash})
    on conflict (email) do nothing
    returning id`;

  if (created.length === 0) {
    return { error: "An account with that email already exists. Try logging in.", email };
  }

  await createSession(created[0].id);
  redirect(REQUIRE_SUBSCRIPTION ? "/subscribe" : "/onboarding");
}

export async function logIn(_previous, formData) {
  const { email, password } = readForm(formData);
  const failed = { error: "That email and password don't match an account.", email };

  if (!email || !password || password.length > 200) return failed;

  const rows = await sql`select id, password_hash from users where email = ${email} limit 1`;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) return failed;

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logOut() {
  await destroySession();
  redirect("/");
}

// Saves onboarding answers. Called as the person moves between steps (draft) and once at the end (completed).
export async function saveProfile(answers, { completed = false } = {}) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again to save your answers." };

  const clean = withDefaults(answers);
  const json = JSON.stringify(clean);
  if (json.length > 30000) return { ok: false, error: "That's more text than we can save. Try shortening your notes." };

  await sql`
    insert into profiles (user_id, data, completed_at, updated_at)
    values (${user.id}, ${json}::jsonb, ${completed ? new Date() : null}, now())
    on conflict (user_id) do update
      set data = excluded.data,
          completed_at = coalesce(excluded.completed_at, profiles.completed_at),
          updated_at = now()`;
  return { ok: true };
}

export async function changePassword(_previous, formData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < MIN_PASSWORD) return { error: `Use a new password with at least ${MIN_PASSWORD} characters.` };
  if (next.length > 200) return { error: "That password is too long." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  const [row] = await sql`select password_hash from users where id = ${user.id}`;
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "Your current password isn't right." };

  await sql`update users set password_hash = ${await hashPassword(next)} where id = ${user.id}`;
  // Log out everywhere else, then start a fresh session here.
  await sql`delete from sessions where user_id = ${user.id}`;
  await createSession(user.id);
  return { success: "Password changed. You've been logged out on other devices." };
}

// ---------- Recipe generator ----------

export async function generateRecipes({ request, avoidTitles = [] }) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again to get recipes." };
  if (!user.has_paid_access) return { error: "Recipe ideas are part of the paid plan." };

  const text = String(request ?? "").trim().slice(0, 400);
  if (text.length < 3) return { error: "Tell ChatEAT a little about what you want first." };

  const { data } = await getProfile(user.id);
  data.pantry = await pantryNames(user.id);
  const titles = (Array.isArray(avoidTitles) ? avoidTitles : []).map((t) => String(t).slice(0, 120)).slice(0, 30);
  try {
    // Library answers are free and unlimited. Only requests that use the AI count toward the daily limit.
    const allowAi = (await aiUsesThisWeek(user.id)) < WEEKLY_AI_LIMIT;
    const result = await generateRecipeIdeas(text, data, titles, { allowAi });
    await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${text}, ${result.usedAi ? "ai" : "library"})`;
    return { ...result, limitReached: !allowAi };
  } catch (error) {
    if (error instanceof RecipeError) return { error: error.message };
    console.error("Recipe generation failed", error);
    return { error: "Something went wrong getting recipes. Please try again." };
  }
}

// Shared checks for every personal (AI) recipe request.
async function personalRequest(label, run) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again." };
  if (!user.has_paid_access) return { error: "\"Make it mine\" is part of the paid plan." };
  if ((await aiUsesThisWeek(user.id)) >= WEEKLY_AI_LIMIT) return { error: `You've used all ${WEEKLY_AI_LIMIT} of this week's AI requests. Library recipes still work, and AI requests free up as the week rolls on.` };
  const { data } = await getProfile(user.id);
  data.pantry = await pantryNames(user.id);
  try {
    const result = await run(data);
    await sql`insert into recipe_requests (user_id, request, mode) values (${user.id}, ${label.slice(0, 380)}, 'ai')`;
    return result;
  } catch (error) {
    if (error instanceof RecipeError) return { error: error.message };
    console.error("Personal recipe failed", error);
    return { error: "Something went wrong making that recipe. Please try again." };
  }
}

const tooBig = (recipe) => JSON.stringify(recipe ?? {}).length > 20000;

// "Make it mine" on a recipe card.
export async function makeItMine(recipe) {
  if (tooBig(recipe)) return { error: "That recipe is too large to personalize." };
  return personalRequest(`make it mine: ${String(recipe?.title ?? "")}`, async (profile) => ({ recipe: await personalizeRecipe(recipe, profile) }));
}

// "Make it mine" from the request box: only for a specific dish.
export async function makeItMineFromRequest(request) {
  const text = String(request ?? "").trim().slice(0, 300);
  if (!describesSpecificMeal(text)) {
    return { notice: "\"Make it mine\" needs a specific meal, like \"chicken pot pie\" or \"lasagna but spicier.\" For ideas, use Get recipes." };
  }
  return personalRequest(`make it mine: ${text}`, async (profile) => {
    const rules = hardRules(profile);
    return personalizeFromRequest(text, profile, (pool) => findLibraryDish(pool, text, rules));
  });
}

// "Change it": edit a personal recipe with the person's own instructions.
export async function changeMyRecipe(recipe, change) {
  const text = String(change ?? "").trim().slice(0, 300);
  if (text.length < 3) return { error: "Tell ChatEAT what you'd like different first." };
  if (tooBig(recipe)) return { error: "That recipe is too large to change." };
  return personalRequest(`change: ${text}`, async (profile) => ({ recipe: await refineRecipe(recipe, text, profile) }));
}

export async function saveRecipe(recipe) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out." };
  const title = String(recipe?.title ?? "").trim().slice(0, 200);
  const json = JSON.stringify(recipe ?? {});
  if (!title || json.length > 20000) return { error: "That recipe couldn't be saved." };
  await sql`
    insert into saved_recipes (user_id, title, recipe) values (${user.id}, ${title}, ${json}::jsonb)
    on conflict (user_id, title) do nothing`;
  return { ok: true };
}

export async function removeSavedRecipe(id) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await sql`delete from saved_recipes where id = ${Number(id)} and user_id = ${user.id}`;
  redirect("/cookbook");
}

// ---------- My pantry ----------

const ALL_STAPLES = new Set(STAPLE_CATEGORIES.flatMap((c) => c.items));

export async function savePantryStaples(items) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again." };
  const clean = [...new Set((Array.isArray(items) ? items : []).filter((i) => ALL_STAPLES.has(i)))];
  await sql`
    insert into pantry_staples (user_id, items, updated_at) values (${user.id}, ${JSON.stringify(clean)}::jsonb, now())
    on conflict (user_id) do update set items = excluded.items, updated_at = now()`;
  return { ok: true, count: clean.length };
}

export async function addFreshItems(names) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again." };
  const list = (Array.isArray(names) ? names : [names]).map((n) => String(n ?? "").trim()).filter((n) => n.length >= 2).slice(0, 20);
  if (!list.length) return { error: "Type an item first, like chicken or bacon." };
  const [{ count }] = await sql`select count(*)::int as count from pantry_items where user_id = ${user.id} and remove_at > now()`;
  if (count + list.length > 100) return { error: "Your fresh list is full. Remove a few items first." };
  const added = [];
  for (const typed of list) {
    const { name, days } = lookupFresh(typed);
    const hours = Math.round(keepDays(days) * 24);
    const [row] = await sql`
      insert into pantry_items (user_id, name, remove_at)
      values (${user.id}, ${name}, now() + make_interval(hours => ${hours}::int))
      returning id, name, added_at`;
    added.push({ id: Number(row.id), name: row.name, addedAt: new Date(row.added_at).toISOString() });
  }
  return { ok: true, added };
}

export async function removeFreshItem(id) {
  const user = await getCurrentUser();
  if (!user) return { error: "You're logged out. Log in again." };
  await sql`delete from pantry_items where id = ${Number(id)} and user_id = ${user.id}`;
  return { ok: true };
}

// ---------- Subscriptions (Stripe Checkout) ----------

export async function startCheckout() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.has_paid_access) redirect("/dashboard");

  const s = stripe();
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({ email: user.email, metadata: { chateat_user_id: String(user.id) } });
    customerId = customer.id;
    await sql`update users set stripe_customer_id = ${customerId} where id = ${user.id}`;
  }
  const base = await siteUrl();
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: String(user.id),
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${base}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/subscribe?canceled=1`,
  });
  redirect(session.url);
}

// Stripe's own page for updating a card or canceling.
export async function openBillingPortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.stripe_customer_id) redirect("/account");
  let url;
  try {
    const portal = await stripe().billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${await siteUrl()}/account` });
    url = portal.url;
  } catch (error) {
    console.error("Billing portal failed", error?.message);
    redirect("/account?billing=unavailable");
  }
  redirect(url);
}
