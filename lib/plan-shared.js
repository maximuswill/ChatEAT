// "Plan my week" helpers used by both the server and the browser. No server-only code here.
import { MEALS } from "./onboarding-data.js";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Meal rows on the calendar: always lunch and dinner, plus anything else from the kitchen profile, in the usual order.
export function planMeals(profileMeals = []) {
  const wanted = new Set(["Lunch", "Dinner", ...profileMeals]);
  return MEALS.filter((m) => wanted.has(m));
}

// Seven days starting on `startISO` ("2026-11-09"). Dates are plain calendar dates, no time zones.
export function weekDays(startISO) {
  const [y, m, d] = startISO.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    return {
      date: date.toISOString().slice(0, 10),
      name: DAY_NAMES[date.getUTCDay()],
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    };
  });
}

export const slotKey = (dayIndex, meal) => `${dayIndex}|${meal}`;

// The browser's local date as "YYYY-MM-DD".
export function localISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ---------- "You may need" grocery list ----------

const normalize = (text) => String(text).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w) => (w.length > 3 && !w.endsWith("ss") ? w.replace(/(ies)$/, "y").replace(/(es|s)$/, "") : w);
const GENERIC = new Set(["frozen", "fresh", "canned", "powder", "ground", "dried", "mixed", "whole", "plain", "sauce", "oil", "extract", "seasoning", "large", "small", "medium", "boneless", "skinless", "chopped", "sliced", "diced", "minced", "for", "and", "the", "with", "into", "cut", "optional", "serving"]);
const SKIP = new Set(["water", "ice", "ice water", "warm water", "cold water"]);

// The shopping name for an ingredient line: drop anything in brackets, notes after a comma and
// leading descriptors ("Boneless, skinless chicken breasts" -> "Chicken breasts").
function shoppingName(item) {
  const parts = String(item).replace(/\([^)]*\)?/g, " ").split(/,|\bfor serving\b/i).map((p) => p.trim()).filter(Boolean);
  const words = (parts.find((p) => p.toLowerCase().split(/\s+/).some((w) => !DESCRIPTORS.has(w))) ?? parts[0] ?? "").split(/\s+/);
  while (words.length > 1 && DESCRIPTORS.has(words[0].toLowerCase())) words.shift();
  const name = words.join(" ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
const DESCRIPTORS = new Set(["boneless", "skinless", "large", "small", "medium", "fresh", "chopped", "sliced", "diced", "minced", "melted", "softened", "shredded", "grated", "very", "ripe", "cold", "warm", "optional", "extra", "lean", "thin", "thick", "about"]);

// Ingredients across the chosen recipes, split into what they may need to buy and what their pantry probably covers.
export function groceryList(recipes, pantry = []) {
  const pantryWords = new Set(pantry.flatMap((p) => normalize(p).split(" ")).map(stem).filter((w) => w.length > 2 && !GENERIC.has(w)));
  const items = new Map();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients ?? []) {
      if (ing.heading) continue;
      const name = shoppingName(ing.item);
      const key = normalize(name);
      if (!key || SKIP.has(key)) continue;
      const entry = items.get(key) ?? { name, recipes: new Set() };
      entry.recipes.add(recipe.title);
      items.set(key, entry);
    }
  }
  const need = [];
  const have = [];
  for (const [key, entry] of items) {
    const words = key.split(" ").map(stem).filter((w) => w.length > 2 && !GENERIC.has(w));
    const row = { name: entry.name, recipes: [...entry.recipes] };
    (words.length && words.some((w) => pantryWords.has(w)) ? have : need).push(row);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return { need: need.sort(byName), have: have.sort(byName) };
}
