import { createHash } from "node:crypto";
import Link from "next/link";
import Brand from "../Brand";
import ResetForm from "./ResetForm";
import { sql } from "../../lib/db";

export const metadata = { title: "Set a new password · ChatEAT" };

// Opened from a one-time link the owner sends: /reset?token=...
export default async function ResetPage({ searchParams }) {
  const token = String((await searchParams)?.token ?? "").slice(0, 200);
  const [row] = token
    ? await sql`
        select u.email from password_reset_tokens t join users u on u.id = t.user_id
        where t.token_hash = ${createHash("sha256").update(token).digest("hex")} and t.used_at is null and t.expires_at > now()`
    : [];

  return (
    <main className="auth-page">
      <Brand />
      {row ? (
        <ResetForm token={token} email={row.email} />
      ) : (
        <div className="auth-card">
          <h1>This link doesn&apos;t work</h1>
          <p className="auth-sub">Reset links work once and expire after 24 hours. Ask for a new one and Maximus will send it.</p>
          <Link className="button primary" href="/forgot">Ask for a new link</Link>
        </div>
      )}
    </main>
  );
}
