// The built-in ChatEAT recipe library: about 300 common recipes, written in our own words
// (the first 100 on 2026-11-09, 200 more in four batches on 2026-11-14 in the more-*.js files).
// Recipes that list a source were checked against it; the rest follow standard methods
// with USDA safe minimum internal temperatures.
import { BREAKFAST } from "./breakfast.js";
import { CHICKEN } from "./chicken.js";
import { BEEF_PORK } from "./beef-pork.js";
import { SEAFOOD_VEG_SOUPS } from "./seafood-veg-soups.js";
import { SIDES_GRAINS } from "./sides-grains.js";
import { SNACKS_DESSERTS } from "./snacks-desserts.js";
import { MORE_BREAKFAST_1 } from "./more-breakfast-1.js";
import { MORE_BREAKFAST_2 } from "./more-breakfast-2.js";
import { MORE_LUNCH_1 } from "./more-lunch-1.js";

// Added 2026-11-14 (shown as the creation date on the Owner page).
const EXPANSION = [...MORE_BREAKFAST_1, ...MORE_BREAKFAST_2, ...MORE_LUNCH_1].map((recipe) => ({ added: "2026-11-14", ...recipe }));

export const CURATED = [...BREAKFAST, ...CHICKEN, ...BEEF_PORK, ...SEAFOOD_VEG_SOUPS, ...SIDES_GRAINS, ...SNACKS_DESSERTS, ...EXPANSION].map((recipe) => ({
  ...recipe,
  origin: "library",
}));

// When the built-in recipes were written (while building the library with Claude). A recipe added later
// can set its own `added` date ("YYYY-MM-DD") in its file.
export const BUILT_IN_ADDED = "2026-11-09";

export const CURATED_BY_ID = Object.fromEntries(CURATED.map((recipe) => [recipe.id, recipe]));
