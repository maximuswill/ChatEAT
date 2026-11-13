// Creates the database tables (safe to run again) and makes sure the demo account exists.
// Run with: npm run db:setup
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../lib/password.mjs";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}
const sql = neon(url);

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

// One kitchen profile per user. Answers are stored as JSON so questions can change without new columns.
await sql`
  create table if not exists profiles (
    user_id bigint primary key references users(id) on delete cascade,
    data jsonb not null default '{}'::jsonb,
    completed_at timestamptz,
    updated_at timestamptz not null default now()
  )`;
await sql`delete from sessions where expires_at < now()`;

// Recipes people save to their cookbook.
await sql`
  create table if not exists saved_recipes (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    title text not null,
    recipe jsonb not null,
    created_at timestamptz not null default now(),
    unique (user_id, title)
  )`;

// One row per recipe request, used for a daily limit that keeps AI costs in check.
await sql`
  create table if not exists recipe_requests (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    request text not null,
    mode text not null,
    created_at timestamptz not null default now()
  )`;
await sql`create index if not exists recipe_requests_user_time_idx on recipe_requests (user_id, created_at)`;

// Recipes the AI has written, saved so the next person who asks for something similar
// gets it from the library instead of a new AI request. (The ~100 built-in recipes live in lib/library.)
await sql`
  create table if not exists library_recipes (
    id text primary key,
    title text not null,
    recipe jsonb not null,
    origin text not null default 'ai',
    created_at timestamptz not null default now()
  )`;
await sql`create unique index if not exists library_recipes_title_idx on library_recipes (lower(title))`;

// One row per AI call with its token counts and estimated cost, used for the monthly spending cap.
await sql`
  create table if not exists ai_usage (
    id bigint generated always as identity primary key,
    model text not null,
    input_tokens integer not null,
    output_tokens integer not null,
    cost_usd numeric(10, 6) not null,
    created_at timestamptz not null default now()
  )`;
await sql`create index if not exists ai_usage_created_idx on ai_usage (created_at)`;

// "My pantry": staples from the tap quiz (kept until removed) and fresh items (removed automatically).
await sql`
  create table if not exists pantry_staples (
    user_id bigint primary key references users(id) on delete cascade,
    items jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
  )`;
await sql`
  create table if not exists pantry_items (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    name text not null,
    added_at timestamptz not null default now(),
    remove_at timestamptz not null
  )`;
await sql`create index if not exists pantry_items_user_idx on pantry_items (user_id, remove_at)`;
await sql`delete from pantry_items where remove_at < now()`;

// "Plan my week": each person's current weekly plan (calendar slots, options pool and chosen meals) as JSON.
await sql`
  create table if not exists meal_plans (
    user_id bigint primary key references users(id) on delete cascade,
    week_start date not null,
    plan jsonb not null,
    updated_at timestamptz not null default now()
  )`;

// Billing. Paid access = complimentary access (staff, demo and test accounts) OR an active Stripe subscription.
await sql`alter table users add column if not exists comp_access boolean not null default false`;
await sql`alter table users add column if not exists stripe_customer_id text`;
await sql`alter table users add column if not exists stripe_subscription_id text`;
await sql`alter table users add column if not exists subscription_status text`;
// Which friends & family code gave someone free access: 'family_full', 'family_limited' or null (see lib/access-codes.js).
await sql`alter table users add column if not exists access_tier text`;
// When a canceled subscription stops (set while it's still running until the end of the paid period).
await sql`alter table users add column if not exists subscription_cancel_at timestamptz`;

// Failed logins, wrong codes and reset requests, used to slow down guessing (see lib/rate-limit.js).
await sql`
  create table if not exists auth_attempts (
    id bigint generated always as identity primary key,
    kind text not null,
    key text not null,
    created_at timestamptz not null default now()
  )`;
await sql`create index if not exists auth_attempts_lookup_idx on auth_attempts (kind, key, created_at)`;
await sql`delete from auth_attempts where created_at < now() - interval '1 day'`;

// "Forgot password?" requests waiting for the owner, and the one-time reset links the owner makes.
await sql`
  create table if not exists password_reset_requests (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    handled_at timestamptz
  )`;
await sql`
  create table if not exists password_reset_tokens (
    token_hash text primary key,
    user_id bigint not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
  )`;
await sql`delete from password_reset_tokens where expires_at < now() - interval '7 days'`;

// Accounts given full access before billing existed keep it for free.
await sql`update users set comp_access = true where has_paid_access = true and comp_access = false`;

// Grader demo account, required by the assignment: verified and with full paid access.
const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "password123!";
const demoHash = await hashPassword(DEMO_PASSWORD);
await sql`
  insert into users (email, password_hash, email_verified, has_paid_access, comp_access)
  values (${DEMO_EMAIL}, ${demoHash}, true, true, true)
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        email_verified = true,
        has_paid_access = true,
        comp_access = true`;

const [{ count }] = await sql`select count(*)::int as count from users`;
console.log(`Database ready. Tables: users, sessions, profiles, saved_recipes, recipe_requests, library_recipes, ai_usage, pantry_staples, pantry_items, meal_plans, auth_attempts, password_reset_requests, password_reset_tokens. Demo account ready. Total accounts: ${count}.`);
