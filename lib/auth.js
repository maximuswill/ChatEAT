import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { REQUIRE_SUBSCRIPTION } from "./billing";

export { hashPassword, verifyPassword } from "./password.mjs";

const SESSION_COOKIE = "chateat_session";
const SESSION_DAYS = 30;

// ---------- Sessions ----------
// The browser keeps a random token in an HTTP-only cookie.
// The database keeps only a SHA-256 hash of it, so a leaked table can't be used to log in.

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`insert into sessions (token_hash, user_id, expires_at) values (${hashToken(token)}, ${userId}, ${expires})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}

// Returns the logged-in user, or null. Cached so a page can call it many times per request.
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    select u.id, u.email, u.comp_access, u.subscription_status, u.stripe_customer_id,
           (u.comp_access or coalesce(u.subscription_status, '') in ('active', 'trialing')) as has_paid_access
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
    limit 1`;
  return rows[0] ?? null;
});

// For pages inside the app: logged in, and subscribed (or given free access) when subscriptions are required.
export async function requireMember() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (REQUIRE_SUBSCRIPTION && !user.has_paid_access) redirect("/subscribe");
  return user;
}
