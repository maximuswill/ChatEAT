import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to .env.local (locally) or to the Vercel project's environment variables.");
}

// Tagged-template queries: sql`select * from users where id = ${id}`
// Values are sent separately from the SQL text, so they can't inject SQL.
export const sql = neon(process.env.DATABASE_URL);
