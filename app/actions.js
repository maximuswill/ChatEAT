"use server";

import { redirect } from "next/navigation";
import { sql } from "../lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "../lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function readForm(formData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUp(_previous, formData) {
  const { email, password } = readForm(formData);

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "Enter a valid email address.", email };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password with at least ${MIN_PASSWORD} characters.`, email };
  }
  if (password.length > 200) {
    return { error: "That password is too long.", email };
  }

  const passwordHash = await hashPassword(password);
  const created = await sql`
    insert into users (email, password_hash)
    values (${email}, ${passwordHash})
    on conflict (email) do nothing
    returning id`;

  if (created.length === 0) {
    return { error: "An account with that email already exists. Try logging in.", email };
  }

  await createSession(created[0].id);
  redirect("/dashboard");
}

export async function logIn(_previous, formData) {
  const { email, password } = readForm(formData);
  const failed = { error: "That email and password don't match an account.", email };

  if (!email || !password || password.length > 200) return failed;

  const rows = await sql`select id, password_hash from users where email = ${email} limit 1`;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) return failed;

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logOut() {
  await destroySession();
  redirect("/");
}
