// Slows down guessing: failed logins, wrong friends & family codes and password-reset requests.
// Each attempt is a row in auth_attempts; a limit is "no more than N in the last M minutes".
import { headers } from "next/headers";
import { sql } from "./db";

export const LIMITS = {
  loginEmail: { kind: "login_email", max: 5, minutes: 15 },   // wrong passwords for one email
  loginDevice: { kind: "login_ip", max: 30, minutes: 15 },    // failed logins from one device/network
  code: { kind: "code_ip", max: 5, minutes: 60 },             // wrong friends & family codes
  resetEmail: { kind: "reset_email", max: 3, minutes: 60 },   // "Forgot password?" for one email
  resetDevice: { kind: "reset_ip", max: 10, minutes: 60 },
};

// The visitor's network address, as reported by Vercel (or "local" on your computer).
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

// True when this key has hit the limit.
export async function limited({ kind, max, minutes }, key) {
  const [{ count }] = await sql`
    select count(*)::int as count from auth_attempts
    where kind = ${kind} and key = ${String(key)} and created_at > now() - make_interval(mins => ${minutes})`;
  return count >= max;
}

export async function recordAttempt({ kind }, key) {
  await sql`insert into auth_attempts (kind, key) values (${kind}, ${String(key)})`;
  // Old rows are useless; tidy up now and then.
  if (Math.random() < 0.05) await sql`delete from auth_attempts where created_at < now() - interval '1 day'`;
}

export async function clearAttempts({ kind }, key) {
  await sql`delete from auth_attempts where kind = ${kind} and key = ${String(key)}`;
}

export const waitMessage = (minutes) => `Too many tries. Please wait ${minutes >= 60 ? "an hour" : `${minutes} minutes`} and try again.`;
