// Finds the library recipes that best fit a request and a person's profile.
// No AI involved: it reads the request for ideas it understands (ingredients, cuisines,
// moods like "filling", time limits) and scores every recipe against them.
import { violations } from "../allergens.js";
import { skillTier } from "../onboarding-data.js";

// Words in a request that point to recipe qualities. Each concept lists the tags,
// courses, meals, cuisines or proteins it matches.
const CONCEPTS = [
  { words: ["filling", "hearty", "substantial", "stick to my ribs", "starving", "hungry", "big meal"], tags: ["hearty", "filling"] },
  { words: ["savory", "salty", "umami"], tags: ["savory", "hearty"] },
  { words: ["comfort", "cozy", "comforting", "warm me up", "cold day", "rainy"], tags: ["comfort", "cozy", "soup"] },
  { words: ["quick", "fast", "easy", "simple", "no time", "lazy", "busy", "weeknight", "short on time", "in a hurry"], tags: ["quick", "weeknight", "beginner"], quick: true },
  { words: ["healthy", "light", "lean", "clean", "lose weight", "losing weight", "weight loss", "diet", "low calorie", "cut", "cutting"], tags: ["healthy", "light", "lean", "weight-loss"] },
  { words: ["protein", "high protein", "gains", "muscle", "bulk", "bulking", "post workout", "recovery"], tags: ["high-protein", "athlete", "post-workout"] },
  { words: ["pre workout", "before practice", "before a game", "energy", "fuel", "carb", "carbs", "carb heavy", "game tomorrow"], tags: ["pre-workout", "athlete", "carbs"] },
  { words: ["cheap", "budget", "broke", "inexpensive", "affordable", "save money"], tags: ["budget", "pantry"] },
  { words: ["meal prep", "prep", "batch", "make ahead", "leftovers for the week", "lunches for the week", "whole week"], tags: ["meal-prep", "make-ahead"] },
  { words: ["leftover", "leftovers", "use up", "clean out the fridge"], tags: ["leftovers", "use-it-up"] },
  { words: ["date night", "impress", "impressive", "special", "fancy", "romantic", "anniversary"], tags: ["date-night", "impressive"] },
  { words: ["party", "crowd", "friends over", "people over", "guests", "game day", "super bowl", "tailgate", "potluck"], tags: ["party", "crowd", "game-day", "crowd-pleaser"] },
  { words: ["kid", "kids", "picky"], tags: ["kid-friendly"] },
  { words: ["spicy", "hot", "heat", "kick"], tags: ["spicy"] },
  { words: ["cheesy", "cheese"], tags: ["cheesy"] },
  { words: ["crispy", "crunchy", "fried"], tags: ["crispy", "crunchy"] },
  { words: ["creamy", "rich"], tags: ["creamy"] },
  { words: ["fresh", "summer", "refreshing"], tags: ["fresh", "summer"] },
  { words: ["grill", "grilled", "grilling", "barbecue", "bbq", "cookout"], tags: ["grill", "bbq"] },
  { words: ["smoke", "smoked", "smoker"], tags: ["smoked"] },
  { words: ["slow cooker", "crockpot", "crock pot", "hands off", "set it and forget it"], tags: ["hands-off"] },
  { words: ["one pan", "one pot", "few dishes", "easy cleanup", "sheet pan"], tags: ["one-pan", "easy-cleanup"] },
  { words: ["project", "challenge", "learn", "new skill", "teach me", "something new", "weekend"], tags: ["project", "weekend", "from-scratch"] },
  { words: ["takeout", "take out", "restaurant", "like the restaurant", "chinese food"], tags: ["takeout"] },
  { words: ["soup", "stew", "chili"], tags: ["soup"] },
  { words: ["salad", "greens"], tags: ["salad"] },
  { words: ["no cook", "no stove", "no oven", "without cooking"], tags: ["no-cook"] },
  { words: ["late night", "midnight", "drunk"], tags: ["late-night", "quick"] },
  { words: ["sick", "cold", "flu", "not feeling well"], tags: ["sick-day", "soup", "comfort"] },
  { words: ["vegetarian", "meatless", "no meat", "veggie"], tags: ["vegetarian", "vegan"] },
  { words: ["vegan", "plant based", "dairy free"], tags: ["vegan"] },
  { words: ["gluten free"], tags: ["gluten-free"] },
  { words: ["low carb", "keto"], tags: ["low-carb"] },
  { words: ["breakfast", "brunch", "morning"], meals: ["breakfast"] },
  { words: ["lunch"], meals: ["lunch"] },
  { words: ["dinner", "supper", "tonight"], meals: ["dinner"] },
  { words: ["snack", "snacks", "munchies", "appetizer", "dip"], meals: ["snack"], courses: ["snack"] },
  { words: ["dessert", "sweet", "treat", "sweet tooth", "bake", "baking", "chocolate"], courses: ["dessert", "baking"], tags: ["sweet", "baking"] },
  { words: ["side", "side dish", "sides", "to go with"], courses: ["side"] },
];

const CUISINE_WORDS = {
  mexican: "Mexican", taco: "Mexican", tacos: "Mexican", burrito: "Mexican", italian: "Italian", pasta: "Italian",
  chinese: "Chinese", "stir fry": "Chinese", japanese: "Japanese", teriyaki: "Japanese", indian: "Indian", curry: "Indian",
  thai: "Thai", korean: "Korean", mediterranean: "Mediterranean", greek: "Greek", french: "French",
  "middle eastern": "Middle Eastern", southern: "Southern", american: "American", bbq: "American BBQ", barbecue: "American BBQ",
};

const PROTEIN_WORDS = {
  chicken: "chicken", wings: "chicken", beef: "beef", steak: "beef", burger: "beef", burgers: "beef", "ground beef": "beef",
  pork: "pork", bacon: "pork", sausage: "pork", ribs: "pork", fish: "fish", salmon: "fish", cod: "fish", tuna: "fish",
  shrimp: "shellfish", scallops: "shellfish", seafood: "fish|shellfish", tofu: "tofu", beans: "beans", lentils: "beans",
  chickpeas: "beans", eggs: "eggs", egg: "eggs", turkey: "turkey",
};

const STOP = new Set("i im i'm a an the and or but with for to of in on at my me some something want wanna would like have got make cook cooking food meal meals about minutes minute min mins hour hours time it is that this what can should could really very just maybe kind sort feel feeling craving crave mood up".split(" "));

const normalize = (text) => ` ${String(text).toLowerCase().replace(/[-_/]/g, " ").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ")} `;
const has = (text, phrase) => text.includes(` ${phrase} `);
// Light plural handling: "noodles" -> "noodle", "berries" -> "berry", "dishes" -> "dish".
const stem = (word) => {
  if (word.length <= 3 || word.endsWith("ss")) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(x|z|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("oes")) return word.slice(0, -2);
  return word.replace(/s$/, "");
};

const DIFFICULTY_RANK = { Easy: 1, Medium: 2, Challenging: 3 };
const SKILL_COMFORT = { "Not assessed yet": 2, "Brand new: ready to learn": 1, "Getting started": 2, "Home cook": 3, "Confident cook": 3 };

function readRequest(request) {
  const text = normalize(request);
  const tags = new Set();
  const conceptTags = []; // one group per matched concept, so a concept counts once
  const meals = new Set();
  const courses = new Set();
  let quick = false;
  for (const concept of CONCEPTS) {
    if (concept.words.some((w) => has(text, w))) {
      if (concept.tags) conceptTags.push(concept.tags);
      concept.tags?.forEach((t) => tags.add(t));
      concept.meals?.forEach((m) => meals.add(m));
      concept.courses?.forEach((c) => courses.add(c));
      if (concept.quick) quick = true;
    }
  }
  const cuisines = new Set(Object.entries(CUISINE_WORDS).filter(([w]) => has(text, w)).map(([, c]) => c));
  const proteins = new Set(Object.entries(PROTEIN_WORDS).filter(([w]) => has(text, w)).flatMap(([, p]) => p.split("|")));
  const minutes = Number((text.match(/ (\d{1,3}) ?(?:minutes?|mins?|min) /) ?? [])[1]) || (has(text, "an hour") || has(text, "1 hour") ? 60 : 0);
  // Remaining meaningful words, used to match titles and ingredients ("rice", "broccoli", "lasagna").
  const words = [...new Set(text.trim().split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem))];
  return { text, tags, conceptTags, meals, courses, cuisines, proteins, minutes, quick, words };
}

function equipmentOk(recipe, equipment) {
  if (!equipment?.length) return true;
  const owned = new Set(equipment);
  return recipe.equip.every((need) => need.split("|").some((tool) => owned.has(tool)));
}

function recipeWords(recipe) {
  if (!recipe._words) {
    recipe._titleWords = new Set(normalize(recipe.title).trim().split(" ").map(stem));
    recipe._words = new Set(normalize([recipe.title, recipe.summary, ...recipe.ingredients.map((i) => i.item), ...recipe.tags].join(" ")).trim().split(" ").map(stem));
  }
  return recipe._words;
}

// Score one recipe. Higher is better; anything at or above STRONG is a confident match.
function score(recipe, want, profile) {
  let s = 0;
  const reasons = [];
  const words = recipeWords(recipe);

  for (const w of want.words) {
    if (recipe._titleWords.has(w)) { s += 6; reasons.push(w); }
    else if (words.has(w)) { s += 2.5; reasons.push(w); }
  }
  for (const group of want.conceptTags) if (group.some((t) => recipe.tags.includes(t))) s += 3;
  for (const c of want.cuisines) if (recipe.cuisine === c) s += 4;
  for (const p of want.proteins) if (recipe.protein === p) s += 5;
  if (want.meals.size) s += [...want.meals].some((m) => recipe.meal.includes(m)) ? 3 : -4;
  if (want.courses.size) s += want.courses.has(recipe.course) ? 5 : -4;
  if (want.quick && recipe.active_minutes <= 20) s += 2;

  // Profile: favorites, cuisines, dislikes and skill. Favorites only nudge recipes that already fit the request.
  const p = profile;
  const relevant = s > 0;
  const titleText = normalize(recipe.title);
  const matchesFav = (fav) => normalize(fav).trim().split(" ").some((w) => w.length > 3 && titleText.includes(` ${stem(w)}`));
  if (relevant && (p.topFavorites ?? []).some(matchesFav)) s += 3;
  else if (relevant && (p.favorites ?? []).some(matchesFav)) s += 1.5;
  if (p.cuisines?.[recipe.cuisine] === "love") s += 1.5;
  if (p.cuisines?.[recipe.cuisine] === "no") s -= 4;
  for (const d of p.dislikes ?? []) if (words.has(stem(normalize(d).trim()))) s -= 6;
  if ((p.goals ?? []).some((g) => /muscle|training/i.test(g)) && recipe.tags.includes("high-protein")) s += 1;
  if ((p.goals ?? []).some((g) => /lose weight|healthier/i.test(g)) && recipe.tags.some((t) => ["healthy", "light", "weight-loss", "lean"].includes(t))) s += 1;
  if ((p.lifestyle ?? []).includes("Trying to save money") && recipe.tags.includes("budget")) s += 1;
  if (relevant && p.pantry?.length) s += Math.round(pantryCoverage(recipe, p.pantry) * 4 * 10) / 10;
  const comfort = SKILL_COMFORT[skillTier(p.skills ?? {})] ?? 2;
  const gap = DIFFICULTY_RANK[recipe.difficulty] - comfort;
  if (gap > 0 && !want.tags.has("project")) s -= gap * 1.5;

  return { score: s, reasons };
}

export const STRONG = 8;

// Words in pantry names that don't identify a food on their own.
const PANTRY_GENERIC = new Set(["frozen", "fresh", "canned", "powder", "ground", "dried", "mixed", "whole", "plain", "sauce", "oil", "extract", "seasoning", "noodle", "noodles"]);

// Share of a recipe's ingredients that appear in the person's pantry (0 to 1). Rough by design.
export function pantryCoverage(recipe, pantry = []) {
  if (!pantry.length) return 0;
  const pantryWords = new Set(pantry.flatMap((name) => normalize(name).trim().split(" ")).map(stem).filter((w) => w.length > 2 && !PANTRY_GENERIC.has(w)));
  const items = (recipe.ingredients ?? []).filter((i) => !i.heading);
  if (!items.length) return 0;
  const have = items.filter((i) => normalize(i.item).trim().split(" ").map(stem).some((w) => pantryWords.has(w))).length;
  let share = have / items.length;
  // Having the spices for a salmon dish doesn't help much without the salmon.
  const proteinWords = PROTEIN_IN_PANTRY[recipe.protein];
  if (proteinWords && !proteinWords.some((w) => pantryWords.has(w))) share *= 0.3;
  return share;
}

const PROTEIN_IN_PANTRY = {
  chicken: ["chicken"], beef: ["beef", "steak", "chuck", "roast"], pork: ["pork", "bacon", "sausage", "ham"],
  fish: ["salmon", "fish", "cod", "tuna"], shellfish: ["shrimp", "scallop"], tofu: ["tofu"],
  beans: ["bean", "chickpea", "lentil"], eggs: ["egg"], turkey: ["turkey"],
};

// Returns ranked matches: [{ recipe, score }], already filtered for safety, equipment and time.
export function searchRecipes(pool, request, profile, { rules = [], avoidTitles = [] } = {}) {
  const want = readRequest(request);
  const avoid = new Set(avoidTitles.map((t) => t.toLowerCase()));
  const wantsSide = want.courses.has("side");

  // "A side for steak": find the mains the request mentions and boost the sides they pair with.
  const pairedSides = new Set();
  if (wantsSide) {
    const mains = pool.filter((recipe) => recipe.course === "main").map((recipe) => (recipeWords(recipe), recipe));
    // Prefer mains named in the request ("steak"); fall back to mains with the requested protein.
    const named = mains.filter((recipe) => want.words.some((w) => recipe._titleWords.has(w)));
    const chosen = named.length ? named : mains.filter((recipe) => want.proteins.has(recipe.protein));
    chosen.forEach((recipe) => recipe.pairs.forEach((id) => pairedSides.add(id)));
  }

  const results = [];
  for (const recipe of pool) {
    if (avoid.has(recipe.title.toLowerCase())) continue;
    if (violations(recipe, rules).length) continue;
    if (!equipmentOk(recipe, profile.equipment)) continue;
    if (want.minutes && recipe.active_minutes > want.minutes + 5 && recipe.total_minutes > want.minutes * 1.25) continue;
    recipeWords(recipe);
    // Sides and snacks only appear when asked for (or named); otherwise they show up as pairings.
    const named = want.words.some((w) => recipe._titleWords.has(w));
    if ((recipe.course === "side" || recipe.course === "snack") && !want.courses.has(recipe.course) && !named) continue;
    if (wantsSide && recipe.course === "main") continue;
    let { score: s } = score(recipe, want, profile);
    if (pairedSides.has(recipe.id)) s += 6;
    results.push({ recipe, score: s });
  }
  results.sort((a, b) => b.score - a.score);
  return { results, understood: want.words.length + want.tags.size + want.cuisines.size + want.proteins.size + want.meals.size + want.courses.size > 0 };
}

// Pick up to `count` results, avoiding three of the same main protein when there are alternatives.
export function pickVaried(results, count) {
  const picked = [];
  const proteinCount = {};
  for (const item of results) {
    if (picked.length >= count) break;
    const key = item.recipe.protein || item.recipe.id; // only limit repeats of the same main protein
    if ((proteinCount[key] ?? 0) >= 2 && results.length > count * 2) continue;
    picked.push(item);
    proteinCount[key] = (proteinCount[key] ?? 0) + 1;
  }
  return picked;
}

// A one-line reason a library recipe suits this person, built from their profile.
export function whyItFits(recipe, profile, request) {
  const want = readRequest(request);
  const bits = [];
  const weeknight = Number(profile.weeknightTime);
  if (want.minutes && recipe.active_minutes <= want.minutes) bits.push(`about ${recipe.active_minutes} minutes of hands-on time, inside your ${want.minutes}`);
  else if (weeknight && recipe.active_minutes <= weeknight) bits.push(`fits your ${weeknight}-minute weeknights`);
  if (profile.weeknightTime === "0" && recipe.tags.some((t) => ["make-ahead", "meal-prep"].includes(t))) bits.push("can be made ahead for busy days");
  if (recipe.tags.includes("high-protein") && ((profile.lifestyle ?? []).includes("Athlete or training") || (profile.goals ?? []).some((g) => /muscle|training/i.test(g)))) bits.push(`${recipe.nutrition.protein_g} g of protein per serving for your training`);
  if (recipe.tags.includes("budget") && (profile.lifestyle ?? []).includes("Trying to save money")) bits.push("easy on your budget");
  const fav = [...(profile.topFavorites ?? []), ...(profile.favorites ?? [])].find((f) => normalize(recipe.title).includes(` ${stem(normalize(f).trim().split(" ")[0])}`));
  if (fav) bits.push(`you said you love ${fav.toLowerCase()}`);
  if (pantryCoverage(recipe, profile.pantry) >= 0.6) bits.push("you already have most of what it needs");
  if (recipe.new_skill && (profile.learn ?? []).length) bits.push(`teaches a new skill: ${recipe.new_skill.toLowerCase()}`);
  if (!bits.length) bits.push(recipe.summary.split(".")[0].toLowerCase());
  const text = bits.slice(0, 2).join(", and ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

// ---------- "Make it mine" from the request box ----------
// Only works when the request names a dish ("chicken pot pie", "lasagna", "steak"),
// not a mood ("something filling") or a list of ingredients ("I have chicken and rice").

const VAGUE = ["something", "anything", "ideas", "idea", "options", "suggest", "suggestions", "recommend", "what should", "what can", "whatever", "surprise me", "i have", "i've got", "ive got", "using up", "what to make", "what to cook"];
// Words that describe ingredients or qualities rather than a dish.
const NOT_A_DISH = new Set([
  "chicken", "beef", "pork", "fish", "salmon", "shrimp", "tofu", "bean", "egg", "turkey", "rice", "pasta", "noodle", "potato",
  "broccoli", "cheese", "vegetable", "veggie", "meat", "seafood", "bread", "lentil", "chickpea", "cod", "tuna", "bacon", "sausage",
  "ground", "pepper", "onion", "tomato", "spinach", "mushroom", "carrot", "corn", "food", "dish", "recipe", "thing", "today", "tomorrow",
  "high", "low", "big", "small", "good", "best", "new", "simple", "protein", "calorie", "carb", "week", "night", "morning", "make", "version",
]);
// Dish nouns that also appear in the mood lists above still count as dishes.
const DISH_NOUNS = new Set(["soup", "stew", "chili", "salad", "pizza", "taco", "burger", "wing", "rib", "steak", "pasta"]);
const CONCEPT_WORDS = new Set(CONCEPTS.flatMap((c) => c.words).filter((w) => !w.includes(" ")).map(stem).filter((w) => !DISH_NOUNS.has(w)));
const CUISINE_ONLY = new Set(Object.keys(CUISINE_WORDS).filter((w) => !w.includes(" ")));

// The dish itself, without changes asked for after "but", "with", "without" and so on.
function dishPart(request) {
  return String(request).split(/\b(?:but|with|without|minus|except|and make|make it|instead of|no)\b/i)[0];
}

function dishWords(request) {
  const { words } = readRequest(dishPart(request));
  return words.filter((w) => !NOT_A_DISH.has(w) && !CONCEPT_WORDS.has(w) && !CUISINE_ONLY.has(w));
}

export function describesSpecificMeal(request) {
  const text = normalize(request);
  if (VAGUE.some((phrase) => has(text, phrase))) return false;
  const { words } = readRequest(request);
  return words.length > 0 && words.length <= 10 && dishWords(request).length > 0;
}

// The library recipe that is the same dish as the request, if there is one.
export function findLibraryDish(pool, request, rules = []) {
  const wanted = dishWords(request);
  const { words } = readRequest(request);
  let best = null;
  for (const recipe of pool) {
    if (violations(recipe, rules).length) continue;
    recipeWords(recipe);
    // Every dish word must appear in the title (allowing short forms like "parm" for "parmesan").
    const titleWords = [...recipe._titleWords];
    const matches = (w) => recipe._titleWords.has(w) || (w.length >= 4 && titleWords.some((t) => t.startsWith(w)));
    const dishHits = wanted.filter(matches).length;
    if (!wanted.length || dishHits < wanted.length) continue;
    const extra = words.filter((w) => recipe._titleWords.has(w)).length;
    const s = dishHits * 10 + extra + (recipe.course === "main" ? 1 : 0);
    if (!best || s > best.s) best = { recipe, s };
  }
  return best?.recipe ?? null;
}
