// Creates (or resets) an account with full paid access and a newly generated password.
// The password is written to local-accounts.txt (kept off GitHub), not printed.
// Usage: npm run account:create -- <email> [personal|test]
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { hashPassword } from "../lib/password.mjs";

const email = String(process.argv[2] ?? "").trim().toLowerCase();
const kind = process.argv[3] === "personal" ? "personal" : "test";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Give an email address: npm run account:create -- someone@example.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}

// Readable passwords: a word plus random characters.
const words = { personal: "ChatEAT-temp", test: "ChatEAT-test" };
const password = `${words[kind]}-${randomBytes(4).toString("hex")}`;

const sql = neon(process.env.DATABASE_URL);
const passwordHash = await hashPassword(password);
const rows = await sql`
  insert into users (email, password_hash, email_verified, has_paid_access, comp_access)
  values (${email}, ${passwordHash}, true, true, true)
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        email_verified = true,
        has_paid_access = true,
        comp_access = true
  returning (xmax = 0) as created`;

const note = kind === "personal" ? "Your personal account. Temporary password: change it once that option exists." : "Test account for trying features.";
appendFileSync(
  new URL("../local-accounts.txt", import.meta.url),
  `${email}\n  Password: ${password}\n  ${note}\n  ${rows[0].created ? "Created" : "Password reset"} ${new Date().toISOString().slice(0, 10)}\n\n`,
);
console.log(`${rows[0].created ? "Created" : "Reset"} ${email} with full access. Password saved to local-accounts.txt.`);
