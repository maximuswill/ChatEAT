import { sql } from "./db";
import { withDefaults } from "./onboarding-data";

// Returns { data, completed } for a user; data always has every field filled with defaults.
export async function getProfile(userId) {
  const rows = await sql`select data, completed_at from profiles where user_id = ${userId}`;
  return { data: withDefaults(rows[0]?.data), completed: Boolean(rows[0]?.completed_at), exists: rows.length > 0 };
}
