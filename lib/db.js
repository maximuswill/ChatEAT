import { neon } from "@neondatabase/serverless";

// Tagged-template queries: sql`select * from users where id = ${id}`
// Values are sent separately from the SQL text, so they can't inject SQL.
//
// The connection is created on first use, not when this file loads, so building the site
// doesn't need the database. A missing DATABASE_URL shows up as a clear error at runtime.
let client;
export function sql(strings, ...values) {
  if (!client) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing. Add it to .env.local (locally) or to the Vercel project's environment variables, then redeploy.");
    }
    client = neon(process.env.DATABASE_URL);
  }
  return client(strings, ...values);
}
