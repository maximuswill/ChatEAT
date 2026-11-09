import { sql } from "./db.js";

// The person's pantry. Fresh items past their keep-until time are cleared out as they're read.
export async function getPantry(userId) {
  await sql`delete from pantry_items where user_id = ${userId} and remove_at < now()`;
  const [staples] = await sql`select items, updated_at from pantry_staples where user_id = ${userId}`;
  const fresh = await sql`select id, name, added_at from pantry_items where user_id = ${userId} order by added_at desc`;
  return {
    staples: Array.isArray(staples?.items) ? staples.items : [],
    hasTakenQuiz: Boolean(staples),
    fresh: fresh.map((row) => ({ id: Number(row.id), name: row.name, addedAt: new Date(row.added_at).toISOString() })),
  };
}

// Just the names, for recipe suggestions.
export async function pantryNames(userId) {
  const { staples, fresh } = await getPantry(userId);
  return [...new Set([...staples, ...fresh.map((f) => f.name)])];
}
