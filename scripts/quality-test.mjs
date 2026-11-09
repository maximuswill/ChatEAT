// Quality test for the recipe AI: runs 10 realistic requests through ChatEAT's real AI code and saves
// every recipe plus timing, cost and safety checks. Costs a few cents on Haiku.
// Run with: node --env-file=.env.local scripts/quality-test.mjs [output.json]
import { writeFileSync } from "node:fs";
import { personalizeFromRequest, refineRecipe, testHooks } from "../lib/recipe-ai.js";
import { findLibraryDish } from "../lib/library/search.js";
import { hardRules, violations } from "../lib/allergens.js";
import { withDefaults } from "../lib/onboarding-data.js";
import { sql } from "../lib/db.js";

const out = process.argv[2] ?? "quality-test-results.json";

// A profile like ChatEAT's first customer: college athlete, big appetite, learning to cook.
const athlete = withDefaults({
  name: "Max", lifestyle: ["Student", "Athlete or training", "Busy most weeknights", "Learning to cook"],
  lifeNotes: "Practice is 3 to 6 on weekdays, games on Saturdays.", activity: "athlete", appetite: 5,
  weeknightTime: "30", weekendTime: "60", mealPrep: "yes", meals: ["Lunch", "Dinner", "Post-workout"],
  householdSize: 1, leftovers: "love",
  equipment: ["Stove", "Oven", "Microwave", "Air fryer", "Rice cooker", "Sheet pans", "Nonstick pan", "Baking pans"],
  skills: { eggs: 2, pancakes: 1, rice: 2, pasta: 2, friedrice: 1, macandcheese: 0, burgers: 2, bakedchicken: 1, salmon: 0, shrimp: 0, roastveg: 1, mashed: 1, chili: 1, cannedsoup: 2, brownies: 2, cookies: 1 },
  cuisines: { Mexican: "love", Italian: "love", Japanese: "love" }, topFavorites: ["Burgers"],
  favorites: ["Tacos", "Chicken parm", "Burrito bowls"], dislikes: ["Mushrooms"], spice: 2,
  goals: ["Fuel my training", "Build muscle", "Learn to cook"], nutritionDetail: "simple", budget: "moderate", splurge: "sometimes",
});
const dairyGlutenFree = withDefaults({ ...athlete, allergies: ["Milk or dairy", "Wheat or gluten"] });
const peanutAndRoommate = withDefaults({ ...athlete, allergies: ["Peanuts"], othersAllergies: [{ name: "Roommate", allergies: ["Shellfish"] }] });

async function spend() {
  const [{ total }] = await sql`select coalesce(sum(cost_usd), 0)::float as total from ai_usage`;
  return total;
}

const results = [];
async function run(label, kind, profile, fn) {
  const before = await spend();
  const started = Date.now();
  try {
    const recipe = await fn();
    const seconds = (Date.now() - started) / 1000;
    const cost = (await spend()) - before;
    const broken = violations(recipe, hardRules(profile));
    results.push({ label, kind, seconds, cost, broken, recipe });
    console.log(`OK   ${label.padEnd(48)} ${seconds.toFixed(1)}s  $${cost.toFixed(4)}  steps:${recipe.steps.length}  ${broken.length ? "RULES BROKEN: " + broken.join(", ") : "safe"}`);
    return recipe;
  } catch (error) {
    results.push({ label, kind, error: String(error.message ?? error) });
    console.log(`FAIL ${label}: ${error.message ?? error}`);
    return null;
  }
}

const personal = (request, profile) => async () => (await personalizeFromRequest(request, profile, (pool) => findLibraryDish(pool, request, hardRules(profile)))).recipe;
const fresh = (request, profile) => async () => {
  const { recipes, removed } = await testHooks.newAiRecipes(request, profile, [], 1, hardRules(profile));
  if (!recipes.length) throw new Error(`no safe recipe (removed: ${JSON.stringify(removed)})`);
  return recipes[0];
};

await run("1. Make it mine: chicken pot pie (not in library)", "make-it-mine", athlete, personal("chicken pot pie", athlete));
await run("2. Make it mine: pad thai with shrimp (not in library)", "make-it-mine", athlete, personal("pad thai with shrimp", athlete));
const stew = await run("3. Make it mine: beef stew but spicier (from library)", "make-it-mine", athlete, personal("beef stew but spicier", athlete));
await run("4. Make it mine: lasagna (from library)", "make-it-mine", athlete, personal("lasagna", athlete));
await run("5. New idea: high-protein post-workout dinner, 20 min", "new", athlete, fresh("a high-protein post-workout dinner I can make in 20 minutes", athlete));
await run("6. New idea: Korean beef rice bowls for meal prep", "new", athlete, fresh("Korean beef rice bowls for meal prep", athlete));
await run("7. New idea: pizza with dough from scratch (beginner)", "new", athlete, fresh("homemade pizza with the dough from scratch, I've never made dough before", athlete));
await run("8. Safety: comforting chicken dinner, no dairy or gluten", "safety", dairyGlutenFree, fresh("a comforting creamy chicken dinner", dairyGlutenFree));
await run("9. Safety: creamy satay noodles, peanut allergy + roommate shellfish", "safety", peanutAndRoommate, fresh("creamy satay-style noodles with shrimp", peanutAndRoommate));
if (stew) await run("10. Change it: stew for 8 people, no wine", "change", athlete, () => refineRecipe(stew, "make it for 8 people and leave out the wine", athlete));

writeFileSync(out, JSON.stringify(results, null, 2));
const ok = results.filter((r) => !r.error);
console.log(`\n${ok.length}/${results.length} succeeded. Total cost $${ok.reduce((a, r) => a + r.cost, 0).toFixed(4)}. Avg ${(ok.reduce((a, r) => a + r.seconds, 0) / Math.max(1, ok.length)).toFixed(1)}s per recipe. Saved to ${out}`);
