// "My pantry": a rough list of what someone has on hand.
// Staples (from the tap quiz) stay until the person removes them; they either last for months
// or are things people restock on their own (eggs, milk). Fresh items are removed automatically
// after their typical refrigerated life plus 20%. ChatEAT doesn't track or show expiration dates.

export const STAPLE_CATEGORIES = [
  {
    id: "fridge", title: "Fridge basics you keep stocked",
    sub: "Things you restock on your own. These stay in your pantry until you remove them.",
    items: ["Eggs", "Milk", "Butter", "Shredded cheese", "Block cheese", "Parmesan", "Greek yogurt", "Sour cream", "Heavy cream", "Cream cheese", "Plant-based milk", "Tortillas"],
  },
  {
    id: "sauces", title: "Oils, vinegars and sauces",
    items: [
      "Olive oil", "Vegetable oil", "Cooking spray", "Sesame oil", "Soy sauce", "Hot sauce", "Sriracha", "Buffalo sauce",
      "Worcestershire sauce", "BBQ sauce", "Ketchup", "Mustard", "Dijon mustard", "Honey mustard", "Mayonnaise", "Ranch",
      "Italian dressing", "Caesar dressing", "Salsa", "Teriyaki sauce", "Sweet chili sauce", "Hoisin sauce", "Gochujang",
      "Chili crisp", "Honey", "Maple syrup", "White vinegar", "Apple cider vinegar", "Balsamic vinegar", "Rice vinegar",
    ],
  },
  {
    id: "spices", title: "Spices and seasonings",
    items: ["Salt", "Black pepper", "Garlic powder", "Onion powder", "Paprika", "Smoked paprika", "Chili powder", "Cumin", "Italian seasoning", "Oregano", "Thyme", "Red pepper flakes", "Cinnamon", "Taco seasoning", "Curry powder", "Cajun seasoning", "Ground ginger", "Bay leaves"],
  },
  {
    id: "baking", title: "Baking",
    items: ["All-purpose flour", "Sugar", "Brown sugar", "Powdered sugar", "Baking soda", "Baking powder", "Vanilla extract", "Cocoa powder", "Chocolate chips", "Cornstarch", "Yeast", "Oats"],
  },
  {
    id: "grains", title: "Rice, pasta and grains",
    items: ["White rice", "Brown rice", "Spaghetti", "Penne", "Elbow macaroni", "Egg noodles", "Ramen noodles", "Rice noodles", "Lasagna noodles", "Quinoa", "Couscous", "Breadcrumbs", "Panko"],
  },
  {
    id: "cans", title: "Cans and jars",
    items: ["Black beans", "Kidney beans", "Chickpeas", "Diced tomatoes", "Crushed tomatoes", "Tomato paste", "Tomato sauce", "Marinara sauce", "Chicken broth", "Beef broth", "Vegetable broth", "Coconut milk", "Canned tuna", "Canned corn", "Peanut butter", "Jelly"],
  },
  {
    id: "produce", title: "Long-lasting produce",
    sub: "The kind that keeps for weeks.",
    items: ["Onions", "Garlic", "Potatoes", "Sweet potatoes", "Carrots", "Lemons", "Limes", "Fresh ginger", "Apples"],
  },
  {
    id: "freezer", title: "Freezer",
    items: ["Frozen mixed vegetables", "Frozen broccoli", "Frozen peas", "Frozen corn", "Frozen berries", "Frozen chicken", "Frozen ground beef", "Frozen shrimp", "Frozen fish", "Frozen fries", "Frozen waffles"],
  },
];

// Quick presets so the quiz can be finished in seconds.
export const COMMON_PICKS = {
  fridge: ["Eggs", "Milk", "Butter", "Shredded cheese"],
  sauces: ["Olive oil", "Vegetable oil", "Soy sauce", "Hot sauce", "Ketchup", "Mustard", "Mayonnaise", "Ranch"],
  spices: ["Salt", "Black pepper", "Garlic powder", "Onion powder", "Paprika", "Chili powder", "Italian seasoning"],
  baking: ["All-purpose flour", "Sugar", "Brown sugar", "Baking soda", "Baking powder", "Vanilla extract"],
  grains: ["White rice", "Spaghetti", "Penne"],
  cans: ["Black beans", "Diced tomatoes", "Tomato paste", "Chicken broth", "Peanut butter"],
  produce: ["Onions", "Garlic", "Potatoes"],
  freezer: ["Frozen mixed vegetables", "Frozen chicken"],
};

// Fresh items and their typical refrigerated life in days (raw, or opened where that's how
// they're usually kept), based on common food-storage guidance. Unknown items use DEFAULT_DAYS.
export const FRESH_ITEMS = {
  "Chicken breast": 2, "Chicken thighs": 2, "Whole chicken": 2, "Ground beef": 2, "Ground turkey": 2,
  "Ground pork": 2, "Steak": 4, "Pork chops": 4, "Pork tenderloin": 4, "Roast or chuck": 4, "Bacon": 7,
  "Fresh sausage": 2, "Deli meat": 5, "Hot dogs": 7, "Rotisserie chicken": 4, "Salmon": 2, "Fish fillets": 2,
  "Shrimp": 2, "Tofu": 5, "Lettuce": 7, "Spinach": 5, "Kale": 5, "Broccoli": 5, "Cauliflower": 5,
  "Bell peppers": 10, "Mushrooms": 7, "Zucchini": 5, "Cucumber": 7, "Tomatoes": 7, "Avocados": 4,
  "Green beans": 5, "Asparagus": 4, "Corn on the cob": 3, "Bananas": 5, "Berries": 5, "Grapes": 7,
  "Fresh herbs": 7, "Green onions": 7, "Celery": 14, "Bread": 7, "Bagels": 7, "Hamburger buns": 7,
  "Fresh pasta": 3, "Hummus": 7, "Cottage cheese": 7, "Fresh mozzarella": 5, "Ricotta": 5,
  "Cooked rice": 4, "Leftovers": 4, "Pizza dough": 3,
};
export const DEFAULT_DAYS = 7;
export const EXTRA = 1.2; // keep items 20% past their typical life before removing them

export const FRESH_SUGGESTIONS = ["Chicken breast", "Ground beef", "Bacon", "Steak", "Salmon", "Shrimp", "Deli meat", "Spinach", "Broccoli", "Bell peppers", "Avocados", "Berries", "Bread", "Leftovers"];

const ALIASES = {
  "chicken": "Chicken breast", "chicken breasts": "Chicken breast", "chicken thigh": "Chicken thighs",
  "beef": "Ground beef", "hamburger": "Ground beef", "turkey": "Ground turkey", "sausage": "Fresh sausage",
  "sausages": "Fresh sausage", "steaks": "Steak", "pork chop": "Pork chops", "fish": "Fish fillets",
  "cod": "Fish fillets", "tilapia": "Fish fillets", "lunch meat": "Deli meat", "ham": "Deli meat",
  "salad": "Lettuce", "romaine": "Lettuce", "peppers": "Bell peppers", "pepper": "Bell peppers",
  "mushroom": "Mushrooms", "tomato": "Tomatoes", "avocado": "Avocados", "banana": "Bananas",
  "strawberries": "Berries", "blueberries": "Berries", "raspberries": "Berries", "herbs": "Fresh herbs",
  "cilantro": "Fresh herbs", "parsley": "Fresh herbs", "basil": "Fresh herbs", "scallions": "Green onions",
  "buns": "Hamburger buns", "leftover": "Leftovers", "rice": "Cooked rice", "mozzarella": "Fresh mozzarella",
};

const norm = (text) => String(text).toLowerCase().trim().replace(/\s+/g, " ");

// Match what someone typed to a known fresh item, so it gets the right shelf life and a tidy name.
export function lookupFresh(typed) {
  const t = norm(typed);
  if (!t) return null;
  const exact = Object.keys(FRESH_ITEMS).find((name) => norm(name) === t);
  if (exact) return { name: exact, days: FRESH_ITEMS[exact] };
  const alias = ALIASES[t] ?? ALIASES[t.replace(/s$/, "")];
  if (alias) return { name: alias, days: FRESH_ITEMS[alias] };
  const singular = t.replace(/(es|s)$/, "");
  const close = Object.keys(FRESH_ITEMS).find((name) => norm(name).replace(/(es|s)$/, "") === singular);
  if (close) return { name: close, days: FRESH_ITEMS[close] };
  const cleaned = String(typed).trim().slice(0, 40);
  return { name: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), days: DEFAULT_DAYS };
}

export const keepDays = (days) => Math.ceil(days * EXTRA * 10) / 10;
