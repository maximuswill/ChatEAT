// Onboarding questions, answer options and the adaptive skills quiz.
// Shared by the onboarding screens (browser) and the dashboard (server). No server-only code here.

export const EMPTY_PROFILE = {
  name: "",
  lifestyle: [],
  lifeNotes: "",
  activity: "",
  appetite: 3,
  weeknightTime: "",
  weekendTime: "",
  mealPrep: "",
  meals: ["Dinner"],
  customMeals: [],
  householdSize: 1,
  leftovers: "",
  equipment: [],
  skills: {},
  skillsDone: false,
  learn: [],
  learnNotes: "",
  cuisines: {},
  favorites: [],
  topFavorites: [],
  dislikes: [],
  textures: [],
  spice: 2,
  style: 3,
  adventure: "",
  repetition: "",
  allergies: [],
  diets: [],
  healthNotes: "",
  othersAllergies: [],
  goals: [],
  goalNotes: "",
  nutritionDetail: "",
  budget: "",
  splurge: "",
};

export const LIFESTYLE = [
  "Student", "Athlete or training", "Work full-time", "Odd hours or shifts", "Parent or caregiver",
  "Busy most weeknights", "Lots of free time", "Trying to save money", "Learning to cook", "Live with roommates",
  "Trying to lose weight", "Building muscle", "Eating healthier", "Work from home", "Long commute",
  "Late dinners", "Cooking for a partner", "Living alone", "Eat out a lot", "Picky eater", "Retired",
];

export const ACTIVITY = [
  { value: "light", label: "Mostly sitting", hint: "Desk, classes, not much exercise" },
  { value: "moderate", label: "Fairly active", hint: "On my feet or working out a few times a week" },
  { value: "very", label: "Very active", hint: "Exercise most days" },
  { value: "athlete", label: "Training hard", hint: "Practices, lifting or competing" },
];

export const APPETITE_LABELS = ["Light eater", "Smaller portions", "Average", "Big appetite", "I eat like crazy"];

export const TIME_OPTIONS = [
  { value: "0", label: "No time (prep ahead)" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "An hour+" },
];

export const MEAL_PREP = [
  { value: "yes", label: "Yes, batch it" },
  { value: "sometimes", label: "Sometimes" },
  { value: "no", label: "Not for me" },
];

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks", "Pre-workout", "Post-workout", "Late-night"];

export const LEFTOVERS = [
  { value: "love", label: "Love them" },
  { value: "sometimes", label: "Now and then" },
  { value: "fresh", label: "Fresh every time" },
];

export const EQUIPMENT = [
  "Stove", "Oven", "Microwave", "Toaster", "Toaster oven", "Air fryer", "Rice cooker", "Slow cooker", "Pressure cooker",
  "Blender", "Immersion blender", "Food processor", "Mixer", "Nonstick pan", "Cast-iron pan", "Dutch oven", "Wok",
  "Griddle", "Grill pan", "Baking pans", "Sheet pans", "Muffin tin", "Waffle maker", "Kitchen scale", "Meat thermometer",
  "Meal-prep containers", "Grill", "Smoker", "Sous vide", "Pizza stone",
];

export const EQUIPMENT_PRESETS = [
  { label: "Dorm or minimal", items: ["Microwave", "Toaster", "Air fryer", "Rice cooker"] },
  { label: "Basic kitchen", items: ["Stove", "Oven", "Microwave", "Toaster", "Nonstick pan", "Sheet pans", "Baking pans"] },
  { label: "Fully loaded", items: ["Stove", "Oven", "Microwave", "Toaster", "Air fryer", "Rice cooker", "Slow cooker", "Pressure cooker", "Blender", "Immersion blender", "Food processor", "Mixer", "Nonstick pan", "Cast-iron pan", "Dutch oven", "Wok", "Griddle", "Baking pans", "Sheet pans", "Muffin tin", "Kitchen scale", "Meat thermometer", "Meal-prep containers", "Grill"] },
];

// ---------- Adaptive skills quiz ----------
// Asks about specific dishes instead of a self-rated skill level.
// Each tier only appears once the person shows they're comfortable with the tier before it.

export const SKILL_LEVELS = [
  { value: 0, label: "Never tried it", reply: "Perfect: that's something new we can teach you." },
  { value: 1, label: "I'd need a recipe", reply: "Got it. We'll give you clear, step-by-step help." },
  { value: 2, label: "I can make it", reply: "Nice. That one's in your toolkit." },
  { value: 3, label: "Could make it in my sleep", reply: "Love that. We'll aim a little higher." },
];

// Each category has three levels. Level 2 only appears if the person can make most of level 1,
// and level 3 only if they can make most of level 2. A beginner answers about 14 questions;
// an experienced cook up to about 50 (they can stop early with "That's enough for now").
// "needs": the category only appears if the person has at least one of these tools.
const SKILL_TRACKS = [
  {
    id: "eggs", label: "Eggs and breakfast",
    levels: [
      [["eggs", "Scrambled eggs"], ["pancakes", "Pancakes"]],
      [["omelet", "A folded omelet"], ["overeasy", "Over-easy eggs"]],
      [["poached", "Poached eggs"], ["benedict", "Eggs Benedict with hollandaise"]],
    ],
  },
  {
    id: "grains", label: "Rice, grains and pasta",
    levels: [
      [["rice", "A pot of rice"], ["pasta", "Pasta with jarred sauce"]],
      [["friedrice", "Fried rice"], ["macandcheese", "Mac and cheese from scratch"]],
      [["risotto", "Risotto"], ["freshpasta", "Fresh pasta"]],
    ],
  },
  {
    id: "meat", label: "Meat and poultry",
    levels: [
      [["burgers", "Burgers in a pan"], ["bakedchicken", "Baked chicken breasts"]],
      [["steak", "A pan-seared steak"], ["chicken", "Roast chicken"], ["porkchops", "Pork chops"]],
      [["braise", "Braised short ribs"], ["wholebird", "Carving a whole turkey"], ["pansauce", "A pan sauce from the drippings"]],
    ],
  },
  {
    id: "seafood", label: "Seafood",
    levels: [
      [["salmon", "Baked salmon"], ["shrimp", "Sautéed shrimp"]],
      [["seared", "A pan-seared fish fillet"], ["fishtacos", "Fish tacos"]],
      [["scallops", "Seared scallops"], ["wholefish", "A whole roasted fish"]],
    ],
  },
  {
    id: "veg", label: "Vegetables and sides",
    levels: [
      [["roastveg", "Roasted vegetables"], ["mashed", "Mashed potatoes"]],
      [["stirfry", "A stir-fry"], ["salad", "A salad with homemade dressing"]],
      [["curry", "Vegetable curry from scratch"], ["gratin", "Potato gratin"]],
    ],
  },
  {
    id: "soups", label: "Soups and sauces",
    levels: [
      [["chili", "Chili"], ["cannedsoup", "Soup from a can, doctored up"]],
      [["sauce", "Tomato sauce from scratch"], ["chickensoup", "Chicken noodle soup from scratch"]],
      [["stock", "Homemade stock"], ["gravy", "Gravy or a roux-based sauce"]],
    ],
  },
  {
    id: "grill", label: "Grilling and smoking", needs: ["Grill", "Smoker", "Grill pan"],
    levels: [
      [["grillburgers", "Burgers or hot dogs on the grill"]],
      [["grillchicken", "Grilled chicken thighs"], ["grillveg", "Grilled vegetables"]],
      [["ribs", "Smoked or grilled ribs"], ["brisket", "A smoked brisket"]],
    ],
  },
  {
    id: "baking", label: "Baking and desserts",
    levels: [
      [["brownies", "Brownies from a box"], ["cookies", "Cookies from scratch"]],
      [["muffins", "Muffins or banana bread"], ["crisp", "A fruit crisp or cobbler"]],
      [["bread", "A yeast bread"], ["pie", "Pie crust"], ["cake", "A layer cake"], ["tiramisu", "Tiramisu"]],
    ],
  },
];

export const DISH_NAMES = Object.fromEntries(SKILL_TRACKS.flatMap((t) => t.levels.flat()));
export const DISH_CATEGORY = Object.fromEntries(SKILL_TRACKS.flatMap((t) => t.levels.flat().map(([key]) => [key, t.label])));
const DISH_LEVEL = Object.fromEntries(SKILL_TRACKS.flatMap((t) => t.levels.flatMap((dishes, i) => dishes.map(([key]) => [key, i + 1]))));

const keys = (dishes) => dishes.map(([key]) => key);
const answered = (skills, list) => list.every((k) => k in skills);
// "Strong" = most dishes in the level can be made without help (skipped dishes don't count).
const strong = (skills, list) => list.filter((k) => skills[k] >= 2).length >= Math.max(1, Math.ceil(list.length / 2));

// Dishes to ask about given the answers so far, in order: one category at a time.
export function skillQueue(skills, equipment = []) {
  const queue = [];
  for (const track of SKILL_TRACKS) {
    if (track.needs && !track.needs.some((tool) => equipment.includes(tool))) continue;
    for (const level of track.levels) {
      const list = keys(level);
      queue.push(...list);
      if (!(answered(skills, list) && strong(skills, list))) break;
    }
  }
  return queue;
}

export function nextDish(skills, equipment = []) {
  return skillQueue(skills, equipment).find((k) => !(k in skills)) ?? null;
}

export function skillTier(skills) {
  const answeredAny = Object.values(skills).some((v) => v >= 0);
  if (!answeredAny) return "Not assessed yet";
  const made = Object.entries(skills).filter(([, v]) => v >= 2).map(([k]) => DISH_LEVEL[k] ?? 1);
  if (made.filter((l) => l === 3).length >= 2) return "Confident cook";
  if (made.filter((l) => l >= 2).length >= 2) return "Home cook";
  if (made.length >= 2) return "Getting started";
  return "Brand new: ready to learn";
}

export const LEARN = ["Cooking a great steak", "Knife skills", "Stir-fries", "Meal prep basics", "Grilling", "Baking bread", "Sauces", "Desserts", "Breakfasts", "Cooking for a crowd"];

// ---------- Taste ----------
export const CUISINES = [
  "Mexican", "Italian", "Chinese", "Japanese", "Korean", "Thai", "Vietnamese", "Indian",
  "Mediterranean", "Middle Eastern", "Greek", "American BBQ", "Southern", "Cajun", "Caribbean", "French",
];

export const FAVORITE_SUGGESTIONS = [
  "Tacos", "Chicken parm", "Burrito bowls", "Fried rice", "Burgers", "Pasta bake", "Wings", "Breakfast sandwiches", "Chili", "Teriyaki chicken",
  "Steak and potatoes", "Pizza", "Mac and cheese", "Lasagna", "Ramen", "Grilled chicken", "Shrimp scampi", "Stir-fry", "Pancakes",
  "Chocolate chip cookies", "Cheesecake",
];

export const DISLIKES = ["Mushrooms", "Onions", "Cilantro", "Olives", "Tomatoes", "Seafood", "Fish", "Eggplant", "Beans", "Coconut", "Blue cheese", "Peppers", "Pork", "Red meat"];

export const TEXTURES = ["Mushy", "Slimy", "Chewy", "Very crunchy", "Creamy"];

export const SPICE_LABELS = ["No heat at all", "Mild", "Medium", "Hot", "Bring it on"];
export const STYLE_LABELS = ["Classic recipes", "Mostly classic", "A bit of both", "Mostly creative", "Surprise me with twists"];

export const ADVENTURE = [
  { value: "safe", label: "Stick to what I know" },
  { value: "mix", label: "Mix it up sometimes" },
  { value: "adventurous", label: "Bring on new things" },
];

export const REPETITION = [
  { value: "fine", label: "Same meal twice? Fine" },
  { value: "some", label: "Some repeats are okay" },
  { value: "variety", label: "Keep it different" },
];

// ---------- Safety: hard rules the AI must never break ----------
export const ALLERGENS = ["Peanuts", "Tree nuts", "Milk or dairy", "Eggs", "Wheat or gluten", "Soy", "Fish", "Shellfish", "Sesame"];
export const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Low sodium", "Diabetic-friendly"];

// ---------- Goals and budget ----------
export const GOALS = ["Fuel my training", "Build muscle", "Lose weight", "Eat healthier", "More energy", "Save money", "Learn to cook", "Waste less food", "Make dinner easier"];

export const NUTRITION_DETAIL = [
  { value: "simple", label: "Keep it simple", hint: "Rough estimates, no counting" },
  { value: "macros", label: "Show me the numbers", hint: "Calories and protein per meal" },
];

export const BUDGET = [
  { value: "tight", label: "Under $50", hint: "per week" },
  { value: "moderate", label: "$50 to $100", hint: "per week" },
  { value: "comfortable", label: "$100 to $150", hint: "per week" },
  { value: "flexible", label: "$150+", hint: "per week" },
  { value: "unsure", label: "Not sure", hint: "We'll learn as we go" },
];

export const SPLURGE = [
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Now and then" },
  { value: "often", label: "Often" },
];

// ---------- Summary used by the live profile card and the dashboard ----------
const labelOf = (list, value) => list.find((o) => o.value === value)?.label;

export function summarize(p) {
  const rows = [];
  const add = (key, label, value, tone) => { if (value && (!Array.isArray(value) || value.length)) rows.push({ key, label, value: Array.isArray(value) ? value.join(", ") : value, tone }); };

  add("life", "Life", [...p.lifestyle]);
  add("activity", "Activity", labelOf(ACTIVITY, p.activity));
  if (p.activity || p.lifestyle.length) add("appetite", "Appetite", APPETITE_LABELS[p.appetite - 1]);
  const timeText = (value, when) => (value === "0" ? `no time ${when} (prep ahead)` : `${labelOf(TIME_OPTIONS, value)} ${when}`);
  const time = [p.weeknightTime && timeText(p.weeknightTime, "weeknights"), p.weekendTime && timeText(p.weekendTime, "weekends")].filter(Boolean);
  add("time", "Cooking time", time);
  add("meals", "Plans", [...p.meals, ...p.customMeals]);
  if (p.leftovers) add("household", "Cooking for", `${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}, leftovers: ${labelOf(LEFTOVERS, p.leftovers).toLowerCase()}`);
  add("equipment", "Kitchen", p.equipment.length ? `${p.equipment.length} tools` : "");
  if (Object.keys(p.skills).length) add("skill", "Skill", skillTier(p.skills));
  add("learn", "Wants to learn", p.learn);
  add("top", "All-time favorites", p.topFavorites);
  add("loves", "Loves", [...Object.entries(p.cuisines).filter(([, v]) => v === "love").map(([k]) => k), ...p.favorites]);
  add("avoids", "Skips", [...Object.entries(p.cuisines).filter(([, v]) => v === "no").map(([k]) => k), ...p.dislikes]);
  if (p.adventure || p.repetition) add("spice", "Spice", SPICE_LABELS[p.spice]);
  const hardRules = [...p.allergies, ...p.diets, ...p.othersAllergies.flatMap((o) => o.allergies.map((a) => `${a} (${o.name || "someone I cook for"})`))];
  add("safety", "Never use", hardRules, "danger");
  add("goals", "Goals", p.goals);
  add("budget", "Budget", labelOf(BUDGET, p.budget) && `${labelOf(BUDGET, p.budget)}${p.budget !== "unsure" ? " a week" : ""}`);
  return rows;
}

// Merge stored answers over the defaults so new questions get sensible starting values.
export function withDefaults(stored) {
  const merged = { ...EMPTY_PROFILE, ...(stored && typeof stored === "object" ? stored : {}) };
  for (const key of Object.keys(EMPTY_PROFILE)) {
    const fallback = EMPTY_PROFILE[key];
    if (Array.isArray(fallback) && !Array.isArray(merged[key])) merged[key] = [...fallback];
    else if (typeof fallback === "object" && !Array.isArray(fallback) && (typeof merged[key] !== "object" || Array.isArray(merged[key]) || merged[key] === null)) merged[key] = { ...fallback };
    else if (typeof fallback !== "object" && typeof merged[key] !== typeof fallback) merged[key] = fallback;
  }
  return merged;
}
