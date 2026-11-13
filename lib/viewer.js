// Who is searching for recipes, so results can favor their own recipes and mark them:
//   userId    their account id (their "Make it mine" recipes get a chef's hat and a boost)
//   saved     lowercase titles in their cookbook (marked with a heart and boosted)
//   cookbook  their cookbook recipes, added to their search pool if they aren't in the library
import { sql } from "./db";
import { normTitle } from "./library/search.js";

export async function viewerFor(user) {
  if (!user?.id) return null;
  const rows = await sql`select recipe from saved_recipes where user_id = ${user.id} order by created_at`;
  const cookbook = rows.map((row) => row.recipe).filter((r) => r?.title);
  return { userId: String(user.id), saved: new Set(cookbook.map((r) => normTitle(r.title))), cookbook };
}
