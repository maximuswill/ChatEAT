// The built-in ChatEAT recipe library: about 100 common recipes, written in our own words.
// Recipes that list a source were checked against it; the rest follow standard methods
// with USDA safe minimum internal temperatures.
import { BREAKFAST } from "./breakfast.js";
import { CHICKEN } from "./chicken.js";
import { BEEF_PORK } from "./beef-pork.js";
import { SEAFOOD_VEG_SOUPS } from "./seafood-veg-soups.js";
import { SIDES_GRAINS } from "./sides-grains.js";
import { SNACKS_DESSERTS } from "./snacks-desserts.js";

export const CURATED = [...BREAKFAST, ...CHICKEN, ...BEEF_PORK, ...SEAFOOD_VEG_SOUPS, ...SIDES_GRAINS, ...SNACKS_DESSERTS].map((recipe) => ({
  ...recipe,
  origin: "library",
}));

export const CURATED_BY_ID = Object.fromEntries(CURATED.map((recipe) => [recipe.id, recipe]));
