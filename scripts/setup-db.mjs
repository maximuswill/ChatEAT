// Creates the database tables (safe to run again) and makes sure the demo account exists.
// Run with: npm run db:setup
import { neon } from "@neondatabase/serverless";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}
const sql = neon(url);
const scryptAsync = promisify(scrypt);

// Must match hashPassword() in lib/auth.js
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

await sql`
  create table if not exists users (
    id bigint generated always as identity primary key,
    email text not null unique,
    password_hash text not null,
    email_verified boolean not null default false,
    has_paid_access boolean not null default false,
    created_at timestamptz not null default now()
  )`;

await sql`
  create table if not exists sessions (
    token_hash text primary key,
    user_id bigint not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`;

await sql`create index if not exists sessions_user_id_idx on sessions (user_id)`;
await sql`delete from sessions where expires_at < now()`;

// Grader demo account, required by the assignment: verified and with full paid access.
const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "password123!";
const demoHash = await hashPassword(DEMO_PASSWORD);
await sql`
  insert into users (email, password_hash, email_verified, has_paid_access)
  values (${DEMO_EMAIL}, ${demoHash}, true, true)
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        email_verified = true,
        has_paid_access = true`;

const [{ count }] = await sql`select count(*)::int as count from users`;
console.log(`Database ready. Tables: users, sessions. Demo account ready. Total accounts: ${count}.`);
