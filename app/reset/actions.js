"use server";

// Password reset, owner-assisted for now (no customer emails needed):
//   1. "Forgot password?" → requestReset saves a request and emails the owner.
//   2. The owner clicks "Make reset link" on /owner and texts the link to the person.
//   3. The link opens /reset, where resetPassword sets the new password (one use, 24 hours).
// Once there are ~10 paying customers, switch to emailing the link straight to the person.
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { sql } from "../../lib/db";
import { createSession, getCurrentUser, hashPassword } from "../../lib/auth";
import { isOwner } from "../../lib/owner";
import { siteUrl } from "../../lib/billing";
import { emailOwner } from "../../lib/notify";
import { clearAttempts, clientIp, limited, LIMITS, recordAttempt, waitMessage } from "../../lib/rate-limit";

const LINK_HOURS = 24;
const hash = (token) => createHash("sha256").update(token).digest("hex");

export async function requestReset(_previous, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!email.includes("@")) return { error: "Enter the email you signed up with.", email };

  const ip = await clientIp();
  if ((await limited(LIMITS.resetEmail, email)) || (await limited(LIMITS.resetDevice, ip))) {
    return { error: waitMessage(LIMITS.resetEmail.minutes), email };
  }
  await Promise.all([recordAttempt(LIMITS.resetEmail, email), recordAttempt(LIMITS.resetDevice, ip)]);

  const [user] = await sql`select id, email from users where email = ${email}`;
  if (user) {
    // One open request per person: asking again doesn't email the owner again.
    const [open] = await sql`select id from password_reset_requests where user_id = ${user.id} and handled_at is null`;
    if (!open) {
      await sql`insert into password_reset_requests (user_id) values (${user.id})`;
      await emailOwner(
        `ChatEAT: ${user.email} needs a password reset`,
        `${user.email} asked to reset their ChatEAT password.\n\nOpen your Owner page, click "Make reset link" next to their name, and send them the link:\n${await siteUrl()}/owner\n\nThe link works once and expires after ${LINK_HOURS} hours.`,
      );
    }
  }
  // Same answer either way, so this can't be used to find out who has an account.
  return { sent: true, email };
}

// Owner only: makes a one-time reset link for a customer and marks their request handled.
export async function makeResetLink(userId) {
  const owner = await getCurrentUser();
  if (!isOwner(owner)) return { error: "Only the owner can do that." };
  const [user] = await sql`select id, email from users where id = ${Number(userId)}`;
  if (!user) return { error: "That account doesn't exist anymore." };

  const token = randomBytes(32).toString("base64url");
  await sql`update password_reset_tokens set used_at = now() where user_id = ${user.id} and used_at is null`; // older links stop working
  await sql`insert into password_reset_tokens (token_hash, user_id, expires_at) values (${hash(token)}, ${user.id}, now() + make_interval(hours => ${LINK_HOURS}))`;
  await sql`update password_reset_requests set handled_at = now() where user_id = ${user.id} and handled_at is null`;
  return { link: `${await siteUrl()}/reset?token=${token}`, email: user.email, hours: LINK_HOURS };
}

// Owner only: clears a request without making a link (e.g. they remembered their password).
export async function dismissResetRequest(requestId) {
  const owner = await getCurrentUser();
  if (!isOwner(owner)) return { error: "Only the owner can do that." };
  await sql`update password_reset_requests set handled_at = now() where id = ${Number(requestId)}`;
  return { ok: true };
}

export async function resetPassword(_previous, formData) {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8) return { error: "Use a password with at least 8 characters." };
  if (next.length > 200) return { error: "That password is too long." };
  if (next !== confirm) return { error: "The passwords don't match." };

  const [row] = await sql`
    select t.user_id, u.email from password_reset_tokens t join users u on u.id = t.user_id
    where t.token_hash = ${hash(token)} and t.used_at is null and t.expires_at > now()`;
  if (!row) return { error: "This reset link has expired or was already used. Ask for a new one." };

  await sql`update password_reset_tokens set used_at = now() where token_hash = ${hash(token)}`;
  await sql`update users set password_hash = ${await hashPassword(next)} where id = ${row.user_id}`;
  await sql`delete from sessions where user_id = ${row.user_id}`; // log out everywhere
  await clearAttempts(LIMITS.loginEmail, row.email);
  await createSession(row.user_id);
  redirect("/dashboard");
}
