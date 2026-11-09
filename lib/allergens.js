// Safety net for allergies and diets. The AI is told these rules, and every recipe is also
// checked here before anyone sees it. A recipe that trips a rule is removed, never shown.
// Matching is deliberately cautious: a false alarm hides a recipe, a miss could hurt someone.

const FISH = ["fish", "salmon", "tuna", "cod", "tilapia", "anchovy", "sardine", "halibut", "trout", "mahi", "bass", "snapper", "catfish", "haddock", "pollock", "worcestershire", "fish sauce"];
const SHELLFISH = ["shellfish", "shrimp", "prawn", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "crawfish", "crayfish"];
const MEAT = ["chicken", "beef", "pork", "bacon", "ham", "sausage", "turkey", "lamb", "steak", "veal", "duck", "prosciutto", "pepperoni", "salami", "chorizo", "gelatin", "lard", "brisket", "rib", "ground meat", "meatball", "hot dog", "jerky", "venison", "bone broth", "burger"];
const DAIRY = ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "ghee", "whey", "casein", "parmesan", "mozzarella", "cheddar", "ricotta", "feta", "buttermilk", "half-and-half", "queso", "paneer", "custard", "ice cream", "brie", "gouda", "provolone", "mascarpone"];
const DAIRY_SAFE = ["coconut milk", "coconut cream", "almond milk", "oat milk", "soy milk", "rice milk", "cashew milk", "peanut butter", "almond butter", "cashew butter", "sunflower butter", "cocoa butter", "apple butter", "cream of tartar", "dairy-free", "vegan butter", "vegan cheese", "nutritional yeast", "butternut", "butter lettuce", "butter bean"];
const EGGS = ["egg", "mayonnaise", "mayo", "meringue", "aioli"];
const EGG_SAFE = ["eggplant", "egg-free", "vegan mayo"];
const GLUTEN = ["flour", "wheat", "bread", "pasta", "spaghetti", "penne", "macaroni", "noodle", "couscous", "barley", "rye", "semolina", "tortilla", "soy sauce", "breadcrumb", "panko", "seitan", "bulgur", "farro", "spelt", "cracker", "bun", "pita", "croissant", "biscuit", "dumpling", "orzo", "naan", "bagel", "pizza dough", "puff pastry", "pie crust", "beer"];
const GLUTEN_SAFE = ["gluten-free", "corn tortilla", "rice noodle", "rice flour", "almond flour", "coconut flour", "chickpea flour", "oat flour (certified gluten-free)", "cassava flour", "tapioca flour", "rice paper", "tamari", "buckwheat"];
const ALCOHOL = ["wine", "beer", "rum", "vodka", "whiskey", "bourbon", "brandy", "sake", "mirin", "sherry", "tequila", "liqueur"];
const PORK = ["pork", "bacon", "ham", "prosciutto", "pepperoni", "salami", "chorizo", "lard", "gelatin", "pancetta"];

const RULES = {
  "Peanuts": { words: ["peanut", "groundnut"] },
  "Tree nuts": { words: ["almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "pine nut", "brazil nut", "praline", "nutella", "marzipan"] },
  "Milk or dairy": { words: DAIRY, safe: DAIRY_SAFE },
  "Eggs": { words: EGGS, safe: EGG_SAFE },
  "Wheat or gluten": { words: GLUTEN, safe: GLUTEN_SAFE },
  "Soy": { words: ["soy", "tofu", "edamame", "miso", "tempeh", "tamari"] },
  "Fish": { words: FISH },
  "Shellfish": { words: SHELLFISH },
  "Sesame": { words: ["sesame", "tahini", "benne", "furikake"] },
  // Diets
  "Vegetarian": { words: [...MEAT, ...FISH, ...SHELLFISH], safe: ["vegetable broth", "veggie burger", "bean burger", "burger bun", "plant-based"] },
  "Vegan": { words: [...MEAT, ...FISH, ...SHELLFISH, ...DAIRY, ...EGGS, "honey"], safe: [...DAIRY_SAFE, ...EGG_SAFE, "vegetable broth", "veggie burger", "bean burger", "burger bun", "plant-based"] },
  "Pescatarian": { words: MEAT, safe: ["vegetable broth", "plant-based"] },
  "Halal": { words: [...PORK, ...ALCOHOL] },
  "Kosher": { words: [...PORK, ...SHELLFISH] },
  "Gluten-free": { words: GLUTEN, safe: GLUTEN_SAFE },
  "Dairy-free": { words: DAIRY, safe: DAIRY_SAFE },
};

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findWord(text, word) {
  // Whole word, allowing plurals ("eggs", "almonds", "anchovies").
  const w = word.toLowerCase();
  const forms = [`${escape(w)}(?:s|es)?`];
  if (w.endsWith("y")) forms.push(`${escape(w.slice(0, -1))}ies`);
  return new RegExp(`\\b(?:${forms.join("|")})\\b`, "i").test(text);
}

function ruleFor(name) {
  if (RULES[name]) return RULES[name];
  // Custom allergies people type in: match the word itself.
  const word = String(name).trim().toLowerCase();
  return word ? { words: [word] } : null;
}

// Every rule that applies: the person's allergies and diets, plus allergies of anyone they cook for.
export function hardRules(profile) {
  const fromOthers = (profile.othersAllergies ?? []).flatMap((p) => p.allergies ?? []);
  return [...new Set([...(profile.allergies ?? []), ...(profile.diets ?? []), ...fromOthers])];
}

// Returns the rules a recipe breaks (empty list = safe).
export function violations(recipe, rules) {
  const parts = [recipe.title, ...(recipe.ingredients ?? []).map((i) => `${i.item} ${i.amount ?? ""}`)];
  const broken = [];
  for (const name of rules) {
    const rule = ruleFor(name);
    if (!rule) continue;
    const ruleWords = [...String(name).toLowerCase().split(/[^a-z]+/), ...rule.words].filter((w) => w.length > 2);
    const related = (word) => ruleWords.some((r) => r.startsWith(word) || word.startsWith(r));
    const hit = parts.some((raw) => {
      let text = ` ${String(raw).toLowerCase()} `;
      // "Peanut-free satay" is safe for a peanut allergy, so drop it. But "egg-free pasta" still
      // contains wheat, so for unrelated rules only the "egg-free" label is dropped, not the food.
      text = text.replace(/\b([a-z]+)-free(\s+[a-z]+)?/g, (match, word, next) => (related(word) ? " " : ` ${next ?? ""}`));
      for (const safe of rule.safe ?? []) text = text.split(safe.toLowerCase()).join(" ");
      return rule.words.some((w) => findWord(text, w));
    });
    if (hit) broken.push(name);
  }
  return broken;
}

// Rules the code can't check by ingredient name; the AI is still told about them.
export const PROMPT_ONLY_RULES = ["Low sodium", "Diabetic-friendly"];
