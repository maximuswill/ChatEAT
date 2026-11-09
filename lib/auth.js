import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "./db";

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = "chateat_session";
const SESSION_DAYS = 30;

// ---------- Passwords ----------
// Stored as "scrypt$<salt>$<hash>". The plain password is never saved.

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hashHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length);
  return timingSafeEqual(actual, expected);
}

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
    select u.id, u.email, u.has_paid_access
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
    limit 1`;
  return rows[0] ?? null;
});
